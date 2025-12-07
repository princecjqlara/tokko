# Duplicate Message Send Fix - Summary

## Problem
Messages were being sent multiple times to the same contact, and sometimes to other contacts as well. This was happening due to:

1. **Duplicate contact IDs in request**: The `contactIds` array from the frontend could contain duplicates
2. **Insufficient deduplication**: Contacts weren't properly deduplicated before processing
3. **Race conditions**: Multiple job processors could pick up the same job concurrently
4. **Inconsistent unique keys**: Different deduplication strategies were used inconsistently

## Fixes Applied

### 1. **Early Deduplication in Send Route** (`app/api/facebook/messages/send/route.ts`)
   - Added deduplication of `contactIds` array **before** any processing
   - Ensures each contact ID only appears once in the request
   - Logs warning when duplicates are detected and removed

### 2. **Improved Contact Fetching Deduplication**
   - Changed deduplication key from `${page_id}_${contact_id}` to just `contact_id`
   - `contact_id` is globally unique across all pages, making it the correct unique identifier
   - Added deduplication in `fetchContactsForSendJob()` to prevent fetching same contact multiple times

### 3. **Enhanced Duplicate Prevention During Sending**
   - Mark contacts as "processing" **immediately** before sending (prevents race conditions)
   - Check for duplicates **before** processing each contact
   - Added warning logs when duplicates are detected
   - Remove from sent set on failure (allows retry of failed sends)

### 4. **Improved Job Processing Race Condition Prevention**
   - Increased concurrent job detection window from 60 to 90 seconds
   - Added check for "processing" status jobs to prevent concurrent processing
   - Better logging with warnings for duplicate processing attempts

### 5. **Better Contact ID Storage in Jobs**
   - Jobs now store deduplicated contact IDs from fetched contacts (not original array)
   - Ensures consistency between stored IDs and actual contacts processed
   - Applied to both regular send jobs and scheduled messages

### 6. **Scheduled Messages Deduplication**
   - Added deduplication when processing scheduled messages
   - Uses same `contact_id`-based deduplication as regular sends
   - Prevents duplicate sends in scheduled messages

## Key Changes

### Contact Deduplication Strategy
- **Before**: Used composite key `${page_id}_${contact_id}` 
- **After**: Uses `contact_id` only (globally unique)
- **Rationale**: `contact_id` is unique across all Facebook pages, so it's the correct unique identifier

### Duplicate Prevention Layers

1. **Request Level**: Deduplicate `contactIds` array before processing
2. **Fetch Level**: Deduplicate contacts when fetching from database
3. **Processing Level**: Check and mark contacts as processing before sending
4. **Job Level**: Track sent contacts in job metadata to prevent resend on resume

### Race Condition Prevention

- Jobs in "processing" or "running" status updated within last 90 seconds are skipped
- Atomic job claiming with status check to prevent concurrent processing
- Processing ID tracking to verify job ownership

## Files Modified

1. `app/api/facebook/messages/send/route.ts`
   - Early contactIds deduplication
   - Improved contact fetching deduplication
   - Better duplicate prevention during sending
   - Store deduplicated contact IDs in jobs

2. `app/api/facebook/messages/process-send-job/route.ts`
   - Improved contact fetching with deduplication
   - Better race condition prevention
   - Enhanced duplicate detection and logging

3. `app/api/facebook/messages/process-scheduled/route.ts`
   - Added contact deduplication before processing

## Testing Recommendations

1. **Test with duplicate contact IDs**:
   - Send message with same contact ID appearing multiple times
   - Verify only one message is sent

2. **Test concurrent job processing**:
   - Create large batch that triggers background job
   - Verify job is only processed once

3. **Test scheduled messages**:
   - Schedule message with duplicate contact IDs
   - Verify each contact receives message only once

4. **Test resume functionality**:
   - Create job that times out mid-processing
   - Verify resume doesn't send duplicates to already-processed contacts

## Expected Behavior

- ✅ Each contact receives message exactly once, regardless of how many times they appear in the request
- ✅ Jobs are processed by only one worker at a time
- ✅ Failed sends can be retried without sending duplicates
- ✅ Scheduled messages don't send duplicates
- ✅ Clear logging when duplicates are detected and prevented
