# Amargo y Dulce - Frontend (Next.js)

Base de Next.js (App Router) preparada para conectar con Strapi.

## Requisitos
- Node.js 18+

## Instalación
```bash
npm install
```

## Variables de entorno
Copiá `.env.example` a `.env.local` y completá los valores:

```bash
cp .env.example .env.local
```

Para el envío de emails transaccionales con Brevo, definí al menos:

```bash
BREVO_API_KEY=tu_api_key_de_brevo
EMAIL_FROM=tienda@tudominio.com
```

Opcionales:

```bash
EMAIL_FROM_NAME=Amargo y Dulce
TEST_EMAIL_TO=tu_correo_verificado@dominio.com
```

## Correr en desarrollo
```bash
npm run dev
```

Abre `http://localhost:3000`.
