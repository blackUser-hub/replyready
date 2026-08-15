import { appendCookies, graphRequest, outlookConfigured, sameOrigin } from "../_lib";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  if (!outlookConfigured()) return Response.json({ error: "Outlook is not configured." }, { status: 503 });
  const payload = (await request.json()) as { messageId?: string; body?: string };
  const messageId = payload.messageId?.trim() || "";
  const body = payload.body?.trim() || "";
  if (!messageId || body.length < 10) {
    return Response.json({ error: "Choose an Outlook email and a complete reply first." }, { status: 400 });
  }
  if (body.length > 20_000) return Response.json({ error: "Keep the reply under 20,000 characters." }, { status: 400 });
  const graph = await graphRequest(
    request,
    `/me/messages/${encodeURIComponent(messageId)}/createReply`,
    { method: "POST", body: JSON.stringify({ comment: body }) },
  );
  if (!graph) return Response.json({ error: "Connect Outlook first." }, { status: 401 });
  if (!graph.response.ok) {
    return Response.json({ error: "Outlook could not create the draft reply." }, { status: graph.response.status });
  }
  const draft = (await graph.response.json()) as { id?: string; webLink?: string };
  return appendCookies(
    Response.json({ saved: true, draftId: draft.id || null, webLink: draft.webLink || null }),
    graph.setCookies,
  );
}
