import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { UserStateSync } from "@/components/session/UserStateSync";
import { Suspense } from "react";

function HeaderFallback() {
  return <div className="sticky top-0 z-50 h-[72px] border-b bg-white/95 backdrop-blur" />;
}

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-[linear-gradient(180deg,#FAF8F5_0%,#F1EAE2_100%)]">
      <UserStateSync />
      <Suspense fallback={<HeaderFallback />}>
        <Header />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
