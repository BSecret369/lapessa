// La Pessa · crea el pago en Stripe con todo el carrito.
// Se ejecuta en Vercel. La clave secreta va en la variable STRIPE_SECRET_KEY (nunca en este archivo).
// Los precios están aquí, en el servidor: lo que mande el navegador solo dice qué puzzles y cuántos.

const SITE = 'https://lapessa.es';

const CATALOGO = {
  'cocina':     { nombre: 'La cocina de la abuela', detalle: '24 piezas grandes', precio: 2495, img: 'cocina.jpg' },
  'mercado':    { nombre: 'El mercado del pueblo',  detalle: '96 piezas',          precio: 2995, img: 'mercado.jpg' },
  'nochebuena': { nombre: 'La Nochebuena',          detalle: '96 piezas',          precio: 2995, img: 'nochebuena.jpg' },
  'hilo':       { nombre: 'Hilo y aguja',           detalle: '24 piezas grandes · Preventa, envío antes del 17 dic.', precio: 2495, img: 'costurera.jpg' },
  'fresco':     { nombre: 'Tomando el fresco',      detalle: '24 piezas grandes · Preventa, envío antes del 17 dic.', precio: 2495, img: 'fresco.jpg' },
  'playa':      { nombre: 'Un día de playa',        detalle: '24 piezas grandes · Preventa, envío antes del 17 dic.', precio: 2495, img: 'playa.jpg' },
  'corral':     { nombre: 'El corral',              detalle: '24 piezas grandes · Preventa, envío antes del 17 dic.', precio: 2495, img: 'corral.jpg' },
  'pescador':   { nombre: 'El pescador',            detalle: '24 piezas grandes · Preventa, envío antes del 17 dic.', precio: 2495, img: 'pescador.jpg' },
  'mesa': { nombre: 'Christmas Table', detalle: 'Eurographics · 1000 piezas · Bajo pedido, envío en 5–7 días', precio: 2795, imgUrl: 'https://b2btoysline.es/wp-content/uploads/2021/02/8051-5623_Tin-1.jpg', pedido: true },
  'hygge': { nombre: 'Hygge Holidays', detalle: 'Penny Puzzles · 1000 piezas · Bajo pedido, envío en 5–7 días', precio: 2795, imgUrl: 'https://b2btoysline.es/wp-content/uploads/1970/01/Copia-de-Diseno-sin-titulo.png', pedido: true },
  'arbol': { nombre: 'Árbol de Navidad', detalle: 'Eurographics · 550 piezas · Bajo pedido, envío en 5–7 días', precio: 2595, imgUrl: 'https://b2btoysline.es/wp-content/uploads/2022/09/8551-5663-ISO.jpg', pedido: true },
  'jengibre3d': { nombre: 'Casita de jengibre 3D', detalle: 'Eurographics · 302 piezas · Bajo pedido, envío en 5–7 días', precio: 2695, imgUrl: 'https://b2btoysline.es/wp-content/uploads/2026/03/628136659420-3.png', pedido: true },
  'taller3d': { nombre: 'Taller de Papá Noel 3D', detalle: 'Eurographics · 323 piezas · Bajo pedido, envío en 5–7 días', precio: 2695, imgUrl: 'https://b2btoysline.es/wp-content/uploads/2026/03/628136659420-2.png', pedido: true },
  'tienda': { nombre: 'The Christmas Shop', detalle: 'Eurographics · 1000 piezas · Bajo pedido, envío en 5–7 días', precio: 2195, imgUrl: 'https://b2btoysline.es/wp-content/uploads/2025/08/Fotos-Eurographica-novedades-2026-16.png', pedido: true },
  'paris': { nombre: 'Nochebuena en París', detalle: 'Eurographics · 1000 piezas · Bajo pedido, envío en 5–7 días', precio: 2195, imgUrl: 'https://b2btoysline.es/wp-content/uploads/2021/01/6000-0785.jpg', pedido: true },
  'granja': { nombre: 'Navidad en la granja', detalle: 'Cobble Hill · 1000 piezas · Bajo pedido, envío en 5–7 días', precio: 2195, imgUrl: 'https://b2btoysline.es/wp-content/uploads/1970/01/40215-christmas-on-the-farm-pkg-rgb.jpg', pedido: true },
  'hogar': { nombre: 'Navidad junto al hogar', detalle: 'Eurographics · 500 piezas grandes · Bajo pedido, envío en 5–7 días', precio: 1995, imgUrl: 'https://b2btoysline.es/wp-content/uploads/2021/02/6500-5502-ISO-EU.jpg', pedido: true },
};

const ENVIO = 495;          // 4,95 € a península
const ENVIO_GRATIS = 6000;  // gratis a partir de 60 €
const MAX_UNIDADES = 20;    // por puzzle

const ORIGENES = ['https://lapessa.es', 'https://www.lapessa.es'];

function cors(req, res) {
  const o = req.headers.origin || '';
  const ok = ORIGENES.includes(o) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(o) || /^http:\/\/localhost(:\d+)?$/.test(o);
  if (ok) res.setHeader('Access-Control-Allow-Origin', o);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Convierte un objeto anidado al formato que pide la API de Stripe (a[b][0][c]=valor)
function form(obj, prefix, out) {
  out = out || [];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (typeof v === 'object') form(v, key, out);
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out.join('&');
}

function montarSesion(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('El carrito está vacío.');
  const juntos = {};
  for (const it of items) {
    const id = String((it && it.id) || '');
    const n = Math.floor(Number(it && it.cantidad));
    if (!CATALOGO[id]) throw new Error('Hay un puzzle que ya no está disponible. Recarga la página.');
    if (!(n >= 1)) continue;
    juntos[id] = Math.min(MAX_UNIDADES, (juntos[id] || 0) + n);
  }
  const ids = Object.keys(juntos);
  if (!ids.length) throw new Error('El carrito está vacío.');

  let subtotal = 0;
  const line_items = ids.map(id => {
    const p = CATALOGO[id];
    subtotal += p.precio * juntos[id];
    return {
      quantity: juntos[id],
      price_data: {
        currency: 'eur',
        unit_amount: p.precio,
        product_data: { name: p.nombre, description: p.detalle, images: [p.imgUrl || `${SITE}/img/${p.img}`] },
      },
    };
  });
  const preventa = ids.some(id => CATALOGO[id].detalle.includes('Preventa'));
  const bajoPedido = ids.some(id => CATALOGO[id].pedido);
  const gratis = subtotal >= ENVIO_GRATIS;

  return {
    mode: 'payment',
    locale: 'es',
    line_items,
    shipping_address_collection: { allowed_countries: ['ES'] },
    phone_number_collection: { enabled: true },
    shipping_options: [{
      shipping_rate_data: {
        type: 'fixed_amount',
        display_name: gratis ? 'Envío gratis a península' : 'Envío a península',
        fixed_amount: { amount: gratis ? 0 : ENVIO, currency: 'eur' },
        delivery_estimate: (preventa || bajoPedido)
          ? undefined
          : { minimum: { unit: 'business_day', value: 2 }, maximum: { unit: 'business_day', value: 6 } },
      },
    }],
    custom_fields: [{
      key: 'dedicatoria',
      label: { type: 'custom', custom: 'Dedicatoria para la tarjeta (opcional)' },
      type: 'text',
      optional: true,
      text: { maximum_length: 255 },
    }],
    custom_text: preventa
      ? { submit: { message: 'Tu pedido incluye una escena en preventa: lo enviamos todo junto antes del 17 de diciembre.' } }
      : bajoPedido
        ? { submit: { message: 'Tu pedido incluye puzzles bajo pedido: lo enviamos todo junto en 5–7 días.' } }
        : undefined,
    metadata: { carrito: ids.map(id => `${id}x${juntos[id]}`).join(',').slice(0, 490) },
    success_url: `${SITE}/?pedido=ok`,
    cancel_url: `${SITE}/#coleccion`,
  };
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Falta configurar la clave de Stripe en Vercel.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }

  let sesion;
  try { sesion = montarSesion(body && body.items); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form(sesion),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('Stripe:', data && data.error);
      return res.status(502).json({ error: 'No se ha podido abrir el pago. Inténtalo de nuevo en un momento.' });
    }
    return res.status(200).json({ url: data.url });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'No se ha podido conectar con el pago. Inténtalo de nuevo.' });
  }
};

module.exports.montarSesion = montarSesion;
module.exports.form = form;
module.exports.CATALOGO = CATALOGO;
