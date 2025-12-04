import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Background fetch endpoint - redirects to stream route
// This is a placeholder that can be extended for background job processing
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !(session as any).accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // For now, this endpoint just returns success
    // In the future, this could trigger a background job
    return NextResponse.json({ 
      success: true,
      message: "Background fetch endpoint - use /api/facebook/contacts/stream for actual fetching"
    });
  } catch (error: any) {
    console.error("Error in background route:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !(session as any).accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Return status of background jobs if any
    return NextResponse.json({ 
      success: true,
      message: "Background fetch status endpoint"
    });
  } catch (error: any) {
    console.error("Error in background route:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
