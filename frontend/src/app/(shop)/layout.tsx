import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { UserStateSync } from "@/components/session/UserStateSync";
import { getServerAuthUser } from "@/lib/server/auth-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialUser = await getServerAuthUser();

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#FAF6F6] flex flex-col">
      <UserStateSync />
      <Header initialUser={initialUser} />
      <main className="flex-1">{children}</main>
      <Footer initialUser={initialUser} />
    </div>
  );
}
