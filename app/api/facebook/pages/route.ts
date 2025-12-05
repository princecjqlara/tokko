import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !(session as any).accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const accessToken = (session as any).accessToken;
    const userId = (session.user as any).id;

    // Helper function to retry with exponential backoff
    const fetchWithRetry = async (url: string, retries = 3, delay = 1000): Promise<Response> => {
      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch(url);
          
          if (response.ok) {
            return response;
          }
          
          const errorData = await response.json().catch(() => ({}));
          
          // Check if it's a rate limit error
          if (errorData.error?.code === 4 || errorData.error?.is_transient) {
            if (i < retries - 1) {
              const waitTime = delay * Math.pow(2, i); // Exponential backoff
              console.log(`Rate limit hit, waiting ${waitTime}ms before retry ${i + 1}/${retries}`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
          }
          
          return response; // Return even if error, let caller handle it
        } catch (error) {
          if (i === retries - 1) throw error;
          const waitTime = delay * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      throw new Error("Max retries exceeded");
    };

    // Fetch all pages from user's account and business accounts
    const allPages: any[] = [];

    // 1. Fetch user's direct pages
    try {
      const userPagesResponse = await fetchWithRetry(
        `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}&fields=id,name,access_token&limit=1000`
      );

      if (userPagesResponse.ok) {
        const userPagesData = await userPagesResponse.json();
        const userPages = userPagesData.data || [];
        allPages.push(...userPages);
        
        // Handle pagination if there are more than 1000 pages
        let nextUrl = userPagesData.paging?.next;
        while (nextUrl && allPages.length < 10000) { // Support up to 10,000 pages
          // Add delay between pagination requests to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 200));
          
          const nextResponse = await fetchWithRetry(nextUrl);
          if (nextResponse.ok) {
            const nextData = await nextResponse.json();
            allPages.push(...(nextData.data || []));
            nextUrl = nextData.paging?.next;
          } else {
            const errorData = await nextResponse.json().catch(() => ({}));
            if (errorData.error?.code === 4) {
              console.warn("Rate limit reached during pagination, stopping");
            }
            break;
          }
        }
      }
    } catch (error) {
      console.error("Error fetching user pages:", error);
    }

    // 2. Fetch business accounts
    try {
      // Add delay before business accounts request
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const businessAccountsResponse = await fetchWithRetry(
        `https://graph.facebook.com/v18.0/me/businesses?access_token=${accessToken}&fields=id,name&limit=1000`
      );

      if (businessAccountsResponse.ok) {
        const businessAccountsData = await businessAccountsResponse.json();
        const businessAccounts = businessAccountsData.data || [];

        // Fetch pages from each business account
        for (const business of businessAccounts) {
          try {
            // Add delay between business account requests to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const businessPagesResponse = await fetchWithRetry(
              `https://graph.facebook.com/v18.0/${business.id}/owned_pages?access_token=${accessToken}&fields=id,name,access_token&limit=1000`
            );

            if (businessPagesResponse.ok) {
              const businessPagesData = await businessPagesResponse.json();
              const businessPages = businessPagesData.data || [];
              allPages.push(...businessPages);

              // Handle pagination for business pages
              let nextUrl = businessPagesData.paging?.next;
              while (nextUrl && allPages.length < 10000) {
                // Add delay between pagination requests
                await new Promise(resolve => setTimeout(resolve, 200));
                
                const nextResponse = await fetchWithRetry(nextUrl);
                if (nextResponse.ok) {
                  const nextData = await nextResponse.json();
                  allPages.push(...(nextData.data || []));
                  nextUrl = nextData.paging?.next;
                } else {
                  const errorData = await nextResponse.json().catch(() => ({}));
                  if (errorData.error?.code === 4) {
                    console.warn("Rate limit reached during business pages pagination, stopping");
                  }
                  break;
                }
              }
            }
          } catch (error) {
            console.error(`Error fetching pages for business ${business.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching business accounts:", error);
    }

    // Remove duplicates based on page ID
    const uniquePages = Array.from(
      new Map(allPages.map((page) => [page.id, page])).values()
    );

    // Store/update pages in database for multi-user access
    // Filter out pages without access tokens before saving (they can't be used anyway)
    const pagesWithTokens = uniquePages.filter((page) => page.access_token);
    
    if (pagesWithTokens.length > 0) {
      try {
        // Upsert pages to database (only pages with access tokens)
        const pagesToUpsert = pagesWithTokens.map((page) => ({
          page_id: page.id,
          page_name: page.name,
          page_access_token: page.access_token,
          updated_at: new Date().toISOString(),
        }));
        
        // Log pages without tokens for debugging
        const pagesWithoutTokens = uniquePages.filter((page) => !page.access_token);
        if (pagesWithoutTokens.length > 0) {
          console.warn(`⚠️ Skipping ${pagesWithoutTokens.length} pages without access tokens:`, 
            pagesWithoutTokens.map(p => p.name || p.id).join(", "));
        }

        // Use Supabase to store pages (allows multiple users to access same page)
        // IMPORTANT: Must insert pages first before creating relations
        const { data: insertedPages, error: dbError } = await supabaseServer
          .from("facebook_pages")
          .upsert(pagesToUpsert, {
            onConflict: "page_id",
            ignoreDuplicates: false,
          })
          .select();

        if (dbError) {
          console.error("Error storing pages in database:", dbError);
          // Continue even if database storage fails, but don't create relations
        } else {
          // Only create user-page relations if pages were successfully stored
          // Filter to only include pages that were actually inserted/updated
          const successfullyStoredPageIds = insertedPages?.map(p => p.page_id) || pagesToUpsert.map(p => p.page_id);
          
          // Automatically connect all pages for the user (only for successfully stored pages with tokens)
          const userPageRelations = pagesWithTokens
            .filter((page) => successfullyStoredPageIds.includes(page.id))
            .map((page) => ({
              user_id: userId,
              page_id: page.id,
              connected_at: new Date().toISOString(),
            }));

          if (userPageRelations.length > 0) {
            const { error: relationError } = await supabaseServer
              .from("user_pages")
              .upsert(userPageRelations, {
                onConflict: "user_id,page_id",
                ignoreDuplicates: false,
              });

            if (relationError) {
              console.error("Error storing user-page relations:", relationError);
              // Continue even if relation storage fails
            } else {
              console.log(`Automatically connected ${userPageRelations.length} pages for user ${userId}`);
            }
          }
        }
      } catch (dbError) {
        console.error("Database error:", dbError);
        // Continue even if database operations fail
      }
    }

    console.log(`Fetched ${uniquePages.length} unique pages (${pagesWithTokens.length} with access tokens, ${uniquePages.length - pagesWithTokens.length} without)`);
    
    // Return only pages with access tokens (these are the usable ones)
    return NextResponse.json({ pages: pagesWithTokens });
  } catch (error: any) {
    console.error("Error fetching Facebook pages:", error);
    
    // Check if it's a rate limit error
    if (error.message?.includes("rate limit") || error.code === 4) {
      return NextResponse.json(
        { 
          error: "Facebook API rate limit reached", 
          details: "Please wait a few minutes and try again. Facebook limits the number of API requests per hour.",
          isTransient: true,
          retryAfter: 3600 // Suggest retry after 1 hour
        },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE endpoint to delete user pages
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
    const { pageIds } = body;

    if (!pageIds || !Array.isArray(pageIds) || pageIds.length === 0) {
      return NextResponse.json(
        { error: "No page IDs provided" },
        { status: 400 }
      );
    }

    console.log(`Attempting to delete ${pageIds.length} pages for user ${userId}`);

    let deletedPages: string[] = [];
    let deletedContacts: number = 0;
    let errors: any[] = [];

    for (const pageId of pageIds) {
      try {
        // Step 1: Delete all contacts for this user and page
        const { data: deletedContactsData, error: contactsDeleteError } = await supabaseServer
          .from("contacts")
          .delete()
          .eq("user_id", userId)
          .eq("page_id", pageId)
          .select();

        if (contactsDeleteError) {
          console.error(`Error deleting contacts for page ${pageId}:`, contactsDeleteError);
          errors.push({
            pageId,
            step: "delete_contacts",
            error: contactsDeleteError.message
          });
          continue;
        }

        const contactsCount = deletedContactsData?.length || 0;
        deletedContacts += contactsCount;
        console.log(`Deleted ${contactsCount} contacts for page ${pageId}`);

        // Step 2: Delete the user_pages relationship
        const { error: userPagesDeleteError } = await supabaseServer
          .from("user_pages")
          .delete()
          .eq("user_id", userId)
          .eq("page_id", pageId);

        if (userPagesDeleteError) {
          console.error(`Error deleting user_pages for page ${pageId}:`, userPagesDeleteError);
          errors.push({
            pageId,
            step: "delete_user_pages",
            error: userPagesDeleteError.message
          });
          continue;
        }

        console.log(`✅ Deleted user_pages relationship for page ${pageId}`);

        // Step 3: Check if this page has any contacts from ANY other user
        const { count: totalPageContacts, error: totalCountError } = await supabaseServer
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .eq("page_id", pageId);

        if (totalCountError) {
          console.error(`Error checking total contacts for page ${pageId}:`, totalCountError);
          errors.push({
            pageId,
            step: "check_remaining_contacts",
            error: totalCountError.message
          });
          continue;
        }

        // Step 4: If no contacts exist for this page from any user, delete the page
        if (totalPageContacts === 0) {
          console.log(`No contacts remaining for page ${pageId} from any user, deleting page`);
          
          const { error: pageDeleteError } = await supabaseServer
            .from("facebook_pages")
            .delete()
            .eq("page_id", pageId);

          if (pageDeleteError) {
            console.error(`Error deleting page ${pageId}:`, pageDeleteError);
            errors.push({
              pageId,
              step: "delete_page",
              error: pageDeleteError.message
            });
          } else {
            deletedPages.push(pageId);
            console.log(`✅ Deleted page ${pageId}`);
          }
        } else {
          console.log(`Page ${pageId} still has ${totalPageContacts} contacts from other users, keeping page`);
        }
      } catch (error: any) {
        console.error(`Error processing page ${pageId}:`, error);
        errors.push({
          pageId,
          step: "unknown",
          error: error.message
        });
      }
    }

    if (errors.length > 0 && errors.length === pageIds.length) {
      // All pages failed
      return NextResponse.json(
        { 
          error: "Failed to delete pages",
          errors: errors
        },
        { status: 500 }
      );
    }

    const successCount = pageIds.length - errors.length;
    console.log(`Successfully processed ${successCount} pages for user ${userId}`);

    return NextResponse.json({ 
      success: true,
      deletedPages: deletedPages.length,
      deletedContacts,
      requestedCount: pageIds.length,
      deletedPageIds: deletedPages,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error("Error deleting pages:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

