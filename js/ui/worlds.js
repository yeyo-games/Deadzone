// Mundos guardados del modo en línea (los arma el servidor: server/src/sim/worldsave.ts). Cada jugador
// guarda en su navegador el último estado de cada mundo en el que jugó: llega al terminar cada oleada o
// parada y al salir de la partida. En la sala, el propietario elige seguir uno o empezar uno nuevo.
// También el panel para dar dinero y cosas a los compañeros (#give).
import { SHOP, SHOP_ORDER } from '../core/config.ts';
import { storage } from '../core/util.ts';
import { on } from './dom.js';

// cuántos mundos se guardan (los más viejos se borran)
const MAX = 8;
const key = (game) => `${game.accounts.saveKey()}-mundos`;

/** Los mundos guardados, del más reciente al más viejo. */
export function listWorlds(game) {
  const l = storage.get(key(game), []);
  return Array.isArray(l) ? l.filter((w) => w && w.id && w.v) : [];
}

/** Llegó el mundo del servidor: reemplaza al que tenía el mismo id (o lo borra si ya terminó). */
export function storeWorld(game, w) {
  if (!w || !w.id) return;
  let l = listWorlds(game).filter((x) => x.id !== w.id);
  if (!w.done) l.unshift(w);
  l = l.slice(0, MAX);
  storage.set(key(game), l);
  if (game.state === 'online') renderWorlds(game);
}

export function dropWorld(game, id) {
  storage.set(
    key(game),
    listWorlds(game).filter((x) => x.id !== id),
  );
  renderWorlds(game);
}

/** Por dónde va un mundo, en una línea. */
export function worldWhere(w) {
  return w.mode === 'escape' ? `Huida · parada ${w.escape?.stop ?? 1} de 7` : `Oleadas · va por la ${w.wave + 1}`;
}

const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'hace un momento';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
};

// el mundo que eligió el propietario en esta sala (id local; el servidor guarda la etiqueta)
let picked = '';

/** La lista de mundos en la sala: el propietario elige; los demás ven cuál se va a jugar. */
export function renderWorlds(game) {
  const ol = game.online;
  const st = ol.room?.state;
  const box = game.$('ol-worlds');
  if (!st) return;
  const lobbyLike = st.phase === 'waiting' || st.phase === 'finished';
  if (!st.world) picked = '';
  if (!ol.isOwner || !lobbyLike) {
    box.innerHTML = `<p class="ol-world-now">${st.world ? `Mundo guardado: ${esc(st.world)}` : 'Mundo nuevo'}</p>`;
    return;
  }
  const worlds = listWorlds(game);
  let h = `<button type="button" class="ol-world${!picked ? ' on' : ''}" data-w=""><b>Mundo nuevo</b><small>Empezar desde cero</small></button>`;
  for (const w of worlds) {
    h += `<div class="ol-world-row"><button type="button" class="ol-world${picked === w.id ? ' on' : ''}" data-w="${w.id}"><b>${worldWhere(w)}</b><small>${esc(w.players.map((p) => p.name).join(', '))} · ${ago(w.at)}</small></button><button type="button" class="ol-world-del" data-del="${w.id}" aria-label="Borrar este mundo">×</button></div>`;
  }
  if (!worlds.length) h += '<p class="ol-world-none">Aún no hay mundos guardados: se guardan solos al jugar.</p>';
  box.innerHTML = h;
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* ---------- dar a los compañeros ---------- */

/** Abre el panel con los compañeros de la partida y lo que se les puede dar. */
export function openGive(game) {
  renderGive(game);
  game.$('give').hidden = false;
}

function renderGive(game) {
  const ol = game.online;
  const st = ol.room?.state;
  const box = game.$('give-list');
  const mates = [];
  st?.members.forEach((m, id) => {
    if (id !== ol.room.sessionId && m.inGame) mates.push([id, m]);
  });
  game.$('give-money').textContent = `Tienes $${game.money}`;
  if (!mates.length) {
    box.innerHTML = '<p class="give-none">No hay compañeros en la partida.</p>';
    return;
  }
  const items = SHOP_ORDER.filter((k) => game.inv[k] > 0);
  const half = Math.floor(game.money / 2);
  box.innerHTML = mates
    .map(([id, m]) => {
      const money = [50, 200, 500]
        .map(
          (n) =>
            `<button type="button" data-to="${id}" data-k="money" data-n="${n}" ${game.money < n ? 'disabled' : ''}>$${n}</button>`,
        )
        .join('');
      const halfBtn = `<button type="button" data-to="${id}" data-k="money" data-n="${half}" ${half < 1 ? 'disabled' : ''}>La mitad ($${half})</button>`;
      const inv = items
        .map(
          (k) =>
            `<button type="button" data-to="${id}" data-k="${k}" data-n="1">1 × ${SHOP[k].name} <i>(${game.inv[k]})</i></button>`,
        )
        .join('');
      return `<div class="give-mate"><b>${esc(m.name)}</b><div class="give-btns">${money}${halfBtn}</div>${inv ? `<div class="give-btns inv">${inv}</div>` : ''}</div>`;
    })
    .join('');
}

export function bindWorlds(game) {
  game.$('ol-worlds').addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (del) return dropWorld(game, del.dataset.del);
    const b = e.target.closest('[data-w]');
    if (!b || !game.online.isOwner) return;
    picked = b.dataset.w;
    const w = picked ? listWorlds(game).find((x) => x.id === picked) : null;
    game.online.send('world', { data: w || null });
    renderWorlds(game);
  });
  on(game, 'btn-give', () => openGive(game));
  on(game, 'btn-shop-give', () => openGive(game));
  on(game, 'btn-give-done', () => (game.$('give').hidden = true));
  game.$('give').addEventListener('pointerdown', (e) => {
    if (e.target === game.$('give')) game.$('give').hidden = true;
  });
  game.$('give-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-to]');
    if (!b || b.disabled) return;
    game.online.send('give', { to: b.dataset.to, k: b.dataset.k, n: Number(b.dataset.n) });
    game.sfx.buy();
    // lo que queda se ve cuando llega la siguiente foto
    setTimeout(() => !game.$('give').hidden && renderGive(game), 250);
  });
}
