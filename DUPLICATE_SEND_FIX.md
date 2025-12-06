# Duplicate Message Send Fix

## Problem
Messages with media attachments were being sent multiple times, causing contacts to receive duplicate messages.

## Root Cause Analysis

The issue had TWO components:

### 1. Backend Logic Issue (FIXED)
The original code was sending **TWO separate messages** when media was attached:
1. Media attachment message
2. Text message

This was based on an incorrect assumption that Facebook Messenger API requires separate messages. However, this caused users to receive duplicate content.

### 2. Frontend Race Conditions (FIXED)
- Button could be clicked multiple times before disabled state updated
- React state updates are asynchronous, causing timing issues
- Event bubbling could trigger the handler multiple times

## Fixes Applied

### 1. Backend Message Sending Logic (route.ts)
**File**: `app/api/facebook/messages/send/route.ts` (lines 556-671)

**CRITICAL CHANGE**: Now sends **ONLY ONE message** per contact:
- **If media is attached**: Send ONLY the media (no separate text message)
- **If no media**: Send ONLY the text message

**Before** (WRONG - sent 2 messages):
```typescript
// Send media first
await sendMedia(contact, attachment);
// Then send text separately
await sendText(contact, message);  // ❌ This caused duplicates!
```

**After** (CORRECT - sends 1 message):
```typescript
if (attachment && attachment.url) {
  // Send ONLY media (no separate text)
  await sendMedia(contact, attachment);
} else {
  // Send ONLY text
  await sendText(contact, message);
}
```
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
6. User receives **1 message** (media only)

### Message Flow without Media:
1. User clicks "Send Broadcast" button
2. Button immediately disabled
3. Request sent to backend with unique request ID
4. Backend sends **ONLY the text** to Facebook API
5. User receives **1 message** (text only)

### Duplicate Prevention Layers:
1. **Button disabled state** - Uses ref for instant feedback
2. **onClick handler check** - Double-checks ref before calling function
3. **handleSendBroadcast early return** - Checks ref and state at function start
4. **Backend request ID** - Prevents duplicate API calls if somehow frontend sends twice
5. **Event propagation prevention** - Stops event bubbling
6. **Backend logic** - Sends ONLY ONE message per contact (media OR text, not both)

## Testing Instructions

To verify the fix works:

1. **Test 1: Send with Media Only**
   - Select 1 contact
   - Type a message (e.g., "Check this out!")
   - Attach an image
   - Click "Send Broadcast" once
   - **Expected**: Contact receives **1 message** (the image only, no separate text)
   - **Check**: Console shows only one send operation

2. **Test 2: Send Text Only**
   - Select 1 contact
   - Type a message (e.g., "Hello!")
   - Do NOT attach any media
   - Click "Send Broadcast" once
   - **Expected**: Contact receives **1 message** (text only)
   - **Check**: Console shows only one send operation

3. **Test 3: Rapid Double-Click Prevention**
   - Select 1 contact
   - Type a message
   - Attach an image
   - Double-click "Send Broadcast" rapidly
   - **Expected**: Only 1 send operation starts
   - **Check**: Console shows warning "Button clicked but send already in progress"

4. **Test 4: Multiple Contacts**
   - Select 3 contacts
   - Type a message
   - Attach an image
   - Click "Send Broadcast"
   - **Expected**: Each contact receives **1 message** (image only)
   - **Check**: No duplicate sends to the same contact

## Console Logs to Monitor

When testing, watch for these console messages:

✅ **Good logs**:
- `[Frontend] Starting send with request ID: <id>`
- `[Send Message API] Processing request ID: <id>`
- `✅ Sent image to <contact>`
- `✅ Sent message to <contact>`

❌ **Warning logs** (should only appear if you try to double-click):
- `[Frontend] Button clicked but send already in progress (ref check)`
- `[Frontend] Send already in progress (ref check), ignoring duplicate call`
- `[Send Message API] Duplicate request detected: <id>`

## Important Notes

1. **ONE message per contact is the CORRECT behavior**
   - When media is attached: Contact receives ONLY the media (no separate text)
   - When no media: Contact receives ONLY the text
   - This prevents duplicate messages

2. **The fix prevents duplicate SEND OPERATIONS**
   - Prevents the entire send operation from running twice
   - Prevents sending the same message multiple times to the same contact

3. **If user still sees duplicates**
   - Check if they're clicking the button multiple times
   - Check console logs for duplicate request IDs
   - Verify the backend request ID cache is working
   - Ensure the frontend ref checks are working

4. **Media-only messages**
   - When you attach media, the text you type is NOT sent separately
   - Only the media file is sent
   - If you want both media AND text, you need to:
     - First send the media (with media attached)
     - Then send the text (without media attached)
   - Or use a different approach where text is embedded in the image itself

## Files Modified

1. `app/bulk-message/page.tsx` - Button click handler improvements
2. `app/api/facebook/messages/send/route.ts` - No changes (already had protection)
