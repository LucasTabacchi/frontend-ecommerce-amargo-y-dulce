export const GOOGLE_OAUTH_SCOPE = "openid email profile";

function normBase(url: string) {
  return String(url || "").trim().replace(/\/$/, "");
}

export function buildStrapiGoogleConnectUrl(strapiBase: string, frontendRedirect: string) {
  const url = new URL(`${normBase(strapiBase)}/api/connect/google`);
  url.searchParams.set("callback", frontendRedirect);
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPE);
  return url;
}

export function shouldExchangeGoogleAccessToken(_opts?: { existingJwt?: string | null }) {
  return true;
}

function safeToken(value: unknown) {
  const token = typeof value === "string" ? value.trim() : "";
  return token.length ? token : null;
}

export function pickGoogleProfileSyncToken(input: {
  userJwt: string;
  strapiApiToken?: string | null;
  strapiToken?: string | null;
}) {
  return (
    safeToken(input.strapiApiToken) ||
    safeToken(input.strapiToken) ||
    safeToken(input.userJwt) ||
    ""
  );
}
