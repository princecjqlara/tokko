import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Handle popup callback - return HTML that closes the popup
  // The session will be set by NextAuth's callback, we just need to close the popup
  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head>
  <title>Authentication Successful</title>
</head>
<body>
  <script>
    // Wait a moment for the session to be set
    setTimeout(() => {
      if (window.opener) {
        window.opener.postMessage({ type: 'AUTH_SUCCESS' }, '*');
        window.close();
      } else {
        window.location.href = '/bulk-message';
      }
    }, 1000);
  </script>
  <p>Authentication successful. Closing window...</p>
</body>
</html>`,
    {
      headers: { "Content-Type": "text/html" },
    }
  );
}

