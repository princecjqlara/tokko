export const MAX_DURATION = 300; // 5 minutes (requires Vercel Pro)
export const DYNAMIC = "force-dynamic";

// Threshold for using background jobs (avoid timeouts)
export const BACKGROUND_JOB_THRESHOLD = Number(process.env.BACKGROUND_JOB_THRESHOLD ?? "0");

// Very large sends skip prefetch and go straight to a background job
export const LARGE_SEND_FAST_PATH_THRESHOLD = Number(process.env.LARGE_SEND_FAST_PATH_THRESHOLD || "5000");

// Supabase IN() safety chunk size
export const CONTACT_FETCH_CHUNK = 200;

// Timeout buffer for direct sends (used in legacy inline path)
export const VERCEL_SEND_TIMEOUT_MS = 280000;

// Duplicate request guard
export const REQUEST_TTL_MS = 5 * 60 * 1000;
export const REQUEST_CLEANUP_INTERVAL_MS = 60 * 1000;

export const ALLOWED_MESSAGE_TAGS = [
  "ACCOUNT_UPDATE",
  "CONFIRMED_EVENT_UPDATE",
  "POST_PURCHASE_UPDATE",
  "HUMAN_AGENT"
] as const;

// Per-contact send throttle (ms) to slow down bursts and reduce duplicates
export const CONTACT_SEND_THROTTLE_MS = Number(process.env.CONTACT_SEND_THROTTLE_MS || "1000");

// Active job statuses used to block duplicate broadcasts
export const ACTIVE_JOB_STATUSES = ["pending", "running", "processing"];
