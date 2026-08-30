Business & Productivity

# ReplyReady

ReplyReady helps with the email you keep postponing: paste the message, choose a tone, and get three editable ways to respond.

[Live application](https://replyready-email.vercel.app) · [Video walkthrough](./media/replyready-presentation.mp4)

## Frequently asked questions

### Does it send the reply?

No. It creates a draft and leaves the final decision with the user. Nothing is sent automatically.

### Why are there three versions?

They are different positions, not cosmetic rewrites:

- **Hold firm** protects the current price and scope.
- **Reduce scope** matches a smaller budget with less work.
- **Meet halfway** offers a controlled concession.

### Can I change the tone?

Yes. Warmer, neutral, and firmer controls adjust all three drafts. The selected reply remains directly editable.

### Is Outlook required?

No. A message can be pasted manually. Outlook connection is presented as an optional workflow, not a requirement for the core demo.

### How do I run it locally?

```bash
npm install
npm run dev
```

Open the local address printed by Vite. Use the sample email, generate replies, switch between the three positions, and copy the one that fits.

### What is under the hood?

React and TypeScript provide the editor and draft workflow. The production API can use a text model, while a deterministic fallback keeps the interface demonstrable when no provider key is configured.

### What does the project intentionally avoid?

ReplyReady does not impersonate the user, auto-send mail, or hide the generated text behind a one-click action. It is a drafting tool: the user reads, changes, and approves every response.
