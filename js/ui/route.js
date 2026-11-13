// Mapa de ruta del modo Huida (entre paradas): se elige la siguiente parada en el mapa (clic o toque, o
// teclas 1–3 y Enter), se ve qué trae (tipo, ronda especial, amenaza, bidones), se puede ir a la tienda o al
// taller (mejoras de la camioneta: VAN_UPS), y
// al viajar la camioneta recorre la carretera en el mapa y un fundido lleva al mapa nuevo. Los datos están
// en sim/route.ts y sim/escape.ts; el dibujo en render/route.js.
import { ESCAPE, ESCAPE_ROUTE, ESCAPE_STOPS, EVENTS, VAN_UP_ORDER, VAN_UPS } from '../core/config.ts';
import { drawRoute, drawStopArt, roadAt, routeHit } from '../render/route.js';
import { needAt } from '../sim/escape.ts';
import { on } from './dom.js';
import { saveTrip } from './escape.js';

/** Íconos de las mejoras de la camioneta (también en el panel de la Huida). */
export const VAN_ICONS = {
  armor: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8 12h8M12 8v8"/>',
  turret: '<circle cx="9" cy="15" r="5"/><path d="M12 13l9-6M3 21h12"/>',
  horn: '<path d="M3 10v4h4l6 4V6L7 10z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
  tank: '<path d="M7 5h7l4 4v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M9 14h6"/>',
  lights: '<path d="M3 7h5a5 5 0 0 1 0 10H3z"/><path d="M14 9l7-2M14 12h7M14 15l7 2"/>',
};
export const vanIcon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${VAN_ICONS[k]}</svg>`;

// Lo de la pantalla que no es del juego: lo elegido, la animación y el acomodo del último dibujo.
// confirm: la parada que espera el segundo toque del botón (hay que confirmar a dónde se va)
const view = {
  sel: -1,
  hover: -1,
  t: 0,
  travel: null,
  puffs: [],
  L: null,
  w: 0,
  h: 0,
  dpr: 1,
  voted: -1,
  from: -1,
  confirm: -1,
};

/** Fundido a negro (on) o de vuelta (off); `then` corre a mitad del fundido. */
export function fade(game, then) {
  const el = game.$('esc-fade');
  el.classList.add('on');
  setTimeout(() => {
    then?.();
    // un momento después, para que lo nuevo ya esté dibujado al aclarar
    setTimeout(() => el.classList.remove('on'), 80);
  }, ESCAPE_ROUTE.fadeT * 1000);
}

/** Abre el mapa al terminar una parada. */
export function openRoute(game) {
  const e = game.escape;
  view.sel = e.route.nodes[e.at].next[0] ?? -1;
  view.travel = null;
  view.puffs = [];
  view.t = 0;
  view.voted = -1;
  view.confirm = -1;
  view.from = e.at;
  game.$('route-garage').hidden = true;
  game.setState('route');
  game.$('route-kicker').textContent = `Parada ${e.stop} superada · ${e.stopDef.name}`;
  game.$('route-sub').textContent = `Siguiente: parada ${e.stop + 1} de ${e.total}`;
  renderCard(game);
}

/** Lo que trae la parada `id` si viajas a ella: amenaza al llegar y bidones que hacen falta. */
function preview(e, id) {
  const n = e.route.nodes[id];
  const def = ESCAPE_STOPS[n.kind];
  const stop = e.stop + 1;
  return {
    n,
    def,
    stop,
    level: ESCAPE.startLevel + Math.floor((stop - 1) * ESCAPE_ROUTE.levelPerStop) + (def.level || 0),
    need: needAt(stop, e.ups),
  };
}

function renderCard(game) {
  const e = game.escape;
  const $ = game.$;
  $('route-money').textContent = `$${game.money}`;
  if (!$('route-garage').hidden) renderGarage(game);
  const ok = view.sel >= 0;
  $('route-card').classList.toggle('empty', !ok);
  $('btn-route-go').disabled = !ok || !!view.travel;
  if (!ok) return;
  const { n, def, stop, level, need } = preview(e, view.sel);
  $('rc-kind').textContent = def.name;
  $('rc-kind').style.setProperty('--c', def.col);
  $('rc-name').textContent = n.name;
  $('rc-desc').textContent = def.desc;
  const ev = n.mod ? EVENTS.types[n.mod] : null;
  $('rc-mod').hidden = !ev;
  if (ev) {
    $('rc-mod-t').textContent = ev.name;
    $('rc-mod-d').textContent = `${ev.desc} · bajas ×${String(ev.pay).replace('.', ',')}`;
  }
  $('rc-lvl').textContent = level;
  $('rc-need').textContent = need;
  $('rc-stop').textContent = `${stop} de ${e.total}`;
  const ask = view.confirm === view.sel;
  $('btn-route-go').textContent = ask ? 'Confirmar' : n.kind === 'bridge' ? 'Ir al puente' : 'Viajar';
  $('btn-route-go').classList.toggle('ask', ask);
  $('rc-confirm').hidden = !ask;
  if (ask) $('rc-confirm').textContent = `¿Vamos a ${n.name}? Toca otra vez para confirmar, o elige otra parada`;
  // en línea se vota: gana la parada con más votos (o la que diga el tiempo)
  if (game.mode.viaServer()) {
    const v = game.routeVotes;
    const left = v ? v[0] : 0;
    $('btn-route-go').textContent =
      view.voted === view.sel ? `Votaste · ${left} s` : ask ? `Confirmar · ${left} s` : `Votar · ${left} s`;
    $('btn-route-go').disabled = !!view.travel;
  }
}

/* ---------- el taller: mejoras de la camioneta ---------- */

/** La lista del taller: cada mejora con su nivel, lo que hace y lo que cuesta el siguiente. */
function renderGarage(game) {
  const e = game.escape;
  let html = '';
  for (const k of VAN_UP_ORDER) {
    const d = VAN_UPS[k];
    const n = e.ups[k] || 0;
    const cost = e.upCost(k);
    const pips = d.price.map((_, i) => `<em class="${i < n ? 'on' : ''}"></em>`).join('');
    const cls = !cost ? 'max' : cost > game.money ? 'poor' : '';
    html += `<button class="rg-item ${cls}" type="button" data-k="${k}" ${cost ? '' : 'disabled'}>
      <span class="rg-ic">${vanIcon(k)}</span>
      <span class="rg-txt"><b>${d.name}</b><small>${d.desc}</small><i class="rg-pips">${pips}</i></span>
      <span class="rg-price">${cost ? `$${cost}` : 'Máximo'}</span></button>`;
  }
  const list = game.$('rg-list');
  if (list.dataset.sig !== html) {
    list.dataset.sig = html;
    list.innerHTML = html;
  }
  game.$('rg-money').textContent = `$${game.money}`;
}

/** Abre o cierra el taller. */
function garage(game, open) {
  const g = game.$('route-garage');
  if (open && view.travel) return;
  g.hidden = !open;
  game.sfx.pageFlip?.();
  if (open) renderGarage(game);
}

/** Compra el siguiente nivel de una mejora (en línea la cobra el servidor). */
function buyUp(game, k) {
  const e = game.escape;
  const cost = e.upCost(k);
  if (!cost || cost > game.money) return game.sfx.empty?.();
  if (game.mode.viaServer()) {
    game.online.buy('van', k, 0);
    game.sfx.buy();
    return;
  }
  game.money -= cost;
  e.buyUp(k);
  game.sfx.buy();
  saveTrip(game);
  renderCard(game);
}

/** Elige una de las paradas siguientes (por su lugar: 0, 1, 2…). */
function choose(game, i) {
  if (view.travel) return;
  const next = game.escape.route.nodes[view.from >= 0 ? view.from : game.escape.at].next;
  if (next[i] === undefined) return;
  view.sel = next[i];
  game.sfx.pageFlip?.();
  renderCard(game);
}

/** Viaja a la parada elegida: la camioneta recorre la carretera y luego cambia el mapa. */
function travel(game) {
  const e = game.escape;
  if (view.travel || view.sel < 0) return;
  // primero se pide confirmar a dónde se va (un toque de más: no se viaja sin querer)
  if (view.confirm !== view.sel && view.voted !== view.sel) {
    view.confirm = view.sel;
    game.sfx.pageFlip?.();
    renderCard(game);
    return;
  }
  view.confirm = -1;
  // en línea: votar (el viaje lo decide el servidor cuando votan todos o se acaba el tiempo)
  if (game.mode.viaServer()) {
    view.voted = view.sel;
    game.online.send('route', { i: view.sel });
    game.sfx.pageFlip?.();
    renderCard(game);
    return;
  }
  view.travel = { to: view.sel, k: 0 };
  game.$('btn-route-go').disabled = true;
  game.$('route-garage').hidden = true;
  game.sfx.boost();
}

// Cada fotograma en el mapa: la animación del viaje y el dibujo.
export function updateRoute(game, dt) {
  const e = game.escape;
  if (!e.route) return;
  view.t += dt;
  const s = game.input.consume('slot');
  if (s) choose(game, s - 1);
  if (game.input.consume('nextRound')) travel(game);
  // Esc cierra el taller
  if (game.input.consume('pause') && !game.$('route-garage').hidden) garage(game, false);
  // en línea: el tiempo que queda para votar (y el dinero y las mejoras, que cambian con las compras)
  if (game.mode.viaServer() && !view.travel && Math.floor(view.t * 4) !== Math.floor((view.t - dt) * 4))
    renderCard(game);
  if (view.travel) {
    view.travel.k = Math.min(1, view.travel.k + dt / ESCAPE_ROUTE.travelT);
    // polvo detrás de la camioneta
    const L = view.L;
    if (L) {
      const k = view.travel.k;
      const q = roadAt(L, L.pos[view.from], L.pos[view.travel.to], k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
      if (Math.random() < dt * 30)
        view.puffs.push({
          x: q.x - Math.cos(q.a) * L.r * 0.7,
          y: q.y - Math.sin(q.a) * L.r * 0.7,
          r: L.r * 0.25,
          life: 1,
        });
    }
    if (view.travel.k >= 1 && !view.travel.done) {
      view.travel.done = true;
      const to = view.travel.to;
      const then = view.travel.then;
      fade(game, () => (then ? then() : nextStop(game, to)));
    }
  }
  for (const p of view.puffs) p.life -= dt * 1.4;
  view.puffs = view.puffs.filter((p) => p.life > 0);
  draw(game);
}

function draw(game) {
  // la ilustración de la parada elegida
  const a = game.$('rc-art');
  if (view.sel >= 0 && a.clientWidth) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const aw = a.clientWidth;
    const ah = a.clientHeight;
    if (a.width !== Math.round(aw * dpr) || a.height !== Math.round(ah * dpr)) {
      a.width = Math.round(aw * dpr);
      a.height = Math.round(ah * dpr);
    }
    const n = game.escape.route.nodes[view.sel];
    drawStopArt(a.getContext('2d'), aw, ah, dpr, n.kind, n.mod, view.t);
  }
  const c = game.$('route-map');
  const w = c.clientWidth;
  const h = c.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }
  const e = game.escape;
  // votos por parada (en línea): [s que quedan, jugador, parada, …]
  const votes = {};
  const v = game.routeVotes;
  if (v) for (let i = 2; i < v.length; i += 2) votes[v[i]] = (votes[v[i]] || 0) + 1;
  // mientras viaja, la camioneta sale de donde estaba (en línea la parada ya cambió)
  const at = view.travel || game.mode.viaServer() ? view.from : e.at;
  view.L = drawRoute(c.getContext('2d'), e.route, w, h, dpr, {
    at,
    votes,
    visited: e.visited.includes(at) ? e.visited.slice(0, e.visited.indexOf(at) + 1) : e.visited,
    sel: view.sel,
    hover: view.hover,
    t: view.t,
    travel: view.travel,
    puffs: view.puffs,
  });
}

/** En línea: el servidor eligió la parada `to`: la camioneta viaja en el mapa y luego `then` cambia el mapa. */
export function travelOnline(game, from, to, then) {
  if (view.travel) return;
  game.arriving = true;
  view.from = from;
  view.sel = to;
  view.travel = { to, k: 0, then };
  game.$('btn-route-go').disabled = true;
  game.$('route-garage').hidden = true;
  game.sfx.boost();
}

/** Cambia de mapa y empieza la parada `id` (conserva al jugador, su dinero, mejoras e inventario). */
export function nextStop(game, id) {
  const e = game.escape;
  const p = game.player;
  view.from = id;
  if (!e.travel(id)) return;
  if (game.robot.piloted) game.robot.leave(p, game.world);
  // mapa nuevo: cada parada con su semilla (la de la ruta y la parada)
  game.newWorld((e.route.seed + id * 7919) | 0);
  const h = game.horde;
  h.list.length = 0;
  h.lobs.length = 0;
  h.zones.length = 0;
  h.fallen.length = 0;
  h.grid.clear();
  game.bullets.clear();
  game.pickups.clear();
  game.structures.clear();
  game.particles.clear();
  game.decals.clear();
  game.floaters.clear();
  game.setAcid(0);
  game.cache = {};
  game.flowT = 0;
  p.inVan = false;
  p.kx = 0;
  p.ky = 0;
  p.alive = true;
  e.begin(game);
  // el robot viaja con la camioneta
  if (game.robot.owned) {
    game.robot.x = p.x + 70;
    game.robot.y = p.y;
  }
  game.input.reset();
  game.last = performance.now();
  game.setState('play');
  game.updateHud(true);
}

/** Botones y toques del mapa. */
export function bindRoute(game) {
  const c = game.$('route-map');
  const at = (ev) => {
    const r = c.getBoundingClientRect();
    return view.L ? routeHit(view.L, ev.clientX - r.left, ev.clientY - r.top) : -1;
  };
  c.addEventListener('pointerdown', (ev) => {
    if (game.state !== 'route' || view.travel) return;
    const id = at(ev);
    const e = game.escape;
    if (id < 0 || !e.route.nodes[view.from >= 0 ? view.from : e.at].next.includes(id)) return;
    // tocar la ya elegida: viajar
    if (id === view.sel && ev.pointerType !== 'mouse') return travel(game);
    view.sel = id;
    renderCard(game);
  });
  c.addEventListener('dblclick', (ev) => {
    if (game.state === 'route' && at(ev) === view.sel) travel(game);
  });
  c.addEventListener('pointermove', (ev) => {
    if (game.state !== 'route') return;
    const id = at(ev);
    const e = game.escape;
    c.style.cursor =
      id >= 0 && e.route.nodes[view.from >= 0 ? view.from : e.at].next.includes(id) ? 'pointer' : 'default';
  });
  on(game, 'btn-route-go', () => travel(game));
  on(game, 'btn-route-van', () => game.state === 'route' && garage(game, true));
  on(game, 'btn-garage-close', () => garage(game, false));
  game.$('rg-list').addEventListener('click', (ev) => {
    const b = ev.target.closest('.rg-item');
    if (b && game.state === 'route') buyUp(game, b.dataset.k);
  });
  on(game, 'btn-route-shop', () => {
    if (game.state !== 'route' || view.travel) return;
    game.shopReturn = 'route';
    game.openShop();
  });
}

/** Al volver de la tienda: el dinero al día. */
export const refreshRoute = (game) => renderCard(game);
