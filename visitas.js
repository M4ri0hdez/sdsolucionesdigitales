(() => {
  if (!/^https?:$/.test(location.protocol)) return;
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  const clave = 'sd-visita-' + ymd;
  const persona = !localStorage.getItem(clave);
  if (persona) localStorage.setItem(clave, '1');
  fetch('/api/visita', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona, pagina: location.pathname || '/' }),
    keepalive: true,
  }).catch(() => {});
})();
