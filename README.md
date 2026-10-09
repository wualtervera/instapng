# InstaPNG

App web en **JavaScript puro** (sin dependencias ni build) para descargar imágenes de publicaciones públicas de Instagram en **PNG** a la máxima resolución disponible.

**Demo:** https://wualtervera.github.io/instapng/

## Uso

1. Copia el enlace de una publicación (`/p/…`, `/reel/…`, también carruseles).
2. Pégalo y pulsa **Obtener**.
3. Descarga cada imagen en PNG o usa **Descargar todas**.

También acepta URLs directas de imágenes y enlaces compartidos como `?url=<enlace>`.

## Cómo funciona

- Lee la página *embed* pública de la publicación (`/p/<código>/embed/captioned/`) a través de [r.jina.ai](https://jina.ai/reader) (con CORS), con proxies públicos como fallback.
- Extrae `display_url` (original) de cada elemento del carrusel o, en su defecto, la variante de mayor ancho del `srcset`.
- Descarga la imagen y la re-codifica a PNG sin redimensionar usando `<canvas>`.

## Despliegue en GitHub Pages

1. Sube estos archivos a un repositorio (`index.html`, `styles.css`, `app.js`, `.nojekyll`).
2. En **Settings → Pages**, elige *Deploy from a branch*, rama `main` y carpeta `/ (root)`.
3. Abre `https://<usuario>.github.io/<repo>/`.

Para probar en local: `python -m http.server 8080` y abre `http://localhost:8080`.

## Limitaciones

- Solo contenido público. Las cuentas privadas no son accesibles.
- Depende de servicios gratuitos de terceros (lista `HTML_SOURCES` en `app.js`, con límites de uso); si uno falla se prueba el siguiente. Redes corporativas pueden bloquearlos.
- La resolución máxima es la que Instagram expone públicamente (normalmente 1080 px o superior).
- Respeta los derechos de autor: descarga solo contenido propio o con permiso.
