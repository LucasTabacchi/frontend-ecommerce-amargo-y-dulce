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
    <div className="min-h-screen min-h-[100dvh] bg-[#FAF6F6] flex flex-col">
      <UserStateSync />
      <Suspense fallback={<HeaderFallback />}>
        <Header />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
