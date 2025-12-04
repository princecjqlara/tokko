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
    if (uniquePages.length > 0) {
      try {
        // Upsert pages to database
        const pagesToUpsert = uniquePages.map((page) => ({
          page_id: page.id,
          page_name: page.name,
          page_access_token: page.access_token,
          updated_at: new Date().toISOString(),
        }));

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
          
          // Automatically connect all pages for the user (only for successfully stored pages)
          const userPageRelations = uniquePages
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

    console.log(`Fetched ${uniquePages.length} unique pages (including business accounts)`);
    
    return NextResponse.json({ pages: uniquePages });
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

