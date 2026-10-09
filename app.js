// InstaPNG — descarga imágenes públicas de Instagram en PNG (JS puro, sin dependencias).

// Lectores/proxies con CORS para obtener la página embed (en orden de preferencia).
const HTML_SOURCES = [
  { url: (u) => `https://r.jina.ai/${u}`, headers: { 'X-Return-Format': 'html' } },
  { url: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
  { url: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}` },
  { url: (u) => `https://api.cors.lol/?url=${encodeURIComponent(u)}` },
];
// Fallback para imágenes (el CDN de Instagram normalmente permite CORS directo).
const IMAGE_PROXIES = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];
const TIMEOUT_MS = 30000;

const $ = (s) => document.querySelector(s);
const form = $('#form');
const input = $('#url');
const submitBtn = $('#submit');
const statusEl = $('#status');
const results = $('#results');
const toolbar = $('#toolbar');
const countEl = $('#count');
const tpl = $('#card-tpl');

let items = []; // { blob: PNG Blob, name }

// ---------- utilidades ----------

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', isError);
}

function setLoading(on) {
  submitBtn.disabled = on;
  submitBtn.classList.toggle('loading', on);
}

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function parseInput(raw) {
  let url;
  try { url = new URL(raw.trim()); } catch { return null; }
  if (/(^|\.)instagram\.com$/i.test(url.hostname)) {
    const m = url.pathname.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    return m ? { type: 'post', code: m[1] } : null;
  }
  return { type: 'direct', url: url.href };
}

// Decodifica secuencias \uXXXX (con cualquier nivel de escape) y elimina barras invertidas.
function unescapeUrl(s) {
  return s
    .replace(/\\+u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\+/g, '')
    .replace(/&amp;/g, '&');
}

function dedupe(urls) {
  const seen = new Set();
  return urls.filter((u) => {
    let key;
    try { key = new URL(u).pathname.split('/').pop(); } catch { return false; }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------- obtención de datos ----------

async function fetchPostHtml(url) {
  let lastErr;
  for (const src of HTML_SOURCES) {
    try {
      const res = await fetchWithTimeout(src.url(url), { headers: src.headers || {} });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // Algunos proxies devuelven páginas de bloqueo o la versión sin datos: validar contenido.
      if (text && /EmbeddedMediaImage|display_url/.test(text)) return text;
      throw new Error('Respuesta sin datos de la publicación');
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('No se pudo conectar');
}

async function fetchImageBlob(url) {
  const attempts = [url, ...IMAGE_PROXIES.map((p) => p(url))];
  let lastErr;
  for (const u of attempts) {
    try {
      const res = await fetchWithTimeout(u, { mode: 'cors', referrerPolicy: 'no-referrer' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (!blob.size || (blob.type && !blob.type.startsWith('image/') && blob.type !== 'application/octet-stream')) {
        throw new Error('No es una imagen');
      }
      return blob;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('No se pudo descargar la imagen');
}

function extractImageUrls(html) {
  const urls = [];

  // 1) JSON embebido (contextJSON / gql_data): display_url es la mayor resolución disponible.
  const re = /display_url\\*"\s*:\s*\\*"(.*?)\\*"/g;
  let m;
  while ((m = re.exec(html))) urls.push(unescapeUrl(m[1]));

  // 2) Fallback: srcset de la imagen embebida, eligiendo el ancho máximo.
  if (!urls.length) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    let imgs = doc.querySelectorAll('img.EmbeddedMediaImage');
    if (!imgs.length) imgs = doc.querySelectorAll('.EmbeddedMedia img');
    imgs.forEach((img) => {
      const srcset = img.getAttribute('srcset');
      if (srcset) {
        const best = srcset.split(',')
          .map((p) => p.trim().split(/\s+/))
          .map(([u, w]) => ({ u, w: parseInt(w, 10) || 0 }))
          .sort((a, b) => b.w - a.w)[0];
        if (best) urls.push(unescapeUrl(best.u));
      } else if (img.src && /cdninstagram|fbcdn/.test(img.src)) {
        urls.push(unescapeUrl(img.getAttribute('src')));
      }
    });
  }

  return dedupe(urls.filter((u) => /^https?:\/\//.test(u)));
}

async function getPostImages(code) {
  const embeds = [
    `https://www.instagram.com/p/${code}/embed/captioned/`,
    `https://www.instagram.com/p/${code}/embed/`,
  ];
  let connected = false;
  for (const e of embeds) {
    try {
      const html = await fetchPostHtml(e);
      connected = true;
      const urls = extractImageUrls(html);
      if (urls.length) return urls;
    } catch { /* probar siguiente */ }
  }
  throw new Error(connected
    ? 'No se encontraron imágenes. ¿La publicación es pública?'
    : 'No se pudo conectar con Instagram (proxies no disponibles o bloqueados por tu red). Inténtalo más tarde.');
}

// ---------- conversión a PNG ----------

async function toPng(blob) {
  let source;
  try {
    source = await createImageBitmap(blob);
  } catch {
    source = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Imagen no válida'));
      img.src = URL.createObjectURL(blob);
    });
  }
  const w = source.naturalWidth || source.width;
  const h = source.naturalHeight || source.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  source.close?.();
  const png = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  if (!png) throw new Error('No se pudo generar el PNG');
  return { png, w, h };
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------- UI ----------

function addCard(index, name) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  const img = node.querySelector('img');
  const res = node.querySelector('.res');
  const btn = node.querySelector('.dl');
  btn.disabled = true;
  res.textContent = 'Procesando…';
  results.appendChild(node);
  return {
    ready(png, w, h) {
      img.src = URL.createObjectURL(png);
      img.alt = `Imagen ${index + 1}`;
      res.textContent = `${w} × ${h} px`;
      btn.disabled = false;
      btn.onclick = () => download(png, name);
    },
    fail(msg) {
      res.textContent = msg;
      node.style.opacity = '.6';
    },
  };
}

function resetResults() {
  results.querySelectorAll('img').forEach((i) => i.src && URL.revokeObjectURL(i.src));
  results.innerHTML = '';
  toolbar.hidden = true;
  items = [];
}

async function processUrls(urls, baseName) {
  let ok = 0;
  await Promise.all(urls.map(async (u, i) => {
    const name = urls.length > 1 ? `${baseName}_${i + 1}.png` : `${baseName}.png`;
    const card = addCard(i, name);
    try {
      const blob = await fetchImageBlob(u);
      const { png, w, h } = await toPng(blob);
      card.ready(png, w, h);
      items[i] = { blob: png, name };
      ok++;
    } catch (e) {
      card.fail('Error al cargar');
    }
  }));
  return ok;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const parsed = parseInput(input.value);
  if (!parsed) {
    setStatus('Enlace no válido. Usa un enlace de publicación (/p/…) o una URL de imagen.', true);
    return;
  }

  resetResults();
  setLoading(true);
  try {
    let urls, baseName;
    if (parsed.type === 'post') {
      setStatus('Buscando imágenes…');
      urls = await getPostImages(parsed.code);
      baseName = `instagram_${parsed.code}`;
    } else {
      urls = [parsed.url];
      baseName = `imagen_${Date.now()}`;
    }

    setStatus(`Convirtiendo ${urls.length} imagen(es) a PNG…`);
    const ok = await processUrls(urls, baseName);
    if (!ok) throw new Error('No se pudieron descargar las imágenes. Inténtalo de nuevo.');

    setStatus(`Listo · ${ok} imagen(es) en PNG`);
    countEl.textContent = `${ok} de ${urls.length} imagen(es)`;
    toolbar.hidden = ok < 2;
  } catch (err) {
    setStatus(err.message || 'Ocurrió un error', true);
  } finally {
    setLoading(false);
  }
});

$('#downloadAll').addEventListener('click', async () => {
  for (const it of items.filter(Boolean)) {
    download(it.blob, it.name);
    await new Promise((r) => setTimeout(r, 350));
  }
});

$('#paste').addEventListener('click', async () => {
  try {
    input.value = (await navigator.clipboard.readText()).trim();
    input.focus();
  } catch {
    setStatus('No se pudo leer el portapapeles. Pega manualmente (Ctrl+V).', true);
  }
});

// Permite compartir enlaces como ?url=...
const shared = new URLSearchParams(location.search).get('url');
if (shared) {
  input.value = shared;
  form.requestSubmit();
}
