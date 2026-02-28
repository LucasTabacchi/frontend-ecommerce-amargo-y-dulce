"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Container } from "./Container";
import { Search, ShoppingCart, User, Menu, X, ChevronDown } from "lucide-react";
import { LoginModal } from "@/components/auth/LoginModal";
import { CartBadge } from "@/components/cart/CartBadge";
import { ProfilePanel } from "@/components/profile/ProfilePanel";
import { useCartStore } from "@/store/cart.store";

type Suggestion = {
  id: string | number | null;
  title: string;
  price: number | null;
  slug: string | null;
};

type MeResponse = { user: any | null };

function normalizeQty(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function NavLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="
        text-[15px] font-medium
        text-neutral-700
        hover:text-neutral-900
        hover:underline
        underline-offset-4
        transition-colors
      "
    >
      {children}
    </Link>
  );
}

function safeName(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

export function Header() {
  const router = useRouter();

  // ✅ evita hydration mismatch: en SSR siempre contamos 0, y en cliente ya mostramos el real
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const cartCount = useCartStore((st) =>
    typeof (st as any).totalItems === "function"
      ? (st as any).totalItems()
      : (st as any).items.reduce((acc: number, it: any) => acc + normalizeQty(it?.qty), 0)
  );
  const safeCartCount = isMounted ? cartCount : 0;

  const pathname = usePathname();
  const sp = useSearchParams();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // ✅ auth
  const [meLoading, setMeLoading] = useState(true);
  const [me, setMe] = useState<any | null>(null);

  // ✅ Profile dropdown (desktop)
  const [profileOpen, setProfileOpen] = useState(false);
  const profileBoxRef = useRef<HTMLDivElement | null>(null);

  // ✅ buscador (desktop + mobile comparten estado)
  const [query, setQuery] = useState("");

  // ✅ autocomplete state
  const [openSuggest, setOpenSuggest] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  // ✅ refs separados para evitar conflictos desktop vs mobile
  const suggestBoxRefDesktop = useRef<HTMLDivElement | null>(null);
  const suggestBoxRefMobile = useRef<HTMLDivElement | null>(null);

  const debounceRef = useRef<number | null>(null);

  // ✅ IDs estables SSR/cliente (reemplaza Math.random)
  const reactId = useId();
  const stableId = useMemo(() => reactId.replace(/[:]/g, ""), [reactId]);

  const ids = useMemo(() => {
    return {
      desktop: `suggestions-desktop-${stableId}`,
      mobile: `suggestions-mobile-${stableId}`,
    };
  }, [stableId]);

  async function refreshMe() {
    setMeLoading(true);
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      const j: MeResponse = await r.json().catch(() => ({ user: null }));
      setMe(j.user ?? null);
    } catch {
      setMe(null);
    } finally {
      setMeLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setMe(null);
      setLoginOpen(false);
      setProfileOpen(false);
      setMobileOpen(false);
      router.refresh();
    }
  }

  function openLogin() {
    // ✅ cerrá todo lo demás antes de abrir
    setProfileOpen(false);
    setMobileOpen(false);
    setOpenSuggest(false);
    setActiveIndex(-1);
    setLoginOpen(true);
  }

  // ✅ click en user desde MOBILE: si no hay sesión -> login; si hay sesión -> /mi-perfil
  function onUserPressMobile() {
    if (meLoading) return;
    if (!me) {
      openLogin();
      return;
    }
    setMobileOpen(false);
    router.push("/mi-perfil");
  }

  // ✅ mount
  useEffect(() => {
    refreshMe();

    const onFocus = () => refreshMe();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ✅ ESC cierra menú mobile, modal login, sugerencias y perfil
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setLoginOpen(false);
        setOpenSuggest(false);
        setActiveIndex(-1);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ✅ click afuera: cierra sugerencias (desktop + mobile)
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const elD = suggestBoxRefDesktop.current;
      const elM = suggestBoxRefMobile.current;

      const insideDesktop = elD?.contains(e.target as Node);
      const insideMobile = elM?.contains(e.target as Node);

      if (!insideDesktop && !insideMobile) {
        setOpenSuggest(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  // ✅ click afuera: cierra profile dropdown (desktop)
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!profileOpen) return;
      const box = profileBoxRef.current;
      if (box && box.contains(e.target as Node)) return;
      setProfileOpen(false);
    };

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [profileOpen]);

  // ✅ si cambio de ruta, cierro dropdowns
  useEffect(() => {
    setProfileOpen(false);
    setOpenSuggest(false);
    setActiveIndex(-1);
    setMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ✅ si estoy en /productos, sincronizo el input con ?q=
  useEffect(() => {
    if (pathname === "/productos") {
      setQuery(sp.get("q") || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, sp]);

  // ✅ Trigger de login por URL: ?login=1&next=/checkout
  // Abre el modal UNA vez y luego limpia el parámetro login=1 para que no se re-dispare solo.
  useEffect(() => {
    if (!isMounted) return;

    const wantsLogin = sp.get("login") === "1";
    if (!wantsLogin) return;

    // cerramos otras cosas por prolijidad
    setProfileOpen(false);
    setMobileOpen(false);
    setOpenSuggest(false);
    setActiveIndex(-1);

    setLoginOpen(true);

    // ✅ limpiar "login=1" pero mantener "next"
    const next = sp.get("next");
    if (next) {
      router.replace(`${pathname}?next=${encodeURIComponent(next)}`);
    } else {
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, sp, pathname]);

  function goSearch(raw: string) {
    const q = raw.trim();
    setMobileOpen(false);
    setOpenSuggest(false);
    setActiveIndex(-1);

    if (!q) {
      router.push("/productos");
      return;
    }

    router.push(`/productos?q=${encodeURIComponent(q)}`);
  }

  async function fetchSuggest(q: string) {
    const qq = q.trim();
    if (qq.length < 2) {
      setSuggestions([]);
      setLoadingSuggest(false);
      return;
    }

    setLoadingSuggest(true);
    try {
      const r = await fetch(`/api/search/suggest?q=${encodeURIComponent(qq)}`, {
        cache: "no-store",
      });
      const data = await r.json();
      const res = Array.isArray(data?.results) ? data.results.slice(0, 5) : [];
      setSuggestions(res);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggest(false);
    }
  }

  function onChangeQuery(next: string) {
    setQuery(next);
    setOpenSuggest(true);
    setActiveIndex(-1);

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetchSuggest(next);
    }, 250);
  }

  function onKeyDownSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      goSearch(query);
      return;
    }

    if (!openSuggest) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => {
        const max = suggestions.length - 1;
        const next = i + 1;
        return next > max ? max : next;
      });
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => {
        const next = i - 1;
        return next < -1 ? -1 : next;
      });
    }

    if (e.key === "Tab") {
      setOpenSuggest(false);
      setActiveIndex(-1);
    }
  }

  function pickSuggestion(s: Suggestion) {
    setQuery(s.title);
    setOpenSuggest(false);
    setActiveIndex(-1);

    const idNum = Number(s.id);
    if (Number.isFinite(idNum) && idNum > 0) {
      router.push(`/productos/${idNum}`);
      return;
    }

    goSearch(s.title);
  }

  function SearchBox({ variant }: { variant: "desktop" | "mobile" }) {
    const showDropdown = openSuggest && query.trim().length >= 2;
    const ref = variant === "desktop" ? suggestBoxRefDesktop : suggestBoxRefMobile;
    const listId = variant === "desktop" ? ids.desktop : ids.mobile;

    return (
      <div ref={ref} className="relative w-full">
        <form
          className={variant === "desktop" ? "relative w-full max-w-[760px]" : "relative"}
          onSubmit={(e) => {
            e.preventDefault();
            goSearch(query);
          }}
        >
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            onFocus={() => {
              setOpenSuggest(true);
              if (query.trim().length >= 2) fetchSuggest(query);
            }}
            onKeyDown={onKeyDownSearch}
            placeholder="Buscá tu producto"
            className={
              variant === "desktop"
                ? "h-11 w-full rounded-full border border-neutral-300 bg-white pl-12 pr-4 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
                : "h-11 w-full rounded-full border border-neutral-300 bg-white pl-12 pr-4 text-[15px] focus:outline-none"
            }
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls={listId}
            aria-activedescendant={
              activeIndex >= 0 && suggestions[activeIndex]
                ? `${listId}-opt-${activeIndex}`
                : undefined
            }
          />
        </form>

        {showDropdown && (
          <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
            <div className="px-4 py-2 text-xs text-neutral-500">
              {loadingSuggest ? "Buscando..." : suggestions.length ? "Sugerencias" : "Sin resultados"}
            </div>

            <ul id={listId} role="listbox" className="max-h-80 overflow-auto">
              {suggestions.map((s, idx) => (
                <li
                  key={String(s.id ?? s.slug ?? s.title)}
                  id={`${listId}-opt-${idx}`}
                  role="option"
                  aria-selected={idx === activeIndex}
                >
                  <button
                    type="button"
                    onClick={() => pickSuggestion(s)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={[
                      "flex w-full items-center justify-between px-4 py-2 text-left text-sm",
                      idx === activeIndex ? "bg-neutral-50" : "bg-white",
                      "hover:bg-neutral-50",
                    ].join(" ")}
                  >
                    <span className="truncate">{s.title}</span>
                    {typeof s.price === "number" && (
                      <span className="ml-3 shrink-0 text-xs text-neutral-600 whitespace-nowrap">
                        {formatARS(s.price)}
                      </span>
                    )}
                  </button>
                </li>
              ))}

              <li className="border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => goSearch(query)}
                  className="w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  Ver todos los resultados →
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ✅ Muestra firstName + lastName si existen, si no cae a username o email
  const displayName =
    safeName(me?.firstName)
      ? `${safeName(me.firstName)}${safeName(me?.lastName) ? " " + safeName(me.lastName) : ""}`
      : safeName(me?.name) ||
        safeName(me?.username) ||
        (typeof me?.email === "string" ? safeName(me.email.split("@")[0]) : null) ||
        "Cuenta";
  const isStoreAdmin = Boolean(me?.isStoreAdmin);

  return (
    <header
      className={[
        "sticky top-0 z-50 border-b bg-white/95 backdrop-blur transition-shadow",
        scrolled ? "shadow-sm" : "shadow-none",
      ].join(" ")}
    >
      <Container>
        <div className="flex h-[72px] items-center justify-between gap-2 md:grid md:grid-cols-[auto_1fr_auto] md:gap-6">
          {/* IZQUIERDA */}
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <Link href="/" className="leading-none">
              <div className="text-[20px] font-extrabold tracking-tight text-neutral-900 sm:text-[22px]">
                Amargo
              </div>
              <div className="text-[20px] font-extrabold tracking-tight text-neutral-900 sm:text-[22px]">
                y Dulce
              </div>
            </Link>

            <nav className="hidden items-center gap-4 md:flex">
              <span className="text-neutral-300">|</span>
              <NavLink href="/productos">Productos</NavLink>
              <span className="text-neutral-300">|</span>
              <NavLink href="/promociones">Promociones</NavLink>
              <span className="text-neutral-300">|</span>
              <NavLink href="/sobre-nosotros">Sobre nosotros</NavLink>
            </nav>
          </div>

          {/* CENTRO */}
          <div className="hidden justify-center lg:flex">
            <div className="relative w-full max-w-[760px]">{SearchBox({ variant: "desktop" })}</div>
          </div>

          {/* DERECHA */}
          <div className="hidden items-center gap-4 md:flex">
            <div className="h-6 w-px bg-neutral-200" />

            <div className="relative" ref={profileBoxRef}>
              {!me && !meLoading ? (
                <button
                  onClick={openLogin}
                  className="flex items-center gap-2 text-[15px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
                  type="button"
                  aria-expanded={loginOpen}
                >
                  <User className="h-5 w-5" />
                  Iniciar sesión
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setLoginOpen(false);
                      setProfileOpen((v) => !v);
                    }}
                    className="flex items-center gap-2 text-[15px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
                    type="button"
                    aria-expanded={profileOpen}
                    disabled={meLoading}
                  >
                    <User className="h-5 w-5" />
                    {meLoading ? "Cargando…" : displayName}
                    {/* ✅ Flechita que rota cuando el dropdown está abierto */}
                    <ChevronDown
                      className={[
                        "h-4 w-4 transition-transform duration-200",
                        profileOpen ? "rotate-180" : "rotate-0",
                      ].join(" ")}
                    />
                  </button>

                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                      <div className="absolute right-0 top-12 z-50">
                        <ProfilePanel
                          variant="dropdown"
                          onClose={() => setProfileOpen(false)}
                          onLogout={logout}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {!isStoreAdmin && (
              <>
                <div className="h-6 w-px bg-neutral-200" />

                <Link
                  href="/carrito"
                  className="relative flex items-center gap-2 text-[15px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
                  aria-label={
                    safeCartCount > 0
                      ? `Carrito, ${safeCartCount} item${safeCartCount === 1 ? "" : "s"}`
                      : "Carrito"
                  }
                >
                  <span className="relative inline-flex">
                    <ShoppingCart className="h-5 w-5" />
                    <CartBadge />
                  </span>
                  Carrito
                  <span className="sr-only">
                    {safeCartCount > 0 ? `, ${safeCartCount} item${safeCartCount === 1 ? "" : "s"}` : ""}
                  </span>
                </Link>
              </>
            )}
          </div>

          {/* MOBILE */}
          <div className="flex shrink-0 min-w-0 items-center justify-end gap-1.5 md:hidden sm:gap-2">
            <button
              type="button"
              onClick={onUserPressMobile}
              className="inline-flex h-11 min-w-0 max-w-[132px] items-center gap-2 rounded-md border border-neutral-200 bg-white px-2.5 text-[14px] font-medium text-neutral-800 sm:max-w-[170px] sm:px-3"
              aria-label={me ? "Mi perfil" : "Iniciar sesión"}
              disabled={meLoading}
            >
              <User className="h-5 w-5" />
              <span className="max-w-[78px] truncate sm:max-w-[120px]">
                {meLoading ? "…" : me ? displayName : "Iniciar sesión"}
              </span>
            </button>

            {!isStoreAdmin && (
              <Link
                href="/carrito"
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-md border border-neutral-200 bg-white"
                aria-label={
                  safeCartCount > 0
                    ? `Carrito, ${safeCartCount} item${safeCartCount === 1 ? "" : "s"}`
                    : "Carrito"
                }
                onClick={() => setMobileOpen(false)}
              >
                <ShoppingCart className="h-5 w-5" />
                <CartBadge />
              </Link>
            )}

            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-neutral-200 bg-white"
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileOpen}
              type="button"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t bg-white md:hidden">
            <div className="py-4">
              {SearchBox({ variant: "mobile" })}

              <nav className="mt-4 flex flex-col gap-3">
                <NavLink href="/productos" onClick={() => setMobileOpen(false)}>
                  Productos
                </NavLink>
                <NavLink href="/promociones" onClick={() => setMobileOpen(false)}>
                  Promociones
                </NavLink>
                <NavLink href="/sobre-nosotros" onClick={() => setMobileOpen(false)}>
                  Sobre nosotros
                </NavLink>
              </nav>
            </div>
          </div>
        )}
      </Container>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          refreshMe();
          setLoginOpen(false);

          const next = sp.get("next");
          if (next) {
            router.push(next);
            return;
          }

          router.refresh();
        }}
      />
    </header>
  );
}
