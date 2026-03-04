import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { UserStateSync } from "@/components/session/UserStateSync";
import { Suspense } from "react";
import { getServerAuthUser } from "@/lib/server/auth-user";
import Link from "next/link";
import { Container } from "@/components/layout/Container";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function HeaderWithAuth() {
  const initialUser = await getServerAuthUser();
  return <Header initialUser={initialUser} />;
}

async function FooterWithAuth() {
  const initialUser = await getServerAuthUser();
  return <Footer initialUser={initialUser} />;
}

function HeaderFallback() {
  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
      <Container>
        <div className="flex h-[72px] items-center justify-between gap-2 md:grid md:grid-cols-[auto_1fr_auto] md:gap-6">
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
              <Link
                href="/productos"
                className="text-[15px] font-medium text-neutral-700 hover:text-neutral-900 hover:underline underline-offset-4 transition-colors"
              >
                Productos
              </Link>
              <span className="text-neutral-300">|</span>
              <Link
                href="/cupones"
                className="text-[15px] font-medium text-neutral-700 hover:text-neutral-900 hover:underline underline-offset-4 transition-colors"
              >
                Cupones
              </Link>
              <span className="text-neutral-300">|</span>
              <Link
                href="/sobre-nosotros"
                className="text-[15px] font-medium text-neutral-700 hover:text-neutral-900 hover:underline underline-offset-4 transition-colors"
              >
                Sobre nosotros
              </Link>
            </nav>
          </div>

          <div className="hidden justify-center lg:flex">
            <div className="h-11 w-full max-w-[760px] rounded-full border border-neutral-300 bg-white" />
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <div className="h-6 w-px bg-neutral-200" />
            <div className="h-6 w-32 rounded bg-neutral-100" />
            <div className="h-6 w-px bg-neutral-200" />
            <div className="h-6 w-16 rounded bg-neutral-100" />
          </div>
        </div>
      </Container>
    </header>
  );
}

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#FAF6F6] flex flex-col">
      <UserStateSync />
      <Suspense fallback={<HeaderFallback />}>
        <HeaderWithAuth />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Suspense fallback={<Footer initialUser={null} />}>
        <FooterWithAuth />
      </Suspense>
    </div>
  );
}
