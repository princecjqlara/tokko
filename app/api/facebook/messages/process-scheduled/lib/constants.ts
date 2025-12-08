export const MAX_MESSAGES_PER_RUN = 10;
export const CONTACT_FETCH_CHUNK = 200;
// Slow down scheduled sends to avoid duplicate deliveries
export const MESSAGE_SEND_THROTTLE_MS = Number(process.env.CONTACT_SEND_THROTTLE_MS || "1000");
export const ATTACHMENT_THROTTLE_MS = 400;

export const STUCK_PROCESSING_MINUTES = 30;
export const FUTURE_BUFFER_MS = 60 * 1000; // 1 minute
