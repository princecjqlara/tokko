import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function requireStreamSession() {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  return {
    ok: true as const,
    userId: (session.user as any).id,
    accessToken: (session as any).accessToken
  };
}
