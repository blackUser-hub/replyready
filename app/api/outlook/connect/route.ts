import { appendCookies, createAuthorization, outlookConfigured } from "../_lib";

export async function GET(request: Request) {
  if (!outlookConfigured()) {
    return Response.json(
      { error: "Outlook setup is incomplete. Add the Microsoft Entra credentials to .env.local." },
      { status: 503 },
    );
  }
  const authorization = await createAuthorization(request);
  return appendCookies(Response.redirect(authorization.url, 302), authorization.cookies);
}
