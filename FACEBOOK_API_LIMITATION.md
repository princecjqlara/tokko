# IMPORTANT: Facebook Messenger API Limitation

## The Reality

**Facebook Messenger API does NOT support sending media with text captions in a single message.**

This is a Facebook API limitation, not a bug in our code.

## What This Means

When you send a message with media attached, the recipient will receive **2 separate messages**:
1. The media file (image/video/audio/document)
2. The text message

**This is NORMAL and EXPECTED behavior** for Facebook Messenger broadcasts.

## Why Can't We Combine Them?

Facebook's Send API has these limitations:
- `attachment` field: Sends media only (no text allowed)
- `text` field: Sends text only (no media allowed)
- `quick_replies`: Can add buttons, but not full text content

There is NO way to send media with a text caption in a single message using the Send API.

## What We've Fixed

The duplicate issue we fixed was:
- **Before**: Sending the ENTIRE operation twice (4 messages total: 2 media + 2 text)
- **After**: Sending the operation once (2 messages total: 1 media + 1 text)

## If You're Still Seeing 4 Messages

This means:
1. The old code is still deployed (changes haven't been pushed to production)
2. OR the send function is being called twice (frontend issue)
3. OR there's a caching issue

## Solution Options

If you absolutely need media and text in ONE message, you have these options:

### Option 1: Embed Text in Image
- Add the text directly onto the image before uploading
- Send only the image (1 message)
- User sees text as part of the image

### Option 2: Send Text Only
- Don't attach media
- Include a link to the media in the text
- Send only text (1 message)

### Option 3: Accept Facebook's Limitation
- Send media and text as 2 separate messages
- This is how ALL Facebook Messenger broadcast tools work
- It's the standard behavior users expect

## Recommendation

**Accept the 2-message behavior** - this is how Facebook Messenger works for ALL broadcast tools, including:
- ManyChat
- Chatfuel  
- MobileMonkey
- Every other Messenger marketing platform

Users are familiar with this pattern and it's considered normal.

## Testing

To verify the fix is working:
1. Deploy the latest code to production
2. Send a test message with media to 1 contact
3. You should receive exactly **2 messages** (1 media + 1 text)
4. If you receive **4 messages** (2 media + 2 text), the fix hasn't been deployed yet
