"use client";

import { useMemo, useState } from "react";

type Tone = "warmer" | "neutral" | "firmer";
type StrategyKind = "hold_firm" | "smaller_scope" | "meet_middle";

type Draft = {
  kind: StrategyKind;
  label: string;
  stance: string;
  body: string;
};

const sampleEmail = `Hi Alex,

We reviewed the proposal again and need to bring the total down by 30%. Since the project is already underway, we were hoping you could keep the full scope and absorb the difference. We see this as a long-term partnership and there should be more work later in the year.

Could you confirm the new price by tomorrow so we can keep the current launch date?

Best,
Morgan`;

const initialDrafts: Draft[] = [
  {
    kind: "hold_firm",
    label: "Hold firm",
    stance: "Protect the agreed price and scope",
    body: `Hi Morgan,

Thanks for being direct about the budget. I’m not able to reduce the fee by 30% while keeping the agreed scope and launch date. The current price reflects the work already underway and the resources reserved to deliver it well.

I’m happy to continue with the original agreement and timeline. If the budget has changed, I can outline a smaller scope as a separate option.

Best,
Alex`,
  },
  {
    kind: "smaller_scope",
    label: "Reduce scope",
    stance: "Match the budget by changing the work",
    body: `Hi Morgan,

Thanks for the context. We can get closer to the revised budget, but we’ll need to adjust the scope so the project remains viable.

I suggest keeping the core launch deliverables and moving the secondary features into a later phase. I can send a revised scope showing exactly what stays, what moves, and the updated price by tomorrow.

Best,
Alex`,
  },
  {
    kind: "meet_middle",
    label: "Meet halfway",
    stance: "Share the concession with clear terms",
    body: `Hi Morgan,

I value the partnership and want to find a workable path. I can offer a 12% reduction if we keep the current scope, with the remaining balance split across two payment dates.

That lets us protect the launch date and quality without reopening work already in progress. If that works for you, I’ll send the revised schedule tomorrow.

Best,
Alex`,
  },
];

const strategyNumbers: Record<StrategyKind, string> = {
  hold_firm: "01",
  smaller_scope: "02",
  meet_middle: "03",
};

export function ReplyReadyApp() {
  const [email, setEmail] = useState(sampleEmail);
  const [tone, setTone] = useState<Tone>("neutral");
  const [drafts, setDrafts] = useState<Draft[]>(initialDrafts);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState<StrategyKind | null>(null);
  const [engine, setEngine] = useState<"preview" | "ai">("preview");
  const [error, setError] = useState("");

  const wordCount = useMemo(
    () => email.trim().split(/\s+/).filter(Boolean).length,
    [email],
  );

  async function generateDrafts(nextTone: Tone = tone) {
    if (email.trim().length < 30 || isGenerating) return;

    setIsGenerating(true);
    setError("");
    setCopied(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), tone: nextTone }),
      });
      const payload = (await response.json()) as {
        drafts?: Draft[];
        mode?: "preview" | "ai";
        error?: string;
      };

      if (!response.ok || !payload.drafts) {
        throw new Error(payload.error || "We couldn’t create the drafts.");
      }

      setDrafts(payload.drafts);
      setEngine(payload.mode === "ai" ? "ai" : "preview");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "We couldn’t create the drafts.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function changeTone(nextTone: Tone) {
    if (nextTone === tone) return;
    setTone(nextTone);
    void generateDrafts(nextTone);
  }

  function updateDraft(kind: StrategyKind, body: string) {
    setDrafts((current) =>
      current.map((draft) => (draft.kind === kind ? { ...draft, body } : draft)),
    );
  }

  async function copyDraft(draft: Draft) {
    await navigator.clipboard.writeText(draft.body);
    setCopied(draft.kind);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="ReplyReady home">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>ReplyReady</span>
        </a>
        <div className="topbar-note">
          <span className="status-dot" aria-hidden="true" />
          Decision support for difficult emails
        </div>
      </header>

      <section className="hero" id="top">
        <p className="eyebrow">Stop staring at the reply box</p>
        <h1>Three ways forward.<br /><em>None of them blank.</em></h1>
        <p className="hero-copy">
          Paste the email you have been avoiding. Get three ready-to-send replies,
          each taking a clear and genuinely different position.
        </p>
      </section>

      <section className="workspace" aria-label="Reply generator">
        <div className="composer-panel">
          <div className="panel-heading">
            <div>
              <span className="step-label">Incoming</span>
              <h2>The difficult email</h2>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() => setEmail(sampleEmail)}
            >
              Use sample
            </button>
          </div>

          <label className="sr-only" htmlFor="incoming-email">
            Paste the email you need to answer
          </label>
          <textarea
            id="incoming-email"
            className="email-input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Paste the email you need to answer…"
            spellCheck="true"
          />

          <div className="composer-meta">
            <span>{wordCount} words</span>
            <span>Your text is not saved</span>
          </div>

          <div className="tone-section">
            <div>
              <span className="field-label">Response tone</span>
              <span className="field-help">All three drafts adapt</span>
            </div>
            <div className="tone-control" role="group" aria-label="Response tone">
              {(["warmer", "neutral", "firmer"] as Tone[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={tone === option ? "active" : ""}
                  aria-pressed={tone === option}
                  onClick={() => changeTone(option)}
                >
                  {option[0].toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <button
            className="generate-button"
            type="button"
            disabled={email.trim().length < 30 || isGenerating}
            onClick={() => void generateDrafts()}
          >
            <span>{isGenerating ? "Finding three ways forward…" : "Generate three replies"}</span>
            <span className="button-arrow" aria-hidden="true">↗</span>
          </button>

          {error ? <p className="error-message" role="alert">{error}</p> : null}
        </div>

        <div className="results-panel">
          <div className="results-heading">
            <div>
              <span className="step-label">Ready to send</span>
              <h2>Choose your position</h2>
            </div>
            <span className="engine-badge">
              <span aria-hidden="true">✦</span>
              {engine === "ai" ? "AI generated" : "Preview engine"}
            </span>
          </div>

          <div className="draft-grid" aria-live="polite" aria-busy={isGenerating}>
            {drafts.map((draft) => (
              <article className={`draft-card ${draft.kind}`} key={draft.kind}>
                <div className="card-topline">
                  <span className="strategy-number">{strategyNumbers[draft.kind]}</span>
                  <span className="tone-pill">{tone}</span>
                </div>
                <h3>{draft.label}</h3>
                <p className="stance">{draft.stance}</p>
                <label className="sr-only" htmlFor={`draft-${draft.kind}`}>
                  Edit {draft.label} reply
                </label>
                <textarea
                  id={`draft-${draft.kind}`}
                  className="draft-body"
                  value={draft.body}
                  onChange={(event) => updateDraft(draft.kind, event.target.value)}
                  spellCheck="true"
                />
                <div className="card-actions">
                  <span>{draft.body.trim().split(/\s+/).length} words</span>
                  <button type="button" onClick={() => void copyDraft(draft)}>
                    {copied === draft.kind ? "Copied ✓" : "Copy reply"}
                  </button>
                </div>
                {isGenerating ? (
                  <div className="card-loading" aria-hidden="true">
                    <span /><span /><span /><span />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          <p className="edit-note">Every draft is editable. Make it yours before you send.</p>
        </div>
      </section>

      <footer>
        <span>ReplyReady © 2026</span>
        <span>One email in. Three clear decisions out.</span>
      </footer>
    </main>
  );
}
