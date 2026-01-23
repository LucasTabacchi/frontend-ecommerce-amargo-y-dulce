"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type ReviewItem = {
  id: number | string;
  rating: number;
  title?: string;
  text?: string; // en UI mostramos esto (sale de comment/text/body)
  name?: string;
  createdAt?: string;
};

function toStars(n: number) {
  const v = Math.max(0, Math.min(5, Math.round(n)));
  return "★★★★★☆☆☆☆☆".slice(5 - v, 10 - v);
}

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-AR", { dateStyle: "medium" });
}

function normalizeReviewRow(r: any): ReviewItem {
  const a = r?.attributes ?? r ?? {};
  const ratingRaw = a?.rating ?? r?.rating ?? 0;
  const ratingNum = Number(ratingRaw);

  const text =
    String(
      a?.comment ??
        a?.text ??
        a?.body ??
        r?.comment ??
        r?.text ??
        r?.body ??
        ""
    ).trim() || undefined;

  return {
    id: r?.id ?? a?.id ?? crypto.randomUUID(),
    rating: Number.isFinite(ratingNum) ? ratingNum : 0,
    title: String(a?.title ?? r?.title ?? "").trim() || undefined,
    text,
    name: String(a?.name ?? r?.name ?? "").trim() || undefined,
    createdAt: String(a?.createdAt ?? r?.createdAt ?? "").trim() || undefined,
  };
}

function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onChange(s)}
          className={[
            "text-lg leading-none",
            disabled
              ? "opacity-50 cursor-not-allowed"
              : "hover:scale-110 transition",
            s <= value ? "text-amber-500" : "text-neutral-300",
          ].join(" ")}
          aria-label={`${s} estrellas`}
          title={`${s} estrellas`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function ProductReviews({
  productDocumentId,
  productId,
  pageSize = 20,
}: {
  productDocumentId?: string;
  productId?: number;
  pageSize?: number;
}) {
  const canFilter =
    Boolean(productDocumentId) ||
    (Number.isFinite(productId) && (productId as number) > 0);

  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // form
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<string | null>(null);

  async function load() {
    if (!canFilter) return;
    setLoading(true);
    setError(null);

    try {
      const sp = new URLSearchParams();
      sp.set("pageSize", String(pageSize));
      if (productDocumentId) sp.set("productDocumentId", productDocumentId);
      if (Number.isFinite(productId) && (productId as number) > 0)
        sp.set("productId", String(productId));

      const r = await fetch(`/api/reviews?${sp.toString()}`, {
        cache: "no-store",
      });
      const json = await r.json().catch(() => null);

      if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);

      const list = Array.isArray(json?.data) ? json.data : [];
      setReviews(list.map(normalizeReviewRow));
    } catch (e: any) {
      setReviews([]);
      setError(e?.message || "No se pudieron cargar las reseñas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productDocumentId, productId, pageSize]);

  const count = reviews.length;
  const avg = useMemo(() => {
    return count > 0
      ? reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) / count
      : 0;
  }, [count, reviews]);

  async function submitReview(e: FormEvent) {
    e.preventDefault();
    setFormMsg(null);

    const pidOk = Number.isFinite(productId) && (productId as number) > 0;
    if (!pidOk && !productDocumentId) {
      setFormMsg("No se pudo identificar el producto para guardar la reseña.");
      return;
    }

    const ratingNum = Number(rating);
    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      setFormMsg("Elegí una calificación de 1 a 5.");
      return;
    }

    if (!text.trim()) {
      setFormMsg("Escribí un comentario.");
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: pidOk ? Number(productId) : undefined,
          productDocumentId: productDocumentId || undefined,
          rating: ratingNum,
          name: name.trim() || undefined,
          title: title.trim() || undefined,
          comment: text.trim(), // ✅ Strapi field
        }),
      });

      const json = await r.json().catch(() => null);
      if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);

      // reset
      setName("");
      setTitle("");
      setText("");
      setRating(5);
      setFormMsg("¡Reseña enviada!");
      await load();
    } catch (e: any) {
      setFormMsg(e?.message || "No se pudo enviar la reseña.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!canFilter) return null;

  return (
    <section className="mt-10 rounded-2xl border bg-white p-6 lg:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-neutral-900">
            Valoraciones y opiniones
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {loading
              ? "Cargando..."
              : count > 0
              ? "Lo que opinan quienes compraron"
              : "Todavía no hay reseñas"}
          </p>
        </div>

        <div className="rounded-2xl bg-neutral-50 px-4 py-3">
          <div className="text-sm font-semibold text-neutral-600">Promedio</div>
          <div className="mt-1 flex items-center gap-2">
            <div className="text-2xl font-extrabold text-neutral-900">
              {avg.toFixed(1)}
            </div>
            <div className="text-sm font-bold text-amber-600">
              {toStars(avg)}
            </div>
            <div className="text-sm text-neutral-500">({count})</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border bg-white p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ✅ FORM */}
      <form onSubmit={submitReview} className="mt-6 rounded-2xl bg-neutral-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-extrabold text-neutral-900">
            Dejar reseña
          </div>
          <StarPicker value={rating} onChange={setRating} disabled={submitting} />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-neutral-600">
              Nombre (opcional)
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-xl border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
              placeholder="Ej: Lucas"
              disabled={submitting}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-neutral-600">
              Título (opcional)
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 rounded-xl border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
              placeholder="Ej: Excelente"
              disabled={submitting}
            />
          </label>
        </div>

        <label className="mt-3 grid gap-1">
          <span className="text-xs font-semibold text-neutral-600">Comentario</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[96px] rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
            placeholder="Contá tu experiencia…"
            disabled={submitting}
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-red-600 px-5 py-2 text-sm font-extrabold text-white disabled:opacity-60"
          >
            {submitting ? "Enviando..." : "Enviar reseña"}
          </button>

          {formMsg && <div className="text-sm text-neutral-700">{formMsg}</div>}
        </div>
      </form>

      {/* ✅ LIST */}
      {!loading && count === 0 ? (
        <div className="mt-6 rounded-xl bg-white p-4 text-sm text-neutral-700 border">
          Sé el primero en dejar una reseña.
        </div>
      ) : (
        <div className="mt-6 divide-y">
          {reviews.map((r) => (
            <article key={String(r.id)} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-amber-600">
                    {toStars(r.rating)}
                  </div>
                  <div className="text-sm font-semibold text-neutral-900">
                    {r.title ?? "Reseña"}
                  </div>
                </div>
                <div className="text-xs text-neutral-500">
                  {r.name ? `${r.name} · ` : ""}
                  {formatDate(r.createdAt)}
                </div>
              </div>

              {r.text && (
                <p className="mt-2 text-sm leading-6 text-neutral-700 whitespace-pre-line">
                  {r.text}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
