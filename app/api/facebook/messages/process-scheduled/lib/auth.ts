export function isVercelCronRequest(headers: Headers) {
  const authHeader = headers.get("authorization");
  const vercelCronHeader = headers.get("x-vercel-cron");
  const vercelSignature = headers.get("x-vercel-signature");
  const userAgent = headers.get("user-agent") || "";

  const hasVercelHeaders = vercelCronHeader === "1" || vercelCronHeader !== null || vercelSignature !== null;
  const hasVercelUserAgent =
    userAgent.toLowerCase().includes("vercel") ||
    userAgent.toLowerCase().includes("cron") ||
    userAgent.toLowerCase().includes("node-fetch") ||
    userAgent === "";

  const isVercelCron = hasVercelHeaders || (hasVercelUserAgent && !authHeader);
  return { isVercelCron, authHeader, userAgent, vercelCronHeader, vercelSignature };
}

export function authorizeCronRequest(headers: Headers) {
  const cronSecret = process.env.CRON_SECRET;
  const { isVercelCron, authHeader } = isVercelCronRequest(headers);

  if (!cronSecret) {
    return { authorized: true, isVercelCron };
  }

  const hasValidAuth = authHeader === `Bearer ${cronSecret}`;

  if (authHeader && !hasValidAuth && !isVercelCron) {
    return { authorized: false, reason: "Invalid auth token provided and not a Vercel Cron request" };
  }

  return { authorized: true, isVercelCron };
}
