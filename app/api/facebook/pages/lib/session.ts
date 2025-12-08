import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function requirePageSession() {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  const userId = (session.user as any)?.id;
  const accessToken = (session as any).accessToken;
  if (!userId) return { ok: false as const, status: 401, error: "User ID not found in session" };
  return { ok: true as const, session, userId, accessToken };
}
