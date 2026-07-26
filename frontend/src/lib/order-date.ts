const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

export function formatOrderDateTime(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ARGENTINA_TIME_ZONE,
  });
}
