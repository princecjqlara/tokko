# Duplicate Broadcast Message Fix (December 2024)

## Problem
Contacts were receiving duplicate messages when broadcasts were sent with attachments. Each contact was receiving BOTH:
1. A text message
2. A media message (image/video/file)

This was incorrect - users should receive only ONE message per broadcast send operation.

## Root Cause
The code in all three message sending routes was sending BOTH text AND media when an attachment was present:
- `app/api/facebook/messages/send/route.ts` - Direct (small batch) sends
- `app/api/facebook/messages/process-send-job/route.ts` - Background job sends
- `app/api/facebook/messages/process-scheduled/route.ts` - Scheduled message sends

The logic was:
```
STEP 1: Send TEXT to all contacts
STEP 2: Send MEDIA to all contacts (if attachment exists)
```

This resulted in 2 messages per contact when attachment was present.

## Fix Applied
Changed all three routes to send ONLY ONE message:
- **If attachment exists**: Send ONLY the media (no text)
- **If no attachment**: Send ONLY the text

New logic:
```typescript
if (attachment && attachment.url) {
  // SEND MEDIA ONLY
  await sendMedia(contact, attachment);
} else {
  // SEND TEXT ONLY
  await sendText(contact, message);
}
```

## Files Modified
1. `app/api/facebook/messages/send/route.ts`
2. `app/api/facebook/messages/process-send-job/route.ts`
3. `app/api/facebook/messages/process-scheduled/route.ts`

## Important Note
This is a **Facebook API limitation** - the Messenger API does NOT support sending text with media in a single message. You must choose one:
- Media-only message
- Text-only message

If you need to send both text and media, you must do it in two separate broadcast operations.

## Testing
After deploying, test by:
1. Sending a text-only message to 1 contact → Should receive 1 message
2. Sending a media-only message to 1 contact → Should receive 1 message (the media)
3. Sending media with text to 1 contact → Should receive 1 message (the media only)

If contacts still receive duplicates, check:
- Server logs for "DUPLICATE PREVENTION" warnings
- Whether old code is cached/deployed
- Frontend double-click prevention is working
