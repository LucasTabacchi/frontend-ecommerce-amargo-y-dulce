export const GOOGLE_PROFILE_COOKIE = "amg_google_profile";

export type GoogleProfileName = {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

function safeString(value: unknown) {
  const s = typeof value === "string" ? value.trim() : "";
  return s.length ? s : null;
}

function fullNameFromParts(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || null;
}

export function normalizeGoogleProfileName(raw: unknown): GoogleProfileName | null {
  if (!raw || typeof raw !== "object") return null;

  const profile = raw as Record<string, unknown>;
  const firstName = safeString(profile.given_name) ?? safeString(profile.firstName);
  const lastName = safeString(profile.family_name) ?? safeString(profile.lastName);
  const name = safeString(profile.name) ?? fullNameFromParts(firstName, lastName);
  const email = safeString(profile.email);

  if (!name && !firstName && !lastName && !email) return null;

  return {
    name,
    firstName,
    lastName,
    email,
  };
}

export function mergeGoogleProfileName<T extends Record<string, any> | null | undefined>(
  user: T,
  googleProfile: GoogleProfileName | null | undefined
): T {
  if (!user || !googleProfile) return user;

  const userEmail = safeString(user.email)?.toLowerCase();
  const googleEmail = safeString(googleProfile.email)?.toLowerCase();
  if (userEmail && googleEmail && userEmail !== googleEmail) return user;

  const name = safeString(googleProfile.name);
  const firstName = safeString(googleProfile.firstName);
  const lastName = safeString(googleProfile.lastName);

  if (!name && !firstName && !lastName) return user;

  return {
    ...user,
    ...(name ? { name } : {}),
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
  };
}

export function encodeGoogleProfileName(profile: GoogleProfileName | null | undefined) {
  const normalized = normalizeGoogleProfileName(profile);
  if (!normalized) return "";
  const json = JSON.stringify(normalized);
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeGoogleProfileName(value: unknown): GoogleProfileName | null {
  const raw = safeString(value);
  if (!raw) return null;

  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    return normalizeGoogleProfileName(JSON.parse(json));
  } catch {
    return null;
  }
}
