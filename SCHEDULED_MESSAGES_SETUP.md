# Scheduled Messages Setup

## ✅ What Was Implemented

1. **Database Migration**: Created `supabase_migrations/create_scheduled_messages_table.sql`
   - Stores scheduled messages with contact IDs, message content, attachments, and scheduled time
   - Tracks status (pending, processing, sent, failed)

2. **Send Route Updated**: Modified `app/api/facebook/messages/send/route.ts`
   - Now checks if `scheduleDate` is provided
   - If scheduled: Stores message in database instead of sending immediately
   - If not scheduled: Sends immediately (existing behavior)
   - **ACCOUNT_UPDATE tag is used for all messages** ✅

3. **Cron Job Route**: Created `app/api/facebook/messages/process-scheduled/route.ts`
   - Processes scheduled messages that are due
   - Sends messages using ACCOUNT_UPDATE tag
   - Updates status and tracks success/failure

4. **Vercel Cron Configuration**: Created `vercel.json`
   - Runs every 5 minutes to process scheduled messages
   - Can be manually triggered via GET/POST to `/api/facebook/messages/process-scheduled`

## 📋 Next Steps

### 1. Run the Database Migration

You need to apply the migration to create the `scheduled_messages` table:

**Option A: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase_migrations/create_scheduled_messages_table.sql`
4. Run the migration

**Option B: Using Supabase CLI** (if you have it set up)
```bash
supabase migration up
```

### 2. Optional: Set Up Cron Secret (Recommended for Security)

To secure the cron endpoint, add a secret token:

1. Generate a random secret (e.g., using `openssl rand -hex 32`)
2. Add to your `.env.local`:
   ```
   CRON_SECRET=your-secret-token-here
   ```
3. Add the same to Vercel environment variables
4. Update `vercel.json` to include the secret in the cron configuration

**Note**: The cron job will work without a secret, but it's recommended for production.

### 3. Deploy to Vercel

1. Commit and push your changes:
   ```bash
   git add .
   git commit -m "Add scheduled messages functionality"
   git push
   ```

2. Vercel will automatically:
   - Deploy the new routes
   - Set up the cron job (runs every 5 minutes)

### 4. Test the Feature

1. **Test Scheduling**:
   - Go to the bulk message page
   - Select contacts
   - Enter a message
   - Set a future date/time in the datetime picker
   - Click "Schedule" (button text changes when date is set)
   - Message should be stored and not sent immediately

2. **Test Immediate Send**:
   - Select contacts
   - Enter a message
   - Don't set a schedule date
   - Click "Send Broadcast"
   - Message should send immediately

3. **Test Cron Job** (Manual):
   - Visit: `https://your-domain.vercel.app/api/facebook/messages/process-scheduled`
   - Or use curl:
     ```bash
     curl https://your-domain.vercel.app/api/facebook/messages/process-scheduled
     ```

## 🔍 How It Works

1. **User Schedules Message**:
   - User selects contacts, enters message, sets schedule date/time
   - Frontend sends request to `/api/facebook/messages/send` with `scheduleDate`
   - API stores message in `scheduled_messages` table with status "pending"

2. **Cron Job Processes Messages**:
   - Every 5 minutes, Vercel calls `/api/facebook/messages/process-scheduled`
   - Route finds all pending messages where `scheduled_for <= now()`
   - For each message:
     - Updates status to "processing"
     - Fetches contacts from database
     - Sends messages using ACCOUNT_UPDATE tag
     - Updates status to "sent" or "failed"
     - Records success/failure counts

3. **Message Sending**:
   - Uses the same logic as immediate sends
   - **Always uses ACCOUNT_UPDATE tag** for Facebook Messenger API
   - Supports attachments (images, videos, audio, files)
   - Supports {FirstName} placeholder personalization

## 📊 Database Schema

The `scheduled_messages` table includes:
- `id`: Primary key
- `user_id`: User who scheduled the message
- `contact_ids`: JSON array of contact IDs
- `message`: Message text
- `attachment`: JSON object with type and URL (optional)
- `scheduled_for`: When to send the message (TIMESTAMPTZ)
- `status`: pending, processing, sent, or failed
- `sent_count`: Number of successful sends
- `failed_count`: Number of failed sends
- `errors`: JSON array of error details
- `created_at`, `updated_at`, `processed_at`: Timestamps

## 🔒 Security Notes

- The cron endpoint can be secured with a `CRON_SECRET` environment variable
- Messages are only processed for the user who scheduled them
- All messages use ACCOUNT_UPDATE tag as required by Facebook
- Rate limiting is applied (100ms delay between messages)

## 🐛 Troubleshooting

**Scheduled messages not sending?**
- Check Vercel cron logs in the dashboard
- Manually trigger: `GET /api/facebook/messages/process-scheduled`
- Verify the migration was applied successfully
- Check that `scheduled_for` is in the past

**Messages sending immediately when scheduled?**
- Verify `scheduleDate` is being sent in the request body
- Check browser console for errors
- Ensure the date is in the future (validation in place)

**ACCOUNT_UPDATE tag not working?**
- All message sends use ACCOUNT_UPDATE tag (verified in code)
- Check Facebook App permissions include `pages_messaging`
- Verify page access tokens are valid


