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
