# Debug: Messages Not Sending

## Quick Diagnostic Steps

### 1. Check Browser Console
Open your browser's developer console (F12) and look for:
- Error messages when clicking "Send Broadcast"
- Network errors (check Network tab)
- Any console warnings or errors

### 2. Check What's Happening
When you click "Send Broadcast", what happens?
- [ ] Nothing happens at all
- [ ] Error message appears on page
- [ ] Loading spinner but never completes
- [ ] Success message but no messages sent
- [ ] Something else (describe)

### 3. Check Server Logs
If deployed on Vercel:
1. Go to Vercel Dashboard → Your Project → Functions
2. Click on `/api/facebook/messages/send`
3. Look for error messages or warnings

### 4. Common Issues After Duplicate Fix

#### Issue: All contacts filtered out
**Symptoms**: "No contacts found" error
**Possible causes**:
- Contact IDs don't match database
- Contacts missing `contact_id` field
- Deduplication too aggressive

#### Issue: Contacts found but not sending
**Symptoms**: No error, but no messages sent
**Possible causes**:
- Missing page access tokens
- Facebook API errors
- Rate limiting

#### Issue: Duplicate prevention blocking sends
**Symptoms**: Messages skipped due to "duplicate prevention"
**Fix**: Check if contacts are being incorrectly marked as already sent

## What Information Do I Need?

Please provide:
1. **Exact error message** (if any) from browser console or page
2. **What happens** when you click "Send Broadcast"
3. **How many contacts** you're trying to send to
4. **Any console logs** you see (especially ones starting with `[Send Message API]`)

## Temporary Workaround

If messages are completely blocked, I can:
1. Temporarily disable the duplicate prevention
2. Add more detailed logging
3. Check if contacts are being found correctly

Let me know what you see and I'll fix it!
