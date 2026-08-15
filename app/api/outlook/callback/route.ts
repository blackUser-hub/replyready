import { appendCookies, clearOutlookCookies, redeemAuthorizationCode } from "../_lib";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error || !code || !state) {
    return appendCookies(
      Response.redirect(`${origin}/?outlook_error=signin_cancelled`, 302),
      clearOutlookCookies(request),
    );
  }

  try {
    const cookies = await redeemAuthorizationCode(request, code, state);
    return appendCookies(Response.redirect(`${origin}/?outlook=connected`, 302), cookies);
  } catch {
    return appendCookies(
      Response.redirect(`${origin}/?outlook_error=signin_failed`, 302),
      clearOutlookCookies(request),
    );
  }
}
