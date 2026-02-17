/** @type {import('next').NextConfig} */
const nextConfig = {
  // Evita que el build requiera acceso a Google Fonts (útil en CI/entornos sin red)
  optimizeFonts: false,
  images: {
    remotePatterns: [
      // 🧪 Strapi local (desarrollo)
      {
        protocol: "http",
        hostname: "localhost",
        port: "1337",
        pathname: "/uploads/**",
      },

      // 🚀 Strapi en producción (Render)
      {
        protocol: "https",
        hostname: "strapi-backend-ecommerce-qete.onrender.com",
        pathname: "/uploads/**",
      },

      // ☁️ Cloudinary (imagenes nuevas)
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      

      // 🔁 ngrok (si exponés Strapi)
      // {
      //   protocol: "https",
      //   hostname: "xxxx.ngrok-free.app",
      //   pathname: "/uploads/**",
      // },
    ],
  },
  
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
  },
};

export default nextConfig;
