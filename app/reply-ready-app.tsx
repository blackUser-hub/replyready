"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Tone = "warmer" | "neutral" | "firmer";
type StrategyKind = "hold_firm" | "smaller_scope" | "meet_middle";

type Draft = {
  kind: StrategyKind;
  label: string;
  stance: string;
  body: string;
};

type OutlookStatus = {
  loading: boolean;
  configured: boolean;
  connected: boolean;
  user?: { name: string; email: string };
};

type OutlookMessage = {
  id: string;
  subject: string;
  preview: string;
  body?: string;
  receivedAt: string;
  isRead: boolean;
  from: { name: string; address: string };
};

type CrmStage = "new" | "needs_reply" | "draft_ready" | "done";
type CrmFilter = "all" | "unread" | "priority";
type AuthMode = "signup" | "login";

type CrmRecord = OutlookMessage & {
  stage: CrmStage;
  priority: boolean;
  note: string;
};

type CrmChange = OutlookMessage & { removed: boolean };

const crmStages: Array<{ id: CrmStage; label: string; hint: string }> = [
  { id: "new", label: "New", hint: "Just arrived" },
  { id: "needs_reply", label: "Needs reply", hint: "Decision needed" },
  { id: "draft_ready", label: "Draft ready", hint: "Waiting for review" },
  { id: "done", label: "Done", hint: "Handled" },
];

const previewCrmRecords: CrmRecord[] = [
  {
    id: "preview-1",
    subject: "Can we revisit the project fee?",
    preview: "The revised budget is lower than expected, but we would like to keep the launch date…",
    receivedAt: "2026-08-11T08:42:00.000Z",
    isRead: false,
    from: { name: "Morgan Lee", address: "morgan@example.com" },
    stage: "new",
    priority: true,
    note: "30% discount request",
  },
  {
    id: "preview-2",
    subject: "One more round of revisions",
    preview: "The team has a few additional changes that were not included in the original brief…",
    receivedAt: "2026-08-10T16:15:00.000Z",
    isRead: true,
    from: { name: "Nora Bennett", address: "nora@example.com" },
    stage: "needs_reply",
    priority: false,
    note: "Check original scope",
  },
  {
    id: "preview-3",
    subject: "Re: updated delivery timeline",
    preview: "Thanks for explaining the delay. Please send the adjusted milestones when they are ready…",
    receivedAt: "2026-08-09T11:24:00.000Z",
    isRead: true,
    from: { name: "Caleb Wright", address: "caleb@example.com" },
    stage: "draft_ready",
    priority: false,
    note: "Draft reviewed",
  },
  {
    id: "preview-4",
    subject: "Contract extension confirmed",
    preview: "Everything looks good from our side. We are happy to proceed with the extension…",
    receivedAt: "2026-08-08T09:05:00.000Z",
    isRead: true,
    from: { name: "Priya Shah", address: "priya@example.com" },
    stage: "done",
    priority: false,
    note: "Closed",
  },
];

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
  const [outlook, setOutlook] = useState<OutlookStatus>({
    loading: true,
    configured: false,
    connected: false,
  });
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [messages, setMessages] = useState<OutlookMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<OutlookMessage | null>(null);
  const [outlookNotice, setOutlookNotice] = useState("");
  const [authModal, setAuthModal] = useState<AuthMode | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState<StrategyKind | null>(null);
  const [savedDraft, setSavedDraft] = useState<StrategyKind | null>(null);
  const [crmRecords, setCrmRecords] = useState<CrmRecord[]>([]);
  const [previewRecords, setPreviewRecords] = useState<CrmRecord[]>(previewCrmRecords);
  const [crmLoaded, setCrmLoaded] = useState(false);
  const [crmSearch, setCrmSearch] = useState("");
  const [crmFilter, setCrmFilter] = useState<CrmFilter>("all");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [crmSyncing, setCrmSyncing] = useState(false);
  const deltaLinkRef = useRef<string | null>(null);
  const syncingRef = useRef(false);

  const wordCount = useMemo(
    () => email.trim().split(/\s+/).filter(Boolean).length,
    [email],
  );

  const activeCrmRecords = outlook.connected ? crmRecords : previewRecords;
  const visibleCrmRecords = useMemo(() => {
    const query = crmSearch.trim().toLowerCase();
    return activeCrmRecords.filter((record) => {
      const matchesQuery =
        !query ||
        `${record.from.name} ${record.from.address} ${record.subject} ${record.preview} ${record.note}`
          .toLowerCase()
          .includes(query);
      const matchesFilter =
        crmFilter === "all" ||
        (crmFilter === "unread" && !record.isRead) ||
        (crmFilter === "priority" && record.priority);
      return matchesQuery && matchesFilter;
    });
  }, [activeCrmRecords, crmFilter, crmSearch]);

  const unreadCount = activeCrmRecords.filter((record) => !record.isRead).length;
  const waitingCount = activeCrmRecords.filter((record) => record.stage === "needs_reply").length;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackNotice = params.get("outlook") === "connected"
      ? "Outlook connected. Choose an email from your inbox."
      : params.has("outlook_error")
        ? "Microsoft sign-in was not completed. Please try again."
        : "";
    const noticeTimer = callbackNotice
      ? window.setTimeout(() => setOutlookNotice(callbackNotice), 0)
      : null;
    if (params.has("outlook") || params.has("outlook_error")) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    void fetch("/api/outlook/status")
      .then(async (response) => {
        const payload = (await response.json()) as Omit<OutlookStatus, "loading">;
        setOutlook({ loading: false, ...payload });
      })
      .catch(() => setOutlook({ loading: false, configured: false, connected: false }));

    return () => {
      if (noticeTimer !== null) window.clearTimeout(noticeTimer);
    };
  }, []);

  useEffect(() => {
    function closeOverlays(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setAuthModal(null);
      setAccountMenuOpen(false);
    }

    window.addEventListener("keydown", closeOverlays);
    return () => window.removeEventListener("keydown", closeOverlays);
  }, []);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try {
        const savedRecords = window.localStorage.getItem("replyready.crm.records.v1");
        const savedDelta = window.localStorage.getItem("replyready.crm.delta.v1");
        const savedSync = window.localStorage.getItem("replyready.crm.last-sync.v1");
        if (savedRecords) setCrmRecords(JSON.parse(savedRecords) as CrmRecord[]);
        if (savedDelta) deltaLinkRef.current = savedDelta;
        if (savedSync) setLastSync(savedSync);
      } catch {
        window.localStorage.removeItem("replyready.crm.records.v1");
        window.localStorage.removeItem("replyready.crm.delta.v1");
      } finally {
        setCrmLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!crmLoaded) return;
    window.localStorage.setItem("replyready.crm.records.v1", JSON.stringify(crmRecords));
  }, [crmLoaded, crmRecords]);

  const syncCrm = useCallback(async () => {
    if (!outlook.connected || syncingRef.current) return;
    syncingRef.current = true;
    setCrmSyncing(true);
    try {
      const response = await fetch("/api/outlook/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deltaLink: deltaLinkRef.current }),
      });
      const payload = (await response.json()) as {
        changes?: CrmChange[];
        deltaLink?: string | null;
        syncedAt?: string;
        error?: string;
      };
      if (!response.ok || !payload.changes) throw new Error(payload.error || "Outlook sync failed.");

      setCrmRecords((current) => {
        const records = new Map(current.map((record) => [record.id, record]));
        for (const change of payload.changes || []) {
          if (change.removed) {
            records.delete(change.id);
            continue;
          }
          const existing = records.get(change.id);
          records.set(change.id, {
            ...change,
            stage: existing?.stage || (change.isRead ? "needs_reply" : "new"),
            priority: existing?.priority || false,
            note: existing?.note || "",
          });
        }
        return [...records.values()].sort(
          (first, second) => Date.parse(second.receivedAt || "0") - Date.parse(first.receivedAt || "0"),
        );
      });

      if (payload.deltaLink) {
        deltaLinkRef.current = payload.deltaLink;
        window.localStorage.setItem("replyready.crm.delta.v1", payload.deltaLink);
      }
      if (payload.syncedAt) {
        setLastSync(payload.syncedAt);
        window.localStorage.setItem("replyready.crm.last-sync.v1", payload.syncedAt);
      }
    } catch (syncError) {
      setOutlookNotice(syncError instanceof Error ? syncError.message : "Outlook sync failed.");
    } finally {
      syncingRef.current = false;
      setCrmSyncing(false);
    }
  }, [outlook.connected]);

  useEffect(() => {
    if (!outlook.connected) return;
    void syncCrm();
    const interval = window.setInterval(() => void syncCrm(), 30_000);
    return () => window.clearInterval(interval);
  }, [outlook.connected, syncCrm]);

  function updateCrmRecord(id: string, values: Partial<Pick<CrmRecord, "stage" | "priority" | "note">>) {
    const update = (records: CrmRecord[]) =>
      records.map((record) => (record.id === id ? { ...record, ...values } : record));
    if (outlook.connected) setCrmRecords(update);
    else setPreviewRecords(update);
  }

  async function openCrmRecord(record: CrmRecord) {
    if (outlook.connected) {
      await selectOutlookMessage(record);
    } else {
      const sender = record.from.address
        ? `${record.from.name} <${record.from.address}>`
        : record.from.name;
      setEmail(`From: ${sender}\nSubject: ${record.subject}\n\n${record.preview}`);
      setSelectedMessage(null);
      setOutlookNotice("Preview email loaded. Connect Outlook to create a real linked draft.");
    }
    updateCrmRecord(record.id, { stage: "needs_reply" });
    window.setTimeout(
      () => document.getElementById("reply-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  }

  async function loadInbox() {
    if (inboxOpen) {
      setInboxOpen(false);
      return;
    }
    setInboxOpen(true);
    if (messages.length) return;
    setInboxLoading(true);
    setOutlookNotice("");
    try {
      const response = await fetch("/api/outlook/messages");
      const payload = (await response.json()) as { messages?: OutlookMessage[]; error?: string };
      if (!response.ok || !payload.messages) throw new Error(payload.error || "Could not load your inbox.");
      setMessages(payload.messages);
    } catch (inboxError) {
      setOutlookNotice(inboxError instanceof Error ? inboxError.message : "Could not load your inbox.");
    } finally {
      setInboxLoading(false);
    }
  }

  async function selectOutlookMessage(message: OutlookMessage) {
    setInboxLoading(true);
    setOutlookNotice("");
    try {
      const response = await fetch(`/api/outlook/messages?id=${encodeURIComponent(message.id)}`);
      const payload = (await response.json()) as { message?: OutlookMessage; error?: string };
      if (!response.ok || !payload.message) throw new Error(payload.error || "Could not open this email.");
      const fullMessage = payload.message;
      const sender = fullMessage.from.address
        ? `${fullMessage.from.name} <${fullMessage.from.address}>`
        : fullMessage.from.name;
      setEmail(`From: ${sender}\nSubject: ${fullMessage.subject}\n\n${fullMessage.body || fullMessage.preview}`);
      setSelectedMessage(fullMessage);
      updateCrmRecord(fullMessage.id, { stage: "needs_reply" });
      setInboxOpen(false);
      setSavedDraft(null);
      setOutlookNotice(`Imported “${fullMessage.subject}” from Outlook.`);
    } catch (messageError) {
      setOutlookNotice(messageError instanceof Error ? messageError.message : "Could not open this email.");
    } finally {
      setInboxLoading(false);
    }
  }

  async function disconnectOutlook() {
    await fetch("/api/outlook/disconnect", { method: "POST" });
    setOutlook({ loading: false, configured: true, connected: false });
    setAccountMenuOpen(false);
    setMessages([]);
    setSelectedMessage(null);
    setInboxOpen(false);
    setOutlookNotice("Outlook disconnected.");
  }

  async function saveToOutlook(draft: Draft) {
    if (!selectedMessage) return;
    setSavingDraft(draft.kind);
    setSavedDraft(null);
    setOutlookNotice("");
    try {
      const response = await fetch("/api/outlook/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: selectedMessage.id, body: draft.body }),
      });
      const payload = (await response.json()) as { saved?: boolean; error?: string };
      if (!response.ok || !payload.saved) throw new Error(payload.error || "Could not save the Outlook draft.");
      setSavedDraft(draft.kind);
      updateCrmRecord(selectedMessage.id, { stage: "draft_ready" });
      setOutlookNotice("Reply saved to your Outlook Drafts. Nothing was sent.");
    } catch (draftError) {
      setOutlookNotice(draftError instanceof Error ? draftError.message : "Could not save the Outlook draft.");
    } finally {
      setSavingDraft(null);
    }
  }

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
      <section className="intro" id="top" aria-labelledby="page-title">
        <div>
          <h1 id="page-title">ReplyReady</h1>
          <p>Paste a difficult email and choose from three practical replies.</p>
        </div>
        {outlook.loading ? (
          <span className="account-loading" aria-label="Checking account" />
        ) : outlook.connected ? (
          <div className="account-control">
            <button
              type="button"
              className="account-button"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              onClick={() => setAccountMenuOpen((open) => !open)}
            >
              <span className="account-avatar" aria-hidden="true">
                {(outlook.user?.name || "R").slice(0, 1).toUpperCase()}
              </span>
              <span>{outlook.user?.name || "Outlook"}</span>
              <span className="account-chevron" aria-hidden="true">⌄</span>
            </button>
            {accountMenuOpen ? (
              <div className="account-menu" role="menu">
                <div className="account-menu-identity">
                  <strong>{outlook.user?.name || "ReplyReady account"}</strong>
                  <span>{outlook.user?.email || "Microsoft account"}</span>
                </div>
                <div className="account-menu-status">
                  <span aria-hidden="true" /> Outlook connected
                </div>
                <button type="button" role="menuitem" onClick={() => void disconnectOutlook()}>
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <button type="button" className="signup-button" onClick={() => setAuthModal("signup")}>
            Connect Outlook
          </button>
        )}
      </section>

      {authModal ? (
        <div className="auth-modal-backdrop">
          <section
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
          >
            <button
              type="button"
              className="auth-modal-close"
              aria-label="Close account dialog"
              onClick={() => setAuthModal(null)}
            >
              ×
            </button>
            <h2 id="auth-modal-title">
              {authModal === "signup" ? "Connect Outlook" : "Log in"}
            </h2>
            <p className="auth-modal-copy">
              {authModal === "signup"
                ? "Use your Microsoft account to import emails and save reply drafts."
                : "Continue with the Microsoft account connected to ReplyReady."}
            </p>

            {outlook.configured ? (
              <a className="microsoft-auth-button" href="/api/outlook/connect">
                <span className="microsoft-mark" aria-hidden="true"><i /><i /><i /><i /></span>
                Continue with Microsoft
              </a>
            ) : (
              <>
                <button type="button" className="microsoft-auth-button disabled" disabled>
                  <span className="microsoft-mark" aria-hidden="true"><i /><i /><i /><i /></span>
                  Microsoft setup required
                </button>
                <p className="auth-setup-note">
                  Add the Microsoft Entra credentials to <code>.env.local</code> and restart the local server to enable real registration.
                </p>
              </>
            )}

            <button type="button" className="demo-mode-button" onClick={() => setAuthModal(null)}>
              Continue in demo mode
            </button>
            <p className="auth-switch">
              {authModal === "signup" ? "Already registered?" : "New to ReplyReady?"}{" "}
              <button
                type="button"
                onClick={() => setAuthModal(authModal === "signup" ? "login" : "signup")}
              >
                {authModal === "signup" ? "Log in" : "Create account"}
              </button>
            </p>
            <p className="auth-privacy">ReplyReady never sends email automatically.</p>
          </section>
        </div>
      ) : null}

      <section className="crm-section" aria-label="Outlook CRM">
        <div className="crm-header">
          <div>
            <div className="crm-title-line">
              <span className="step-label">Outlook CRM</span>
              <span className={`crm-live-badge ${outlook.connected ? "live" : ""}`}>
                <span aria-hidden="true" />
                {outlook.connected ? "Live inbox" : "Preview data"}
              </span>
            </div>
            <h2>Inbox</h2>
            <p>Keep track of emails that need a reply.</p>
          </div>
          <div className="crm-summary">
            <div><strong>{activeCrmRecords.length}</strong><span>Tracked</span></div>
            <div><strong>{unreadCount}</strong><span>Unread</span></div>
            <div><strong>{waitingCount}</strong><span>Waiting</span></div>
          </div>
        </div>

        <div className="crm-toolbar">
          <label className="crm-search">
            <span className="sr-only">Search CRM emails</span>
            <span aria-hidden="true">⌕</span>
            <input
              value={crmSearch}
              onChange={(event) => setCrmSearch(event.target.value)}
              placeholder="Search sender, subject or note"
            />
          </label>
          <div className="crm-filters" role="group" aria-label="CRM filters">
            {(["all", "unread", "priority"] as CrmFilter[]).map((filter) => (
              <button
                type="button"
                key={filter}
                className={crmFilter === filter ? "active" : ""}
                aria-pressed={crmFilter === filter}
                onClick={() => setCrmFilter(filter)}
              >
                {filter[0].toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="crm-sync-button"
            disabled={!outlook.connected || crmSyncing}
            onClick={() => void syncCrm()}
          >
            <span className={crmSyncing ? "spinning" : ""} aria-hidden="true">↻</span>
            {crmSyncing ? "Syncing" : outlook.connected ? "Sync now" : "Connect for live mail"}
          </button>
        </div>

        <div className="crm-board">
          {crmStages.map((stage) => {
            const records = visibleCrmRecords.filter((record) => record.stage === stage.id);
            return (
              <div className={`crm-column stage-${stage.id}`} key={stage.id}>
                <div className="crm-column-heading">
                  <div><span className="stage-dot" aria-hidden="true" /><strong>{stage.label}</strong></div>
                  <span>{records.length}</span>
                </div>
                <p className="crm-column-hint">{stage.hint}</p>
                <div className="crm-card-list">
                  {records.length ? records.map((record) => (
                    <div
                      className={`crm-card ${record.priority ? "priority" : ""} ${selectedMessage?.id === record.id ? "selected" : ""}`}
                      key={record.id}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest("button, input, select")) return;
                        void openCrmRecord(record);
                      }}
                      onKeyDown={(event) => {
                        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          void openCrmRecord(record);
                        }
                      }}
                    >
                      <div className="crm-card-top">
                        <span className={`crm-avatar ${record.isRead ? "read" : ""}`}>
                          {record.from.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <strong>{record.from.name}</strong>
                          <small>{record.from.address}</small>
                        </div>
                        <button
                          type="button"
                          className={record.priority ? "priority-active" : ""}
                          aria-label={record.priority ? "Remove priority" : "Mark as priority"}
                          onClick={(event) => {
                            event.stopPropagation();
                            updateCrmRecord(record.id, { priority: !record.priority });
                          }}
                        >
                          {record.priority ? "★" : "☆"}
                        </button>
                      </div>
                      <h3>{record.subject}</h3>
                      <p>{record.preview}</p>
                      <div className="crm-card-fields">
                        <select
                          aria-label={`Stage for ${record.subject}`}
                          value={record.stage}
                          onChange={(event) => updateCrmRecord(record.id, { stage: event.target.value as CrmStage })}
                        >
                          {crmStages.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
                        </select>
                        <input
                          aria-label={`Note for ${record.subject}`}
                          value={record.note}
                          onChange={(event) => updateCrmRecord(record.id, { note: event.target.value })}
                          placeholder="Add note"
                        />
                      </div>
                      <div className="crm-card-footer">
                        <time dateTime={record.receivedAt}>
                          {record.receivedAt
                            ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(record.receivedAt))
                            : ""}
                        </time>
                        <span>Open in ReplyReady →</span>
                      </div>
                    </div>
                  )) : (
                    <div className="crm-empty">No emails here</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="crm-footnote">
          <span>{outlook.connected ? "Outlook checks automatically every 30 seconds" : "Preview CRM — connect Outlook below for live email"}</span>
          <span>{lastSync ? `Last synced ${new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date(lastSync))}` : "CRM fields stay on this device"}</span>
        </div>
      </section>

      <section className="workspace" id="reply-workspace" aria-label="Reply generator">
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

          <section className={`outlook-connector ${outlook.connected ? "connected" : ""}`} aria-label="Outlook connection">
            <div className="outlook-connector-row">
              <div className="outlook-identity">
                <span className="outlook-mark" aria-hidden="true">O</span>
                <div>
                  <strong>{outlook.connected ? outlook.user?.name || "Outlook connected" : "Bring in an Outlook email"}</strong>
                  <span>
                    {outlook.loading
                      ? "Checking connection…"
                      : outlook.connected
                        ? outlook.user?.email || "Microsoft Graph connected"
                        : "Import one message, save one reply draft"}
                  </span>
                </div>
              </div>
              <div className="outlook-actions">
                {outlook.loading ? null : outlook.connected ? (
                  <>
                    <button type="button" className="connector-button primary" onClick={() => void loadInbox()}>
                      {inboxOpen ? "Close inbox" : "Open inbox"}
                    </button>
                    <button type="button" className="connector-button quiet" onClick={() => void disconnectOutlook()}>
                      Disconnect
                    </button>
                  </>
                ) : outlook.configured ? (
                  <a className="connector-button primary" href="/api/outlook/connect">Connect Outlook</a>
                ) : (
                  <button
                    type="button"
                    className="connector-button primary"
                    onClick={() => setOutlookNotice("Add your Microsoft Entra credentials to .env.local, then restart the local server.")}
                  >
                    Set up Outlook
                  </button>
                )}
              </div>
            </div>

            {outlookNotice ? <p className="outlook-notice" role="status">{outlookNotice}</p> : null}

            {inboxOpen ? (
              <div className="inbox-popover">
                <div className="inbox-title">
                  <span>Recent inbox</span>
                  <span>Choose one email</span>
                </div>
                {inboxLoading ? (
                  <div className="inbox-loading">Loading Outlook…</div>
                ) : messages.length ? (
                  <div className="message-list">
                    {messages.map((message) => (
                      <button key={message.id} type="button" onClick={() => void selectOutlookMessage(message)}>
                        <span className={`message-unread ${message.isRead ? "read" : ""}`} aria-hidden="true" />
                        <span className="message-main">
                          <strong>{message.from.name}</strong>
                          <span>{message.subject}</span>
                          <small>{message.preview}</small>
                        </span>
                        <time dateTime={message.receivedAt}>
                          {message.receivedAt
                            ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(message.receivedAt))
                            : ""}
                        </time>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="inbox-loading">Your inbox is empty.</div>
                )}
              </div>
            ) : null}
          </section>

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
            <span>{selectedMessage ? "Imported from Outlook" : "Your text is not saved"}</span>
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
              <span className="step-label">Replies</span>
              <h2>Choose an approach</h2>
            </div>
            <span className="engine-badge">
              {engine === "ai" ? "Generated" : "Preview"}
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
                  <div className="card-button-group">
                    {outlook.connected && selectedMessage ? (
                      <button
                        type="button"
                        className="save-outlook-button"
                        disabled={savingDraft !== null}
                        onClick={() => void saveToOutlook(draft)}
                      >
                        {savingDraft === draft.kind
                          ? "Saving…"
                          : savedDraft === draft.kind
                            ? "Saved ✓"
                            : "Save draft"}
                      </button>
                    ) : null}
                    <button type="button" onClick={() => void copyDraft(draft)}>
                      {copied === draft.kind ? "Copied ✓" : "Copy reply"}
                    </button>
                  </div>
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

      <footer>ReplyReady · 2026</footer>
    </main>
  );
}
