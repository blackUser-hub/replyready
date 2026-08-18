import { appendCookies, getOutlookSession, outlookConfigured, sameOrigin } from "../_lib";

type DeltaMessage = {
  id: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  isRead?: boolean;
  from?: { emailAddress?: { name?: string; address?: string } };
  "@removed"?: { reason?: string };
};

type DeltaResponse = {
  value?: DeltaMessage[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
};

function safeDeltaUrl(value: string) {
  if (value.length > 12_000) return false;
  try {
    const url = new URL(value);
    return (
      url.origin === "https://graph.microsoft.com" &&
      /^\/v1\.0\/me\/mailFolders(?:\/[^/]+|\([^)]{1,400}\))\/messages\/delta$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function initialDeltaUrl() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta");
  url.searchParams.set("$select", "id,subject,from,receivedDateTime,bodyPreview,isRead");
  url.searchParams.set("$filter", `receivedDateTime ge ${since}`);
  url.searchParams.set("$orderby", "receivedDateTime desc");
  return url.toString();
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  if (!outlookConfigured()) return Response.json({ error: "Outlook is not configured." }, { status: 503 });
  const payload = (await request.json().catch(() => ({}))) as { deltaLink?: string | null };
  if (payload.deltaLink && !safeDeltaUrl(payload.deltaLink)) {
    return Response.json({ error: "Invalid Outlook sync cursor." }, { status: 400 });
  }

  const session = await getOutlookSession(request);
  if (!session) return Response.json({ error: "Connect Outlook first." }, { status: 401 });

  let nextUrl: string | undefined = payload.deltaLink || initialDeltaUrl();
  let cursor: string | null = null;
  let complete = false;
  const changes: DeltaMessage[] = [];

  for (let page = 0; page < 6 && nextUrl; page += 1) {
    if (!safeDeltaUrl(nextUrl)) {
      return Response.json({ error: "Microsoft returned an invalid sync cursor." }, { status: 502 });
    }
    const graphResponse = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Prefer: "odata.maxpagesize=50",
      },
    });
    if (!graphResponse.ok) {
      return Response.json({ error: "Outlook could not synchronize the inbox." }, { status: graphResponse.status });
    }
    const pagePayload = (await graphResponse.json()) as DeltaResponse;
    changes.push(...(pagePayload.value || []));
    if (pagePayload["@odata.deltaLink"]) {
      cursor = pagePayload["@odata.deltaLink"]!;
      complete = true;
      nextUrl = undefined;
    } else {
      nextUrl = pagePayload["@odata.nextLink"];
      cursor = nextUrl || null;
    }
  }

  const response = Response.json({
    changes: changes.map((message) => ({
      id: message.id,
      removed: Boolean(message["@removed"]),
      subject: message.subject || "(No subject)",
      preview: message.bodyPreview || "",
      receivedAt: message.receivedDateTime || "",
      isRead: Boolean(message.isRead),
      from: {
        name: message.from?.emailAddress?.name || "Unknown sender",
        address: message.from?.emailAddress?.address || "",
      },
    })),
    deltaLink: cursor,
    complete,
    syncedAt: new Date().toISOString(),
  });
  return appendCookies(response, session.setCookies);
}
