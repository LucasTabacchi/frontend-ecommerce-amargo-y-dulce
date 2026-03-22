import "server-only";
import crypto from "crypto";

const BREVO_SEND_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";

// Dedupe best-effort en memoria (sirve si llegan 2 hits al mismo runtime)
const recentSends = new Map<string, number>();
const DEDUPE_WINDOW_MS = 10_000;

// Límite razonable para adjuntos
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB

type BrevoSender = {
  email: string;
  name?: string;
};

type BrevoAttachment = {
  name: string;
  content: string;
};

export type OrderConfirmationEmailPayload = {
  email?: string | null;
  name?: string | null;
  orderNumber?: string | null;
  total?: number | string | null;
  items?: any;
  phone?: string | null;
  shippingAddress?: any;
  mpPaymentId?: string | number | null;
  invoiceNumber?: string | null;
  invoicePdfUrl?: string | null;
  invoiceFilename?: string | null;
};

export type OrderConfirmationEmailResult = {
  status: number;
  body: Record<string, any>;
};

function makeBrevoIdempotencyKey(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 32);
}

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseEmailIdentity(raw: string): BrevoSender | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  const withName = /^(?:"?([^"]*)"?\s)?<([^<>@\s]+@[^<>@\s]+\.[^<>@\s]+)>$/.exec(value);
  if (withName) {
    const email = withName[2]?.trim();
    const name = withName[1]?.trim();
    return {
      email,
      ...(name ? { name } : {}),
    };
  }

  if (/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(value)) {
    return { email: value };
  }

  return null;
}

function resolveSender() {
  const parsed = parseEmailIdentity(process.env.EMAIL_FROM || "");
  if (!parsed) return null;

  const envName = String(process.env.EMAIL_FROM_NAME || "").trim();
  return {
    ...parsed,
    ...(envName ? { name: envName } : {}),
  };
}

function safeJsonParse(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickBrevoError(payload: any, fallback: string) {
  return (
    payload?.message ||
    payload?.code ||
    payload?.error ||
    (typeof payload === "string" ? payload : null) ||
    fallback
  );
}

function looksRateLimitError(payload: any, status?: number) {
  const msg = String(pickBrevoError(payload, "")).toLowerCase();
  const code = String(payload?.code ?? "").toLowerCase();

  return (
    status === 429 ||
    code.includes("rate") ||
    code.includes("too_many") ||
    msg.includes("too many requests") ||
    msg.includes("rate limit")
  );
}

function looksDuplicateIdempotency(payload: any, status?: number) {
  const msg = String(pickBrevoError(payload, "")).toLowerCase();
  const code = String(payload?.code ?? "").toLowerCase();

  return (
    status === 409 ||
    code === "duplicate_parameter" ||
    msg.includes("duplicate_parameter") ||
    (msg.includes("idempotency") && msg.includes("duplicate"))
  );
}

async function fetchWithTimeout(input: string, init: RequestInit, ms = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

async function fetchPdfAsBase64(url: string) {
  const r = await fetchWithTimeout(
    url,
    {
      headers: {
        Accept: "application/pdf,*/*",
      },
    },
    25_000
  );

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`PDF fetch failed (${r.status}) ${t?.slice?.(0, 200) || ""}`);
  }

  const ab = await r.arrayBuffer();
  const buf = Buffer.from(ab);

  if (buf.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error(`PDF too large (${buf.byteLength} bytes)`);
  }

  return buf.toString("base64");
}

function safeFilename(name: any) {
  const s = String(name ?? "factura.pdf").trim() || "factura.pdf";
  const clean = s.replace(/[\r\n"]/g, "");
  return clean.toLowerCase().endsWith(".pdf") ? clean : `${clean}.pdf`;
}

function buildEmailText(params: {
  name?: string | null;
  orderNumber: string;
  invoiceNumber?: string | null;
  invoicePdfUrl?: string | null;
  shippingAddress?: any;
  phone?: string | null;
  items?: any[];
  total?: number;
}) {
  const {
    name,
    orderNumber,
    invoiceNumber,
    invoicePdfUrl,
    shippingAddress,
    phone,
    items,
    total,
  } = params;

  const addressText =
    shippingAddress?.text ||
    shippingAddress?.address ||
    (shippingAddress ? JSON.stringify(shippingAddress) : "-");

  const itemsText = Array.isArray(items) && items.length
    ? items
        .map((it: any) => {
          const qty = Number(it?.qty ?? 1);
          const title = String(it?.title ?? "Item").trim() || "Item";
          const unit = Number(it?.unit_price ?? it?.price ?? 0);
          return `- ${qty} x ${title} - ${formatARS(unit)}`;
        })
        .join("\n")
    : "-";

  const invoiceLines = [
    invoiceNumber ? `Factura: ${invoiceNumber}` : "",
    invoicePdfUrl ? `PDF: ${invoicePdfUrl}` : "",
  ].filter(Boolean);

  return [
    `Gracias por tu compra${name ? `, ${String(name).trim()}` : ""}.`,
    `Confirmamos tu pedido ${orderNumber}.`,
    invoiceLines.length ? invoiceLines.join("\n") : "",
    `Direccion de envio: ${addressText || "-"}.`,
    `Telefono: ${String(phone ?? "-").trim() || "-"}.`,
    `Items:\n${itemsText}`,
    `Total: ${formatARS(Number(total ?? 0))}.`,
    "Si tenes dudas, responde este email.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function sendBrevoEmail(params: {
  apiKey: string;
  sender: BrevoSender;
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  attachments?: BrevoAttachment[];
}) {
  const { apiKey, sender, to, toName, subject, html, text, idempotencyKey, attachments } = params;

  const payload = {
    sender,
    to: [
      {
        email: to,
        ...(toName ? { name: String(toName).trim() } : {}),
      },
    ],
    subject,
    htmlContent: html,
    textContent: text,
    headers: {
      idempotencyKey,
    },
    ...(attachments?.length ? { attachment: attachments } : {}),
  };

  const response = await fetch(BREVO_SEND_EMAIL_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const rawText = await response.text().catch(() => "");
  const json = safeJsonParse(rawText);

  return {
    response,
    payload: json ?? rawText,
  };
}

export async function sendOrderConfirmationEmail(
  payload: OrderConfirmationEmailPayload
): Promise<OrderConfirmationEmailResult> {
  try {
    if (!process.env.BREVO_API_KEY) {
      return { status: 500, body: { error: "Falta BREVO_API_KEY" } };
    }

    const sender = resolveSender();
    if (!sender) {
      return {
        status: 500,
        body: {
          error:
            "EMAIL_FROM invalido. Usa 'correo@dominio.com' o 'Nombre <correo@dominio.com>'.",
        },
      };
    }

    const {
      email,
      name,
      orderNumber,
      total,
      items,
      phone,
      shippingAddress,
      mpPaymentId,
      invoiceNumber,
      invoicePdfUrl,
      invoiceFilename,
    } = payload || {};

    if (!email || !orderNumber) {
      return { status: 400, body: { error: "Faltan email u orderNumber" } };
    }

    const rawIdempotencyKey = `order-confirmation/${String(orderNumber)}${
      mpPaymentId ? `/${String(mpPaymentId)}` : ""
    }`;
    const idempotencyKey = makeBrevoIdempotencyKey(rawIdempotencyKey);

    const now = Date.now();
    const last = recentSends.get(idempotencyKey);
    if (last && now - last < DEDUPE_WINDOW_MS) {
      return {
        status: 200,
        body: {
          ok: true,
          deduped: true,
          to: process.env.TEST_EMAIL_TO || email,
          idempotencyKey,
        },
      };
    }
    recentSends.set(idempotencyKey, now);

    const addressText =
      shippingAddress?.text ||
      shippingAddress?.address ||
      (shippingAddress ? JSON.stringify(shippingAddress) : "");

    const itemsHtml = Array.isArray(items)
      ? items
          .map((it: any) => {
            const qty = Number(it?.qty ?? 1);
            const title = escapeHtml(it?.title ?? "Item");
            const unit = Number(it?.unit_price ?? it?.price ?? 0);
            return `<li>${qty} x ${title} - ${escapeHtml(formatARS(unit))}</li>`;
          })
          .join("")
      : "";

    const invoiceLine =
      invoiceNumber || invoicePdfUrl
        ? `
          <h3>Factura</h3>
          <p>
            ${invoiceNumber ? `N° <b>${escapeHtml(String(invoiceNumber))}</b><br/>` : ""}
            ${invoicePdfUrl ? `Descarga: <a href="${escapeHtml(String(invoicePdfUrl))}">PDF</a>` : ""}
          </p>
        `
        : "";

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>¡Gracias por tu compra${name ? `, ${escapeHtml(name)}` : ""}!</h2>
        <p>Confirmamos tu pedido <b>${escapeHtml(String(orderNumber))}</b>.</p>

        ${invoiceLine}

        <h3>Dirección de envío</h3>
        <p>${escapeHtml(addressText || "-")}</p>

        <h3>Teléfono</h3>
        <p>${escapeHtml(phone || "-")}</p>

        <h3>Items</h3>
        <ul>${itemsHtml || "<li>-</li>"}</ul>

        <h3>Total</h3>
        <p><b>${escapeHtml(formatARS(Number(total ?? 0)))}</b></p>

        <p style="margin-top:24px;color:#666">
          Si tenés dudas, respondé este email.
        </p>
      </div>
    `;

    const text = buildEmailText({
      name,
      orderNumber: String(orderNumber),
      invoiceNumber,
      invoicePdfUrl,
      shippingAddress,
      phone,
      items,
      total: Number(total ?? 0),
    });

    const to = process.env.TEST_EMAIL_TO || String(email);

    console.log("[email] sending confirmation", {
      provider: "brevo",
      orderNumber,
      to,
      forced: Boolean(process.env.TEST_EMAIL_TO),
      idempotencyKey,
      rawIdempotencyKey,
      hasInvoicePdfUrl: Boolean(invoicePdfUrl),
    });

    let attachments: BrevoAttachment[] | undefined;

    if (invoicePdfUrl && typeof invoicePdfUrl === "string") {
      try {
        const base64 = await fetchPdfAsBase64(invoicePdfUrl);
        attachments = [
          {
            name: safeFilename(invoiceFilename || invoiceNumber || "factura.pdf"),
            content: base64,
          },
        ];
      } catch (e: any) {
        console.error("[email] failed to attach pdf, sending without attachment:", e?.message || e);
      }
    }

    const result = await sendBrevoEmail({
      apiKey: process.env.BREVO_API_KEY,
      sender,
      to,
      toName: name,
      subject: `Confirmación de pedido ${String(orderNumber)}`,
      html,
      text,
      idempotencyKey,
      attachments,
    });

    if (!result.response.ok) {
      if (looksDuplicateIdempotency(result.payload, result.response.status)) {
        return {
          status: 200,
          body: { ok: true, deduped: true, provider: "brevo", to },
        };
      }

      const message = pickBrevoError(result.payload, "Brevo error");

      if (looksRateLimitError(result.payload, result.response.status)) {
        return {
          status: 202,
          body: { ok: false, queued: false, error: message, rateLimited: true, to },
        };
      }

      return {
        status: 502,
        body: {
          error: message,
          provider: "brevo",
        },
      };
    }

    return {
      status: 200,
      body: {
        ok: true,
        provider: "brevo",
        to,
        idempotencyKey,
        attachedPdf: Boolean(attachments?.length),
        messageId:
          typeof (result.payload as any)?.messageId === "string"
            ? (result.payload as any).messageId
            : null,
      },
    };
  } catch (e: any) {
    return {
      status: 500,
      body: { error: e?.message || "Error enviando email con Brevo" },
    };
  }
}
