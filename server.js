import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { config } from 'dotenv';
import { cerrarConversacion, nuevaSesion, responder, tieneClave } from './lib/asistente-ia.js';
import { correoListo, enviarContactoPorGmail } from './lib/correo.js';
import { ayerMexico, enviarReporteDelDia, registrarVisita } from './lib/visitas.js';

config({ path: join(process.cwd(), 'chatbot', '.env') });
config({ path: join(process.cwd(), '.env'), override: true });

const PORT = Number(process.env.PORT || 3000);
const ROOT = resolve(process.cwd());

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  cors(res);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function isBlocked(rel) {
  const lower = rel.toLowerCase().replace(/\\/g, '/');
  return (
    lower.includes('..')
    || lower.startsWith('chatbot/')
    || lower.startsWith('node_modules/')
    || lower.startsWith('data/')
    || lower.startsWith('lib/')
    || lower.endsWith('.env')
    || lower.endsWith('server.js')
    || lower.endsWith('package-lock.json')
  );
}

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  rel = rel.replace(/^\/+/, '');
  if (isBlocked(rel)) {
    res.writeHead(404);
    res.end('No encontrado');
    return;
  }

  const file = normalize(join(ROOT, rel));
  if (!file.startsWith(ROOT) || !existsSync(file)) {
    res.writeHead(404);
    res.end('No encontrado');
    return;
  }

  const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
  const data = await readFile(file);
  res.writeHead(200, { 'Content-Type': type });
  res.end(data);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (req.method === 'GET' && url.pathname === '/api/asistente/salud') {
      return json(res, 200, { ok: true, ia: tieneClave() });
    }

    if (req.method === 'POST' && url.pathname === '/api/asistente/mensaje') {
      const body = await readBody(req);
      const sessionId = String(body.sessionId || nuevaSesion());
      const result = await responder(sessionId, body.mensaje);
      if (result.error) return json(res, result.status || 400, result);
      return json(res, 200, result);
    }

    if (req.method === 'POST' && url.pathname === '/api/asistente/cerrar') {
      const body = await readBody(req);
      const result = await cerrarConversacion(String(body.sessionId || ''));
      if (result.error) return json(res, result.status || 400, result);
      return json(res, 200, result);
    }

    if (req.method === 'POST' && url.pathname === '/api/contacto') {
      const body = await readBody(req);
      const nombre = String(body.nombre || '').trim().slice(0, 120);
      const correo = String(body.correo || '').trim().slice(0, 200);
      const mensaje = String(body.mensaje || '').trim().slice(0, 4000);
      const correoOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
      if (!nombre || !correoOk || !mensaje) {
        return json(res, 400, { error: 'Completa nombre, correo y mensaje.' });
      }
      if (!correoListo()) {
        return json(res, 503, { error: 'El correo no está configurado en el servidor.' });
      }
      await enviarContactoPorGmail({ nombre, correo, mensaje });
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/visita') {
      const body = await readBody(req).catch(() => ({}));
      await registrarVisita({ persona: Boolean(body.persona) });
      cors(res);
      res.writeHead(204);
      res.end();
      if (process.env.RENDER || process.env.RENDER_EXTERNAL_URL) {
        enviarReporteDelDia(ayerMexico()).catch((err) => console.error('reporte-visitas', err));
      }
      return;
    }

    if (req.method === 'GET') return serveStatic(req, res, url);

    res.writeHead(405);
    res.end('Método no permitido');
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: 'Error interno del asistente.' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`S.D lista en http://localhost:${PORT}`);
  if (!tieneClave()) {
    console.log('Falta GEMINI_API_KEY. Ponla en chatbot/.env o en .env de la raíz.');
  }
});
