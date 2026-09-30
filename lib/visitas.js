import { enviarMensajeInterno } from './correo.js';

const NAMESPACE = 'sdsolucionesdigitales';
const ABACUS = 'https://abacus.jasoncameron.dev';

export function ymdMexico(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(date);
}

export function ayerMexico() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = Number(partes.find((p) => p.type === 'year').value);
  const m = Number(partes.find((p) => p.type === 'month').value);
  const d = Number(partes.find((p) => p.type === 'day').value);
  const local = new Date(y, m - 1, d);
  local.setDate(local.getDate() - 1);
  const yy = local.getFullYear();
  const mm = String(local.getMonth() + 1).padStart(2, '0');
  const dd = String(local.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function fechaLarga(ymd) {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  });
}

async function abacus(accion, clave) {
  const res = await fetch(`${ABACUS}/${accion}/${NAMESPACE}/${encodeURIComponent(clave)}`, {
    signal: AbortSignal.timeout(12000),
  });
  if (res.status === 404) return 0;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Contador no disponible (${res.status})`);
  return Number(data.value || 0);
}

export async function resumenDia(ymd) {
  const [personas, visitas, enviado] = await Promise.all([
    abacus('get', `${ymd}-personas`),
    abacus('get', `${ymd}-visitas`),
    abacus('get', `${ymd}-enviado`),
  ]);
  return { ymd, personas, visitas, enviado: enviado > 0 };
}

export async function registrarVisita({ persona }) {
  const ymd = ymdMexico();
  await abacus('hit', `${ymd}-visitas`);
  if (persona) await abacus('hit', `${ymd}-personas`);
  return { ok: true, ymd };
}

export function textoReporte({ ymd, personas, visitas }) {
  return [
    'Reporte diario de visitas — S.D Soluciones Digitales',
    '',
    `Fecha: ${fechaLarga(ymd)}`,
    `Personas distintas: ${personas}`,
    `Visitas a la página: ${visitas}`,
    '',
    'Una persona es un navegador que abrió el sitio al menos una vez ese día.',
    'Si nadie entra, el número llega en 0 para que sepas que el reporte sí salió.',
  ].join('\n');
}

export async function marcarEnviado(ymd) {
  return abacus('hit', `${ymd}-enviado`);
}

export async function enviarReporteDelDia(ymd) {
  const datos = await resumenDia(ymd);
  if (datos.enviado) return { ok: true, omitido: true, ...datos };
  await enviarMensajeInterno(
    `S.D · Visitas del ${ymd}: ${datos.personas} personas`,
    textoReporte(datos),
  );
  await marcarEnviado(ymd);
  return { ok: true, omitido: false, ...datos };
}
