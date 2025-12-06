import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

// Route configuration
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Allow larger request bodies (25MB max file size)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  console.log("[Upload API] Received upload request");

  // Ensure we always return JSON, even on errors
  try {
    const session = await getServerSession(authOptions);

    console.log("[Upload API] Session check:", { hasSession: !!session, hasAccessToken: !!(session as any)?.accessToken });

    if (!session || !(session as any).accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    console.log("[Upload API] User ID:", userId);

    if (!userId) {
      console.error("No user ID in session:", session);
      return NextResponse.json(
        { error: "User ID not found in session" },
        { status: 401 }
      );
    }

    // Parse form data with error handling
    console.log("[Upload API] Parsing form data...");
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (formError: any) {
      console.error("Error parsing form data:", formError);
      return NextResponse.json(
        { error: "Failed to parse form data", details: formError.message },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File;

    if (!file || !(file instanceof File)) {
      console.error("Invalid file object:", file);
      return NextResponse.json(
        { error: "Invalid file object provided" },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size (25MB limit)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 25MB limit" },
        { status: 400 }
      );
    }

    // Validate file type and determine attachment type for Facebook Messenger
    const validMediaTypes = [
      // Images
      "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
      // Videos
      "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-ms-wmv", "video/webm",
      // Audio
      "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm",
      // Documents
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" // .pptx
    ];

    if (!validMediaTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please use images, videos, audio, or documents (PDF, DOC, XLS, PPT)." },
        { status: 400 }
      );
    }

    // Determine Facebook Messenger attachment type
    let messengerType = "file"; // default
    if (file.type.startsWith("image/")) {
      messengerType = "image";
    } else if (file.type.startsWith("video/")) {
      messengerType = "video";
    } else if (file.type.startsWith("audio/")) {
      messengerType = "audio";
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Convert file to buffer
    let arrayBuffer: ArrayBuffer;
    let buffer: Buffer;

    try {
      arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch (bufferError: any) {
      console.error("Error converting file to buffer:", bufferError);
      return NextResponse.json(
        { error: "Failed to process file", details: bufferError.message },
        { status: 500 }
      );
    }

    // Upload to Supabase Storage
    let data, error;
    try {
      const uploadResult = await supabaseServer.storage
        .from("message-attachments")
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false,
        });
      data = uploadResult.data;
      error = uploadResult.error;
    } catch (uploadException: any) {
      console.error("Exception during upload:", uploadException);
      return NextResponse.json(
        {
          error: "Failed to upload file to storage",
          details: uploadException.message || "Unknown upload error"
        },
        { status: 500 }
      );
    }

    if (error) {
      console.error("Error uploading file:", error);

      // Provide helpful error message if bucket doesn't exist
      if (error.message?.includes("Bucket not found") || error.message?.includes("does not exist")) {
        return NextResponse.json(
          {
            error: "Storage bucket 'message-attachments' not found. Please create it in Supabase Storage settings and make it public.",
            details: error.message
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "Failed to upload file", details: error.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabaseServer.storage
      .from("message-attachments")
      .getPublicUrl(fileName);

    if (!urlData || !urlData.publicUrl) {
      console.error("Failed to get public URL for uploaded file");
      return NextResponse.json(
        {
          error: "Failed to generate public URL for uploaded file",
          details: "The file was uploaded but the public URL could not be generated"
        },
        { status: 500 }
      );
    }

    if (!data || !data.path) {
      console.error("Upload succeeded but no path returned");
      return NextResponse.json(
        {
          error: "Upload succeeded but file path is missing",
          details: "The file was uploaded but the path information is missing"
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      fileName: data.path,
      type: messengerType,
      mimeType: file.type,
    });
  } catch (error: any) {
    console.error("Error in upload route:", error);
    console.error("Error stack:", error.stack);

    // Ensure we always return JSON, never HTML
    try {
      return NextResponse.json(
        {
          error: "Internal server error",
          details: error.message || "Unknown error",
          stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        },
        { status: 500 }
      );
    } catch (jsonError) {
      // Last resort - if even JSON creation fails, return plain text as JSON
      return new NextResponse(
        JSON.stringify({
          error: "Critical error",
          details: "Failed to create error response"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }
}

