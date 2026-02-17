import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: {
    default: "Tienda de Chocolates Artesanales",
    template: "%s | Tienda de Chocolates",
  },
  description: "Descubrí los mejores chocolates y bombones artesanales. Calidad premium y envíos a todo el país.",
  keywords: ["chocolate", "bombones", "artesanal", "regalos", "dulces"],
  authors: [{ name: "Manus Next.js Expert" }],
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "https://tutienda.com",
    siteName: "Chocolates Artesanales",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Chocolates Artesanales",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
