# InstaPNG

App web en **JavaScript puro** (sin dependencias ni build) para descargar imÃ¡genes de publicaciones pÃºblicas de Instagram en **PNG** a la mÃ¡xima resoluciÃ³n disponible.

## Uso

1. Copia el enlace de una publicaciÃ³n (`/p/â€¦`, `/reel/â€¦`, tambiÃ©n carruseles).
2. PÃ©galo y pulsa **Obtener**.
3. Descarga cada imagen en PNG o usa **Descargar todas**.

TambiÃ©n acepta URLs directas de imÃ¡genes y enlaces compartidos como `?url=<enlace>`.

## CÃ³mo funciona

- Lee la pÃ¡gina *embed* pÃºblica de la publicaciÃ³n (`/p/<cÃ³digo>/embed/captioned/`) mediante proxies CORS pÃºblicos con fallback automÃ¡tico.
- Extrae `display_url` (original) de cada elemento del carrusel o, en su defecto, la variante de mayor ancho del `srcset`.
- Descarga la imagen y la re-codifica a PNG sin redimensionar usando `<canvas>`.

## Despliegue en GitHub Pages

1. Sube estos archivos a un repositorio (`index.html`, `styles.css`, `app.js`, `.nojekyll`).
2. En **Settings â†’ Pages**, elige *Deploy from a branch*, rama `main` y carpeta `/ (root)`.
3. Abre `https://<usuario>.github.io/<repo>/`.

Para probar en local: `python -m http.server 8080` y abre `http://localhost:8080`.

## Limitaciones

- Solo contenido pÃºblico. Las cuentas privadas no son accesibles.
- Depende de servicios gratuitos de terceros (lista `HTML_SOURCES` en `app.js`, con límites de uso); si uno falla se prueba el siguiente. Redes corporativas pueden bloquearlos.
- La resoluciÃ³n mÃ¡xima es la que Instagram expone pÃºblicamente (normalmente 1080 px o superior).
- Respeta los derechos de autor: descarga solo contenido propio o con permiso.
