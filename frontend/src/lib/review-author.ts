function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  const email = cleanText(value).toLowerCase();
  return email.includes("@") ? email : "";
}

function isEmailLike(value: unknown) {
  return normalizeEmail(value).length > 0;
}

export function getReviewUserKey(user: any) {
  return (
    normalizeEmail(user?.email) ||
    cleanText(user?.documentId) ||
    (user?.id != null ? cleanText(user.id) : "")
  );
}

export function buildReviewAuthorFields(user: any, fallbackName?: string | null) {
  const firstName = cleanText(user?.firstName);
  const lastName = cleanText(user?.lastName);
  const fullNameFromParts = [firstName, lastName].filter(Boolean).join(" ");

  const candidates = [
    cleanText(user?.name),
    fullNameFromParts,
    cleanText(user?.username),
    cleanText(fallbackName),
  ];

  const displayName = candidates.find((candidate) => candidate && !isEmailLike(candidate));

  return {
    name: displayName || "Cliente verificado",
    userEmail: normalizeEmail(user?.email) || undefined,
  };
}
