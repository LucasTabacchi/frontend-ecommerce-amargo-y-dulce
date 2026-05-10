import { Container } from "@/components/layout/Container";

export default function Loading() {
  return (
    <main>
      <Container>
        <div className="pt-8">
          <div className="h-5 w-36 animate-pulse rounded bg-neutral-200" />
        </div>

        <div className="pt-6 pb-6">
          <div className="h-9 w-full max-w-md animate-pulse rounded bg-neutral-200" />
          <div className="mt-3 h-4 w-24 animate-pulse rounded bg-neutral-200" />
        </div>

        <div className="grid gap-8 pb-14 lg:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border bg-white">
            <div className="aspect-[4/3] w-full animate-pulse bg-neutral-100" />
          </section>

          <aside className="h-fit rounded-2xl border bg-white p-6 lg:p-7">
            <div className="h-9 w-40 animate-pulse rounded bg-neutral-200" />
            <div className="mt-6 space-y-3">
              <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
              <div className="h-4 w-full animate-pulse rounded bg-neutral-200" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-neutral-200" />
            </div>
            <div className="mt-6 h-12 w-full animate-pulse rounded-full bg-neutral-200" />
          </aside>
        </div>
      </Container>
    </main>
  );
}
