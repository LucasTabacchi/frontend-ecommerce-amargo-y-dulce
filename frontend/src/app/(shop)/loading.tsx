import { Container } from "@/components/layout/Container";

export default function Loading() {
  return (
    <main>
      <Container>
        <div className="pt-8 pb-14">
          <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="h-[40dvh] w-full animate-pulse bg-neutral-200 sm:h-[50dvh] md:h-[540px]" />
          </div>
        </div>
      </Container>

      <Container>
        <div className="-mt-10 relative z-10 mb-10 grid grid-cols-1 gap-2 rounded-xl border border-neutral-200 bg-white p-2 shadow-sm md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-200" />
          ))}
        </div>
      </Container>

      <Container>
        <div className="pb-16">
          <div className="mb-8 flex justify-center">
            <div className="h-6 w-64 animate-pulse rounded bg-neutral-200" />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
              >
                <div className="h-52 w-full animate-pulse bg-neutral-200" />
                <div className="space-y-3 p-4">
                  <div className="h-5 w-3/4 animate-pulse rounded bg-neutral-200" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200" />
                  <div className="h-10 w-36 animate-pulse rounded-full bg-neutral-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </main>
  );
}
