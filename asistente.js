(() => {
  const STORAGE_KEY = 'sd-asistente-sesion';

  function apiBase() {
    if (window.SD_API) return String(window.SD_API).replace(/\/$/, '');
    if (location.protocol === 'file:' || location.hostname === '') return 'http://localhost:3000';
    return '';
  }

  const css = `
    .sd-asistente { font-family: Inter, sans-serif; }
    .sd-burbuja {
      position: fixed; right: 22px; bottom: 22px; z-index: 400;
      width: 62px; height: 62px; border: none; cursor: pointer;
      border-radius: 50%;
      background: linear-gradient(180deg, #f6e4dc 0%, #e8c4b8 100%);
      color: #5c3d42;
      box-shadow: 0 12px 28px rgba(92, 61, 66, .28);
      display: flex; align-items: center; justify-content: center;
      transition: transform .25s ease, box-shadow .25s ease;
    }
    .sd-burbuja:hover { transform: translateY(-3px) scale(1.04); box-shadow: 0 16px 32px rgba(92, 61, 66, .35); }
    .sd-burbuja svg { width: 28px; height: 28px; }
    .sd-burbuja::after {
      content: ""; position: absolute; inset: -5px; border-radius: 50%;
      border: 2px solid rgba(232, 196, 184, .55);
      animation: sd-pulso 2.4s ease-out infinite;
      pointer-events: none;
    }
    @keyframes sd-pulso {
      0% { transform: scale(.92); opacity: .8; }
      100% { transform: scale(1.18); opacity: 0; }
    }
    .sd-panel {
      position: fixed; right: 22px; bottom: 96px; z-index: 400;
      width: min(380px, calc(100vw - 28px));
      height: min(560px, calc(100vh - 130px));
      background: #241d30; color: #f0ecf5;
      border: 1px solid rgba(232, 196, 184, .28);
      border-radius: 22px;
      box-shadow: 0 24px 50px rgba(0,0,0,.4);
      display: none; flex-direction: column; overflow: hidden;
    }
    .sd-panel.abierto { display: flex; }
    .sd-cabeza {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px;
      background: linear-gradient(180deg, #f6e4dc 0%, #e8c4b8 100%);
      color: #4a3236;
    }
    .sd-cabeza img {
      width: 38px; height: 38px; border-radius: 50%; object-fit: cover;
      background: #2a2238;
    }
    .sd-cabeza b { display: block; font-size: .98rem; }
    .sd-cabeza span { font-size: .78rem; opacity: .8; }
    .sd-cerrar {
      margin-left: auto; border: none; background: transparent;
      color: #4a3236; font-size: 1.4rem; cursor: pointer; line-height: 1;
    }
    .sd-cabeza, .sd-pie { flex-shrink: 0; }
    .sd-mensajes {
      flex: 1 1 auto; min-height: 180px; overflow-y: auto; padding: 16px 14px;
      display: flex; flex-direction: column; gap: 10px;
      background: #1c1726;
    }
    .sd-msg {
      max-width: 86%; padding: 10px 13px; border-radius: 16px;
      font-size: .92rem; line-height: 1.45; white-space: pre-wrap;
    }
    .sd-msg.bot { background: #2a2238; color: #f0ecf5; align-self: flex-start; }
    .sd-msg.user {
      background: #e8c4b8; color: #4a3236;
      align-self: flex-end; border-bottom-right-radius: 6px;
    }
    .sd-msg.meta { align-self: center; background: transparent; color: #9a92a8; font-size: .8rem; }
    .sd-pie {
      padding: 10px 12px 12px; border-top: 1px solid rgba(207,195,222,.12);
      background: #241d30;
    }
    .sd-asistente form, .sd-form {
      display: flex; gap: 8px;
      background: transparent; border: none; padding: 0; margin: 0;
      border-radius: 0; width: auto; box-shadow: none;
    }
    .sd-form input {
      flex: 1; border: 1.5px solid rgba(207,195,222,.18);
      background: #17131f; color: #f0ecf5;
      border-radius: 999px; padding: 11px 14px; font: inherit;
    }
    .sd-form input:focus { outline: none; border-color: #e8c4b8; }
    .sd-form button, .sd-fin {
      border: none; cursor: pointer; font: inherit; font-weight: 500;
    }
    .sd-form button {
      background: #e8c4b8; color: #4a3236;
      border-radius: 999px; padding: 0 16px;
    }
    .sd-fin {
      width: 100%; margin-top: 8px;
      background: transparent; color: #e8c4b8;
      border: 1px solid rgba(232,196,184,.4) !important;
      border-radius: 999px; padding: 8px;
      font-size: .82rem;
    }
    .sd-fin:disabled, .sd-form button:disabled { opacity: .55; cursor: wait; }
    @media (max-width: 520px) {
      .sd-burbuja { right: 14px; bottom: 14px; }
      .sd-panel { right: 10px; left: 10px; width: auto; bottom: 86px; }
    }
  `;

  function sessionId() {
    let id = sessionStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
      sessionStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  }

  function resetSession() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function el(html) {
    const box = document.createElement('div');
    box.innerHTML = html.trim();
    return box.firstElementChild;
  }

  function addMsg(list, text, who) {
    const node = document.createElement('div');
    node.className = `sd-msg ${who}`;
    node.textContent = text;
    list.appendChild(node);
    list.scrollTop = list.scrollHeight;
  }

  async function api(path, body) {
    const res = await fetch(`${apiBase()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo hablar con el asistente.');
    return data;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'sd-asistente';
    wrap.innerHTML = `
      <button class="sd-burbuja" type="button" aria-label="Abrir asistente de atención a clientes">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 6.8A2.8 2.8 0 0 1 7.8 4h8.4A2.8 2.8 0 0 1 19 6.8v6.4A2.8 2.8 0 0 1 16.2 16H13l-3.4 3.2c-.7.66-1.85.16-1.85-.72V16H7.8A2.8 2.8 0 0 1 5 13.2V6.8Z" stroke="currentColor" stroke-width="1.7"/>
          <circle cx="9" cy="10" r="1" fill="currentColor"/>
          <circle cx="12" cy="10" r="1" fill="currentColor"/>
          <circle cx="15" cy="10" r="1" fill="currentColor"/>
        </svg>
      </button>
      <section class="sd-panel" role="dialog" aria-label="Chat de atención a clientes">
        <header class="sd-cabeza">
          <img src="logo.jpeg" alt="">
          <div>
            <b>Fujiwara</b>
            <span>Asistente de S.D · Atención a clientes</span>
          </div>
          <button class="sd-cerrar" type="button" aria-label="Cerrar chat">×</button>
        </header>
        <div class="sd-mensajes"></div>
        <div class="sd-pie">
          <form class="sd-form">
            <input type="text" autocomplete="off" maxlength="2000" placeholder="Escribe tu duda o queja…">
            <button type="submit">Enviar</button>
          </form>
          <button class="sd-fin" type="button">Finalizar</button>
        </div>
      </section>
    `;
    document.body.appendChild(wrap);

    const burbuja = wrap.querySelector('.sd-burbuja');
    const panel = wrap.querySelector('.sd-panel');
    const cerrar = wrap.querySelector('.sd-cerrar');
    const lista = wrap.querySelector('.sd-mensajes');
    const form = wrap.querySelector('.sd-form');
    const input = form.querySelector('input');
    const fin = wrap.querySelector('.sd-fin');

    addMsg(lista, 'Hola, soy Fujiwara, el asistente de S.D Soluciones Digitales y de atención a clientes. Cuéntame tu idea, tu duda o tu queja y te ayudo. Cuando termines, pulsa «Finalizar».', 'bot');

    function abrir() {
      panel.classList.add('abierto');
      input.focus();
    }
    function ocultar() {
      panel.classList.remove('abierto');
    }

    burbuja.addEventListener('click', () => {
      if (panel.classList.contains('abierto')) ocultar();
      else abrir();
    });
    cerrar.addEventListener('click', ocultar);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const texto = input.value.trim();
      if (!texto) return;
      input.value = '';
      addMsg(lista, texto, 'user');
      const enviar = form.querySelector('button');
      enviar.disabled = true;
      const espera = document.createElement('div');
      espera.className = 'sd-msg meta';
      espera.textContent = 'Escribiendo…';
      lista.appendChild(espera);
      lista.scrollTop = lista.scrollHeight;
      try {
        const data = await api('/api/asistente/mensaje', {
          sessionId: sessionId(),
          mensaje: texto,
        });
        espera.remove();
        if (data.sessionId) sessionStorage.setItem(STORAGE_KEY, data.sessionId);
        addMsg(lista, data.reply, 'bot');
      } catch (err) {
        espera.remove();
        addMsg(lista, err.message.includes('fetch')
          ? 'No pude conectar con el asistente. En el navegador abre http://localhost:3000 (con npm start corriendo). No abras el archivo HTML directo.'
          : err.message, 'bot');
      } finally {
        enviar.disabled = false;
        input.focus();
      }
    });

    fin.addEventListener('click', async () => {
      fin.disabled = true;
      try {
        await api('/api/asistente/cerrar', { sessionId: sessionId() });
      } catch (err) {
        console.error(err);
      } finally {
        resetSession();
        addMsg(lista, 'Gracias por escribirnos. Que tengas un buen día.', 'bot');
        fin.disabled = false;
        setTimeout(ocultar, 1200);
      }
    });
  });
})();
