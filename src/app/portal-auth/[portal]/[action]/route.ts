import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ portal: string; action: string }> }) {
  const { portal, action } = await params;
  if (!["seller", "manager"].includes(portal) || !["login", "refresh", "logout"].includes(action)) {
    return NextResponse.json({ detail: "Unknown authentication endpoint." }, { status: 404 });
  }

  let origin: URL;
  try { origin = new URL(request.headers.get("origin") || ""); }
  catch { return NextResponse.json({ detail: "Same-origin requests only." }, { status: 403 }); }
  if (!["http:", "https:"].includes(origin.protocol) || origin.host !== request.headers.get("host")) {
    return NextResponse.json({ detail: "Same-origin requests only." }, { status: 403 });
  }

  const cookieName = `benim_${portal}_refresh`;
  const cookiePath = `/portal-auth/${portal}/`;
  const refresh = request.cookies.get(cookieName)?.value;
  const reply = (body: unknown, status: number, token?: string) => {
    const response = status === 204 ? new NextResponse(null, { status }) : NextResponse.json(body, { status });
    response.headers.set("Cache-Control", "no-store");
    const cookieValue = action === "logout" ? "" : token;
    if (cookieValue !== undefined) response.cookies.set(cookieName, cookieValue, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
      path: cookiePath, maxAge: cookieValue ? 7 * 24 * 60 * 60 : 0,
    });
    return response;
  };

  if (action !== "login" && !refresh) return reply({ detail: "Please sign in again." }, action === "logout" ? 204 : 401, "");
  let credentials: { phone?: string; email?: string; password: string } | undefined;
  if (action === "login") {
    try {
      const body = await request.json();
      const field = portal === "seller" ? "phone" : "email";
      if (typeof body?.[field] !== "string" || !body[field].trim() || typeof body?.password !== "string") throw new Error("Invalid credentials");
      credentials = { [field]: body[field], password: body.password };
    } catch { return reply({ detail: portal === "seller" ? "Phone and password are required." : "Email and password are required." }, 400); }
  }

  // Keep this outside /api: production nginx sends /api directly to Django.
  const backend = process.env.BACKEND_URL || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "");
  if (!backend) return reply({ detail: "Authentication service is not configured." }, 503);
  const base = `${backend.replace(/\/$/, "")}/api/v2/auth/`;
  const backendHeaders = (access?: string) => {
    const headers = new Headers({ "Content-Type": "application/json", Host: origin.host, "X-Forwarded-Proto": origin.protocol.slice(0, -1) });
    if (access) headers.set("Authorization", `Bearer ${access}`);
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) headers.set("X-Forwarded-For", forwardedFor);
    return headers;
  };
  const upstream = (endpoint: string, body: unknown, access?: string) => {
    return fetch(`${base}${endpoint}/`, {
      method: "POST", headers: backendHeaders(access), body: JSON.stringify(body), credentials: "omit",
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
    });
  };

  try {
    // No browser cookies or cookie-mode header go upstream; Django's JSON token API stays unchanged.
    const response = await upstream(action === "login" ? "login" : "refresh", credentials || { refresh });
    const data = await response.json();
    if (!response.ok) {
      const { refresh: _refresh, access: _access, ...error } = data;
      void _refresh; void _access;
      return reply(error, response.status, action !== "login" && [400, 401, 403].includes(response.status) ? "" : undefined);
    }
    if (typeof data.access !== "string" || (action === "login" && typeof data.refresh !== "string")) {
      return reply({ detail: "Invalid authentication response." }, 502);
    }
    if (action === "login") {
      const profileResponse = await fetch(`${base}me/`, {
        headers: backendHeaders(data.access), credentials: "omit",
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
      });
      if (!profileResponse.ok) return reply({ detail: "Could not verify your account role." }, profileResponse.status);
      const profile = await profileResponse.json();
      const allowed = portal === "seller" ? profile.role === "seller" : ["manager", "admin"].includes(profile.role);
      if (!allowed) return reply({ detail: "This account cannot access this portal." }, 403);
    }
    const nextRefresh = typeof data.refresh === "string" ? data.refresh : refresh;
    if (action === "logout") {
      const logout = await upstream("logout", { refresh: nextRefresh }, data.access);
      return reply(logout.ok ? null : { detail: "Could not revoke the session." }, logout.ok ? 204 : logout.status, "");
    }
    return reply({ access: data.access }, 200, nextRefresh);
  } catch {
    return reply({ detail: "Authentication service is temporarily unavailable." }, 503, action === "logout" ? "" : undefined);
  }
}
