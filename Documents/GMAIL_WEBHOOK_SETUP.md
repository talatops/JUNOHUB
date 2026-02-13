# Gmail Webhook Setup Guide

This guide explains how to set up automatic email detection and AI-powered replies using Gmail push notifications.

## Overview

When a customer sends an email to your Gmail account, Gmail will send a push notification to our webhook endpoint. The webhook then:
1. Fetches the incoming email
2. Analyzes it using your store's knowledge base
3. Generates an AI-powered reply
4. Sends the reply automatically

## Prerequisites

1. **Gmail Integration**: Your Gmail account must be connected via `/dashboard/juno-engine/gmail-connect`
2. **Knowledge Base**: Your store must have FAQs or documents in the knowledge base
3. **Google Cloud Pub/Sub**: Required for Gmail push notifications

## Step 1: Set Up Google Cloud Pub/Sub

Gmail push notifications require Google Cloud Pub/Sub. Follow these steps:

### 1.1 Create a Pub/Sub Topic

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **Pub/Sub** > **Topics**
3. Click **Create Topic**
4. Name it `gmail-notifications` (or any name you prefer)
5. Click **Create**

### 1.2 Create a Subscription

1. In the topic page, click **Create Subscription**
2. Name it `gmail-webhook-subscription`
3. Choose **Push** delivery type
4. Set the **Endpoint URL** to: `https://yourdomain.com/api/webhooks/gmail`
   - Replace `yourdomain.com` with your actual domain
   - For local development with ngrok: `https://your-ngrok-url.ngrok-free.dev/api/webhooks/gmail`
5. Click **Create**

### 1.3 Grant Gmail API Access

1. Go to **IAM & Admin** > **Service Accounts**
2. Find or create a service account for Gmail API
3. Grant it the `pubsub.topics.publish` permission on your topic

### 1.4 Get Topic Name

Copy the full topic name in the format:
```
projects/YOUR_PROJECT_ID/topics/gmail-notifications
```

## Step 2: Configure Environment Variables

Add the Pub/Sub topic name to your `.env` file:

```env
GMAIL_PUBSUB_TOPIC=projects/YOUR_PROJECT_ID/topics/gmail-notifications
```

## Step 3: Enable Gmail Watch

Once Pub/Sub is set up, enable Gmail push notifications:

### Option A: Via API

Make a POST request to:
```
POST /api/integrations/gmail/watch
```

This will set up Gmail to send push notifications to your webhook.

### Option B: Via UI (Recommended)

Add a button in the Gmail connect page to enable webhooks (coming soon).

## Step 4: Verify Webhook

Gmail will send a verification request to your webhook endpoint. The endpoint automatically handles verification by returning the challenge token.

## How It Works

### Webhook Flow

1. **Customer sends email** → Gmail receives it
2. **Gmail sends push notification** → Webhook endpoint receives notification
3. **Webhook processes email**:
   - Fetches the email content
   - Extracts sender, subject, and body
   - Searches knowledge base for relevant information
   - Generates AI-powered reply using Bedrock
4. **Reply is sent** → Customer receives automated response
5. **Email is marked as read** → Prevents duplicate processing

### Email Processing Logic

- Only processes emails from external senders (not same domain)
- Uses knowledge base to find relevant answers
- Generates contextual replies using AI
- Maintains email threading (replies are properly threaded)
- Logs all sent emails for tracking

## Monitoring

Check logs for:
- Webhook notifications received
- Emails processed
- Replies sent
- Any errors during processing

## Troubleshooting

### Webhook Not Receiving Notifications

1. Verify Pub/Sub topic exists and is configured correctly
2. Check that Gmail watch is active (watch expires after 7 days)
3. Verify webhook URL is accessible (not behind firewall)
4. Check Google Cloud Console logs for Pub/Sub errors

### Replies Not Being Sent

1. Verify Gmail integration is connected
2. Check that store has active knowledge base content
3. Review error logs for specific issues
4. Ensure Bedrock API credentials are configured

### Watch Expired

Gmail watch requests expire after 7 days. You need to renew them:
- Call `/api/integrations/gmail/watch` again
- Or set up a cron job to renew automatically

## Security

- Webhook endpoint verifies Gmail notifications
- Only processes emails for authenticated users
- Validates store ownership before processing
- Logs all actions for audit trail

## Limitations

- Gmail watch expires after 7 days (needs renewal)
- Only processes unread emails in inbox
- Requires active knowledge base for quality replies
- May have rate limits from Gmail API

## Next Steps

- Set up automatic watch renewal (cron job)
- Add email filtering rules (only reply to certain senders)
- Implement reply templates
- Add analytics dashboard for email metrics
