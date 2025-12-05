import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

// Admin endpoint to clear all user data for fresh testing
// WARNING: This will delete ALL data from contacts, user_pages, and facebook_pages tables
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !(session as any).accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get confirmation from query params
    const confirm = request.nextUrl.searchParams.get("confirm");
    if (confirm !== "true") {
      return NextResponse.json(
        { 
          error: "Confirmation required",
          message: "Add ?confirm=true to the URL to confirm deletion of all data"
        },
        { status: 400 }
      );
    }

    console.log("⚠️ CLEARING ALL USER DATA - This will delete all contacts, pages, and user relationships");

    // Step 1: Delete all contacts
    const { count: contactsCount, error: contactsCountError } = await supabaseServer
      .from("contacts")
      .select("*", { count: "exact", head: true });

    if (contactsCountError) {
      console.error("Error counting contacts:", contactsCountError);
    } else {
      console.log(`Found ${contactsCount || 0} contacts to delete`);
    }

    const { error: contactsDeleteError } = await supabaseServer
      .from("contacts")
      .delete()
      .neq("id", 0); // Delete all (this condition is always true)

    if (contactsDeleteError) {
      console.error("Error deleting contacts:", contactsDeleteError);
      return NextResponse.json(
        { error: "Failed to delete contacts", details: contactsDeleteError.message },
        { status: 500 }
      );
    }

    console.log("✅ Deleted all contacts");

    // Step 2: Delete all user_pages relationships
    const { count: userPagesCount, error: userPagesCountError } = await supabaseServer
      .from("user_pages")
      .select("*", { count: "exact", head: true });

    if (userPagesCountError) {
      console.error("Error counting user_pages:", userPagesCountError);
    } else {
      console.log(`Found ${userPagesCount || 0} user_pages relationships to delete`);
    }

    const { error: userPagesDeleteError } = await supabaseServer
      .from("user_pages")
      .delete()
      .neq("user_id", ""); // Delete all (this condition is always true)

    if (userPagesDeleteError) {
      console.error("Error deleting user_pages:", userPagesDeleteError);
      return NextResponse.json(
        { error: "Failed to delete user_pages", details: userPagesDeleteError.message },
        { status: 500 }
      );
    }

    console.log("✅ Deleted all user_pages relationships");

    // Step 3: Delete all facebook_pages (since no users are connected anymore)
    const { count: pagesCount, error: pagesCountError } = await supabaseServer
      .from("facebook_pages")
      .select("*", { count: "exact", head: true });

    if (pagesCountError) {
      console.error("Error counting facebook_pages:", pagesCountError);
    } else {
      console.log(`Found ${pagesCount || 0} facebook_pages to delete`);
    }

    const { error: pagesDeleteError } = await supabaseServer
      .from("facebook_pages")
      .delete()
      .neq("page_id", ""); // Delete all (this condition is always true)

    if (pagesDeleteError) {
      console.error("Error deleting facebook_pages:", pagesDeleteError);
      return NextResponse.json(
        { error: "Failed to delete facebook_pages", details: pagesDeleteError.message },
        { status: 500 }
      );
    }

    console.log("✅ Deleted all facebook_pages");

    // Step 4: Also clear scheduled messages if the table exists
    try {
      const { error: scheduledDeleteError } = await supabaseServer
        .from("scheduled_messages")
        .delete()
        .neq("id", 0);

      if (scheduledDeleteError) {
        // Table might not exist, just log
        console.log("Note: Could not delete scheduled_messages (table may not exist)");
      } else {
        console.log("✅ Deleted all scheduled_messages");
      }
    } catch (e) {
      console.log("Note: scheduled_messages table may not exist");
    }

    // Step 5: Also clear fetch_jobs if the table exists
    try {
      const { error: fetchJobsDeleteError } = await supabaseServer
        .from("fetch_jobs")
        .delete()
        .neq("id", 0);

      if (fetchJobsDeleteError) {
        // Table might not exist, just log
        console.log("Note: Could not delete fetch_jobs (table may not exist)");
      } else {
        console.log("✅ Deleted all fetch_jobs");
      }
    } catch (e) {
      console.log("Note: fetch_jobs table may not exist");
    }

    console.log("🎉 All user data cleared successfully!");

    return NextResponse.json({ 
      success: true,
      message: "All user data cleared successfully",
      deleted: {
        contacts: contactsCount || 0,
        userPages: userPagesCount || 0,
        facebookPages: pagesCount || 0
      }
    });
  } catch (error: any) {
    console.error("Error clearing all data:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}