import nodemailer from 'nodemailer';
import { join } from 'node:path';
import { config } from 'dotenv';

config({ path: join(process.cwd(), 'chatbot', '.env') });
config({ path: join(process.cwd(), '.env'), override: true });

const REPORT_EMAIL = process.env.REPORT_EMAIL || 's.d.soluciones.digitaless@gmail.com';
const SMTP_USER = process.env.SMTP_USER || REPORT_EMAIL;
const SMTP_PASS = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');

export function correoListo() {
  return Boolean(SMTP_USER && SMTP_PASS);
}

function transport() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

function htmlSeguro(texto) {
  return String(texto || '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}

export async function enviarInformePorGmail(informe, cuerpo) {
  if (!correoListo()) {
    throw new Error('Falta SMTP_PASS: contraseña de aplicación de Gmail en el archivo .env');
  }

  const subject = `S.D · Informe de atención (${informe.tipo || 'otro'}) — ${informe.nombre || 'cliente web'}`;
  await transport().sendMail({
    from: `"Fujiwara · S.D" <${SMTP_USER}>`,
    to: REPORT_EMAIL,
    subject,
    text: cuerpo,
    html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;font-size:14px;line-height:1.45">${htmlSeguro(cuerpo)}</pre>`,
  });

  return { ok: true };
}

export async function enviarContactoPorGmail({ nombre, correo, mensaje }) {
  if (!correoListo()) {
    throw new Error('Falta SMTP_PASS: contraseña de aplicación de Gmail en el archivo .env');
  }

  const texto = [
    'Nuevo mensaje del formulario de la página web',
    '',
    `Nombre: ${nombre}`,
    `Correo: ${correo}`,
    '',
    'Mensaje:',
    mensaje,
  ].join('\n');

  await transport().sendMail({
    from: `"S.D · Formulario web" <${SMTP_USER}>`,
    to: REPORT_EMAIL,
    replyTo: correo,
    subject: `S.D · Contacto web — ${nombre}`,
    text: texto,
    html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;font-size:14px;line-height:1.45">${htmlSeguro(texto)}</pre>`,
  });

  return { ok: true };
}

export { REPORT_EMAIL };
