Business & Productivity

# ReplyReady

ReplyReady turns the difficult email you have been avoiding into three clear, ready-to-send replies. Instead of offering one polished phrasing, it helps with the actual decision: hold your position, reduce the scope, or meet in the middle.

## The product

- Paste one uncomfortable email.
- Generate three materially different negotiation strategies in one call.
- Switch between warmer, neutral, and firmer tones; all drafts rewrite together.
- Edit any draft directly and copy it when it feels right.
- No account, mailbox integration, history, or database.

The app includes a deterministic preview engine so the complete interaction works without credentials. Add an OpenAI-compatible API key to use live model-generated drafts.

## Local setup

Requirements: Node.js 22.13 or newer.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` in `.env.local` for live AI. `AI_MODEL` and `AI_API_URL` are optional, which makes the server route compatible with providers that expose the OpenAI chat-completions shape.

## Demo flow

1. Open the app with the sample 30% discount request already loaded.
2. Generate the three replies and keep their labels visible together.
3. Read “Hold firm” and “Meet halfway” aloud to make the strategic difference obvious.
4. Change the tone from Neutral to Firmer and show all three cards rewriting in place.
5. Edit one sentence, copy the selected reply, and finish on the three-way choice.

## Scope

ReplyReady intentionally handles paste-in, copy-out email decisions only. It does not connect to an inbox, retain messages, manage threads, or require sign-in.
