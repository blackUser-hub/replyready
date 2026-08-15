import { appendCookies, clearOutlookCookies, sameOrigin } from "../_lib";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  return appendCookies(Response.json({ disconnected: true }), clearOutlookCookies(request));
}
