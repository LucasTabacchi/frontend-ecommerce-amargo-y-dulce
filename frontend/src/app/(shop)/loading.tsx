import { Container } from "@/components/layout/Container";

export default function Loading() {
  return (
    <Container>
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
        <p className="text-sm font-medium text-neutral-600">Cargando delicias...</p>
      </div>
    </Container>
  );
}
