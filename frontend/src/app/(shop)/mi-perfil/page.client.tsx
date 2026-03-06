"use client";

import { ProfilePanel } from "@/components/profile/ProfilePanel";
import { Container } from "@/components/layout/Container";
import type { ServerAuthUser } from "@/lib/server/auth-user";
import type { ServerAddress } from "@/lib/server/shop-data";

export default function MiPerfilClientPage({
  initialUser,
  initialAddresses,
}: {
  initialUser: ServerAuthUser | null;
  initialAddresses: ServerAddress[];
}) {
  return (
    <main className="bg-[#fbf7f7]">
      <Container>
        <div className="-mt-2 pt-4 pb-10 md:mt-0 md:pt-10">
          <ProfilePanel
            variant="page"
            initialUser={initialUser}
            initialAddresses={initialAddresses}
          />
        </div>
      </Container>
    </main>
  );
}
