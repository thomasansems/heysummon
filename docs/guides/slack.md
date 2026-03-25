# Slack Integration

HeySummon can send help request notifications to a Slack channel. Your providers can reply directly from Slack using the `/reply` command, and responses are delivered back to the consumer.

---

## What you'll need

- A [Slack workspace](https://slack.com/get-started) (free plan works)
- A Slack app with a Bot token and Events API enabled
- A public URL for your HeySummon instance (for receiving Slack webhooks)

---

## Step 1 -- Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**
2. Choose **From scratch**
3. Give it a name (e.g. "HeySummon") and select your workspace
4. Click **Create App**

---

## Step 2 -- Configure Bot Permissions

1. In your app settings, go to **OAuth & Permissions**
2. Under **Bot Token Scopes**, add these scopes:
   - `chat:write` -- Send messages to channels
   - `channels:read` -- View basic channel information
3. Click **Install to Workspace** at the top of the page
4. Authorize the app when prompted
5. Copy the **Bot User OAuth Token** (starts with `xoxb-`) -- you'll need this

---

## Step 3 -- Find your Signing Secret

1. Go to **Basic Information** in your app settings
2. Under **App Credentials**, find the **Signing Secret**
3. Click **Show** and copy it -- you'll need this to verify incoming webhooks

---

## Step 4 -- Create a channel and invite the bot

1. In Slack, create a channel for HeySummon notifications (e.g. `#heysummon-requests`)
2. In the channel, type `/invite @YourBotName` to add the bot
3. Get the **Channel ID**: right-click the channel name, select **View channel details**, and copy the Channel ID shown at the bottom of the dialog

---

## Step 5 -- Add the Slack channel in HeySummon

1. Go to your HeySummon dashboard at `/dashboard/channels`
2. Click **Slack** under "Connect a channel"
3. Fill in the form:
   - **Channel Name**: A display name (e.g. "Support Slack")
   - **Bot Token**: Paste the `xoxb-...` token from Step 2
   - **Signing Secret**: Paste the signing secret from Step 3
   - **Channel ID**: Paste the channel ID from Step 4 (e.g. `C0123456789`)
4. Click **Create Channel**

HeySummon will verify your bot token and channel access. If successful, the channel status will show "connected".

After creation, you'll see the **Event Subscriptions URL** in the channel's error message field. Copy this URL -- you need it for the next step.

The URL looks like: `https://your-domain.com/api/adapters/slack/{channelId}/webhook`

---

## Step 6 -- Enable Event Subscriptions

1. Back in your Slack app settings, go to **Event Subscriptions**
2. Toggle **Enable Events** to On
3. In the **Request URL** field, paste the webhook URL from Step 5
4. Slack will send a verification challenge -- HeySummon will respond automatically
5. Once verified (green checkmark), scroll down to **Subscribe to bot events**
6. Add the `message.channels` event (and `message.groups` if using private channels)
7. Click **Save Changes**

---

## How it works

### Notifications

When a consumer submits a help request, HeySummon posts a message to your Slack channel:

```
*New help request* `HS-ABC123`

*Question:* How do I configure the database connection?

Reply with: `reply HS-ABC123 your answer`
```

### Replying

Providers reply directly in the Slack channel by typing (without a slash -- Slack intercepts `/` as built-in commands):

```
reply HS-ABC123 The database connection string is configured in the .env file...
```

HeySummon processes the reply, updates the request status to "responded", and delivers the answer to the consumer.

### Dashboard

Providers can also view and respond to requests from the HeySummon dashboard at `/dashboard`. The Slack channel status is visible in the provider settings panel.

---

## Troubleshooting

### "Invalid signature" errors

- Make sure your **Signing Secret** matches exactly (no extra spaces)
- Check that your server's clock is synchronized (Slack rejects requests with timestamps older than 5 minutes)

### Bot can't send messages

- Verify the bot has been invited to the channel (`/invite @YourBotName`)
- Check that the `chat:write` scope is added and the app is reinstalled after adding scopes

### Events not received

- Verify Event Subscriptions are enabled and the Request URL shows a green checkmark
- Make sure `message.channels` (or `message.groups` for private channels) is subscribed
- Check that your HeySummon instance is reachable from the internet

### Channel not found

- Double-check the Channel ID (it starts with `C` for public channels or `G` for private channels)
- Make sure the bot is a member of the channel

---

## Security

- All incoming Slack events are verified using HMAC-SHA256 signature validation
- Requests with timestamps older than 5 minutes are rejected (replay attack prevention)
- Bot messages and messages from other channels are ignored
- The signing secret is stored encrypted in the HeySummon database
