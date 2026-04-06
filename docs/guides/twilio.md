# Twilio Integration

HeySummon can call your experts by phone when a new help request comes in. Instead of a Telegram or chat notification, your expert's phone will ring — they hear the request read aloud and can respond verbally. That response is transcribed and delivered back to the consumer.

This is the **phone-first** feature, powered by Twilio Voice.

---

## What you'll need

- A [Twilio account](https://www.twilio.com/try-twilio) (free trial works for testing)
- A Twilio phone number with Voice capability
- Your **Account SID** and **Auth Token** from the Twilio Console

---

## Step 1 — Create a Twilio account

Go to [twilio.com/try-twilio](https://www.twilio.com/try-twilio) and sign up.

A free trial gives you a $15 credit and a test phone number. You will need to verify your own phone number during signup.

---

## Step 2 — Find your Account SID and Auth Token

> **Note:** These credentials are on the **project dashboard**, not in User Settings. If you're on the User Settings page, click **Twilio Home** in the top-left to go back to the dashboard first.

1. Go to [console.twilio.com](https://console.twilio.com). Make sure you're on the main **Account Dashboard** (the page titled with your project name, not "User Settings").

2. Scroll down to the **Account Info** section. You'll see:

   | Field | Looks like |
   |-------|-----------|
   | **Account SID** | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` — starts with `AC`, 34 characters |
   | **Auth Token** | A 32-character hex string — click the **eye icon** next to it to reveal it |

3. Copy both values — you'll paste them into HeySummon in Step 4.

> **Warning:** Your Auth Token is a secret. Never commit it to source code or share it publicly. HeySummon stores it encrypted at rest.

---

## Step 3 — Get a phone number

1. In the Twilio Console, go to **Phone Numbers → Manage → Buy a number**.
2. Filter by your country and make sure **Voice** is checked. Click **Buy** (free trial credit covers this).
3. Note the number — it will be in E.164 format, e.g. `+14155551234`. You'll enter it when configuring phone-first on an expert profile.

---

## Step 4 — Add the integration in HeySummon

1. In your HeySummon dashboard, go to **Integrations** in the sidebar.
2. Click **Set up** on the Twilio card.
3. Fill in the form:

   | Field | Value |
   |-------|-------|
   | **Display name** | A label for your own reference, e.g. `Twilio Production` |
   | **Account SID** | The `ACxxx…` value from the Twilio Console |
   | **Auth Token** | The 32-char secret from the Twilio Console |

4. Click **Connect**.

---

## Step 5 — Enable phone-first on an expert

Once the integration is saved, you can enable phone calls per expert profile:

1. Go to **Experts** → open an expert
2. Under **Phone-first**, toggle it on
3. Select your Twilio integration and enter the expert's phone number
4. Set a **timeout** — how many seconds to wait for an answer before falling back to Telegram

When a new request comes in, HeySummon will call the expert first. If they don't answer within the timeout, the normal Telegram notification fires.

---

## Troubleshooting

**Call doesn't ring**
- Check that your Twilio number has Voice capability
- Make sure the Account SID + Auth Token are correct and the integration is **Active**
- Verify the expert's phone number is in E.164 format (`+countrycode…`)

**Trial account limitations**
- Twilio free trial can only call verified numbers. [Verify your expert's number](https://console.twilio.com/us1/develop/phone-numbers/manage/verified) in the Twilio Console, or upgrade to a paid account.

**Call connects but no audio**
- Ensure your HeySummon instance is reachable from the public internet — Twilio needs to reach your webhook URL to get TwiML instructions.

---

Need help? Open an issue or reach out via the HeySummon community.
