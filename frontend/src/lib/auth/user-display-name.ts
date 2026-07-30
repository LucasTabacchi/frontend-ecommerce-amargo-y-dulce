function cleanText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length ? text : null;
}

function localPartFromEmail(value: unknown) {
  const email = cleanText(value);
  if (!email) return null;
  return cleanText(email.split("@")[0]);
}

export function resolveUserDisplayName(user: any, fallback = "-") {
  const fullName = cleanText(user?.name);
  if (fullName) return fullName;

  const firstName = cleanText(user?.firstName);
  const lastName = cleanText(user?.lastName);
  const nameFromParts = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (nameFromParts) return nameFromParts;

  return cleanText(user?.username) || localPartFromEmail(user?.email) || fallback;
}

export function resolveUserHeaderName(user: any, fallback = "Cuenta") {
  const displayName = resolveUserDisplayName(user, fallback);
  return cleanText(displayName.split(/\s+/)[0]) || fallback;
}
