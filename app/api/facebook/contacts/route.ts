import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

// Increase timeout and allow large responses
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !(session as any).accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id; // Facebook user ID (string)
    const accessToken = (session as any).accessToken;
    const pageId = request.nextUrl.searchParams.get("pageId");
    const fromDatabase = request.nextUrl.searchParams.get("fromDatabase") !== "false"; // Default to true
    
    console.log(`[Contacts API] Fetching contacts for user: ${userId}, pageId: ${pageId || 'all'}, fromDatabase: ${fromDatabase}`);

    // Try to load from database first if requested
    if (fromDatabase && !pageId) {
      try {
        // First, get the total count
        const { count: totalCount, error: countError } = await supabaseServer
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        if (countError) {
          console.error("Error getting contact count:", countError);
        } else {
          console.log(`[Contacts API] Total contacts in database: ${totalCount || 0}`);
        }

        // Fetch ALL contacts using pagination (Supabase default limit is 1000)
        let allDbContacts: any[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;
        let iteration = 0;
        const maxIterations = 100; // Safety limit to prevent infinite loops

        while (hasMore && iteration < maxIterations) {
          iteration++;
          console.log(`[Contacts API] Fetching contacts batch ${iteration}: from ${from} to ${from + pageSize - 1}`);
          
          const { data: dbContacts, error: dbError } = await supabaseServer
            .from("contacts")
            .select("*")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .range(from, from + pageSize - 1);

          if (dbError) {
            console.error(`[Contacts API] Error loading contacts batch ${iteration}:`, dbError);
            break;
          }

          if (dbContacts && dbContacts.length > 0) {
            allDbContacts.push(...dbContacts);
            console.log(`[Contacts API] Loaded ${dbContacts.length} contacts in batch ${iteration}. Total so far: ${allDbContacts.length}`);
            from += pageSize;
            // Continue if we got exactly pageSize (there might be more)
            // Also continue if we haven't reached the expected count yet
            hasMore = dbContacts.length === pageSize;
            if (totalCount && allDbContacts.length < totalCount) {
              hasMore = true; // Force continue if we haven't reached expected count
              console.log(`[Contacts API] Still need ${totalCount - allDbContacts.length} more contacts. Continuing...`);
            }
          } else {
            console.log(`[Contacts API] No more contacts found. Stopping at iteration ${iteration}`);
            hasMore = false;
          }
        }

        if (iteration >= maxIterations) {
          console.warn(`[Contacts API] Reached max iterations (${maxIterations}). Stopping pagination.`);
        }

        if (allDbContacts.length > 0) {
          // Transform database format to frontend format
          const transformedContacts = allDbContacts.map((c: any) => ({
            id: c.contact_id,
            name: c.contact_name,
            page: c.page_name,
            pageId: c.page_id,
            lastMessage: c.last_message || "",
            lastMessageTime: c.last_message_time,
            lastContactMessageDate: c.last_contact_message_date,
            updatedTime: c.updated_at,
            tags: c.tags || [],
            role: c.role || "",
            avatar: c.avatar || (c.contact_name || c.contact_id || "U").substring(0, 2).toUpperCase(),
            date: c.date || (c.updated_at ? new Date(c.updated_at).toISOString().split('T')[0] : null)
          }));

          console.log(`[Contacts API] Successfully loaded ${transformedContacts.length} contacts from database${totalCount ? ` (expected: ${totalCount})` : ''}`);
          
          if (totalCount && transformedContacts.length < totalCount) {
            console.warn(`[Contacts API] WARNING: Loaded ${transformedContacts.length} contacts but database has ${totalCount}. Some contacts may be missing.`);
          }

          return NextResponse.json({ 
            contacts: transformedContacts,
            fromDatabase: true,
            totalCount: transformedContacts.length,
            expectedCount: totalCount || null
          });
        }
      } catch (dbError: any) {
        console.error("[Contacts API] Error loading from database:", dbError);
        console.log("Falling back to API fetch");
      }
    }

    if (!pageId) {
      // Fetch pages from database (supports shared access across users)
      const { data: userPages, error: dbError } = await supabaseServer
        .from("user_pages")
        .select(`
          page_id,
          facebook_pages!inner (
            page_id,
            page_name,
            page_access_token
          )
        `)
        .eq("user_id", userId);

      let pages: any[] = [];

      if (dbError || !userPages || userPages.length === 0) {
        console.error("Error fetching pages from database or no pages found:", dbError);
        // Fallback to direct API call
        const pagesResponse = await fetch(
          `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}&fields=id,name,access_token&limit=1000`
        );

        if (!pagesResponse.ok) {
          const errorData = await pagesResponse.json();
          console.error("Error fetching pages from Facebook API:", errorData);
          return NextResponse.json(
            { error: "Failed to fetch pages", details: errorData },
            { status: pagesResponse.status }
          );
        }

        const pagesData = await pagesResponse.json();
        pages = pagesData.data || [];
        console.log(`Fetched ${pages.length} pages from Facebook API (fallback)`);
      } else {
        // Use pages from database
        pages = (userPages || [])
          .filter((up: any) => up.facebook_pages) // Filter out any null facebook_pages
          .map((up: any) => ({
            id: up.facebook_pages.page_id,
            name: up.facebook_pages.page_name,
            access_token: up.facebook_pages.page_access_token,
          }));
        console.log(`Fetched ${pages.length} pages from database`);
      }
      
      if (pages.length === 0) {
        console.warn("No pages found for user. Make sure pages are connected.");
        return NextResponse.json({ contacts: [] });
      }
      
      // Fetch conversations from all pages
      const allContacts: any[] = [];
      const pageStats: any = {
        total: pages.length,
        processed: 0,
        withContacts: 0,
        withErrors: 0,
        noToken: 0,
        noConversations: 0,
        permissionErrors: 0,
        tokenErrors: 0,
        errors: [] as any[]
      };
      
      console.log(`Starting to fetch contacts from ${pages.length} pages...`);
      
      for (const page of pages) {
        try {
          pageStats.processed++;
          
          if (!page.access_token) {
            console.warn(`⚠️ Page ${page.name} (${page.id}) has no access token. Skipping.`);
            pageStats.noToken++;
            pageStats.errors.push({
              page: page.name,
              pageId: page.id,
              error: "No access token"
            });
            continue;
          }

          // First, validate the page access token by checking page info
          try {
            const pageInfoUrl = `https://graph.facebook.com/v18.0/${page.id}?access_token=${page.access_token}&fields=id,name`;
            const pageInfoResponse = await fetch(pageInfoUrl);
            
            if (!pageInfoResponse.ok) {
              const errorData = await pageInfoResponse.json().catch(() => ({}));
              console.warn(`⚠️ Page ${page.name} (${page.id}): Token validation failed - ${JSON.stringify(errorData.error || errorData)}`);
              
              if (errorData.error?.code === 190 || errorData.error?.type === "OAuthException") {
                pageStats.tokenErrors++;
                pageStats.errors.push({
                  page: page.name,
                  pageId: page.id,
                  error: "Invalid or expired access token",
                  errorCode: errorData.error?.code,
                  errorMessage: errorData.error?.message
                });
              }
              // Continue anyway to try fetching conversations
            }
          } catch (validateError) {
            console.warn(`⚠️ Error validating token for page ${page.name}:`, validateError);
          }

          // Fetch conversations for this page with pagination
          let allConversations: any[] = [];
          let conversationsUrl: string | null = `https://graph.facebook.com/v18.0/${page.id}/conversations?access_token=${page.access_token}&fields=participants,updated_time,messages.limit(10){from,message,created_time}&limit=100`;
          
          // Fetch ALL conversations with pagination
          while (conversationsUrl) {
            const conversationsResponse: Response = await fetch(conversationsUrl);

            if (conversationsResponse.ok) {
              const conversationsData: any = await conversationsResponse.json();
              const conversations = conversationsData.data || [];
              allConversations.push(...conversations);

              // Check if there are more pages
              conversationsUrl = conversationsData.paging?.next || null;
              
              if (conversationsUrl && allConversations.length % 500 === 0) {
                console.log(`   📄 Page ${page.name}: Fetched ${allConversations.length} conversations so far, continuing...`);
              }
            } else {
              const errorData = await conversationsResponse.json().catch(() => ({}));
              const errorMessage = errorData.error?.message || errorData.error?.error_user_msg || "Failed to fetch conversations";
              const errorCode = errorData.error?.code;
              const errorType = errorData.error?.type;
              
              console.error(`❌ Error fetching conversations for page ${page.name} (${page.id}):`, {
                status: conversationsResponse.status,
                statusText: conversationsResponse.statusText,
                errorCode,
                errorType,
                errorMessage,
                fullError: errorData
              });
              
              conversationsUrl = null; // Stop pagination on error
              
              pageStats.withErrors++;
              const errorInfo = {
                page: page.name,
                pageId: page.id,
                status: conversationsResponse.status,
                error: errorData.error || errorData,
                errorCode,
                errorType,
                errorMessage
              };
              
              if (errorData.error?.code === 200 || errorData.error?.message?.includes("permission")) {
                pageStats.permissionErrors++;
              } else if (errorData.error?.code === 190) {
                pageStats.tokenErrors++;
              }
              
              pageStats.errors.push(errorInfo);
              break;
            }
          }

          if (allConversations.length === 0) {
            console.log(`   ℹ️ Page ${page.name}: No conversations found`);
            pageStats.noConversations++;
          } else {
            console.log(`   ✅ Page ${page.name}: Found ${allConversations.length} conversations`);
            console.log(`   📊 Page ${page.name}: Processing conversations to extract contacts...`);
          }

          // Process conversations into contacts
          let pageContacts = 0;
          const seenContactIds = new Set<string>();
          const pageContactsList: any[] = []; // Track contacts for this page only
          
          for (const conversation of allConversations) {
            const participants = conversation.participants?.data || [];
            const messages = conversation.messages?.data || [];
            
            // Get the other participant (not the page)
            const contact = participants.find((p: any) => p.id !== page.id);
            
            if (contact) {
              // Create unique key for this contact on this page
              const contactKey = `${contact.id}-${page.id}`;
              
              // Skip if we've already seen this contact
              if (seenContactIds.has(contactKey)) {
                continue;
              }
              seenContactIds.add(contactKey);
              
              // Find the last message from the contact (not from the page)
              const contactMessages = messages.filter((msg: any) => msg.from?.id === contact.id);
              const lastContactMessage = contactMessages.length > 0 ? contactMessages[0] : null;
              const lastMessage = messages.length > 0 ? messages[0] : null;
              
              // Include contact if they have sent at least one message
              let contactData: any = null;
              
              if (lastContactMessage) {
                const messageDate = new Date(lastContactMessage.created_time).toISOString().split('T')[0];
                contactData = {
                  id: contact.id,
                  name: contact.name || contact.id || `User ${contact.id}`,
                  page: page.name,
                  pageId: page.id,
                  lastMessage: lastContactMessage.message || "",
                  lastMessageTime: lastContactMessage.created_time,
                  lastContactMessageDate: messageDate,
                  updatedTime: conversation.updated_time,
                  tags: [],
                  role: "",
                  avatar: (contact.name || contact.id || "U").substring(0, 2).toUpperCase(),
                  date: messageDate
                };
              } else if (messages.length > 0) {
                const conversationDate = new Date(conversation.updated_time).toISOString().split('T')[0];
                contactData = {
                  id: contact.id,
                  name: contact.name || contact.id || `User ${contact.id}`,
                  page: page.name,
                  pageId: page.id,
                  lastMessage: lastMessage?.message || "",
                  lastMessageTime: lastMessage?.created_time || conversation.updated_time,
                  lastContactMessageDate: null,
                  updatedTime: conversation.updated_time,
                  tags: [],
                  role: "",
                  avatar: (contact.name || contact.id || "U").substring(0, 2).toUpperCase(),
                  date: conversationDate
                };
              } else {
                const conversationDate = new Date(conversation.updated_time).toISOString().split('T')[0];
                contactData = {
                  id: contact.id,
                  name: contact.name || contact.id || `User ${contact.id}`,
                  page: page.name,
                  pageId: page.id,
                  lastMessage: "",
                  lastMessageTime: conversation.updated_time,
                  lastContactMessageDate: null,
                  updatedTime: conversation.updated_time,
                  tags: [],
                  role: "",
                  avatar: (contact.name || contact.id || "U").substring(0, 2).toUpperCase(),
                  date: conversationDate
                };
              }
              
              if (contactData) {
                allContacts.push(contactData);
                pageContactsList.push(contactData);
                pageContacts++;
              }
            }
          }
          
          if (pageContacts > 0) {
            pageStats.withContacts++;
            console.log(`   ✅ Page ${page.name}: Added ${pageContacts} contacts`);
            
            // Save contacts to database
            let savedCount = 0;
            let errorCount = 0;
            
            for (const contact of pageContactsList) {
              try {
                const { error: saveError } = await supabaseServer
                  .from("contacts")
                  .upsert({
                    contact_id: contact.id,
                    page_id: contact.pageId,
                    user_id: userId,
                    contact_name: contact.name,
                    page_name: contact.page,
                    last_message: contact.lastMessage || null,
                    last_message_time: contact.lastMessageTime || null,
                    last_contact_message_date: contact.lastContactMessageDate || null,
                    updated_at: contact.updatedTime || new Date().toISOString(),
                    tags: contact.tags || [],
                    role: contact.role || "",
                    avatar: contact.avatar,
                    date: contact.date || null,
                  }, {
                    onConflict: "contact_id,page_id,user_id"
                  });
                
                if (saveError) {
                  errorCount++;
                  if (errorCount <= 3) {
                    console.error(`❌ Error saving contact ${contact.id} to database:`, saveError);
                  }
                } else {
                  savedCount++;
                }
              } catch (saveError: any) {
                errorCount++;
                if (errorCount <= 3) {
                  console.error(`❌ Exception saving contact ${contact.id}:`, saveError);
                }
              }
            }
            
            if (savedCount > 0) {
              console.log(`   💾 Saved ${savedCount} contacts from ${page.name} to database`);
            }
            if (errorCount > 0) {
              console.error(`   ❌ Failed to save ${errorCount} contacts from ${page.name} to database`);
            }
          } else if (allConversations.length > 0) {
            console.log(`   ⚠️ Page ${page.name}: No contacts extracted from ${allConversations.length} conversations`);
            // Log details about why no contacts were extracted
            const sampleConv = allConversations[0];
            console.log(`   🔍 Debug: First conversation sample:`, {
              hasParticipants: !!sampleConv.participants,
              participants: sampleConv.participants?.data || [],
              pageId: page.id,
              participantIds: (sampleConv.participants?.data || []).map((p: any) => p.id)
            });
          }
        } catch (pageError: any) {
          pageStats.withErrors++;
          const errorInfo = {
            page: page.name,
            pageId: page.id,
            error: pageError?.message || String(pageError)
          };
          console.error(`❌ Error fetching contacts for page ${page.name}:`, errorInfo);
          pageStats.errors.push(errorInfo);
          // Continue with other pages
        }
      }
      
      console.log(`\n📊 Summary:`);
      console.log(`   Total pages: ${pageStats.total}`);
      console.log(`   Pages processed: ${pageStats.processed}`);
      console.log(`   Pages with contacts: ${pageStats.withContacts}`);
      console.log(`   Pages with errors: ${pageStats.withErrors}`);
      console.log(`   Pages with no token: ${pageStats.noToken}`);
      console.log(`   Pages with no conversations: ${pageStats.noConversations}`);
      console.log(`   Permission errors: ${pageStats.permissionErrors}`);
      console.log(`   Token errors: ${pageStats.tokenErrors}`);
      console.log(`   Total contacts: ${allContacts.length}`);
      
      if (allContacts.length === 0) {
        console.warn("\n⚠️ No contacts found. Detailed breakdown:");
        console.warn(`   - Pages processed: ${pageStats.processed}/${pageStats.total}`);
        console.warn(`   - Pages with no token: ${pageStats.noToken}`);
        console.warn(`   - Pages with no conversations: ${pageStats.noConversations}`);
        console.warn(`   - Pages with permission errors: ${pageStats.permissionErrors}`);
        console.warn(`   - Pages with token errors: ${pageStats.tokenErrors}`);
        
        if (pageStats.errors.length > 0) {
          console.warn(`   - Sample errors (showing first 5):`);
          pageStats.errors.slice(0, 5).forEach((err: any) => {
            console.warn(`     • ${err.page}: ${err.error?.message || err.error || 'Unknown error'}`);
          });
        }
      }
      
      return NextResponse.json({ 
        contacts: allContacts,
        debug: {
          pagesProcessed: pageStats.processed,
          totalPages: pageStats.total,
          totalContacts: allContacts.length,
          pagesWithContacts: pageStats.withContacts,
          pagesWithErrors: pageStats.withErrors,
          pagesWithNoToken: pageStats.noToken,
          pagesWithNoConversations: pageStats.noConversations,
          permissionErrors: pageStats.permissionErrors,
          tokenErrors: pageStats.tokenErrors,
          pageNames: pages.map((p: any) => p.name),
          errors: pageStats.errors.slice(0, 10)
        }
      });
    } else {
      // Fetch contacts for a specific page
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}&fields=id,name,access_token`
      );

      if (!pagesResponse.ok) {
        const errorData = await pagesResponse.json();
        return NextResponse.json(
          { error: "Failed to fetch pages", details: errorData },
          { status: pagesResponse.status }
        );
      }

      const pagesData = await pagesResponse.json();
      const page = pagesData.data?.find((p: any) => p.id === pageId);

      if (!page) {
        return NextResponse.json(
          { error: "Page not found" },
          { status: 404 }
        );
      }

      // Fetch conversations for this specific page
      const conversationsResponse = await fetch(
        `https://graph.facebook.com/v18.0/${page.id}/conversations?access_token=${page.access_token}&fields=participants,updated_time,messages.limit(1){from,message,created_time}`
      );

      if (!conversationsResponse.ok) {
        const errorData = await conversationsResponse.json();
        return NextResponse.json(
          { error: "Failed to fetch conversations", details: errorData },
          { status: conversationsResponse.status }
        );
      }

      const conversationsData = await conversationsResponse.json();
      const conversations = conversationsData.data || [];
      const contacts: any[] = [];

      // Process conversations into contacts
      for (const conversation of conversations) {
        const participants = conversation.participants?.data || [];
        const messages = conversation.messages?.data || [];
        
        // Get the other participant (not the page)
        const contact = participants.find((p: any) => p.id !== page.id);
        
        if (contact && messages.length > 0) {
          const lastMessage = messages[0];
          contacts.push({
            id: contact.id,
            name: contact.name || `User ${contact.id}`,
            page: page.name,
            pageId: page.id,
            lastMessage: lastMessage.message,
            lastMessageTime: lastMessage.created_time,
            updatedTime: conversation.updated_time,
            tags: [],
            role: "",
            avatar: contact.id.substring(0, 2).toUpperCase(),
            date: new Date(conversation.updated_time).toISOString().split('T')[0]
          });
        }
      }

      return NextResponse.json({ contacts });
    }
  } catch (error: any) {
    console.error("Error fetching Facebook contacts:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE endpoint to delete contacts
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !(session as any).accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { contactIds } = body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: "No contact IDs provided" },
        { status: 400 }
      );
    }

    console.log(`Attempting to delete ${contactIds.length} contacts for user ${userId}`);

    // First, get the page_ids of contacts that will be deleted to check for empty pages later
    const { data: contactsToDelete, error: fetchError } = await supabaseServer
      .from("contacts")
      .select("page_id")
      .eq("user_id", userId)
      .in("contact_id", contactIds);

    if (fetchError) {
      console.error("Error fetching contacts to delete:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch contacts", details: fetchError.message },
        { status: 500 }
      );
    }

    // Get unique page_ids that will be affected
    const affectedPageIds = Array.from(new Set((contactsToDelete || []).map((c: any) => c.page_id)));

    // Delete contacts in batches (PostgreSQL has limits on IN clause size)
    const batchSize = 1000;
    let totalDeleted = 0;
    let errors: any[] = [];

    for (let i = 0; i < contactIds.length; i += batchSize) {
      const batch = contactIds.slice(i, i + batchSize);
      
      const { data, error: deleteError } = await supabaseServer
        .from("contacts")
        .delete()
        .eq("user_id", userId)
        .in("contact_id", batch)
        .select();

      if (deleteError) {
        console.error(`Error deleting batch ${i / batchSize + 1}:`, deleteError);
        errors.push({
          batch: i / batchSize + 1,
          error: deleteError.message,
          contactIds: batch.length
        });
      } else {
        const deletedCount = data?.length || 0;
        totalDeleted += deletedCount;
        console.log(`Deleted batch ${i / batchSize + 1}: ${deletedCount} contacts`);
      }
    }

    if (errors.length > 0) {
      console.error(`Failed to delete ${errors.length} batches`);
      return NextResponse.json(
        { 
          error: "Some contacts could not be deleted",
          deletedCount: totalDeleted,
          requestedCount: contactIds.length,
          errors: errors
        },
        { status: 207 } // Multi-Status
      );
    }

    // After deleting contacts, check if any pages are now empty for this user
    // and delete user_pages relationships and pages if needed
    let deletedPages: string[] = [];
    let deletedUserPages: string[] = [];

    for (const pageId of affectedPageIds) {
      // Check if user has any remaining contacts for this page
      const { count: remainingContacts, error: countError } = await supabaseServer
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("page_id", pageId);

      if (countError) {
        console.error(`Error checking remaining contacts for page ${pageId}:`, countError);
        continue;
      }

      // If no contacts remain for this user on this page, delete the user_pages relationship
      if (remainingContacts === 0) {
        console.log(`No contacts remaining for user ${userId} on page ${pageId}, removing user_pages relationship`);
        
        const { error: userPagesDeleteError } = await supabaseServer
          .from("user_pages")
          .delete()
          .eq("user_id", userId)
          .eq("page_id", pageId);

        if (userPagesDeleteError) {
          console.error(`Error deleting user_pages for page ${pageId}:`, userPagesDeleteError);
        } else {
          deletedUserPages.push(pageId);
          console.log(`✅ Deleted user_pages relationship for page ${pageId}`);
        }

        // Check if this page has any contacts from ANY user
        const { count: totalPageContacts, error: totalCountError } = await supabaseServer
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .eq("page_id", pageId);

        if (totalCountError) {
          console.error(`Error checking total contacts for page ${pageId}:`, totalCountError);
          continue;
        }

        // If no contacts exist for this page from any user, delete the page
        if (totalPageContacts === 0) {
          console.log(`No contacts remaining for page ${pageId} from any user, deleting page`);
          
          const { error: pageDeleteError } = await supabaseServer
            .from("facebook_pages")
            .delete()
            .eq("page_id", pageId);

          if (pageDeleteError) {
            console.error(`Error deleting page ${pageId}:`, pageDeleteError);
          } else {
            deletedPages.push(pageId);
            console.log(`✅ Deleted page ${pageId}`);
          }
        }
      }
    }

    console.log(`Successfully deleted ${totalDeleted} contacts for user ${userId}`);
    return NextResponse.json({ 
      success: true,
      deletedCount: totalDeleted,
      requestedCount: contactIds.length,
      deletedPages: deletedPages.length,
      deletedUserPages: deletedUserPages.length,
      deletedPageIds: deletedPages
    });
  } catch (error: any) {
    console.error("Error deleting contacts:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}