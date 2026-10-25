/* =====================================================================================
   MEDICIÓN PROPIA (Supabase) · Tavo El Importador
   Registra, sin datos personales (ni nombres, ni teléfonos, ni IP), cómo usan la página los
   visitantes: visitas, de dónde llegan, qué equipos miran, hasta dónde bajan, cuánto tiempo se
   quedan y cada clic en WhatsApp, Llamar, fichas, fotos y el formulario.
   Los números se ven en panel.html (solo propietarios, con correo y contraseña).

   CONFIGURACIÓN · pegue aquí los dos datos de Supabase › Project Settings › API Keys:
     url      "Project URL", por ejemplo https://abcdefghijk.supabase.co
     anonKey  la clave PÚBLICA: "anon" (empieza por eyJ…) o "publishable" (empieza por sb_publishable_…).
              NUNCA la "service_role" ni la "secret": esas dan acceso total y aquí las vería cualquiera.
   Mientras estén vacíos no se envía nada.

   No medir su propio celular o computador: abra la página una vez con ?no_medir=1 al final
   (por ejemplo https://su-dominio.com/?no_medir=1). Para volver a medirlo: ?medir=1.
   Entrar al panel también deja de medir ese navegador.
   Ver en la consola del navegador lo que se mide: ?debug_medicion=1 (se quita con ?debug_medicion=0).
   ===================================================================================== */
window.TAVO_SUPABASE = {
  url: 'https://ahjbtuazzdsksxmucvkv.supabase.co',
  anonKey: 'sb_publishable_ltZTRFdmSja9Ol0w9TeV_Q_B_iYRmIG'
};

(function () {
  'use strict';
  var CFG = window.TAVO_SUPABASE, W = window, D = document, L = location, N = navigator;

  /* ---------- almacenamiento (puede estar bloqueado: modo privado, cookies desactivadas) ---------- */
  function lee(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guarda(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function borra(k) { try { localStorage.removeItem(k); } catch (e) {} }

  var q;
  try { q = new URLSearchParams(L.search); } catch (e) { q = { has: function () { return false; }, get: function () { return null; } }; }
  if (q.has('no_medir')) guarda('tavo_no_medir', '1');
  if (q.has('medir')) borra('tavo_no_medir');
  if (q.has('debug_medicion')) { if (q.get('debug_medicion') === '0') borra('tavo_debug'); else guarda('tavo_debug', '1'); }
  var DEBUG = lee('tavo_debug') === '1';

  if (W.TAVO_NO_MEDIR || lee('tavo_no_medir') === '1') return;
  var UA = N.userAgent || '';
  if (!DEBUG && (N.webdriver || /bot|crawl|spider|slurp|lighthouse|headless|prerender|facebookexternalhit|embedly|preview/i.test(UA))) return;

  /* ---------- catálogo ---------- */
  var PRODUCTOS = ['tala-530', 'tala-680', 'tala-1000', 'tala-1400', 'tala-1550', 'cat-305', 'cat-308', 're4cx'];
  var ruta = L.pathname.replace(/\/index\.html?$/i, '/').replace(/\.html?$/i, '').replace(/\/+$/, '');
  var PAGINA = ruta ? ruta.replace(/^\//, '').slice(0, 120) : 'inicio';
  var PRODUCTO_PAGINA = { 'martillo-hidraulico-tala-1550': 'tala-1550', 'excavadora-cat-305': 'cat-305' }[PAGINA] || null;

  function uid() {
    try { if (W.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
  function corta(v, n) { return v == null || v === '' ? null : String(v).slice(0, n); }

  /* ---------- visitante y sesión (una sesión termina tras 30 minutos sin actividad) ---------- */
  var ahora = Date.now();
  var visitante = lee('tavo_vis');
  if (!visitante) { visitante = uid(); guarda('tavo_vis', visitante); }

  var utm = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) { utm[k] = corta(q.get(k), 150); });
  var clicGoogle = q.has('gclid') || q.has('gbraid') || q.has('wbraid');
  var clicMeta = q.has('fbclid');
  var refHost = '';
  try { refHost = D.referrer ? new URL(D.referrer).hostname.toLowerCase() : ''; } catch (e) {}
  var refExterno = refHost && refHost !== L.hostname.toLowerCase() ? refHost : '';

  var ses = null;
  try { ses = JSON.parse(lee('tavo_ses') || 'null'); } catch (e) {}
  var campanaNueva = !!(utm.utm_source || clicGoogle) && !(ses && ses.c === (utm.utm_campaign || '') + '|' + (utm.utm_source || '') + '|' + clicGoogle);
  if (!ses || !ses.id || ahora - (ses.t || 0) > 30 * 60 * 1000 || campanaNueva) {
    ses = { id: uid(), t: ahora, nueva: true, c: (utm.utm_campaign || '') + '|' + (utm.utm_source || '') + '|' + clicGoogle };
  }
  var esNuevo = lee('tavo_vis_ses1');
  if (!esNuevo) { guarda('tavo_vis_ses1', ses.id); esNuevo = ses.id; }
  var NUEVO = esNuevo === ses.id;
  function toca() { ses.t = Date.now(); delete ses.nueva; guarda('tavo_ses', JSON.stringify(ses)); }
  var SESION_NUEVA = !!ses.nueva;
  toca();

  /* ---------- de dónde llega (canal) ---------- */
  function canal() {
    var s = (utm.utm_source || '').toLowerCase(), m = (utm.utm_medium || '').toLowerCase();
    var pago = /cpc|ppc|paid|pago|ads|display|pmax|search/.test(m);
    if (clicGoogle || (/google|adwords/.test(s) && pago)) return 'Google Ads';
    if ((/facebook|instagram|meta|^fb$|^ig$/.test(s) && pago)) return 'Meta Ads (Facebook/Instagram)';
    if (utm.utm_source) return 'Campaña: ' + utm.utm_source;
    var h = refExterno;
    if (clicMeta && !h) return 'Facebook';
    if (!h) return 'Directo';
    if (/(^|\.)google\./.test(h)) return 'Google (búsqueda)';
    if (/(^|\.)(bing|yahoo|duckduckgo|ecosia|search\.brave)\./.test(h)) return 'Otros buscadores';
    if (/instagram\./.test(h)) return 'Instagram';
    if (/(^|\.)(facebook|fb|messenger)\./.test(h) || /^l\.facebook|^lm\.facebook/.test(h)) return 'Facebook';
    if (/whatsapp|^wa\.me$/.test(h)) return 'WhatsApp';
    if (/tiktok/.test(h)) return 'TikTok';
    if (/youtube|youtu\.be/.test(h)) return 'YouTube';
    if (/linkedin|lnkd\.in/.test(h)) return 'LinkedIn';
    if (/^t\.co$|twitter\.|(^|\.)x\.com$/.test(h)) return 'X (Twitter)';
    return h.replace(/^www\./, '');
  }

  /* ---------- equipo del visitante ---------- */
  var ipadDesk = /Macintosh/.test(UA) && N.maxTouchPoints > 1;
  var DISPOSITIVO = /iPad|Tablet|PlayBook|Silk|Kindle/i.test(UA) || ipadDesk || (/Android/i.test(UA) && !/Mobile/i.test(UA)) ? 'tableta'
    : /Mobi|iPhone|iPod|Android|Windows Phone/i.test(UA) ? 'celular' : 'computador';
  var SISTEMA = /iPhone|iPad|iPod/.test(UA) || ipadDesk ? 'iOS' : /Android/i.test(UA) ? 'Android' : /Windows/i.test(UA) ? 'Windows'
    : /Mac OS X|Macintosh/.test(UA) ? 'macOS' : /CrOS/.test(UA) ? 'ChromeOS' : /Linux/i.test(UA) ? 'Linux' : 'otro';
  var NAVEGADOR = /FBAN|FBAV|FB_IAB/.test(UA) ? 'Facebook (dentro de la app)' : /Instagram/.test(UA) ? 'Instagram (dentro de la app)'
    : /TikTok|musical_ly|BytedanceWebview/i.test(UA) ? 'TikTok (dentro de la app)' : /Edg\//.test(UA) ? 'Edge' : /OPR\/|Opera/.test(UA) ? 'Opera'
    : /SamsungBrowser/.test(UA) ? 'Samsung Internet' : /CriOS|Chrome\//.test(UA) ? 'Chrome' : /FxiOS|Firefox\//.test(UA) ? 'Firefox'
    : /Safari\//.test(UA) ? 'Safari' : 'otro';
  var ZONA = null;
  try { ZONA = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) {}

  var VISTA = uid();
  var COLUMNAS = ['visitante', 'sesion', 'vista_id', 'evento', 'pagina', 'producto', 'ubicacion', 'detalle', 'valor', 'host',
    'referente', 'fuente', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid',
    'dispositivo', 'sistema', 'navegador', 'idioma', 'zona_horaria', 'pantalla', 'nuevo'];

  /* ---------- envío: en grupos, cada 2 s y siempre antes de salir de la página ---------- */
  var cola = [], reloj = null;
  function enviar() {
    clearTimeout(reloj); reloj = null;
    if (!cola.length) return;
    var lote = cola; cola = [];
    if (!CFG.url || !CFG.anonKey) return;
    var h = { 'apikey': CFG.anonKey, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
    if (/^eyJ/.test(CFG.anonKey)) h.Authorization = 'Bearer ' + CFG.anonKey;
    try {
      fetch(CFG.url.replace(/\/+$/, '') + '/rest/v1/eventos', {
        method: 'POST', headers: h, body: JSON.stringify(lote), keepalive: true, credentials: 'omit'
      }).then(function (r) {
        if (!r.ok && DEBUG) r.text().then(function (t) { console.warn('[medición] Supabase respondió', r.status, t); });
      }).catch(function (e) { if (DEBUG) console.warn('[medición] no se pudo enviar', e); });
    } catch (e) {}
  }

  function registrar(evento, d) {
    d = d || {};
    toca();
    var f = {
      visitante: visitante, sesion: ses.id, vista_id: VISTA, evento: evento, pagina: PAGINA,
      producto: corta(d.producto, 40), ubicacion: corta(d.ubicacion, 80), detalle: corta(d.detalle, 300),
      valor: typeof d.valor === 'number' && isFinite(d.valor) ? Math.max(0, Math.min(100000, Math.round(d.valor))) : null,
      host: corta(L.hostname, 120), dispositivo: DISPOSITIVO, sistema: SISTEMA, navegador: NAVEGADOR,
      idioma: corta(N.language, 20), zona_horaria: corta(ZONA, 60),
      pantalla: corta((W.screen ? screen.width + 'x' + screen.height : ''), 20), nuevo: NUEVO, gclid: false
    };
    if (evento === 'vista') {   // de dónde llegó: solo en la vista de página, para no repetirlo en cada evento
      f.fuente = corta(SESION_NUEVA ? canal() : null, 80);
      f.referente = corta(refExterno ? D.referrer.split('?')[0] : null, 500);
      f.gclid = clicGoogle;
      for (var k in utm) f[k] = utm[k];
    }
    var fila = {};
    COLUMNAS.forEach(function (c) { fila[c] = f[c] === undefined ? null : f[c]; });
    if (DEBUG) console.log('[medición]', evento, fila);
    cola.push(fila);
    if (cola.length >= 20) enviar();
    else if (!reloj) reloj = setTimeout(enviar, 2000);
  }
  W.tavoMedir = registrar;   // para eventos propios: tavoMedir('enlace', {detalle: 'algo'})

  /* ---------- 1. vista de la página ---------- */
  registrar('vista', { producto: PRODUCTO_PAGINA });
  if (PRODUCTO_PAGINA) registrar('producto', { producto: PRODUCTO_PAGINA, ubicacion: 'pagina-propia' });

  /* ---------- 2. equipos y secciones que el visitante realmente ve ---------- */
  function idProducto(el) { return el.id === 'retro' ? 're4cx' : el.id; }
  function visible(e) {
    var vh = W.innerHeight || 800;
    return e.intersectionRatio >= 0.5 || (e.intersectionRect && e.intersectionRect.height >= vh * 0.5);
  }
  if ('IntersectionObserver' in W) {
    var umbrales = [0, 0.25, 0.35, 0.5, 0.75, 1];
    if (!PRODUCTO_PAGINA) {
      var vistos = {};
      var obsProd = new IntersectionObserver(function (en) {
        en.forEach(function (e) {
          var el = e.target, p = idProducto(el);
          if (vistos[p]) return;
          if (visible(e)) {
            if (!el._tm) el._tm = setTimeout(function () { vistos[p] = 1; registrar('producto', { producto: p, ubicacion: 'tarjeta' }); obsProd.unobserve(el); }, 1000);
          } else if (el._tm) { clearTimeout(el._tm); el._tm = null; }
        });
      }, { threshold: umbrales });
      PRODUCTOS.forEach(function (p) {
        var el = D.getElementById(p === 're4cx' ? 'retro' : p);
        if (el) obsProd.observe(el);
      });
    }
    var secVistas = {};
    var obsSec = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        var id = e.target.id;
        if (secVistas[id] || !(e.intersectionRatio >= 0.35 || (e.intersectionRect && e.intersectionRect.height >= (W.innerHeight || 800) * 0.5))) return;
        secVistas[id] = 1; registrar('seccion', { detalle: id }); obsSec.unobserve(e.target);
      });
    }, { threshold: umbrales });
    [].forEach.call(D.querySelectorAll('main section[id]'), function (s) { obsSec.observe(s); });
  }

  /* ---------- 3. hasta dónde baja (25, 50, 75 y 100 %) ---------- */
  var maxScroll = 0, marcas = [25, 50, 75, 100], pend = false;
  function midaScroll() {
    pend = false;
    var de = D.documentElement, alto = Math.max(de.scrollHeight, D.body ? D.body.scrollHeight : 0);
    var pct = alto <= 0 ? 100 : Math.min(100, ((W.scrollY || de.scrollTop) + W.innerHeight) / alto * 100);
    if (pct >= 98) pct = 100;
    if (pct > maxScroll) maxScroll = pct;
    while (marcas.length && maxScroll >= marcas[0]) registrar('scroll', { valor: marcas.shift() });
  }
  W.addEventListener('scroll', function () { if (!pend) { pend = true; setTimeout(midaScroll, 250); } }, { passive: true });
  W.addEventListener('load', function () { setTimeout(midaScroll, 1500); });

  /* ---------- 4. clics: WhatsApp, Llamar, fichas, fotos y enlaces ---------- */
  var NOMBRE_SECCION = { inicio: 'portada' };
  function ubicacion(a) {
    var u = a.getAttribute('data-ubic');
    if (u) return u;
    if (a.classList.contains('fab')) return 'flotante';
    var t = a.getAttribute('data-track');
    if (t && /^click_whatsapp_/.test(t)) return t.replace('click_whatsapp_', '').replace('hero', 'portada').replace('final', 'cierre').replace('footer', 'pie');
    if (a.closest('header')) return 'menu';
    if (a.closest('footer')) return 'pie';
    if (a.closest('#combo')) return 'combo';
    if (a.closest('article.hm, article.exc')) return 'tarjeta';
    var s = a.closest('section[id]');
    return s ? (NOMBRE_SECCION[s.id] || s.id) : 'otro';
  }
  function productoDe(a) {
    var dw = a.getAttribute('data-wa');
    if (dw && PRODUCTOS.indexOf(dw) >= 0) return dw;
    if (a.closest('#combo')) return 'tala-680';
    var art = a.closest('article[id], #retro');
    if (art) { var p = idProducto(art); if (PRODUCTOS.indexOf(p) >= 0) return p; }
    return PRODUCTO_PAGINA;
  }
  function texto(a) { return (a.textContent || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 80); }
  function archivo(href) { return href.split(/[?#]/)[0].split('/').pop(); }

  D.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var datos = { producto: productoDe(a), ubicacion: ubicacion(a), detalle: texto(a) };
    if (/wa\.me|whatsapp\.com/i.test(href)) { registrar('whatsapp', datos); enviar(); return; }
    if (/^tel:/i.test(href)) { registrar('llamada', datos); enviar(); return; }
    // accesos "¿Qué máquina tiene?" de la portada: qué tipo de máquina eligen
    if (href.charAt(0) === '#' && a.closest('.quick')) {
      registrar('enlace', { producto: PRODUCTOS.indexOf(href.slice(1)) >= 0 ? href.slice(1) : null, ubicacion: 'que-maquina-tiene', detalle: datos.detalle });
      return;
    }
    if (href.charAt(0) === '#' || /^(mailto|javascript):/i.test(href)) return;
    if (/ficha/i.test(href + ' ' + datos.detalle)) { datos.detalle = archivo(href); registrar('ficha', datos); return; }
    if (/\.(jpe?g|png|webp|gif|avif)$/i.test(href.split(/[?#]/)[0])) { datos.detalle = archivo(href); registrar('foto', datos); return; }
    var destino = href;
    try { var u = new URL(href, L.href); destino = u.hostname === L.hostname ? (u.pathname.replace(/^\//, '') || 'inicio') + u.hash : u.hostname.replace(/^www\./, ''); } catch (e) {}
    datos.detalle = destino;
    registrar('enlace', datos);
    enviar();
  }, true);

  /* ---------- 5. formulario de cotización (solo el equipo y las opciones; nunca nombre ni mensaje) ---------- */
  D.addEventListener('submit', function (ev) {
    var f = ev.target;
    if (!f || f.id !== 'fq') return;
    function v(id) { var el = D.getElementById(id); return el ? el.value : ''; }
    var eq = v('p');
    registrar('formulario', {
      producto: PRODUCTOS.indexOf(eq) >= 0 ? eq : (eq || null), ubicacion: 'contacto',
      detalle: 'cuando=' + v('cu') + '|iva=' + v('iva')
    });
    enviar();
  }, true);

  /* ---------- 6. videos que el visitante pone a reproducir (los automáticos no cuentan) ---------- */
  D.addEventListener('play', function (ev) {
    var v = ev.target;
    if (!v || v.tagName !== 'VIDEO' || !v.controls || v._medido) return;
    v._medido = 1;
    registrar('video', { producto: PRODUCTO_PAGINA, detalle: archivo(v.currentSrc || '') });
  }, true);

  /* ---------- 7. tiempo activo en la página (solo cuenta mientras la pestaña está a la vista) ---------- */
  var activo = 0, desde = D.visibilityState === 'visible' ? Date.now() : 0, ultimoEnviado = 0;
  function cierra() {
    if (desde) { activo += Date.now() - desde; desde = 0; }
    var seg = Math.min(1800, Math.round(activo / 1000));
    midaScroll();
    if (seg >= 1 && seg !== ultimoEnviado) {
      ultimoEnviado = seg;
      registrar('salida', { valor: seg, detalle: 'scroll=' + Math.round(maxScroll) });
    }
    enviar();
  }
  D.addEventListener('visibilitychange', function () {
    if (D.visibilityState === 'hidden') cierra();
    else if (!desde) desde = Date.now();
  });
  W.addEventListener('pagehide', cierra);
})();
