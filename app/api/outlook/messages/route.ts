import { appendCookies, graphRequest, outlookConfigured } from "../_lib";

type GraphMessage = {
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  receivedDateTime?: string;
  isRead?: boolean;
  from?: { emailAddress?: { name?: string; address?: string } };
};

function messageShape(message: GraphMessage) {
  return {
    id: message.id,
    subject: message.subject || "(No subject)",
    preview: message.bodyPreview || "",
    body: message.body?.content || "",
    receivedAt: message.receivedDateTime || "",
    isRead: Boolean(message.isRead),
    from: {
      name: message.from?.emailAddress?.name || "Unknown sender",
      address: message.from?.emailAddress?.address || "",
    },
  };
}

export async function GET(request: Request) {
  if (!outlookConfigured()) return Response.json({ error: "Outlook is not configured." }, { status: 503 });
  const id = new URL(request.url).searchParams.get("id");
  const path = id
    ? `/me/messages/${encodeURIComponent(id)}?$select=id,subject,from,receivedDateTime,body,bodyPreview,isRead`
    : "/me/mailFolders/inbox/messages?$top=12&$orderby=receivedDateTime%20desc&$select=id,subject,from,receivedDateTime,bodyPreview,isRead";
  const graph = await graphRequest(request, path, {
    headers: id ? { Prefer: 'outlook.body-content-type="text"' } : undefined,
  });
  if (!graph) return Response.json({ error: "Connect Outlook first." }, { status: 401 });
  if (!graph.response.ok) return Response.json({ error: "Outlook could not load this mailbox." }, { status: graph.response.status });
  const payload = (await graph.response.json()) as GraphMessage | { value?: GraphMessage[] };
  const response = id
    ? Response.json({ message: messageShape(payload as GraphMessage) })
    : Response.json({ messages: ((payload as { value?: GraphMessage[] }).value || []).map(messageShape) });
  return appendCookies(response, graph.setCookies);
}
