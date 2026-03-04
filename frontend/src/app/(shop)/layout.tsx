import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { UserStateSync } from "@/components/session/UserStateSync";
import { Suspense } from "react";
import { getServerAuthUser } from "@/lib/server/auth-user";

async function HeaderWithAuth() {
  const initialUser = await getServerAuthUser();
  return <Header initialUser={initialUser} />;
}

async function FooterWithAuth() {
  const initialUser = await getServerAuthUser();
  return <Footer initialUser={initialUser} />;
}

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#FAF6F6] flex flex-col">
      <UserStateSync />
      <Suspense fallback={<div className="h-16 bg-white" />}>
        <HeaderWithAuth />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Suspense fallback={<Footer initialUser={null} />}>
        <FooterWithAuth />
      </Suspense>
    </div>
  );
}
