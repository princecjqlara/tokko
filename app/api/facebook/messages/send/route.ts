import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

// Vercel Pro allows up to 300 seconds (5 minutes), Hobby plan allows 10 seconds
// For large batches (>100 contacts), we use background jobs to avoid timeout
export const maxDuration = 300; // 5 minutes max duration (requires Vercel Pro plan)
export const dynamic = "force-dynamic";

// Threshold for using background jobs (to avoid timeout)
const BACKGROUND_JOB_THRESHOLD = 100;

// Supabase IN() query limit - chunk queries to avoid "Bad Request" errors
const CONTACT_FETCH_CHUNK = 200;

// Helper function to chunk arrays
function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function POST(request: NextRequest) {
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
    const { contactIds, message, scheduleDate, attachment } = body;

    console.log("[Send Message API] Received request:", {
      contactIdsCount: contactIds?.length,
      contactIds: contactIds,
      userId,
      hasMessage: !!message
    });

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: "No contacts selected" },
        { status: 400 }
      );
    }

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    console.log("[Send Message API] Fetching contacts with IDs:", contactIds);

    // The frontend uses contact_id as the id, so we need to query by contact_id
    // But we also need page_id to uniquely identify contacts
    // Since contactIds might be contact_id values, we need to handle both cases
    
    let contacts: any[] | null = null;
    let contactsError: any = null;
    
    try {
      // Add timeout to database queries (10 seconds)
      const queryTimeout = 10000;
      
      // Chunk contactIds to avoid Supabase IN() query limits
      // Supabase has a limit on the number of items in IN() clauses (typically 200-1000)
      contacts = [];
      contactsError = null;
      
      // First, try to fetch by database id (in case frontend is using database IDs)
      // Process in chunks to avoid "Bad Request" errors
      for (const chunk of chunkArray(contactIds, CONTACT_FETCH_CHUNK)) {
        const chunkQueryPromise = supabaseServer
          .from("contacts")
          .select(`
            id,
            contact_id,
            page_id,
            contact_name,
            page_name
          `)
          .in("id", chunk)
          .eq("user_id", userId);

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Database query timeout")), queryTimeout)
        );

        try {
          const chunkQuery = await Promise.race([chunkQueryPromise, timeoutPromise]) as any;
          
          if (chunkQuery.error) {
            console.error(`[Send Message API] Error fetching chunk by id:`, chunkQuery.error);
            contactsError = chunkQuery.error;
            // Continue to next chunk or try contact_id
          } else if (chunkQuery.data && chunkQuery.data.length > 0) {
            contacts.push(...chunkQuery.data);
          }
        } catch (chunkError: any) {
          console.error(`[Send Message API] Error in chunk query:`, chunkError);
          if (!contactsError) {
            contactsError = chunkError;
          }
        }
      }

      // If no contacts found by database id, try by contact_id
      if ((!contacts || contacts.length === 0) && contactIds.length > 0) {
        console.log("[Send Message API] No contacts found by database id, trying by contact_id");
        contacts = []; // Reset for contact_id query
        
        // Process in chunks
        for (const chunk of chunkArray(contactIds, CONTACT_FETCH_CHUNK)) {
          const chunkQueryPromise = supabaseServer
            .from("contacts")
            .select(`
              id,
              contact_id,
              page_id,
              contact_name,
              page_name
            `)
            .in("contact_id", chunk)
            .eq("user_id", userId);
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Database query timeout")), queryTimeout)
          );
          
          try {
            const chunkQuery = await Promise.race([chunkQueryPromise, timeoutPromise]) as any;
            
            if (chunkQuery.error) {
              console.error(`[Send Message API] Error fetching chunk by contact_id:`, chunkQuery.error);
              contactsError = chunkQuery.error;
            } else if (chunkQuery.data && chunkQuery.data.length > 0) {
              contacts.push(...chunkQuery.data);
            }
          } catch (chunkError: any) {
            console.error(`[Send Message API] Error in chunk query (contact_id):`, chunkError);
            if (!contactsError) {
              contactsError = chunkError;
            }
          }
        }
      }
      
      // Remove duplicates (in case same contact appears in multiple chunks)
      if (contacts && contacts.length > 0) {
        const uniqueContacts = new Map();
        for (const contact of contacts) {
          const key = `${contact.id}_${contact.contact_id}`;
          if (!uniqueContacts.has(key)) {
            uniqueContacts.set(key, contact);
          }
        }
        contacts = Array.from(uniqueContacts.values());
      }
    } catch (dbError: any) {
      console.error("[Send Message API] Database error fetching contacts:", dbError);
      contactsError = dbError;
      
      // If it's a timeout, provide a more helpful error message
      if (dbError.message?.includes("timeout")) {
        contactsError = {
          message: "Database connection timeout. Please try again in a moment.",
          code: "TIMEOUT"
        };
      }
    }

    console.log("[Send Message API] Query result:", {
      contactsFound: contacts?.length || 0,
      error: contactsError?.message,
      userId
    });

    if (contactsError) {
      console.error("Error fetching contacts:", contactsError);
      // Check if it's an HTML error (Cloudflare timeout/error)
      const errorMessage = typeof contactsError === 'string' && contactsError.includes('<html>')
        ? "Database connection timeout. Please try again."
        : contactsError.message || "Failed to fetch contacts";
      
      return NextResponse.json(
        { error: "Failed to fetch contacts", details: errorMessage },
        { status: 500 }
      );
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        { error: "No contacts found" },
        { status: 404 }
      );
    }

    // For large batches, use background job to avoid timeout
    // If not scheduled and batch is large, create a background job
    if (!scheduleDate && contacts.length > BACKGROUND_JOB_THRESHOLD) {
      console.log(`[Send Message API] Large batch detected (${contacts.length} contacts), creating background job`);
      
      try {
        const { data: sendJob, error: jobError } = await supabaseServer
          .from("send_jobs")
          .insert({
            user_id: userId,
            contact_ids: contactIds,
            message: message.trim(),
            attachment: attachment || null,
            status: "pending",
            total_count: contacts.length
          })
          .select()
          .single();

        if (jobError) {
          console.error("[Send Message API] Error creating send job:", jobError);
          console.error("[Send Message API] Job error details:", JSON.stringify(jobError, null, 2));
          // Check if it's a table not found error
          if (jobError.message?.includes("relation") && jobError.message?.includes("does not exist")) {
            console.error("[Send Message API] send_jobs table does not exist! Please run the migration.");
            return NextResponse.json({
              success: false,
              error: "Database migration required",
              details: "The send_jobs table has not been created. Please run the migration from supabase_migrations/create_send_jobs_table.sql",
              results: {
                total: contacts.length,
                sent: 0,
                failed: 0,
                errors: []
              }
            }, { status: 500 });
          }
          // Fall through to try sending directly (may timeout but better than failing completely)
          console.log("[Send Message API] Failed to create job, attempting direct send (may timeout)");
        } else if (sendJob) {
          console.log(`[Send Message API] Background job created successfully: ${sendJob.id}`);
          
          // Trigger background processing asynchronously (don't wait for it)
          // Pass the access token so the job processor can fetch pages if needed
          // Note: We don't use Authorization header since process-send-job accepts accessToken in body
          let triggerUrl = 'http://localhost:3000';
          if (process.env.NEXTAUTH_URL) {
            triggerUrl = process.env.NEXTAUTH_URL;
          } else if (process.env.VERCEL_URL) {
            triggerUrl = `https://${process.env.VERCEL_URL}`;
          }
          triggerUrl = `${triggerUrl}/api/facebook/messages/process-send-job`;
          fetch(triggerUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
              jobId: sendJob.id,
              accessToken: (session as any).accessToken 
            }),
          }).then(response => {
            if (!response.ok) {
              console.error(`[Send Message API] Failed to trigger background job: ${response.status} ${response.statusText}`);
            } else {
              console.log(`[Send Message API] Background job trigger sent successfully for job ${sendJob.id}`);
            }
          }).catch(err => {
            console.error("[Send Message API] Failed to trigger background job:", err);
            // Job will be picked up by cron or manual trigger
          });

          return NextResponse.json({
            success: true,
            results: {
              total: contacts.length,
              sent: 0,
              failed: 0,
              errors: [],
              scheduled: false,
              backgroundJob: true,
              jobId: sendJob.id,
              message: `Large batch detected. Processing ${contacts.length} messages in the background. Check job status for progress.`
            }
          });
        } else {
          console.error("[Send Message API] Job creation returned no data and no error");
          // Fall through to direct send
        }
      } catch (error: any) {
        console.error("[Send Message API] Exception creating send job:", error);
        // Fall through to try sending directly
      }
    }

    // If scheduleDate is provided, store the message for later instead of sending immediately
    if (scheduleDate) {
      const scheduledDate = new Date(scheduleDate);
      const now = new Date();
      
      console.log("[Send Message API] Scheduling message:", {
        scheduleDateInput: scheduleDate,
        scheduledDateISO: scheduledDate.toISOString(),
        scheduledDateLocal: scheduledDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
        nowISO: now.toISOString(),
        nowLocal: now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
        isFuture: scheduledDate > now,
        timeUntil: scheduledDate.getTime() - now.getTime()
      });
      
      if (scheduledDate <= now) {
        return NextResponse.json(
          { error: "Scheduled date must be in the future" },
          { status: 400 }
        );
      }

      // Store scheduled message in database
      const { data: scheduledMessage, error: scheduleError } = await supabaseServer
        .from("scheduled_messages")
        .insert({
          user_id: userId,
          contact_ids: contactIds,
          message: message.trim(),
          attachment: attachment || null,
          scheduled_for: scheduledDate.toISOString(),
          status: "pending"
        })
        .select()
        .single();

      if (scheduleError) {
        console.error("Error scheduling message:", scheduleError);
        return NextResponse.json(
          { error: "Failed to schedule message", details: scheduleError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        results: {
          total: contactIds.length,
          sent: 0,
          failed: 0,
          errors: [],
          scheduled: true,
          scheduledMessageId: scheduledMessage.id,
          scheduledFor: scheduledDate.toISOString()
        }
      });
    }

    // Group contacts by page to send messages efficiently
    const contactsByPage = new Map<string, any[]>();
    
    for (const contact of contacts) {
      const pageId = contact.page_id;
      if (!contactsByPage.has(pageId)) {
        contactsByPage.set(pageId, []);
      }
      contactsByPage.get(pageId)!.push(contact);
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
      scheduled: false
    };

    // Track start time for timeout protection
    const startTime = Date.now();
    const VERCEL_TIMEOUT = 280000; // 280 seconds (leave 20s buffer before Vercel's 300s limit)

    // Send messages to each page's contacts
    for (const [pageId, pageContacts] of contactsByPage.entries()) {
      // Check if we're approaching timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > VERCEL_TIMEOUT) {
        console.warn(`[Send Message API] Approaching timeout (${Math.round(elapsed/1000)}s elapsed), returning partial results`);
        return NextResponse.json({
          success: true,
          results: {
            total: contactIds.length,
            sent: results.success,
            failed: results.failed,
            errors: results.errors,
            scheduled: false,
            partial: true,
            message: `Timeout approaching. Sent ${results.success} messages. ${contactIds.length - results.success - results.failed} remaining. Please retry with smaller batch or use scheduling.`
          }
        });
      }
      // Get page access token from facebook_pages table
      const firstContact = pageContacts[0];
      
      // Fetch page access token separately
      let pageData: any = null;
      let pageError: any = null;
      
      try {
        // Add timeout to database query (5 seconds)
        const pageQueryPromise = supabaseServer
          .from("facebook_pages")
          .select("page_id, page_access_token")
          .eq("page_id", pageId)
          .maybeSingle();
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Database query timeout")), 5000)
        );
        
        const pageQuery = await Promise.race([pageQueryPromise, timeoutPromise]) as any;
      
        pageData = pageQuery.data;
        pageError = pageQuery.error;
      } catch (dbError: any) {
        console.error(`[Send Message API] Database error fetching page ${pageId}:`, dbError);
        pageError = dbError;
        
        // If it's a timeout, allow fallback to Facebook API
        if (dbError.message?.includes("timeout")) {
          console.log(`[Send Message API] Database timeout for page ${pageId}, will fetch from Facebook API`);
          pageError = null; // Clear error to allow fallback
        }
      }
      
      // If page not found, try to fetch it from Facebook API
      if (pageError || !pageData) {
        console.log(`Page ${pageId} not in database, fetching from Facebook API...`);
        
        try {
          // Fetch pages from Facebook API
          const pagesResponse = await fetch(
            `https://graph.facebook.com/v18.0/me/accounts?access_token=${(session as any).accessToken}&fields=id,name,access_token&limit=1000`
          );
          
          if (pagesResponse.ok) {
            const pagesData = await pagesResponse.json();
            const pages = pagesData.data || [];
            
            // Find the page we need
            const foundPage = pages.find((p: any) => p.id === pageId);
            
            if (foundPage) {
              // Store the page in database
              const { error: storeError } = await supabaseServer
                .from("facebook_pages")
                .upsert({
                  page_id: foundPage.id,
                  page_name: foundPage.name,
                  page_access_token: foundPage.access_token,
                  updated_at: new Date().toISOString(),
                }, {
                  onConflict: "page_id",
                });
              
              if (!storeError) {
                // Retry fetching from database
                try {
                  const retryResult = await supabaseServer
                    .from("facebook_pages")
                    .select("page_id, page_access_token")
                    .eq("page_id", pageId)
                    .maybeSingle();
                  
                  pageData = retryResult.data;
                  pageError = retryResult.error;
                  console.log(`✅ Successfully fetched and stored page ${pageId}`);
                } catch (retryError: any) {
                  console.error(`[Send Message API] Error retrying page fetch:`, retryError);
                  pageError = retryError;
                }
              }
            }
          }
        } catch (fetchError) {
          console.error(`Error fetching page from Facebook API:`, fetchError);
        }
      }
      
      if (pageError || !pageData) {
        console.error(`No access token for page ${pageId}:`, pageError);
        results.failed += pageContacts.length;
        results.errors.push({
          page: firstContact.page_name,
          error: "No access token available for this page. Please fetch pages first by visiting /api/facebook/pages"
        });
        continue;
      }
      
      const pageAccessToken = pageData.page_access_token;
      
      if (!pageAccessToken) {
        console.error(`No access token for page ${pageId}`);
        results.failed += pageContacts.length;
        results.errors.push({
          page: firstContact.page_name,
          error: "No access token available for this page"
        });
        continue;
      }

      // Send message to each contact on this page
      for (const contact of pageContacts) {
        try {
          // Replace {FirstName} placeholder if present
          let personalizedMessage = message;
          const firstName = contact.contact_name?.split(' ')[0] || 'there';
          personalizedMessage = personalizedMessage.replace(/{FirstName}/g, firstName);

          // If attachment is provided, send media first, then text
          // Facebook doesn't allow text and attachment in the same message
          if (attachment && attachment.url) {
            try {
              // Determine attachment type (image, video, audio, or file)
              const attachmentType = attachment.type || "file";
              
              // Send media attachment first
              const mediaPayload: any = {
                recipient: {
                  id: contact.contact_id
                },
                message: {
                  attachment: {
                    type: attachmentType,
                    payload: {
                      url: attachment.url,
                      is_reusable: true
                    }
                  }
                },
                messaging_type: "MESSAGE_TAG",
                tag: "ACCOUNT_UPDATE"
              };

              const mediaResponse = await fetch(
                `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(mediaPayload),
                }
              );

              const mediaData = await mediaResponse.json();

              if (mediaResponse.ok && !mediaData.error) {
                const typeLabel = attachmentType === "image" ? "image" : 
                                 attachmentType === "video" ? "video" : 
                                 attachmentType === "audio" ? "audio" : "file";
                console.log(`✅ Sent ${typeLabel} to ${contact.contact_name} (${contact.contact_id})`);
                // Wait a bit before sending text message
                await new Promise(resolve => setTimeout(resolve, 500));
              } else {
                const errorMsg = mediaData.error?.message || `Failed to send ${attachmentType}`;
                console.error(`❌ Failed to send ${attachmentType} to ${contact.contact_name}:`, errorMsg);
                // Continue to send text message even if media fails
              }
            } catch (mediaError: any) {
              console.error(`❌ Error sending media to ${contact.contact_name}:`, mediaError);
              // Continue to send text message even if media fails
            }
          }

          // Send text message (always send text, even if media was sent)
          const textPayload: any = {
            recipient: {
              id: contact.contact_id
            },
            message: {
              text: personalizedMessage
            },
            messaging_type: "MESSAGE_TAG",
            tag: "ACCOUNT_UPDATE"
          };

          const sendResponse = await fetch(
            `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(textPayload),
            }
          );

          const sendData = await sendResponse.json();

          if (sendResponse.ok && !sendData.error) {
            results.success++;
            console.log(`✅ Sent message to ${contact.contact_name} (${contact.contact_id})`);
          } else {
            results.failed++;
            const errorMsg = sendData.error?.message || "Unknown error";
            console.error(`❌ Failed to send text to ${contact.contact_name}:`, errorMsg);
            results.errors.push({
              contact: contact.contact_name,
              page: contact.page_name,
              error: errorMsg
            });
          }

          // Rate limiting: Add delay between messages to avoid hitting rate limits
          // Facebook allows ~200 calls per hour per page
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay = ~36 messages per minute max
        } catch (error: any) {
          results.failed++;
          console.error(`❌ Error sending to ${contact.contact_name}:`, error);
          results.errors.push({
            contact: contact.contact_name,
            page: contact.page_name,
            error: error.message || "Unknown error"
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      results: {
        total: contactIds.length,
        sent: results.success,
        failed: results.failed,
        errors: results.errors,
        scheduled: results.scheduled
      }
    });
  } catch (error: any) {
    console.error("Error in send message route:", error);
    // Always return JSON, even on errors, to prevent frontend JSON parsing issues
    try {
      return NextResponse.json(
        { 
          success: false,
          error: "Internal server error", 
          details: error.message || "An unexpected error occurred" 
        },
        { 
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    } catch (jsonError) {
      // Fallback if JSON.stringify fails (shouldn't happen)
      return new NextResponse(
        JSON.stringify({ 
          success: false,
          error: "Internal server error", 
          details: "An unexpected error occurred" 
        }),
        { 
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }
  }
}

