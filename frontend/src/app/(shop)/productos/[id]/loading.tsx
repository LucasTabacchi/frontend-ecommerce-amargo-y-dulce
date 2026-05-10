import { Container } from "@/components/layout/Container";

export default function Loading() {
  return (
    <main>
      <Container>
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
          <p className="text-sm font-medium text-neutral-600">Cargando...</p>
        </div>
      </Container>
    </main>
  );
}
