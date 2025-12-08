import { REQUEST_CLEANUP_INTERVAL_MS, REQUEST_TTL_MS } from "./constants";

const processedRequests = new Map<string, number>();

// Clean up old request IDs periodically
setInterval(() => {
  const now = Date.now();
  for (const [requestId, timestamp] of processedRequests.entries()) {
    if (now - timestamp > REQUEST_TTL_MS) {
      processedRequests.delete(requestId);
    }
  }
}, REQUEST_CLEANUP_INTERVAL_MS);

export function guardDuplicateRequest(requestId: string | null) {
  if (!requestId) {
    return { allowed: true, message: "No request ID provided" };
  }

  if (processedRequests.has(requestId)) {
    return { allowed: false, message: "Duplicate request" };
  }

  processedRequests.set(requestId, Date.now());
  return { allowed: true, message: "Processing new request" };
}
