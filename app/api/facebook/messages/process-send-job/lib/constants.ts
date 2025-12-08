// Send one message at a time with a slower throttle to avoid rapid duplicates
export const MESSAGE_SEND_THROTTLE_MS = Number(process.env.CONTACT_SEND_THROTTLE_MS || "1000");
export const ATTACHMENT_THROTTLE_MS = 300;

// Process contacts one-by-one to persist progress frequently and avoid duplicate re-sends
const DEFAULT_PAGE_CHUNK_SIZE = 1;
export const PAGE_CHUNK_SIZE = Math.max(
  1,
  Number(process.env.SEND_JOB_PAGE_CHUNK_SIZE || DEFAULT_PAGE_CHUNK_SIZE)
);

export const TIMEOUT_BUFFER_MS = 15000;
const DEFAULT_MAX_RUNTIME_MS = 280000;
const RUNTIME_ENV_VALUE = Number(process.env.SEND_JOB_MAX_RUNTIME_MS);
export const MAX_RUNTIME_MS = Math.max(
  5000,
  Math.min(
    Number.isFinite(RUNTIME_ENV_VALUE) && RUNTIME_ENV_VALUE > 0 ? RUNTIME_ENV_VALUE : DEFAULT_MAX_RUNTIME_MS,
    DEFAULT_MAX_RUNTIME_MS
  )
);

export const STALE_THRESHOLD_SECONDS = 90;
export const MAX_JOBS_PER_RUN = 5;
