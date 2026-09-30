import { ayerMexico, enviarReporteDelDia } from '../lib/visitas.js';

const ymd = process.argv[2] || ayerMexico();
const result = await enviarReporteDelDia(ymd);
if (result.omitido) {
  console.log(`El reporte de ${ymd} ya se había enviado.`);
} else {
  console.log(`Enviado ${ymd}: ${result.personas} personas, ${result.visitas} visitas.`);
}
