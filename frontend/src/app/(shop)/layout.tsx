import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { UserStateSync } from "@/components/session/UserStateSync";
import { Suspense } from "react";
import { getServerAuthUser } from "@/lib/server/auth-user";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialUser = await getServerAuthUser();

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#FAF6F6] flex flex-col">
      <UserStateSync />
      <Suspense fallback={<div className="h-16 bg-white" />}>
        <Header initialUser={initialUser} />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Footer initialUser={initialUser} />
    </div>
  );
}
