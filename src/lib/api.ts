const ACCESS_TOKEN_KEY = "benim_access_token";
const REFRESH_TOKEN_KEY = "benim_refresh_token";

type RefreshResponse = {
  access: string;
  refresh?: string;
};

let refreshPromise: Promise<string | null> | null = null;

function clearTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = refreshAccessTokenRequest();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function refreshAccessTokenRequest() {
  const refresh = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) return null;

  const response = await fetch("/api/v1/auth/refresh/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!response.ok) {
    clearTokens();
    return null;
  }

  const tokens = (await response.json()) as RefreshResponse;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
  if (tokens.refresh) window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
  return tokens.access;
}

export function apiErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const record = data as Record<string, unknown>;
  const detail = record.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length) return detail.map(String).join(" ");
  for (const [field, value] of Object.entries(record)) {
    if (field === "status_code") continue;
    const text = Array.isArray(value)
      ? value.map(String).join(" ")
      : typeof value === "string"
        ? value
        : "";
    if (text.trim()) return field === "non_field_errors" || field === "ean" ? text : `${field}: ${text}`;
  }
  return fallback;
}

export async function authorizedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const request = (access: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${access}`);
    return fetch(input, { ...init, headers });
  };

  const access = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!access) return new Response(null, { status: 401 });

  const response = await request(access);
  if (response.status !== 401) return response;

  const refreshedAccess = await refreshAccessToken();
  return refreshedAccess ? request(refreshedAccess) : response;
}
