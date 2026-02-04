"use client";

import { ProfilePanel } from "@/components/profile/ProfilePanel";
import { Container } from "@/components/layout/Container";

export default function MiPerfilClientPage() {
  return (
    <main className="bg-[#fbf7f7]">
      <Container>
        <div className="-mt-2 pt-4 pb-10 md:mt-0 md:pt-10">
          <ProfilePanel variant="page" />
        </div>
      </Container>
    </main>
  );
}
