import { appendCookies, graphRequest, outlookConfigured } from "../_lib";

type GraphProfile = {
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
};

export async function GET(request: Request) {
  if (!outlookConfigured()) {
    return Response.json({ configured: false, connected: false });
  }
  const graph = await graphRequest(request, "/me?$select=displayName,mail,userPrincipalName");
  if (!graph) return Response.json({ configured: true, connected: false });
  if (!graph.response.ok) {
    return Response.json({ configured: true, connected: false }, { status: 401 });
  }
  const profile = (await graph.response.json()) as GraphProfile;
  return appendCookies(
    Response.json({
      configured: true,
      connected: true,
      user: {
        name: profile.displayName || "Outlook user",
        email: profile.mail || profile.userPrincipalName || "",
      },
    }),
    graph.setCookies,
  );
}
