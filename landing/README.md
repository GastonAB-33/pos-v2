# Jireh POS - Landing Page Oficial (Standalone)

Este proyecto contiene la **Landing Page pública oficial de Jireh POS**, completamente desacoplada y separada del código fuente del sistema punto de venta.

## ¿Por qué está separada del Sistema POS?
1. **Seguridad y Confidencialidad**: Los visitantes de la web comercial nunca descargan el código fuente, rutas internas, esquemas de bases de datos ni lógica de transacciones del POS.
2. **Rendimiento y SEO**: Carga ultrarrápida, optimizada para motores de búsqueda (Google), sin el peso de las librerías del sistema operativo (AFIP, balanzas, reportes, Excel, etc.).
3. **Independencia Operativa**: Permite cambiar precios, promociones y textos de marketing sin necesidad de re-desplegar ni interrumpir el sistema de cajas donde los comercios están cobrando.

## Variables de Entorno
Crea un archivo `.env` en la raíz de esta carpeta si deseas modificar los destinos por defecto:

```bash
# URL donde se encuentra hosteado el sistema POS (donde los usuarios inician sesión)
VITE_POS_APP_URL=https://app.jirehpos.com

# Número de WhatsApp de atención y soporte (formato internacional sin signos)
VITE_SUPPORT_WHATSAPP_PHONE=5492664689173
```

## Ejecución Local
```bash
npm install
npm run dev
```
La landing correrá en `http://localhost:5174`.

## Build para Producción
```bash
npm run build
```
Generará la carpeta estática `dist/` lista para subir a **Vercel**, **Netlify**, **Cloudflare Pages** o cualquier servidor web (Nginx/Apache).
