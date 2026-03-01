// src/app/(shop)/checkout/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { useCartStore } from "@/store/cart.store";

const CLAIMED_COUPONS_KEY = "amg_my_coupon_codes";

/* ================= helpers ================= */

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function priceWithOff(price: number, off?: number) {
  return typeof off === "number" && off > 0
    ? Math.round(price * (1 - off / 100))
    : price;
}

function makeOrderNumber(numericId: number | string) {
  const n = Number(numericId);
  if (!Number.isFinite(n)) return "AMG-XXXX";
  return `AMG-${String(n).padStart(4, "0")}`;
}

function pickErrorMessage(payload: any, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload.error === "string") return payload.error;

  const mp = payload.mp ?? payload.error ?? payload;
  if (typeof mp?.message === "string") return mp.message;
  if (typeof mp?.error === "string") return mp.error;

  return fallback;
}

function safeUUID() {
  const c: any = typeof window !== "undefined" ? window.crypto : null;
  if (c?.randomUUID) return c.randomUUID();
  return `ref_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeText(v: any) {
  return String(v ?? "").trim();
}

function hasCartDiscount(items: any[]) {
  return (items || []).some((it) => {
    const off = Number(it?.off ?? 0);
    return Number.isFinite(off) && off > 0;
  });
}

type ShippingMethod = "delivery" | "pickup";

function calcShippingARS(baseTotal: number, method: ShippingMethod) {
  if (method === "pickup") return 0;

  // Delivery según tu política
  if (baseTotal > 65000) return 0;
  if (baseTotal > 40000) return 4500;
  return 9000;
}

const PICKUP_POINT = {
  name: "Amargo y Dulce",
  address: "Gascón 349 - Concepción del Uruguay",
};

/* ================= types ================= */

type UiState =
  | { kind: "form" }
  | { kind: "checking"; orderId: string; status?: string }
  | { kind: "paid"; orderId: string }
  | { kind: "failed"; orderId: string; reason: string }
  | { kind: "timeout"; orderId: string };

type Quote = {
  subtotal: number;
  discountTotal: number;
  total: number;
  appliedPromotions: Array<{
    id: number;
    name: string;
    code?: string | null;
    amount: number;
    meta?: any;
  }>;
  lineDiscounts: Array<{
    productId?: number | null;
    productDocumentId?: string | null;
    title?: string | null;
    qty?: number | null;
    amount: number;
  }>;
  reasonCode?: string | null;
  message?: string | null;
  appliesToMessage?: string | null;
  coupon?: {
    requested?: string | null;
    applied?: boolean;
    code?: string | null;
    reasonCode?: string | null;
    message?: string | null;
    appliesToMessage?: string | null;
  } | null;
};

type StockProblem = {
  productDocumentId: string;
  title: string;
  requested: number;
  available: number;
};

type Address = {
  id: string; // documentId (v5)
  documentId?: string | null;
  numericId?: number | null;
  label?: string | null;
  fullName?: string | null;
  phone?: string | null;
  street?: string | null;
  number?: string | null;
  city?: string | null;
  province?: string | null;
  zip?: string | null;
  notes?: string | null;
  isDefault?: boolean | null;
};

// ✅ auth/me (ahora incluye dni)
type MeResponse = {
  user: {
    email?: string | null;
    name?: string | null;
    dni?: string | null;
    isStoreAdmin?: boolean;
  } | null;
};

function toNum(v: any, def = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : def;
}

function normalizeQuote(data: any, fallbackSubtotal: number): Quote {
  const s = Math.round(toNum(data?.subtotal, fallbackSubtotal));
  const d = Math.round(toNum(data?.discountTotal, 0));
  const tot = Math.round(toNum(data?.total, Math.max(0, s - d)));
  const lineDiscounts = Array.isArray(data?.lineDiscounts)
    ? data.lineDiscounts
        .map((it: any) => ({
          productId: Number.isFinite(Number(it?.productId)) ? Number(it.productId) : null,
          productDocumentId:
            typeof it?.productDocumentId === "string" ? it.productDocumentId : null,
          title: typeof it?.title === "string" ? it.title : null,
          qty: Number.isFinite(Number(it?.qty)) ? Number(it.qty) : null,
          amount: Math.max(0, Math.round(toNum(it?.amount, 0))),
        }))
        .filter((it: any) => it.amount > 0)
    : [];

  return {
    subtotal: s,
    discountTotal: d,
    total: tot,
    appliedPromotions: Array.isArray(data?.appliedPromotions) ? data.appliedPromotions : [],
    lineDiscounts,
    reasonCode: typeof data?.reasonCode === "string" ? data.reasonCode : null,
    message: typeof data?.message === "string" ? data.message : null,
    appliesToMessage:
      typeof data?.appliesToMessage === "string" ? data.appliesToMessage : null,
    coupon:
      data?.coupon && typeof data.coupon === "object"
        ? {
            requested:
              typeof data.coupon?.requested === "string" ? data.coupon.requested : null,
            applied: Boolean(data.coupon?.applied),
            code: typeof data.coupon?.code === "string" ? data.coupon.code : null,
            reasonCode:
              typeof data.coupon?.reasonCode === "string" ? data.coupon.reasonCode : null,
            message: typeof data.coupon?.message === "string" ? data.coupon.message : null,
            appliesToMessage:
              typeof data.coupon?.appliesToMessage === "string"
                ? data.coupon.appliesToMessage
                : null,
          }
        : null,
  };
}

function isEmptyish(v: string) {
  return String(v ?? "").trim().length === 0;
}

function readLastClaimedCouponCode() {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(CLAIMED_COUPONS_KEY);
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed) || parsed.length === 0) return "";
    const normalized = parsed
      .map((v) => String(v || "").trim())
      .filter(Boolean);
    if (!normalized.length) return "";
    return normalized[normalized.length - 1];
  } catch {
    return "";
  }
}

/* ================= page ================= */

export default function CheckoutPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const cartItems = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // ✅ DNI
  const [dni, setDni] = useState("");
  const [dniSaving, setDniSaving] = useState(false);
  const [dniError, setDniError] = useState<string | null>(null);

  // obligatorios
  const [phone, setPhone] = useState("");

  // ✅ método de entrega
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("delivery");

  // shippingAddress
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [notes, setNotes] = useState("");

  // ✅ direcciones guardadas
  const [addrLoading, setAddrLoading] = useState(true);
  const [addrError, setAddrError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");

  // ✅ usuario (para autocompletar email/nombre/dni)
  const [me, setMe] = useState<MeResponse>({ user: null });
  const [meReady, setMeReady] = useState(false);

  // cupón
  const [coupon, setCoupon] = useState("");
  const [couponTouched, setCouponTouched] = useState(false);

  const [loading, setLoading] = useState(false);
  const [quoting, setQuoting] = useState(false);

  // ✅ error general
  const [error, setError] = useState<string | null>(null);
  // ✅ errores de stock
  const [stockProblems, setStockProblems] = useState<StockProblem[]>([]);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedDni = dni.trim();
  const trimmedPhone = phone.trim();

  const trimmedStreet = street.trim();
  const trimmedNumber = number.trim();
  const trimmedCity = city.trim();
  const trimmedProvince = province.trim();
  const trimmedPostalCode = postalCode.trim();
  const trimmedNotes = notes.trim();

  const redirectedStatus = sp.get("status") || "";
  const redirectedOrderId = sp.get("orderId") || "";
  const couponFromQuery = (sp.get("coupon") || "").trim();

  // ✅ Si el carrito tiene items con descuento, no permitimos cupón
  const cartHasDiscount = useMemo(() => hasCartDiscount(cartItems as any[]), [cartItems]);

  // Redirigir si vuelve con query
  useEffect(() => {
    const status = sp.get("status");
    const orderId = sp.get("orderId");
    if (orderId && status) {
      router.replace(
        `/gracias?status=${encodeURIComponent(status)}&orderId=${encodeURIComponent(orderId)}`
      );
    }
  }, [sp, router]);

  useEffect(() => {
    if (!couponFromQuery) return;
    if (coupon.trim()) return;
    setCoupon(couponFromQuery);
    setCouponTouched(true);
  }, [couponFromQuery, coupon]);

  useEffect(() => {
    if (couponFromQuery) return;
    if (coupon.trim()) return;
    if (cartHasDiscount) return;
    const claimed = readLastClaimedCouponCode();
    if (!claimed) return;
    setCoupon(claimed);
    setCouponTouched(true);
  }, [couponFromQuery, coupon, cartHasDiscount]);

  const [ui, setUi] = useState<UiState>(() =>
    redirectedOrderId
      ? { kind: "checking", orderId: redirectedOrderId, status: redirectedStatus }
      : { kind: "form" }
  );

  useEffect(() => {
    if (redirectedOrderId) {
      setUi({
        kind: "checking",
        orderId: redirectedOrderId,
        status: redirectedStatus,
      });
    } else {
      setUi({ kind: "form" });
    }
  }, [redirectedOrderId, redirectedStatus]);

  /* ================== AUTOFILL (ME + LOCALSTORAGE) ================== */

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const j: MeResponse = await r.json().catch(() => ({ user: null }));
        if (!alive) return;

        setMe({ user: j?.user ?? null });

        const uEmail = String(j?.user?.email ?? "").trim();
        const uName = String(j?.user?.name ?? "").trim();
        const uDni = String(j?.user?.dni ?? "").trim();

        if (uEmail && isEmptyish(email)) setEmail(uEmail);
        if (uName && isEmptyish(name)) setName(uName);
        if (uDni && isEmptyish(dni)) setDni(uDni);
      } catch {
        if (!alive) return;
        setMe({ user: null });
      } finally {
        if (!alive) return;
        setMeReady(true);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isStoreAdmin = Boolean(me?.user?.isStoreAdmin);

  useEffect(() => {
    if (!isEmptyish(email)) return;
    try {
      const saved = localStorage.getItem("amg_email") || "";
      const s = saved.trim();
      if (s && s.includes("@")) setEmail(s);
    } catch {}
  }, [email]);

  useEffect(() => {
    if (!isEmptyish(dni)) return;
    try {
      const saved = localStorage.getItem("amg_dni") || "";
      const s = saved.trim();
      if (s) setDni(s);
    } catch {}
  }, [dni]);

  async function persistDniIfLogged(nextDniRaw: string) {
    const u = me?.user;
    if (!u) return;

    const clean = safeText(nextDniRaw);
    if (!clean) return;
    if (!/^\d{7,8}$/.test(clean)) return;
    if (String(u.dni ?? "").trim() === clean) return;

    try {
      setDniSaving(true);
      setDniError(null);

      const r = await fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dni: clean }),
      });

      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || "No se pudo guardar el DNI.");

      setMe((prev) => ({
        user: prev.user ? { ...prev.user, dni: clean } : prev.user,
      }));
    } catch (e: any) {
      setDniError(e?.message || "Error guardando DNI.");
    } finally {
      setDniSaving(false);
    }
  }

  /* ================== direcciones guardadas ================== */

  async function loadAddresses() {
    setAddrLoading(true);
    setAddrError(null);
    try {
      const r = await fetch("/api/addresses", { cache: "no-store" });

      if (r.status === 401) {
        setAddresses([]);
        setSelectedAddressId("");
        return;
      }

      const j = await r.json().catch(() => null);
      const list: Address[] = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];

      const sorted = [...list].sort(
        (a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault))
      );

      setAddresses(sorted);

      const def = sorted.find((x) => Boolean(x.isDefault));
      const first = sorted[0];
      if (def?.id) setSelectedAddressId(def.id);
      else if (first?.id) setSelectedAddressId(first.id);
      else setSelectedAddressId("");
    } catch {
      setAddrError("No se pudieron cargar tus direcciones guardadas.");
      setAddresses([]);
      setSelectedAddressId("");
    } finally {
      setAddrLoading(false);
    }
  }

  useEffect(() => {
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedAddress = useMemo(() => {
    return addresses.find((a) => String(a.id) === String(selectedAddressId)) || null;
  }, [addresses, selectedAddressId]);

  function applyAddressToForm(a: Address) {
    if (a.street) setStreet(a.street);
    if (a.number) setNumber(a.number);
    if (a.city) setCity(a.city);
    if (a.province) setProvince(a.province);
    if (a.zip) setPostalCode(a.zip);
    if (a.notes) setNotes(a.notes);

    if (a.phone && isEmptyish(phone)) setPhone(a.phone);
    if (a.fullName && isEmptyish(name)) setName(a.fullName);
  }

  function onChangeAddress(nextId: string) {
    setSelectedAddressId(nextId);
    const next = addresses.find((a) => String(a.id) === String(nextId));
    if (next) applyAddressToForm(next);
  }

  useEffect(() => {
    if (!selectedAddress) return;

    const formEmpty =
      isEmptyish(street) &&
      isEmptyish(number) &&
      isEmptyish(city) &&
      isEmptyish(province) &&
      isEmptyish(postalCode) &&
      isEmptyish(notes);

    if (formEmpty && selectedAddress.isDefault) {
      applyAddressToForm(selectedAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAddress?.id]);

  /* ================== subtotal UI (igual que carrito) ================== */

  const uiSubtotal = useMemo(() => {
    return cartItems.reduce((acc, it: any) => {
      const unit = priceWithOff(Number(it.price) || 0, it.off);
      const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
      return acc + unit * qty;
    }, 0);
  }, [cartItems]);

  const payloadItems = useMemo(() => {
    return (cartItems as any[])
      .map((it) => ({
        id: Number(it.id),
        documentId: String(it?.documentId ?? it?.productDocumentId ?? "").trim() || null,
        qty: Math.max(1, Math.floor(Number(it.qty) || 1)),
      }))
      .filter(
        (x) =>
          ((Number.isFinite(x.id) && x.id > 0) || Boolean(x.documentId)) &&
          Number.isFinite(x.qty) &&
          x.qty > 0
      );
  }, [cartItems]);

  /* ================= quote PRO ================= */

  const [quote, setQuote] = useState<Quote>({
    subtotal: 0,
    discountTotal: 0,
    total: 0,
    appliedPromotions: [],
    lineDiscounts: [],
    reasonCode: null,
    message: null,
    appliesToMessage: null,
    coupon: null,
  });

  useEffect(() => {
    let alive = true;
    const fallbackS = Math.round(uiSubtotal);

    if (!payloadItems.length) {
      setQuote({
        subtotal: 0,
        discountTotal: 0,
        total: 0,
        appliedPromotions: [],
        lineDiscounts: [],
        reasonCode: null,
        message: null,
        appliesToMessage: null,
        coupon: null,
      });
      setQuoting(false);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setQuoting(true);

        const res = await fetch("/api/promotions/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: payloadItems,
            coupon: cartHasDiscount ? "" : coupon.trim(),
            shipping: 0, // promos no dependen del shipping por ahora
          }),
          cache: "no-store",
        });

        const data = await res.json().catch(() => null);
        if (!alive) return;

        if (!res.ok) {
          console.error("[quote] error:", data);
          setQuote({
            subtotal: fallbackS,
            discountTotal: 0,
            total: fallbackS,
            appliedPromotions: [],
            lineDiscounts: [],
            reasonCode: null,
            message: null,
            appliesToMessage: null,
            coupon: null,
          });
          return;
        }

        setQuote(normalizeQuote(data, fallbackS));
      } catch {
        if (!alive) return;
        setQuote({
          subtotal: fallbackS,
          discountTotal: 0,
          total: fallbackS,
          appliedPromotions: [],
          lineDiscounts: [],
          reasonCode: null,
          message: null,
          appliesToMessage: null,
          coupon: null,
        });
      } finally {
        if (alive) setQuoting(false);
      }
    }, 250);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [payloadItems, coupon, uiSubtotal, cartHasDiscount]);

  const effectiveSubtotal = payloadItems.length ? quote.subtotal || Math.round(uiSubtotal) : 0;
  const effectiveDiscount = payloadItems.length ? quote.discountTotal : 0;
  const effectiveTotal = payloadItems.length
    ? quote.total || Math.max(0, effectiveSubtotal - effectiveDiscount)
    : 0;

  // ✅ Envío y total final (usamos effectiveTotal como base)
  const shippingCost = useMemo(
    () => calcShippingARS(effectiveTotal, shippingMethod),
    [effectiveTotal, shippingMethod]
  );
  const grandTotal = useMemo(() => Math.max(0, effectiveTotal + shippingCost), [effectiveTotal, shippingCost]);

  /* ================= polling ================= */

  useEffect(() => {
    if (ui.kind !== "checking") return;

    let alive = true;
    const startedAt = Date.now();

    async function tick() {
      if (ui.kind === "form") return;
      try {
        const res = await fetch(`/api/orders/${ui.orderId}`, { cache: "no-store" });
        const json = await res.json();

        if (!alive) return;

        const orderStatus = json?.data?.attributes?.orderStatus ?? json?.orderStatus ?? null;

        if (orderStatus === "paid") {
          setUi({ kind: "paid", orderId: ui.orderId });
          clear();
          return;
        }

        if (orderStatus === "failed" || orderStatus === "cancelled") {
          setUi({ kind: "failed", orderId: ui.orderId, reason: orderStatus });
          return;
        }

        if (Date.now() - startedAt > 30_000) {
          setUi({ kind: "timeout", orderId: ui.orderId });
        }
      } catch {
        if (Date.now() - startedAt > 30_000) {
          setUi({ kind: "timeout", orderId: ui.orderId });
        }
      }
    }

    tick();
    const id = setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [ui, clear]);

  /* ================= submit ================= */

  async function fetchFinalQuote(): Promise<Quote> {
    const fallbackS = Math.round(uiSubtotal);
    try {
      const res = await fetch("/api/promotions/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: payloadItems,
          coupon: cartHasDiscount ? "" : coupon.trim(),
          shipping: 0,
        }),
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          subtotal: fallbackS,
          discountTotal: 0,
          total: fallbackS,
          appliedPromotions: [],
          lineDiscounts: [],
          reasonCode: null,
          message: null,
          appliesToMessage: null,
          coupon: null,
        };
      }

      return normalizeQuote(data, fallbackS);
    } catch {
      return {
        subtotal: fallbackS,
        discountTotal: 0,
        total: fallbackS,
        appliedPromotions: [],
        lineDiscounts: [],
        reasonCode: null,
        message: null,
        appliesToMessage: null,
        coupon: null,
      };
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStockProblems([]);

    if (isStoreAdmin) {
      return setError("La cuenta tienda no puede realizar compras.");
    }

    try {
      localStorage.setItem("amg_dni", safeText(dni));
    } catch {}

    if (!cartItems.length) return setError("Tu carrito está vacío.");
    if (trimmedName.length < 2) return setError("Ingresá un nombre válido.");
    if (!trimmedEmail.includes("@")) return setError("Ingresá un email válido.");

    if (trimmedDni.length > 0 && !/^\d{7,8}$/.test(trimmedDni)) {
      return setError("Ingresá un DNI válido (7 u 8 dígitos).");
    }

    if (trimmedPhone.length < 6) return setError("Ingresá un teléfono válido.");

    // ✅ Validación de dirección SOLO si es delivery
    if (shippingMethod === "delivery") {
      if (trimmedStreet.length < 2) return setError("Ingresá la calle.");
      if (trimmedNumber.length < 1) return setError("Ingresá el número/altura.");
      if (trimmedCity.length < 2) return setError("Ingresá la ciudad.");
      if (trimmedProvince.length < 2) return setError("Ingresá la provincia.");
      if (trimmedPostalCode.length < 4) return setError("Ingresá un código postal válido.");
    }

    localStorage.setItem("amg_email", trimmedEmail.toLowerCase());

    try {
      setLoading(true);

      await persistDniIfLogged(trimmedDni);

      const finalQuote = await fetchFinalQuote();
      const mpExternalReference = safeUUID();

      const totalNum = Math.round(toNum(finalQuote?.total, 0));
      if (!Number.isFinite(totalNum) || totalNum <= 0) {
        throw new Error("Total inválido. Revisá tu carrito o promociones.");
      }

      const shippingFinal = calcShippingARS(totalNum, shippingMethod);
      const grandTotalFinal = Math.max(0, totalNum + shippingFinal);

      /* 1️⃣ Crear orden */
      const createRes = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          dni: trimmedDni || null,

          // ✅ Shipping policy snapshot
          shippingMethod,
          shippingCost: shippingFinal,
          pickupPoint: shippingMethod === "pickup" ? `${PICKUP_POINT.name} (${PICKUP_POINT.address})` : null,

          // ✅ shippingAddress: solo si es delivery
          shippingAddress:
            shippingMethod === "pickup"
              ? {
                  source: "pickup",
                  addressId: null,
                  label: "Retiro en sucursal",
                  street: null,
                  number: null,
                  city: null,
                  province: null,
                  postalCode: null,
                  notes: null,
                  text: `Retiro en sucursal ${PICKUP_POINT.name} - ${PICKUP_POINT.address}`,
                }
              : {
                  source: selectedAddress?.id ? "saved_address" : "manual",
                  addressId: selectedAddress?.id ?? null,
                  label: selectedAddress?.label ?? null,
                  street: trimmedStreet,
                  number: trimmedNumber,
                  city: trimmedCity,
                  province: trimmedProvince,
                  postalCode: trimmedPostalCode,
                  notes: trimmedNotes || null,
                  text: `${trimmedStreet} ${trimmedNumber}, ${trimmedCity}, ${trimmedProvince} (${trimmedPostalCode})`,
                },

          subtotal: Math.round(toNum(finalQuote.subtotal, 0)),
          discountTotal: Math.round(toNum(finalQuote.discountTotal, 0)),
          appliedPromotions: finalQuote.appliedPromotions,
          coupon: cartHasDiscount ? null : coupon.trim() || null,

          // ✅ Total final con envío
          total: grandTotalFinal,

          mpExternalReference,

          items: cartItems.map((it: any) => ({
            productId: Number(it.id),
            productDocumentId: it?.documentId ?? it?.productDocumentId ?? null,
            slug: String(it.slug || "").trim(),
            title: it.title,
            qty: Math.max(1, Math.floor(Number(it.qty) || 1)),
            unit_price: priceWithOff(Number(it.price) || 0, it.off),
            price: Number(it.price) || 0,
            off: it.off ?? null,
          })),
        }),
      });

      const created = await createRes.json().catch(() => null);
      if (!createRes.ok) {
        throw new Error(pickErrorMessage(created, "No se pudo crear la orden"));
      }

      const orderId: string | undefined = created?.orderDocumentId || created?.orderId;
      const orderNumericId: string | undefined = created?.orderNumericId;
      const mpExtFromServer: string | undefined = created?.mpExternalReference;

      if (!orderId) {
        throw new Error("No se recibió orderDocumentId/orderId desde /api/orders/create");
      }

      const mpExternalReferenceFinal = mpExtFromServer || mpExternalReference;
      const orderNumber = makeOrderNumber(orderNumericId || orderId);

      /* 2️⃣ Preferencia MP */
      const mpItems = cartItems
        .map((it: any) => ({
          title: it.title,
          qty: Math.max(1, Math.floor(Number(it.qty) || 1)),
          unit_price: Number(priceWithOff(Number(it.price) || 0, it.off)),
          productDocumentId: it?.documentId ?? it?.productDocumentId ?? null,
        }))
        .filter((x: any) => x.qty > 0 && Number.isFinite(x.unit_price) && x.unit_price > 0);

      if (mpItems.length === 0) throw new Error("No hay items válidos para MercadoPago.");

      const prefRes = await fetch("/api/mp/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          orderNumber,
          mpExternalReference: mpExternalReferenceFinal,
          items: mpItems,

          // 👇 enviamos el shipping para que el server lo cobre en MP
          shippingMethod,
          shippingCost: shippingFinal,

          // Totales informativos
          total: grandTotalFinal,
          subtotal: Math.round(toNum(finalQuote.subtotal, 0)),
          discountTotal: Math.round(toNum(finalQuote.discountTotal, 0)),
          coupon: cartHasDiscount ? null : coupon.trim() || null,
          appliedPromotions: finalQuote.appliedPromotions,
        }),
      });

      const pref = await prefRes.json().catch(() => null);

      if (prefRes.status === 409 && pref?.code === "OUT_OF_STOCK") {
        const probs = Array.isArray(pref?.problems) ? pref.problems : [];
        setStockProblems(
          probs.map((p: any) => ({
            productDocumentId: String(p?.productDocumentId ?? p?.documentId ?? ""),
            title: String(p?.title ?? "Producto"),
            requested: Number(p?.requested ?? 0),
            available: Number(p?.available ?? 0),
          }))
        );
        throw new Error("No hay stock suficiente para completar la compra.");
      }

      if (!prefRes.ok) {
        throw new Error(pickErrorMessage(pref, "No se pudo crear la preferencia MP"));
      }

      const checkoutUrl: string | undefined = pref?.sandbox_init_point || pref?.init_point;
      if (!checkoutUrl) {
        throw new Error("MercadoPago no devolvió init_point / sandbox_init_point.");
      }

      window.location.href = checkoutUrl;
    } catch (err: any) {
      setError(err?.message || "Error iniciando el pago");
    } finally {
      setLoading(false);
    }
  }

  /* ================= UI ================= */

  const requestedCoupon = coupon.trim();
  const hasCouponInput = requestedCoupon.length > 0;
  const couponApplied = Boolean(quote?.coupon?.applied);
  const couponErrorMessage =
    quote?.coupon?.message ||
    (!couponApplied && hasCouponInput ? quote?.message || null : null);
  const couponScopeMessage = quote?.coupon?.appliesToMessage || quote?.appliesToMessage || null;
  const showCouponFeedback =
    payloadItems.length > 0 &&
    (quote.subtotal || Math.round(uiSubtotal)) > 0 &&
    couponTouched &&
    hasCouponInput &&
    !quoting;

  const showAddressFields = shippingMethod === "delivery";

  return (
    <main>
      <Container>
        <h1 className="text-3xl font-extrabold py-8">Checkout</h1>

        {!meReady && (
          <div className="max-w-md rounded border p-4 text-sm text-neutral-700">
            Cargando sesión…
          </div>
        )}

        {meReady && isStoreAdmin && (
          <div className="max-w-md rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            Las cuentas tienda no pueden finalizar compras.
            <div className="mt-3">
              <Link href="/admin/pedidos" className="font-semibold underline">
                Ir a Panel tienda
              </Link>
            </div>
          </div>
        )}

        {meReady && !isStoreAdmin && (error || stockProblems.length > 0) && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700" role="alert" aria-live="assertive">
            {error ? <div className="font-semibold">{error}</div> : null}

            {stockProblems.length > 0 && (
              <div className="mt-2">
                <div className="font-semibold">Problemas de stock:</div>
                <ul className="mt-1 list-disc pl-5 text-red-700">
                  {stockProblems.map((p) => (
                    <li key={p.productDocumentId || p.title}>
                      <b>{p.title}</b>: pediste {p.requested} y hay {p.available}.
                    </li>
                  ))}
                </ul>
                <div className="mt-2 text-xs text-red-700/80">
                  Ajustá cantidades en el carrito y volvé a intentar.
                </div>
              </div>
            )}
          </div>
        )}

        {meReady && !isStoreAdmin && ui.kind === "form" && (
          <form onSubmit={handleSubmit} className="max-w-md space-y-4">
            {/* ✅ Método de entrega */}
            <div className="rounded border p-3">
              <div className="text-sm font-semibold">Método de entrega</div>

              <div className="mt-3 space-y-2 text-sm">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name="shippingMethod"
                    value="delivery"
                    checked={shippingMethod === "delivery"}
                    onChange={() => setShippingMethod("delivery")}
                  />
                  <div>
                    <div className="font-semibold">Envío a domicilio</div>
                    <div className="text-xs text-neutral-600">
                      Estándar {formatARS(9000)} · &gt; {formatARS(40000)}: {formatARS(4500)} · &gt;{" "}
                      {formatARS(65000)}: GRATIS
                    </div>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name="shippingMethod"
                    value="pickup"
                    checked={shippingMethod === "pickup"}
                    onChange={() => setShippingMethod("pickup")}
                  />
                  <div>
                    <div className="font-semibold">Retiro en sucursal</div>
                    <div className="text-xs text-neutral-600">
                      {PICKUP_POINT.name} ({PICKUP_POINT.address}) · GRATIS
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* ✅ Direcciones guardadas (solo si es delivery) */}
            {showAddressFields && (
              <div className="rounded border p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Dirección guardada</div>
                  <Link href="/mi-perfil" className="text-xs underline">
                    Administrar
                  </Link>
                </div>

                {addrLoading ? (
                  <div className="mt-2 text-xs opacity-70">Cargando direcciones…</div>
                ) : addrError ? (
                  <div className="mt-2 text-xs text-red-600">{addrError}</div>
                ) : addresses.length === 0 ? (
                  <div className="mt-2 text-xs opacity-70">
                    No tenés direcciones guardadas (podés cargar una en Mi Perfil).
                  </div>
                ) : (
                  <div className="mt-2">
                    <select
                      className="w-full border p-2 text-sm"
                      value={selectedAddressId}
                      onChange={(e) => onChangeAddress(e.target.value)}
                    >
                      {addresses.map((a) => {
                        const label =
                          a.label ||
                          (a.street ? `${a.street}${a.number ? ` ${a.number}` : ""}` : "Dirección");
                        const extra = a.isDefault ? " (Predeterminada)" : "";
                        return (
                          <option key={a.id} value={a.id}>
                            {label}
                            {extra}
                          </option>
                        );
                      })}
                    </select>

                    {selectedAddress ? (
                      <div className="mt-2 text-xs text-neutral-600">
                        {selectedAddress.street ? `${selectedAddress.street}` : ""}
                        {selectedAddress.number ? ` ${selectedAddress.number}` : ""}
                        {selectedAddress.city ? `, ${selectedAddress.city}` : ""}
                        {selectedAddress.province ? `, ${selectedAddress.province}` : ""}
                        {selectedAddress.zip ? ` (${selectedAddress.zip})` : ""}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* Info de retiro */}
            {!showAddressFields && (
              <div className="rounded border p-3 text-sm">
                <div className="font-semibold">Retiro en sucursal</div>
                <div className="mt-1 text-neutral-700">
                  {PICKUP_POINT.name} — {PICKUP_POINT.address}
                </div>
                <div className="mt-1 text-xs text-neutral-600">
                  Te vamos a avisar por email cuando tu pedido esté listo para retirar.
                </div>
              </div>
            )}

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre"
              className="w-full border p-2"
              required
            />

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="w-full border p-2"
              required
            />

            {/* ✅ DNI */}
            <div>
              <input
                value={dni}
                onChange={(e) => {
                  setDniError(null);
                  setDni(e.target.value);
                }}
                onBlur={() => persistDniIfLogged(dni)}
                placeholder="DNI (opcional)"
                inputMode="numeric"
                className="w-full border p-2"
              />
              <p className="mt-1 text-xs text-neutral-500">
                {me.user
                  ? "Si estás logueado, lo guardamos en tus datos personales."
                  : "Podés completarlo para este pedido (lo recordamos en este dispositivo)."}
              </p>
              {dniSaving ? <p className="mt-1 text-xs text-neutral-500">Guardando DNI…</p> : null}
              {dniError ? <p className="mt-1 text-xs text-red-600">{dniError}</p> : null}
            </div>

            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Teléfono"
              type="tel"
              className="w-full border p-2"
              required
            />

            {/* ✅ Campos dirección SOLO si es delivery */}
            {showAddressFields && (
              <>
                <input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Calle"
                  className="w-full border p-2"
                  required
                />
                <input
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="Número / Altura"
                  className="w-full border p-2"
                  required
                />
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ciudad"
                  className="w-full border p-2"
                  required
                />
                <input
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="Provincia"
                  className="w-full border p-2"
                  required
                />
                <input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="Código postal"
                  className="w-full border p-2"
                  inputMode="numeric"
                  required
                />

                <div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas para esta entrega (opcional)"
                    className="w-full border p-2"
                    rows={2}
                  />
                  <p className="mt-1 text-xs text-neutral-500">
                    Si usás una dirección guardada, podés cambiar estas notas solo para este pedido.
                  </p>
                </div>
              </>
            )}

            {/* Cupón */}
            <div>
              <div className="flex items-center gap-2">
                <input
                  value={coupon}
                  onChange={(e) => {
                    setCouponTouched(true);
                    setCoupon(e.target.value);
                  }}
                  placeholder="Cupón (opcional)"
                  className="w-full border p-2"
                  disabled={cartHasDiscount}
                />
                {hasCouponInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setCouponTouched(true);
                      setCoupon("");
                    }}
                    className="shrink-0 rounded border px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    Quitar
                  </button>
                )}
              </div>

              <p className="mt-1 text-xs text-neutral-500">
                El cupón aplica solo a productos sin descuento.
              </p>
              <div className="mt-1">
                <Link href="/cupones/mis-cupones" className="text-xs font-semibold text-red-700 hover:underline">
                  Ver mis cupones →
                </Link>
              </div>

              {cartHasDiscount && (
                <p className="mt-1 text-xs text-amber-700">
                  Tu carrito tiene productos con descuento, por eso el cupón no se puede usar.
                </p>
              )}
            </div>

            {showCouponFeedback && couponApplied ? (
              <div className="space-y-1 text-xs text-emerald-700">
                <div>✅ Cupón aplicado correctamente.</div>
                {couponScopeMessage ? <div>{couponScopeMessage}</div> : null}
              </div>
            ) : null}

            {showCouponFeedback && !couponApplied && couponErrorMessage ? (
              <div className="space-y-1 text-xs text-red-600">
                <div>{couponErrorMessage}</div>
                {couponScopeMessage ? <div>{couponScopeMessage}</div> : null}
              </div>
            ) : null}

            {/* Resumen */}
            <div className="rounded border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span className="whitespace-nowrap">{formatARS(effectiveSubtotal)}</span>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span>Descuento</span>
                <span className="whitespace-nowrap">-{formatARS(effectiveDiscount)}</span>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span>Envío</span>
                <span className="whitespace-nowrap">{shippingCost === 0 ? "GRATIS" : formatARS(shippingCost)}</span>
              </div>

              <div className="mt-2 flex items-center justify-between font-semibold">
                <span>Total</span>
                <span className="whitespace-nowrap">{formatARS(grandTotal)}</span>
              </div>

              {quoting ? <div className="mt-2 text-xs opacity-70">Calculando promociones…</div> : null}

              {quote.appliedPromotions?.length ? (
                <div className="mt-3">
                  <div className="text-xs font-semibold">Promociones aplicadas</div>
                  <ul className="mt-1 space-y-1 text-xs">
                    {quote.appliedPromotions.map((p) => (
                      <li key={p.id} className="flex justify-between gap-3">
                        <span className="truncate">
                          {p.name}
                          {p.code ? ` (${p.code})` : ""}
                        </span>
                        <span>-{formatARS(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {quote.lineDiscounts?.length ? (
                <div className="mt-3">
                  <div className="text-xs font-semibold">Descuento por producto</div>
                  <ul className="mt-1 space-y-1 text-xs">
                    {quote.lineDiscounts.map((line, idx) => (
                      <li
                        key={`${line.productDocumentId || line.productId || idx}`}
                        className="flex justify-between gap-3"
                      >
                        <span className="truncate">
                          {line.title || "Producto"}
                          {line.qty ? ` x${line.qty}` : ""}
                        </span>
                        <span>-{formatARS(line.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={loading || quoting}
              className="w-full rounded bg-red-600 py-3 text-white disabled:opacity-60"
            >
              {loading ? "Redirigiendo…" : "Pagar con MercadoPago"}
            </button>

            <Link href="/carrito" className="block text-sm underline">
              Volver al carrito
            </Link>
          </form>
        )}

        {meReady && !isStoreAdmin && ui.kind === "checking" && (
          <div className="max-w-md rounded border p-4">
            <p className="font-semibold">Estamos verificando tu pago…</p>
            <p className="text-sm opacity-80">Orden: {ui.orderId}</p>
          </div>
        )}

        {meReady && !isStoreAdmin && ui.kind === "paid" && (
          <div className="max-w-md rounded border p-4">
            <p className="font-semibold">¡Pago aprobado!</p>
            <p className="text-sm opacity-80">Orden: {ui.orderId}</p>
            <Link href="/" className="mt-3 inline-block underline">
              Volver a la tienda
            </Link>
          </div>
        )}

        {meReady && !isStoreAdmin && ui.kind === "failed" && (
          <div className="max-w-md rounded border p-4">
            <p className="font-semibold">El pago no se pudo completar.</p>
            <p className="text-sm opacity-80">Motivo: {ui.reason}</p>
            <Link href="/carrito" className="mt-3 inline-block underline">
              Volver al carrito
            </Link>
          </div>
        )}

        {meReady && !isStoreAdmin && ui.kind === "timeout" && (
          <div className="max-w-md rounded border p-4">
            <p className="font-semibold">No pudimos confirmar el pago todavía.</p>
            <p className="text-sm opacity-80">
              Podés refrescar en unos segundos o revisar el estado más tarde.
            </p>
            <Link href="/" className="mt-3 inline-block underline">
              Volver a la tienda
            </Link>
          </div>
        )}
      </Container>
    </main>
  );
}
