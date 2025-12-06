# Duplicate Message Send Fix

## Problem
When sending a message with media attachment (image, video, audio, file), recipients were receiving **2 separate messages**:
1. The media attachment
2. The text message

The user wanted recipients to receive only **1 message** (just the media).

## Root Cause Analysis

The backend code was intentionally sending **two separate messages** when media was attached:
1. First, it sent the media attachment
2. Then, it waited 500ms and sent the text message

This was based on an incorrect assumption that "Facebook doesn't allow text and attachment in the same message". However, the user wants to send ONLY the media when an attachment is present, not both media AND text.

## Fixes Applied

### 1. Backend Message Sending Logic (route.ts)
**File**: `app/api/facebook/messages/send/route.ts` (lines 559-665)

**Changes**:
- Modified the logic to send **ONLY media** when an attachment is present
- Text message is **ONLY sent** when there's NO attachment
- Removed the "always send text" logic that was causing duplicates
- Properly incremented success/failed counters for media-only sends

**Before**:
```typescript
// Send media attachment first
if (attachment && attachment.url) {
  // ... send media ...
  await new Promise(resolve => setTimeout(resolve, 500));
}

// Send text message (always send text, even if media was sent) ❌
const textPayload = { ... };
await fetch(...);  // This caused the duplicate!
```

**After**:
```typescript
if (attachment && attachment.url) {
  // Send ONLY media (no separate text message)
  const mediaPayload = { ... };
  await fetch(...);
  results.success++;  // Count the media send
} else {
  // No attachment - send text message only
  const textPayload = { ... };
  await fetch(...);
  results.success++;  // Count the text send
}
```

### 2. Frontend Button Click Handler (page.tsx)
**File**: `app/bulk-message/page.tsx` (lines 3048-3076)

**Changes**:
- Added `e.preventDefault()` and `e.stopPropagation()` to prevent event bubbling
- Added immediate ref check in the onClick handler before calling `handleSendBroadcast()`
- Added `isSendingRef.current` to the button's `disabled` condition for instant UI feedback
- Added console warnings to track duplicate click attempts

**Before**:
```tsx
<button
    onClick={handleSendBroadcast}
    disabled={!message.trim() || selectedContactIds.length === 0 || activeSends > 0 || isUploadingFile}
>
```

**After**:
```tsx
<button
    onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (isSendingRef.current) {
            console.warn("[Frontend] Button clicked but send already in progress (ref check)");
            return;
        }
        
        handleSendBroadcast();
    }}
    disabled={!message.trim() || selectedContactIds.length === 0 || activeSends > 0 || isUploadingFile || isSendingRef.current}
>
```

### 2. Backend Duplicate Request Protection (Already in place)
**File**: `app/api/facebook/messages/send/route.ts` (lines 54-72)

The backend already has duplicate request protection using:
- Request ID tracking with in-memory cache
- 5-minute TTL for request IDs
- Returns 409 Conflict status for duplicate requests

## How It Works Now

### Message Flow with Media:
1. User clicks "Send Broadcast" button
2. Button immediately disabled via `isSendingRef.current = true`
3. File uploaded to storage (if attached)
4. Request sent to backend with unique request ID
5. Backend sends **ONLY the media** to Facebook API (no separate text message)
6. User receives **1 message** (just the media)

### Message Flow without Media:
1. User clicks "Send Broadcast" button
2. Button immediately disabled
3. Request sent to backend
4. Backend sends text message to Facebook API
5. User receives 1 text message

### Duplicate Prevention Layers:
1. **Button disabled state** - Uses ref for instant feedback
2. **onClick handler check** - Double-checks ref before calling function
3. **handleSendBroadcast early return** - Checks ref and state at function start
4. **Backend request ID** - Prevents duplicate API calls if somehow frontend sends twice
5. **Event propagation prevention** - Stops event bubbling

## Testing Instructions

To verify the fix works:

1. **Test 1: Send with Media Only**
   - Select 1 contact
   - Type a message (e.g., "Check this out!")
   - Attach an image
   - Click "Send Broadcast" once
   - **Expected**: Contact receives **1 message** (just the image, NO separate text)
   - **Check**: Console shows only 1 send operation

2. **Test 2: Send Text Only (No Media)**
   - Select 1 contact
   - Type a message
   - Do NOT attach any media
   - Click "Send Broadcast"
   - **Expected**: Contact receives **1 text message**
   - **Check**: Console shows text message sent

3. **Test 3: Rapid Double-Click Prevention**
   - Select 1 contact
   - Type a message
   - Attach an image
   - Double-click "Send Broadcast" rapidly
   - **Expected**: Only 1 send operation starts, contact receives 1 message
   - **Check**: Console shows warning "Button clicked but send already in progress"

4. **Test 4: Multiple Contacts with Media**
   - Select 3 contacts
   - Type a message
   - Attach an image
   - Click "Send Broadcast"
   - **Expected**: Each contact receives **1 message** (just the image)
   - **Check**: No duplicate sends to the same contact

## Console Logs to Monitor

When testing, watch for these console messages:

✅ **Good logs**:
- `[Frontend] Starting send with request ID: <id>`
- `[Send Message API] Processing request ID: <id>`
- `✅ Sent image to <contact>` (when media is attached)
- `✅ Sent message to <contact>` (when no media)

❌ **Warning logs** (should only appear if you try to double-click):
- `[Frontend] Button clicked but send already in progress (ref check)`
- `[Frontend] Send already in progress (ref check), ignoring duplicate call`
- `[Send Message API] Duplicate request detected: <id>`

## Important Notes

1. **Media messages NO LONGER include separate text**
   - When you attach media, ONLY the media is sent
   - The text you type is NOT sent as a separate message
   - This prevents recipients from receiving 2 messages

2. **Text is only sent when NO media is attached**
   - If you want to send both media AND text, you need to:
     - Option A: Send media first, then send text in a separate broadcast
     - Option B: Use a different messaging approach

3. **The {FirstName} placeholder still works**
   - Even though text isn't sent with media, the personalization logic is still in place
   - This is for future enhancements where we might support captions

4. **If user still sees duplicates**
   - Check if they're clicking the button multiple times
   - Check console logs for duplicate request IDs
   - Verify the backend request ID cache is working
   - Make sure they're testing with the latest code changes

## Files Modified

1. `app/api/facebook/messages/send/route.ts` - Changed to send ONLY media when attachment present
2. `app/bulk-message/page.tsx` - Button click handler improvements for duplicate prevention
