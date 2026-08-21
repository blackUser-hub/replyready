Business & Productivity

# ReplyReady

ReplyReady turns the difficult email you have been avoiding into three clear, ready-to-send replies. Instead of offering one polished phrasing, it helps with the actual decision: hold your position, reduce the scope, or meet in the middle.

## The product

- Paste one uncomfortable email.
- Generate three materially different negotiation strategies in one call.
- Switch between warmer, neutral, and firmer tones; all drafts rewrite together.
- Edit any draft directly and copy it when it feels right.
- Optionally connect Outlook, import one inbox message, and save a selected reply to Drafts.
- Track incoming mail on a four-stage CRM board that refreshes every 30 seconds.
- Register or log in with Microsoft; the same secure sign-in connects Outlook to the CRM.
- No automatic sending, message history, or database.

The app includes a deterministic preview engine so the complete interaction works without credentials. Add an OpenAI-compatible API key to use live model-generated drafts.

## Local setup

Requirements: Node.js 22.13 or newer.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` in `.env.local` for live AI. `AI_MODEL` and `AI_API_URL` are optional, which makes the server route compatible with providers that expose the OpenAI chat-completions shape.

## Outlook setup

Outlook is optional; paste-in and copy-out continue to work without it. To enable it:

1. Create an app registration in Microsoft Entra ID that supports the account types you need.
2. Add the Web redirect URI `http://127.0.0.1:3103/api/outlook/callback`.
3. Add delegated Microsoft Graph permissions: `User.Read` and `Mail.ReadWrite`.
4. Create a client secret and set `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` in `.env.local`.
5. Set `OUTLOOK_COOKIE_SECRET` to a random value of at least 32 characters, then restart the server.

The authorization flow uses PKCE. Access and refresh tokens are encrypted into HttpOnly, SameSite cookies and are never exposed to browser JavaScript. The integration only creates a reply draft; it does not request `Mail.Send` or send messages.

## Account registration

ReplyReady uses Microsoft as its account provider. Selecting **Sign up** or **Log in** starts the same OAuth flow: a successful first sign-in creates the local ReplyReady session and connects that Microsoft mailbox. ReplyReady does not collect or store a separate password.

The registration screen remains available before Microsoft Entra credentials are configured, but its Microsoft button is disabled with a setup explanation. Users can always continue in demo mode without an account.

## Local CRM

When Outlook is connected, ReplyReady performs an initial 30-day Inbox sync and then uses Microsoft Graph delta links to fetch only additions, updates, and removals every 30 seconds. Emails appear in four stages: New, Needs reply, Draft ready, and Done.

The stage, priority flag, and note are intentionally device-local for this MVP and stay in browser storage. Outlook remains the source of truth for the actual email. A future multi-user CRM should move this workflow state into a database and use Microsoft Graph webhooks while the app is closed.

## Demo flow

1. Open the app with the sample 30% discount request already loaded.
2. Generate the three replies and keep their labels visible together.
3. Read “Hold firm” and “Meet halfway” aloud to make the strategic difference obvious.
4. Change the tone from Neutral to Firmer and show all three cards rewriting in place.
5. Edit one sentence, copy the selected reply, and finish on the three-way choice.

## Scope

ReplyReady remains paste-in and copy-out by default. Outlook is an optional delegated connection for importing one message and saving one reply draft. It does not retain messages, sync whole threads, or send email automatically.
