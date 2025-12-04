# Facebook Webhook Setup Guide

## Overview
This application uses Facebook Webhooks to receive real-time updates when new messages or conversations are created on your Facebook Pages.

## Setup Steps

### 1. Environment Variables
Add the following to your `.env.local` file:

```env
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_random_verify_token_here
FACEBOOK_APP_SECRET=your_facebook_app_secret
```

Generate a random verify token:
```bash
openssl rand -hex 32
```

### 2. Facebook App Configuration

1. Go to your Facebook App Dashboard: https://developers.facebook.com/apps/1350694239880908/
2. Navigate to **Webhooks** in the left sidebar
3. Click **Add Webhook** or **Edit** if one exists
4. Configure the webhook:
   - **Callback URL**: `https://tokko-official.vercel.app/api/webhooks/facebook`
     - For production: `https://tokko-official.vercel.app/api/webhooks/facebook`
   - **Verify Token**: The same token you set in `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
   - **Subscription Fields**: Select the following:
     - `messages` - Receive new message events
     - `messaging_postbacks` - Receive postback events
     - `messaging_optins` - Receive opt-in events
     - `messaging_deliveries` - Receive delivery confirmations
     - `messaging_reads` - Receive read receipts

### 3. Subscribe to Page Events

After setting up the webhook, you need to subscribe each Page to the webhook:

1. Go to **Webhooks** → **Page** in your Facebook App Dashboard
2. Click **Subscribe** next to your webhook
3. Select the pages you want to receive events from
4. Click **Subscribe**

Alternatively, you can subscribe programmatically using the Graph API:

```bash
curl -X POST "https://graph.facebook.com/v18.0/{page-id}/subscribed_apps" \
  -d "subscribed_fields=messages,messaging_postbacks" \
  -d "access_token={page-access-token}"
```

### 4. Webhook Endpoints

- **GET `/api/webhooks/facebook`**: Webhook verification (Facebook calls this to verify your webhook)
- **POST `/api/webhooks/facebook`**: Receives webhook events from Facebook
- **GET `/api/webhooks/facebook/events`**: Polling endpoint for real-time updates (used by frontend)

### 5. Testing the Webhook

#### Local Development with ngrok:
1. Start your development server: `npm run dev`
2. Start ngrok: `ngrok http 3000`
3. Use the ngrok URL in your Facebook App webhook configuration
4. Facebook will verify the webhook automatically

#### Test Webhook Events:
You can use Facebook's webhook testing tool in the App Dashboard:
1. Go to **Webhooks** → **Page**
2. Click **Test** next to your webhook
3. Select an event type to test
4. Facebook will send a test event to your webhook

### 6. Real-Time Updates

The frontend automatically polls for new webhook events every 3 seconds when a user is authenticated. New contacts are automatically added to the contacts list in real-time.

## Webhook Event Types

### Messages Event
Triggered when a new message is received on a Page:
```json
{
  "object": "page",
  "entry": [{
    "id": "page-id",
    "messaging": [{
      "sender": {"id": "user-id"},
      "recipient": {"id": "page-id"},
      "timestamp": 1234567890,
      "message": {
        "text": "Hello!"
      }
    }]
  }]
}
```

### Conversations Event
Triggered when a new conversation is created:
```json
{
  "object": "page",
  "entry": [{
    "id": "page-id",
    "conversations": [{
      "id": "conversation-id",
      "participants": {
        "data": [
          {"id": "user-id", "name": "User Name"},
          {"id": "page-id", "name": "Page Name"}
        ]
      },
      "updated_time": "2024-01-01T00:00:00+0000"
    }]
  }]
}
```

## Security

- Webhook signature verification is implemented using HMAC SHA256
- The webhook verify token ensures only Facebook can verify your webhook
- All webhook events require authentication to access

## Troubleshooting

### Webhook Verification Fails
- Check that `FACEBOOK_WEBHOOK_VERIFY_TOKEN` matches the token in Facebook App settings
- Ensure the callback URL is publicly accessible
- Check server logs for verification errors

### No Events Received
- Verify the webhook is subscribed to the correct pages
- Check that the required permissions are granted (`pages_messaging`, `pages_read_engagement`)
- Ensure the webhook URL is accessible from the internet
- Check Facebook App Dashboard → Webhooks for delivery status

### Events Not Appearing in UI
- Check browser console for polling errors
- Verify the user is authenticated
- Check that the events endpoint is returning data

## Production Considerations

1. **Use a Database**: Replace the in-memory event store with a proper database (Supabase, PostgreSQL, etc.)
2. **Rate Limiting**: Implement rate limiting on the webhook endpoint
3. **Error Handling**: Add retry logic for failed webhook processing
4. **Logging**: Implement proper logging for webhook events
5. **Monitoring**: Set up monitoring/alerts for webhook failures

