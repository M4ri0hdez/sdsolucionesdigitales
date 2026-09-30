import { join } from 'node:path';
import { config } from 'dotenv';
import { correoListo, enviarInformePorGmail } from '../lib/correo.js';

config({ path: join(process.cwd(), 'chatbot', '.env') });
config({ path: join(process.cwd(), '.env'), override: true });

if (!correoListo()) {
  console.error('Falta SMTP_PASS en el archivo .env (contraseña de aplicación de Gmail).');
  process.exit(1);
}

await enviarInformePorGmail(
  { tipo: 'otro', nombre: 'Prueba del servidor' },
  [
    'Este es un correo de prueba del asistente de S.D Soluciones Digitales.',
    `Fecha: ${new Date().toLocaleString('es-MX')}`,
    'Si lo estás leyendo, el envío a Gmail ya funciona.',
  ].join('\n')
);

console.log('Correo de prueba enviado a s.d.soluciones.digitaless@gmail.com');
