window.SD_WEB3FORMS_KEY = 'b51a58de-6031-4bd4-b12f-d8ee54a64c6a';

window.sdEnviarCorreo = async function sdEnviarCorreo({ subject, text, replyTo, nombre }) {
  const res = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      access_key: window.SD_WEB3FORMS_KEY,
      subject: String(subject || 'S.D · Mensaje web').slice(0, 180),
      from_name: 'S.D Soluciones Digitales',
      name: nombre || 'Sitio S.D',
      email: replyTo || 's.d.soluciones.digitaless@gmail.com',
      message: text,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'No se pudo enviar el correo');
  }
  return data;
};
