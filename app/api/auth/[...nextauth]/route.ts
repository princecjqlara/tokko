import NextAuth, { NextAuthOptions } from "next-auth";
import FacebookProvider from "next-auth/providers/facebook";

// Validate required environment variables
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET is not set. Please create a .env.local file with NEXTAUTH_SECRET.");
}

const providers = [];

// Only add Facebook provider if credentials are provided
if (
  process.env.FACEBOOK_CLIENT_ID &&
  process.env.FACEBOOK_CLIENT_SECRET &&
  process.env.FACEBOOK_CLIENT_ID !== "your-facebook-app-id" &&
  process.env.FACEBOOK_CLIENT_SECRET !== "your-facebook-app-secret"
) {
  providers.push(
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      // Note: For Business type apps, at least one permission beyond email/public_profile is required
      // Permissions needed: pages_show_list (list pages), pages_read_engagement (read messages), pages_messaging (send messages), business_management (access business accounts)
      authorization: {
        params: {
          scope: "email public_profile pages_show_list pages_read_engagement pages_messaging business_management",
        },
      },
    })
  );
}

// Ensure we have at least one provider before creating NextAuth instance
if (providers.length === 0) {
  throw new Error(
    "No authentication providers configured. Please set FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET in .env.local"
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers,
  pages: {
    signIn: "/auth/signin",
  },
  // Development mode settings
  debug: process.env.NODE_ENV === "development",
  useSecureCookies: process.env.NODE_ENV === "production",
  // Session configuration - extend session duration
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 60, // 60 days (matching Facebook token lifetime)
  },
  callbacks: {
    async jwt({ token, account, profile, trigger }) {
      // Initial sign in - store tokens and exchange for long-lived token
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        
        // Immediately exchange short-lived token for long-lived token (60 days)
        try {
          const exchangeUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_CLIENT_ID}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&fb_exchange_token=${account.access_token}`;
          
          const exchangeResponse = await fetch(exchangeUrl);
          if (exchangeResponse.ok) {
            const exchangeData = await exchangeResponse.json();
            if (exchangeData.access_token) {
              token.accessToken = exchangeData.access_token;
              // Long-lived tokens typically last 60 days (5184000 seconds)
              token.expiresAt = Date.now() + (exchangeData.expires_in || 5184000) * 1000;
              console.log("✅ Exchanged for long-lived token, expires in", exchangeData.expires_in || 5184000, "seconds");
            } else {
              // Fallback to default expiration if exchange fails
              token.expiresAt = account.expires_at ? account.expires_at * 1000 : Date.now() + 60 * 24 * 60 * 60 * 1000;
            }
          } else {
            // Fallback to default expiration if exchange fails
            token.expiresAt = account.expires_at ? account.expires_at * 1000 : Date.now() + 60 * 24 * 60 * 60 * 1000;
            console.warn("⚠️ Token exchange failed, using original token");
          }
        } catch (error) {
          console.error("Error exchanging token:", error);
          // Fallback to default expiration
          token.expiresAt = account.expires_at ? account.expires_at * 1000 : Date.now() + 60 * 24 * 60 * 60 * 1000;
        }
      }
      
      // Store user ID from profile
      if (profile) {
        token.id = (profile as any).id;
      }

      // Check if token needs refresh (refresh if expires within 7 days)
      if (token.accessToken && token.expiresAt) {
        const expiresIn = token.expiresAt - Date.now();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        
        if (expiresIn < sevenDays && expiresIn > 0) {
          // Token is expiring soon, try to refresh
          try {
            // Exchange current token for a new long-lived token
            const refreshUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_CLIENT_ID}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&fb_exchange_token=${token.accessToken}`;
            
            const refreshResponse = await fetch(refreshUrl);
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json();
              if (refreshData.access_token) {
                token.accessToken = refreshData.access_token;
                // Long-lived tokens typically last 60 days
                token.expiresAt = Date.now() + (refreshData.expires_in || 5184000) * 1000;
                console.log("✅ Token auto-refreshed successfully, new expiration:", new Date(token.expiresAt).toISOString());
              }
            } else {
              const errorData = await refreshResponse.json().catch(() => ({}));
              console.warn("⚠️ Token refresh failed:", errorData.error?.message || "Unknown error");
            }
          } catch (error) {
            console.error("Error refreshing token:", error);
          }
        } else if (expiresIn <= 0) {
          console.warn("⚠️ Token has expired, user needs to reconnect");
        }
      }

      // Handle manual reconnect trigger
      if (trigger === "update" && account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        // Exchange for long-lived token on reconnect
        try {
          const exchangeUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_CLIENT_ID}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&fb_exchange_token=${account.access_token}`;
          const exchangeResponse = await fetch(exchangeUrl);
          if (exchangeResponse.ok) {
            const exchangeData = await exchangeResponse.json();
            if (exchangeData.access_token) {
              token.accessToken = exchangeData.access_token;
              token.expiresAt = Date.now() + (exchangeData.expires_in || 5184000) * 1000;
            }
          }
        } catch (error) {
          console.error("Error exchanging token on reconnect:", error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session as any).accessToken = token.accessToken as string;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

