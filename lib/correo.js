import nodemailer from 'nodemailer';
import { join } from 'node:path';
import { config } from 'dotenv';

config({ path: join(process.cwd(), 'chatbot', '.env') });
config({ path: join(process.cwd(), '.env'), override: true });

const REPORT_EMAIL = process.env.REPORT_EMAIL || 's.d.soluciones.digitaless@gmail.com';
const SMTP_USER = process.env.SMTP_USER || REPORT_EMAIL;
const SMTP_PASS = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
const EN_RENDER = Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL);

export function correoListo() {
  if (EN_RENDER) return Boolean(REPORT_EMAIL);
  return Boolean(SMTP_USER && SMTP_PASS);
}

function htmlSeguro(texto) {
  return String(texto || '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}

function transport() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

async function enviarPorSmtp({ subject, text, replyTo }) {
  await transport().sendMail({
    from: `"S.D Soluciones Digitales" <${SMTP_USER}>`,
    to: REPORT_EMAIL,
    replyTo: replyTo || undefined,
    subject,
    text,
    html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;font-size:14px;line-height:1.45">${htmlSeguro(text)}</pre>`,
  });
}

async function enviarPorHttps({ subject, text, replyTo }) {
  const destino = encodeURIComponent(REPORT_EMAIL);
  const res = await fetch(`https://formsubmit.co/ajax/${destino}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      _subject: subject,
      _template: 'box',
      _captcha: false,
      _replyto: replyTo || REPORT_EMAIL,
      message: text,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `No se pudo enviar el correo (${res.status})`);
  }
  return data;
}

async function enviarCorreo({ subject, text, replyTo }) {
  if (!correoListo()) {
    throw new Error('Falta configurar el correo del servidor.');
  }
  if (EN_RENDER) {
    await enviarPorHttps({ subject, text, replyTo });
    return { ok: true };
  }
  await enviarPorSmtp({ subject, text, replyTo });
  return { ok: true };
}

export async function enviarInformePorGmail(informe, cuerpo) {
  const subject = `S.D · Informe de atención (${informe.tipo || 'otro'}) — ${informe.nombre || 'cliente web'}`;
  return enviarCorreo({ subject, text: cuerpo });
}

export async function enviarContactoPorGmail({ nombre, correo, mensaje }) {
  const texto = [
    'Nuevo mensaje del formulario de la página web',
    '',
    `Nombre: ${nombre}`,
    `Correo: ${correo}`,
    '',
    'Mensaje:',
    mensaje,
  ].join('\n');

  return enviarCorreo({
    subject: `S.D · Contacto web — ${nombre}`,
    text: texto,
    replyTo: correo,
  });
}

export { REPORT_EMAIL };
