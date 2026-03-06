import { Container } from "@/components/layout/Container";
import { InfoStrip } from "@/components/home/InfoStrip";
import { HomeBestSellers } from "@/components/home/HomeBestSellers";
import { strapiGet } from "@/lib/strapi";
import { toCardItem } from "@/lib/strapi-mappers";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { Metadata } from "next";
import { Suspense } from "react";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Inicio | Chocolates Artesanales",
  description: "Bienvenidos a nuestra tienda de chocolates artesanales premium.",
};

type HomePageAttributes = {
  bestSellers?: any[];
  bestSellersTitle?: string | null;
  moreProductsText?: string | null;
};

type StrapiSingleResponse<T> = {
  data:
    | ({
        id: number;
        attributes?: T;
      } & T)
    | null;
};

async function getBestSellers() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await strapiGet<StrapiSingleResponse<HomePageAttributes>>(
      "/api/home-page?populate[bestSellers][populate]=*",
      { next: { revalidate: 3600 }, signal: controller.signal }
    );

    const home = (res?.data?.attributes ?? res?.data) as HomePageAttributes | undefined;
    const raw = home?.bestSellers ?? [];
    return Array.isArray(raw) ? raw.map(toCardItem) : [];
  } catch (error) {
    // Si Strapi está lento o momentáneamente caído, no rompemos la home.
    // Mostramos la página con el resto del contenido y sin best sellers.
    console.error("Error fetching best sellers:", error);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function HomeBestSellersSection() {
  const bestSellers = await getBestSellers();
  return <HomeBestSellers products={bestSellers} />;
}

function HomeBestSellersFallback() {
  return (
    <section className="py-fluid-lg">
      <div className="mx-auto w-full max-w-7xl px-fluid-sm md:px-fluid-md lg:px-fluid-lg">
        <div className="mx-auto h-5 w-64 animate-pulse rounded bg-neutral-200" />
        <div className="mt-fluid-md grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-fluid-md">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[340px] animate-pulse rounded-2xl border bg-white"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  // Slides estáticos (pueden venir de Strapi en el futuro)
  const slides = [
    {
      id: "s1",
      image: "/home/hero-1.jpg",
      alt: "Elegí tus favoritos",
      href: "/productos",
      title: "Elegí tus favoritos",
      subtitle: "Chocolates y bombones artesanales",
      cta: "Comprar ahora",
    },
    {
      id: "s2",
      image: "/home/hero-2.jpg",
      alt: "Promociones",
      href: "/cupones",
      title: "Promociones",
      subtitle: "Ofertas por tiempo limitado",
      cta: "Ver promos",
    },
    {
      id: "s3",
      image: "/home/hero-3.jpg",
      alt: "Nuevos productos",
      href: "/productos",
      title: "Nuevos productos",
      subtitle: "Descubrí lo último en la tienda",
      cta: "Ver productos",
    },
  ];

  return (
    <>
      <Container>
        <div className="pt-8 pb-14">
          <HeroCarousel slides={slides} intervalMs={4500} />
        </div>
      </Container>
      <Container>
        <div className="-mt-10 relative z-10 mb-10">
          <InfoStrip />
        </div>
      </Container>
      <Container>
        <div className="pb-16">
          <Suspense fallback={<HomeBestSellersFallback />}>
            <HomeBestSellersSection />
          </Suspense>
        </div>
      </Container>
    </>
  );
}
