import { NextRequest, NextResponse } from "next/server";

// Custom callback route that redirects to NextAuth's handler
// This allows Facebook to use /api/facebook/callback while NextAuth handles the OAuth flow
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  // Build the NextAuth callback URL with all the OAuth parameters
  const nextAuthCallback = new URL("/api/auth/callback/facebook", request.url);
  
  // Copy all query parameters to NextAuth's callback
  searchParams.forEach((value, key) => {
    nextAuthCallback.searchParams.set(key, value);
  });
  
  // Redirect to NextAuth's callback handler
  return NextResponse.redirect(nextAuthCallback);
}

