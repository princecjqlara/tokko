export const logEvent = (event: string, details?: Record<string, any>) => {
  if (details) {
    console.log(`[Process Send Job] ${event}`, JSON.stringify(details));
  } else {
    console.log(`[Process Send Job] ${event}`);
  }
};

export const logError = (event: string, error: any, details?: Record<string, any>) => {
  const payload = {
    message: error?.message,
    stack: error?.stack,
    ...details
  };
  console.error(`[Process Send Job] ${event}`, JSON.stringify(payload));
};
