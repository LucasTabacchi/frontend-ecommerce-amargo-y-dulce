import MiPerfilPage from "./page.client";
import { getServerAuthUser } from "@/lib/server/auth-user";
import { getServerAddresses } from "@/lib/server/shop-data";

export default async function Page() {
  const user = await getServerAuthUser();
  const addresses = user && !user.isStoreAdmin ? await getServerAddresses(user) : [];

  return <MiPerfilPage initialUser={user} initialAddresses={addresses} />;
}
