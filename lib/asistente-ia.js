import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from 'dotenv';

config({ path: join(process.cwd(), 'chatbot', '.env') });
config({ path: join(process.cwd(), '.env'), override: true });

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const REPORT_EMAIL = process.env.REPORT_EMAIL || 's.d.soluciones.digitaless@gmail.com';
const INFORMES_DIR = join(process.cwd(), 'data', 'informes');

const MODEL_CANDIDATES = [...new Set([
  DEFAULT_MODEL,
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3-flash-preview',
])];

const SAFETY = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];

const SYSTEM_PROMPT = [
  'Eres Fujiwara, el asistente de S.D Soluciones Digitales y de atención a clientes.',
  'Hablas en español de México, cálida, clara y profesional, como en un chat: sin tarjetas ni títulos decorativos.',
  'Al presentarte, di que eres Fujiwara. No digas que eres Gemini ni enumeres restricciones técnicas.',
  '',
  'La empresa crea software a medida, apps móviles (Android e iOS) y páginas web personalizadas.',
  'Atiende empresas, emprendedores y personas que quieren simplificar su día a día.',
  'El proceso es: 1) escuchamos, 2) proponemos (qué, cuánto y cuánto tarda), 3) construimos con avances, 4) entregamos y acompañamos.',
  'La primera conversación es gratuita y sin compromiso.',
  'Correo de contacto público: s.d.soluciones.digitaless@gmail.com.',
  '',
  'Tienes criterio de administración, contabilidad y marketing (marco México: IVA 16% e ISR general).',
  'Úsalo si el cliente pregunta de negocio, precios aproximados o si le conviene una app o una web. No inventes cifras, plazos ni precios cerrados: da rangos orientativos y di que la cotización formal la confirma el equipo.',
  '',
  'Términos importantes, solo si preguntan o si aplica a una queja:',
  '- El cliente debe revisar y aprobar el trabajo.',
  '- Una vez cerrado el trato, S.D no se hace cargo de fallos posteriores, ni de manipulación del código, ni de daños al negocio por alteraciones de terceros.',
  '- El soporte posterior se cotiza aparte, salvo mantenimiento pactado.',
  'No uses esto para evadir una queja razonable: escucha, resume el problema y di que el equipo lo revisará.',
  '',
  'Tu trabajo: resolver dudas, orientar el servicio adecuado, recoger ideas de proyecto y atender quejas con empatía.',
  'Si aún no tienen nombre o forma de contacto y la charla va en serio, pídelos con naturalidad (nombre, correo o WhatsApp).',
  'Responde exactamente lo que preguntaron. Corto si la pregunta es corta.',
  'Si el cliente parece terminar (gracias, adiós, eso era todo, ya quedó claro), despídete con amabilidad y sugiere pulsar «Finalizar».',
  'No prometas que un humano responderá en un horario exacto.',
  'Nunca menciones informes internos, correos automáticos ni que avisas al equipo al finalizar.',
].join(' ');

const sessions = new Map();

function getSession(id) {
  let session = sessions.get(id);
  if (!session) {
    session = { id, messages: [], createdAt: Date.now() };
    sessions.set(id, session);
  }
  session.updatedAt = Date.now();
  return session;
}

function transcript(session) {
  return session.messages
    .map((msg) => `${msg.role === 'user' ? 'Cliente' : 'Asistente'}: ${msg.text}`)
    .join('\n');
}

function extractText(data) {
  const candidate = data?.candidates?.[0];
  if (!candidate) return '';
  const text = (candidate.content?.parts || []).map((part) => part?.text || '').join('').trim();
  if (text) return text;
  if (candidate.finishReason === 'SAFETY') {
    throw new Error('El proveedor bloqueó la respuesta.');
  }
  return '';
}

async function requestGemini(model, system, userText) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': API_KEY,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      safetySettings: SAFETY,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    return { ok: false, status: response.status, error: new Error(`Gemini ${model} ${response.status}: ${details.slice(0, 240)}`) };
  }

  const data = await response.json();
  const text = extractText(data);
  if (!text) return { ok: false, status: response.status, error: new Error(`Gemini ${model} respondió vacío.`) };
  return { ok: true, text };
}

async function callGemini(system, userText) {
  let lastError = null;
  for (const model of MODEL_CANDIDATES) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result = await requestGemini(model, system, userText);
        if (result.ok) return result.text;
        lastError = result.error;
        console.error('asistente modelo', model, result.status, 'intento', attempt);
        if (result.status === 429 || result.status === 503 || result.status === 408) {
          await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
          continue;
        }
        break;
      } catch (err) {
        lastError = err;
      }
    }
  }
  throw lastError || new Error('No pude obtener respuesta de la IA.');
}

function looksFinished(text) {
  const plain = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return /\b(adios|hasta luego|eso es todo|eso era todo|ya quede|ya quedo|no tengo mas dudas|era todo|gracias por todo|ya me queda claro)\b/.test(plain);
}

export async function responder(sessionId, mensaje) {
  const clean = String(mensaje || '').trim();
  if (!clean) return { error: 'Escribe un mensaje.', status: 400 };
  if (!API_KEY) {
    return {
      error: 'El asistente aún no tiene configurada la clave de Gemini (GEMINI_API_KEY).',
      status: 503,
    };
  }

  const session = getSession(sessionId);
  session.messages.push({ role: 'user', text: clean, at: Date.now() });

  const history = transcript(session);
  const prompt = [
    `Fecha y hora: ${new Date().toLocaleString('es-MX')}`,
    'Historial de este chat web:',
    history || 'Sin mensajes previos.',
    '',
    'Responde al último mensaje del cliente.',
  ].join('\n');

  try {
    const reply = await callGemini(SYSTEM_PROMPT, prompt);
    session.messages.push({ role: 'assistant', text: reply, at: Date.now() });
    return {
      reply,
      sessionId: session.id,
      sugerirCierre: looksFinished(clean),
    };
  } catch (err) {
    console.error('asistente', err);
    const fallback = 'Se me trabó la conexión. Inténtalo otra vez en un momento.';
    session.messages.push({ role: 'assistant', text: fallback, at: Date.now() });
    return { reply: fallback, sessionId: session.id, sugerirCierre: false };
  }
}

function parseInforme(raw) {
  const match = String(raw || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function redactarInforme(session) {
  const history = transcript(session);
  const prompt = [
    'Redacta un informe interno para el dueño de S.D Soluciones Digitales a partir de este chat de atención al cliente.',
    'Devuelve SOLO un JSON válido, sin markdown, con estas claves:',
    '{"asunto":"","tipo":"duda|queja|cotizacion|otro","prioridad":"baja|media|alta","nombre":"","contacto":"","resumen":"","puntos":[""],"siguiente_paso":""}',
    'tipo: duda, queja, cotizacion u otro.',
    'Si no hay nombre o contacto, usa cadenas vacías.',
    'resumen: 4 a 8 líneas en español, concretas.',
    'puntos: lista corta de hechos.',
    '',
    'Conversación:',
    history || '(vacía)',
  ].join('\n');

  const raw = await callGemini('Eres un asistente interno. Solo produces JSON válido.', prompt);
  return parseInforme(raw) || {
    asunto: 'Conversación con un cliente en la web',
    tipo: 'otro',
    prioridad: 'media',
    nombre: '',
    contacto: '',
    resumen: history.slice(0, 1500),
    puntos: [],
    siguiente_paso: 'Revisar el chat y contactar al cliente si dejó datos.',
  };
}

function formatearCorreo(informe, session) {
  const puntos = (informe.puntos || []).map((item) => `• ${item}`).join('\n') || '• (sin puntos extra)';
  return [
    `Asunto: ${informe.asunto || 'Informe de atención al cliente'}`,
    `Tipo: ${informe.tipo || 'otro'}`,
    `Prioridad: ${informe.prioridad || 'media'}`,
    `Nombre: ${informe.nombre || 'No lo indicó'}`,
    `Contacto: ${informe.contacto || 'No lo indicó'}`,
    `Fecha: ${new Date().toLocaleString('es-MX')}`,
    `Sesión: ${session.id}`,
    '',
    'Resumen',
    informe.resumen || '',
    '',
    'Puntos',
    puntos,
    '',
    'Siguiente paso',
    informe.siguiente_paso || '',
    '',
    'Transcripción',
    transcript(session) || '(sin mensajes)',
  ].join('\n');
}

async function guardarInforme(session, cuerpo) {
  await mkdir(INFORMES_DIR, { recursive: true });
  const file = join(INFORMES_DIR, `${Date.now()}-${session.id}.txt`);
  await writeFile(file, cuerpo, 'utf8');
  return file;
}

export async function cerrarConversacion(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return { error: 'No hay una conversación activa.', status: 404 };

  const userTurns = session.messages.filter((msg) => msg.role === 'user').length;
  if (userTurns < 1) {
    sessions.delete(sessionId);
    return { ok: true, enviado: false, motivo: 'vacía' };
  }

  if (!API_KEY) {
    const cuerpo = formatearCorreo({
      asunto: 'Conversación web (IA no configurada)',
      tipo: 'otro',
      prioridad: 'media',
      nombre: '',
      contacto: '',
      resumen: transcript(session),
      puntos: [],
      siguiente_paso: 'Configurar GEMINI_API_KEY y revisar el chat.',
    }, session);
    await guardarInforme(session, cuerpo);
    sessions.delete(sessionId);
    return { ok: true, enviado: false, motivo: 'sin-ia' };
  }

  const informe = await redactarInforme(session);
  const cuerpo = formatearCorreo(informe, session);
  await guardarInforme(session, cuerpo);
  const asunto = `S.D · Informe de atención (${informe.tipo || 'otro'}) — ${informe.nombre || 'cliente web'}`;
  sessions.delete(sessionId);
  return {
    ok: true,
    asunto,
    cuerpo,
    nombre: informe.nombre || '',
  };
}

export function nuevaSesion() {
  const id = crypto.randomUUID();
  getSession(id);
  return id;
}

export function tieneClave() {
  return Boolean(API_KEY);
}
