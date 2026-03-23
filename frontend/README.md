# Amargo y Dulce 🍫

Ecommerce de chocolates artesanales construido con **Next.js 14**, **TypeScript** y **Strapi**. El proyecto resuelve el flujo completo de venta online: catálogo, carrito, checkout, pagos con Mercado Pago, gestión de pedidos, cupones, facturación y emails transaccionales con Brevo.

## 📌 Descripción

**Amargo y Dulce** es una aplicación fullstack orientada a venta directa al consumidor. La interfaz pública está desarrollada con Next.js App Router y consume datos de Strapi mediante REST y GraphQL. Además, expone rutas API internas para checkout, autenticación, pedidos, promociones, reseñas, facturas y webhooks.

**Objetivo del proyecto:** centralizar la experiencia de compra de una tienda de chocolates artesanales, reduciendo trabajo manual en el procesamiento de pedidos, la confirmación de pagos y la comunicación con clientes.

### Resumen rápido

| Campo | Valor |
| --- | --- |
| Nombre | Amargo y Dulce |
| Tipo | Fullstack web app |
| Estado | MVP en evolución / uso productivo |
| Autor | Lucas Tabacchi |
| Demo | [https://amargo-y-dulce.vercel.app](https://amargo-y-dulce.vercel.app) |

## 👀 Demo o preview

La aplicación está pensada para ejecutarse junto con un backend de Strapi. En su flujo actual incluye:

- Home y catálogo de productos
- Vista de detalle por producto
- Carrito y checkout
- Pago con Mercado Pago
- Perfil de usuario, direcciones y pedidos
- Cupones, promociones y facturas
- Confirmación de compra por email con Brevo

## 🧰 Tecnologías utilizadas

- **Next.js 14** con App Router
- **React 18**
- **TypeScript**
- **Tailwind CSS**
- **Zustand** para estado global
- **Strapi** como CMS y backend de negocio
- **GraphQL Request** para consultas a Strapi
- **Mercado Pago** para cobros
- **Brevo** para emails transaccionales
- **Cloudinary** para gestión de imágenes
- **PDFKit** para generación de facturas en PDF

## 🚀 Instalación paso a paso

### 1. Requisitos previos

- Node.js 18 o superior
- npm 9 o superior
- Una instancia de Strapi accesible
- Credenciales de Mercado Pago
- API key de Brevo para emails transaccionales

### 2. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd frontend
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Crear el archivo de entorno

```bash
cp .env.example .env.local
```

En PowerShell:

```powershell
Copy-Item .env.example .env.local
```

### 5. Completar variables de entorno

Configurá `.env.local` con las URLs, tokens y credenciales del entorno.

### 6. Levantar el proyecto en desarrollo

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

### 7. Probar build de producción

```bash
npm run build
npm run start
```

## 🧪 Uso del proyecto

### Flujo principal

1. El usuario navega el catálogo y agrega productos al carrito.
2. Completa el checkout con dirección, envío y método de pago.
3. La aplicación genera una preferencia de pago en Mercado Pago.
4. El webhook actualiza el estado del pedido cuando el pago se acredita.
5. Se genera la confirmación por email mediante Brevo.
6. El cliente puede consultar sus pedidos, cupones y facturas desde su cuenta.

### Casos contemplados

- Catálogo y detalle de productos
- Búsqueda y sugerencias
- Registro/login y sesión
- Gestión de direcciones
- Checkout con validaciones
- Promociones y cupones
- Reseñas y libro de quejas
- Descarga y consulta de facturas
- Administración básica de pedidos

## 🔐 Variables de entorno

Estas son las variables esperadas por el proyecto:

| Variable | Requerida | Descripción |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Sí | URL pública del frontend |
| `NEXT_PUBLIC_STRAPI_URL` | Sí | URL pública de Strapi para el cliente |
| `SITE_URL` | Sí | URL base del frontend en el servidor |
| `STRAPI_URL` | Sí | URL interna o pública del backend Strapi |
| `STRAPI_GRAPHQL_ENDPOINT` | Sí | Endpoint GraphQL, normalmente `/graphql` |
| `STRAPI_API_TOKEN` | Sí | Token API para consumo desde servidor |
| `STRAPI_TOKEN` | Opcional | Alternativa al token anterior según configuración |
| `MP_ACCESS_TOKEN` | Sí | Access token de Mercado Pago |
| `BREVO_API_KEY` | Sí | API key de Brevo para emails transaccionales |
| `EMAIL_FROM` | Sí | Remitente de emails, por ejemplo `Amargo y Dulce <no-reply@tudominio.com>` |
| `EMAIL_FROM_NAME` | Opcional | Nombre visible del remitente |
| `TEST_EMAIL_TO` | Opcional | Fuerza todos los emails a una casilla de prueba |

Ejemplo mínimo:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SITE_URL=http://localhost:3000
STRAPI_URL=http://localhost:1337
STRAPI_GRAPHQL_ENDPOINT=/graphql
STRAPI_API_TOKEN=your_strapi_api_token
MP_ACCESS_TOKEN=your_mercado_pago_access_token
BREVO_API_KEY=your_brevo_api_key
EMAIL_FROM=Amargo y Dulce <no-reply@yourdomain.com>
```

## 📜 Scripts disponibles

| Script | Descripción |
| --- | --- |
| `npm run dev` | Inicia el entorno de desarrollo |
| `npm run build` | Genera el build de producción |
| `npm run start` | Ejecuta la app en modo producción |
| `npm run lint` | Corre ESLint sobre el proyecto |

## 🗂️ Estructura del proyecto

```text
frontend/
├── public/                  # Assets públicos
├── src/
│   ├── app/                 # App Router, páginas y route handlers
│   │   ├── (shop)/          # Rutas públicas de tienda
│   │   ├── api/             # API interna del proyecto
│   │   ├── login/           # Acceso de usuarios
│   │   └── perfil/          # Perfil y cuenta
│   ├── components/          # Componentes reutilizables
│   ├── lib/                 # Utilidades, clientes y helpers server-side
│   ├── store/               # Stores globales con Zustand
│   └── types/               # Tipos TypeScript
├── .env.example             # Variables de entorno de referencia
├── package.json             # Scripts y dependencias
└── README.md
```

## 🔌 API endpoints

La aplicación expone rutas internas mediante Next.js Route Handlers. Los endpoints principales son:

| Endpoint | Método | Descripción |
| --- | --- | --- |
| `/api/products` | `GET` | Lista productos |
| `/api/products/[id]` | `GET` | Obtiene el detalle de un producto |
| `/api/search/suggest` | `GET` | Devuelve sugerencias de búsqueda |
| `/api/auth/google` | `GET` | Inicia autenticación con Google |
| `/api/auth/me` | `GET` | Obtiene el usuario autenticado |
| `/api/auth/logout` | `POST` | Cierra sesión |
| `/api/addresses` | `GET`, `POST` | Lista o crea direcciones del usuario |
| `/api/addresses/[id]` | `PATCH`, `DELETE` | Actualiza o elimina una dirección |
| `/api/orders/create` | `POST` | Crea un pedido |
| `/api/orders/my` | `GET` | Lista pedidos del usuario |
| `/api/orders/[id]` | `GET` | Obtiene un pedido puntual |
| `/api/orders/[id]/status` | `PATCH` | Actualiza estado del pedido |
| `/api/admin/orders` | `GET` | Vista administrativa de pedidos |
| `/api/mp/create-preference` | `POST` | Crea preferencia de pago en Mercado Pago |
| `/api/mp/webhook` | `POST` | Recibe notificaciones de pago |
| `/api/promotions/available` | `GET` | Lista promociones disponibles |
| `/api/promotions/my-coupons` | `GET` | Lista cupones del usuario |
| `/api/promotions/quote` | `POST` | Calcula descuentos/promociones |
| `/api/invoices/generate` | `POST` | Genera factura PDF |
| `/api/invoices/my` | `GET` | Lista facturas del usuario |
| `/api/invoices/download/[invoiceId]` | `GET` | Descarga factura |
| `/api/email/order-confirmation` | `POST` | Envío interno de confirmación por email |
| `/api/reviews` | `GET`, `POST` | Consulta o crea reseñas |
| `/api/complaints` | `POST` | Registra reclamos o libro de quejas |
| `/api/graphql` | `POST` | Proxy o integración GraphQL hacia Strapi |

> Nota: varios endpoints son internos y están pensados para ser consumidos por la propia app, no como API pública para terceros.

## 🤝 Contribución

Si querés contribuir:

1. Hacé un fork del repositorio.
2. Creá una rama para tu cambio.
3. Implementá la mejora con foco en tipado, UX y consistencia con el stack actual.
4. Ejecutá `npm run lint` y `npm run build` antes de abrir el PR.
5. Documentá cambios relevantes en este README o en el código cuando corresponda.

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Podés revisar el texto completo en [LICENSE](C:/Users/lucas/Desktop/frontend-ecommerce/frontend/LICENSE).
