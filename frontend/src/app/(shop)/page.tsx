import { Container } from "@/components/layout/Container";
import { InfoStrip } from "@/components/home/InfoStrip";
import { HomeBestSellers } from "@/components/home/HomeBestSellers";
import { strapiGet } from "@/lib/strapi";
import { toCardItem } from "@/lib/strapi-mappers";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

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
  try {
    const res = await strapiGet<StrapiSingleResponse<HomePageAttributes>>(
      "/api/home-page?populate[bestSellers][populate]=*",
      { cache: "no-store" }
    );

    const home = (res?.data?.attributes ?? res?.data) as HomePageAttributes | undefined;
    const raw = home?.bestSellers ?? [];
    return Array.isArray(raw) ? raw.map(toCardItem) : [];
  } catch (error) {
    console.error("Error fetching best sellers:", error);
    return [];
  }
}

export default async function HomePage() {
  const bestSellers = await getBestSellers();

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
      alt: "Cupones",
      href: "/cupones",
      title: "Cupones",
      subtitle: "Ofertas por tiempo limitado",
      cta: "Ver cupones",
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
          <HomeBestSellers products={bestSellers} />
        </div>
      </Container>
    </>
  );
}
