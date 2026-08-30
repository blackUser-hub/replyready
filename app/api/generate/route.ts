type Tone = "warmer" | "neutral" | "firmer";
type StrategyKind = "hold_firm" | "smaller_scope" | "meet_middle";

type Draft = {
  kind: StrategyKind;
  label: string;
  stance: string;
  body: string;
};

const kinds: StrategyKind[] = ["hold_firm", "smaller_scope", "meet_middle"];

function previewDrafts(tone: Tone, email: string): Draft[] {
  const lower = email.toLowerCase();
  if (lower.includes("northstar coffee") && lower.includes("$12,500")) {
    return [
      {
        kind: "hold_firm",
        label: "Hold firm",
        stance: "Keep the agreed scope and fee",
        body: `Hi Maya,\n\nThanks for sharing the approved budget. I’m not able to reduce the fee from $18,000 to $12,500 while keeping all four deliverables and the November 4 launch date. The proposal reflects the design and development time required for that scope.\n\nI can keep the original scope and schedule at $18,000, or send a phased option for the approved budget by Friday.\n\nBest,\nAlex`,
      },
      {
        kind: "smaller_scope",
        label: "Reduce scope",
        stance: "Fit phase one to the budget",
        body: `Hi Maya,\n\nThanks for the clear numbers. We can work within $12,500 if we narrow the first release.\n\nI suggest launching the product pages and checkout on November 4, then moving subscriptions and the store locator into a second phase. I can send the revised scope and timeline by Friday.\n\nBest,\nAlex`,
      },
      {
        kind: "meet_middle",
        label: "Meet halfway",
        stance: "Adjust cost and delivery together",
        body: `Hi Maya,\n\nI’d like to find a workable middle ground. I can deliver the full scope for $15,500 if we use the existing product photography and move the subscription dashboard to the week after launch.\n\nThat keeps the public November 4 launch date while reducing both cost and production time. If that works, I’ll send the revised schedule by Friday.\n\nBest,\nAlex`,
      },
    ];
  }
  const isDeadline = /deadline|late|delay|overdue|launch date/.test(lower);
  const isScope = /extra|scope|additional|another round|revision/.test(lower);
  const warmOpen = tone === "warmer" ? "Thank you for reaching out — I appreciate the candid note." : tone === "firmer" ? "Thanks for the note. I want to be clear about what we can commit to." : "Thanks for the note and for sharing the context.";
  const close = tone === "warmer" ? "I’m hopeful we can find a path that works well for both of us.\n\nWarmly,\nAlex" : tone === "firmer" ? "Let me know which of these paths you would like to proceed with.\n\nBest,\nAlex" : "Let me know what works best and I’ll confirm the next step.\n\nBest,\nAlex";

  const issue = isDeadline
    ? "the timeline"
    : isScope
      ? "the additional work"
      : "the requested change";

  return [
    {
      kind: "hold_firm",
      label: "Hold firm",
      stance: "Protect the original agreement",
      body: `Hi there,\n\n${warmOpen} I’m not able to accept ${issue} under the current terms. The original agreement reflects the time, resources, and quality required to deliver the work properly.\n\nI’m ready to continue with the agreed scope, price, and schedule. ${close}`,
    },
    {
      kind: "smaller_scope",
      label: "Reduce scope",
      stance: "Trade deliverables for flexibility",
      body: `Hi there,\n\n${warmOpen} We can accommodate ${issue}, provided we adjust what is included. I suggest keeping the highest-priority deliverables and moving the remaining items into a later phase.\n\nI can send a concise revised scope with the updated terms and impact on timing. ${close}`,
    },
    {
      kind: "meet_middle",
      label: "Meet halfway",
      stance: "Offer a measured compromise",
      body: `Hi there,\n\n${warmOpen} I’d like to find a practical middle ground. I can make a limited adjustment while protecting the core work, as long as we agree on clear boundaries and confirm them before proceeding.\n\nI’ll outline the compromise in writing so we both have a clear plan. ${close}`,
    },
  ];
}

function isDraft(value: unknown): value is Draft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return (
    kinds.includes(draft.kind as StrategyKind) &&
    typeof draft.label === "string" &&
    typeof draft.stance === "string" &&
    typeof draft.body === "string" &&
    draft.body.length > 40
  );
}

function extractJson(content: string): unknown {
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { email?: string; tone?: Tone };
    const email = payload.email?.trim() ?? "";
    const tone = payload.tone ?? "neutral";

    if (email.length < 30) {
      return Response.json({ error: "Paste a little more of the email first." }, { status: 400 });
    }
    if (email.length > 12000) {
      return Response.json({ error: "Keep the email under 12,000 characters." }, { status: 400 });
    }
    if (!["warmer", "neutral", "firmer"].includes(tone)) {
      return Response.json({ error: "Choose a valid tone." }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return Response.json({ drafts: previewDrafts(tone, email), mode: "preview" });
    }

    const endpoint = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
    const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        thinking: { type: "disabled" },
        temperature: 0.65,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are ReplyReady, a negotiation-aware email assistant. Return valid JSON with one key, "drafts", containing exactly three reply drafts in this order:
1) kind "hold_firm": politely protect the user's position.
2) kind "smaller_scope": preserve the relationship by reducing deliverables or commitment.
3) kind "meet_middle": propose a concrete, balanced compromise.
Each object must have kind, label, stance (max 8 words), and body. The strategies must differ materially, not just in wording. Match a ${tone} tone. Do not invent names, numbers, promises, dates, or facts not present in the incoming email. Use placeholders only when essential. Keep each body under 180 words and ready to send.`,
          },
          { role: "user", content: email },
        ],
        max_tokens: 1800,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI provider returned ${aiResponse.status}`);
    }

    const result = (await aiResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = result.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI provider returned an empty response");

    const parsed = extractJson(content) as { drafts?: unknown[] };
    if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 3 || !parsed.drafts.every(isDraft)) {
      throw new Error("AI provider returned an invalid draft structure");
    }

    const ordered = kinds.map((kind) => parsed.drafts!.find((draft) => (draft as Draft).kind === kind));
    if (!ordered.every(isDraft)) throw new Error("AI provider omitted a strategy");

    return Response.json({ drafts: ordered, mode: "ai" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create replies.";
    return Response.json({ error: message }, { status: 500 });
  }
}
