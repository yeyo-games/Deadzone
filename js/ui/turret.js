// Taller de las torretas pesada y militar: junto a una (o montado en ella) se abre con M o el botón
// Mejorar y se compran sus mejoras (HEAVY_UP o MILITARY_UP), que son de esa torreta. En solitario
// pausa; en línea el mundo sigue y la compra la hace el servidor (llega de vuelta con la foto).
import { ABILITY, HEAVY, MILITARY, SHOP, WEAPONS } from '../core/config.ts';
import {
  heavyAuto,
  heavyBlastR,
  heavyDmg,
  heavyLevel,
  heavyLevels,
  heavyMax,
  heavyMaxHp,
  heavyPrice,
  heavyRate,
  milBlastR,
  milDmg,
  milRange,
  milReload,
  milSalvo,
  upDefs,
  upgradeHeavy,
  upOrder,
  heavyFireOn,
  heavyFireReady,
  toggleHeavyFire,
} from '../sim/heavy.ts';
import { hasPlan } from './ops.js';
import { MOUNTS } from '../sim/build.ts';
import { drawHeavyPreview } from '../render/build.js';
import { shareTurret } from '../actions.js';
import { closest, on } from './dom.js';

const P = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  cal: `<svg viewBox="0 0 24 24" ${P}><path d="M4 9h11l3 3-3 3H4z"/><path d="M8 9v6M18 12h3"/></svg>`,
  rate: `<svg viewBox="0 0 24 24" ${P}><path d="M3 8h9l2 2-2 2H3zM6 14h9l2 2-2 2H6z"/><path d="M19 6l2-2M20 11h2"/></svg>`,
  blast: `<svg viewBox="0 0 24 24" ${P}><path d="M12 2l2 6 6-2-3 5 5 3-6 1 1 6-5-4-4 5 0-6-6-1 5-4-3-5 6 2z"/></svg>`,
  armor: `<svg viewBox="0 0 24 24" ${P}><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="M9 12h6M12 9v6"/></svg>`,
  auto: `<svg viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`,
  fire: `<svg viewBox="0 0 24 24" ${P}><path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-5 1-8z"/></svg>`,
  warhead: `<svg viewBox="0 0 24 24" ${P}><path d="M3 12h10l5-4v8l-5-4"/><path d="M13 9.5v5M18 12h3"/></svg>`,
  reload: `<svg viewBox="0 0 24 24" ${P}><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/><path d="M9 12h6"/></svg>`,
  radar: `<svg viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12l6-6"/></svg>`,
  salvo: `<svg viewBox="0 0 24 24" ${P}><path d="M4 12h12l3-2M4 7h9l3-2M4 17h9l3 2"/></svg>`,
};

const GUN_DMG = WEAPONS.heavy.damage;
const MIS_DMG = ABILITY.bomber.power;
const MIS_R = ABILITY.bomber.radius;

// La torreta abierta: se busca por su lugar (en línea las piezas se rehacen con cada foto).
function current(game) {
  const k = game.tupAt;
  return k ? game.structures.blocks.find((b) => MOUNTS.includes(b.kind) && b.x === k.x && b.y === k.y) || null : null;
}
const isMil = (b) => b.kind === 'military';
// Segundos entre misiles subido en la militar (el cargador también lo acorta).
const manualCd = (b) => Math.round(((MILITARY.manual * milReload(b)) / MILITARY.reload) * 10) / 10;

export function openTurret(game) {
  const p = game.player;
  if (game.state !== 'play' || !p.alive || p.inRobot) return;
  const b = game.structures.heavyFor(p);
  if (!b) return game.toast('Acércate a una torreta pesada o militar para mejorarla');
  game.tupAt = { x: b.x, y: b.y };
  game.tupSig = '';
  game.tupUp = b.up || 0;
  game.tupPulse = 0;
  game.tupT = 0;
  game.setState('turret');
  game.sfx.build();
  renderTurret(game);
}

export function closeTurret(game) {
  if (game.state !== 'turret') return;
  game.tupAt = null;
  if (game.mode.savesProgress()) game.saveProgress();
  game.input.reset();
  game.last = performance.now();
  game.setState('play');
}

// Las mejoras que se ven: la munición incendiaria sólo con su plano (operación del nido).
const shown = (game, b) => upOrder(b).filter((id) => id !== 'fire' || hasPlan(game, 'fire'));

// Balas normales o incendiarias (si están instaladas).
function toggleFire(game) {
  const b = current(game);
  if (!b || !heavyFireReady(b)) return;
  if (game.mode.viaServer()) return game.online.buy('tfire', '');
  game.toast(toggleHeavyFire(b) ? 'Balas incendiarias' : 'Balas normales');
  renderTurret(game);
}

// Compra el siguiente nivel de la mejora id (en línea lo pide al servidor).
export function buyTurretUp(game, id) {
  const b = current(game);
  if (!b || !upDefs(b)[id] || !shown(game, b).includes(id)) return;
  const price = heavyPrice(b, id);
  if (!price) return game.toast(`${upDefs(b)[id].name}: ya está al máximo`);
  if (game.money < price) return game.toast(`Te faltan $${price - game.money}`);
  if (game.mode.viaServer()) return game.online.buy('tup', id);
  game.money -= price;
  upgradeHeavy(b, id);
  renderTurret(game);
}

// Lo que dice la fila de cada mejora: el efecto de ahora y el del siguiente nivel.
function stepText(b, id) {
  const lv = heavyLevel(b, id);
  const d = upDefs(b)[id];
  const next = lv < heavyMax(b, id) ? lv + 1 : -1;
  const arrow = (a, z, u = '') => (next < 0 ? `${a}${u}` : `${a}${u} → <em>${z}${u}</em>`);
  const at = (a) => a[next < 0 ? lv : next];
  if (id === 'warhead')
    return `Daño ${arrow(Math.round(MIS_DMG * d.dmg[lv]), Math.round(MIS_DMG * at(d.dmg)))} · radio ${arrow(Math.round(MIS_R * d.r[lv]), Math.round(MIS_R * at(d.r)), ' px')}`;
  if (id === 'reload') return `Un misil cada ${arrow(d.cd[lv], at(d.cd), ' s')}`;
  if (id === 'radar') return `Alcance ${arrow(d.reach[lv], at(d.reach), ' px')} · giro más rápido`;
  if (id === 'salvo') return `${arrow(d.n[lv], at(d.n))} ${at(d.n) === 1 ? 'misil' : 'misiles'} por disparo`;
  if (id === 'cal') return `Daño ${arrow(Math.round(GUN_DMG * d.dmg[lv]), Math.round(GUN_DMG * d.dmg[next]))}`;
  if (id === 'rate') return arrow(d.rate[lv], d.rate[next], ' disp/s');
  if (id === 'blast') return `Radio ${arrow(d.r[lv], d.r[next], ' px')}`;
  if (id === 'armor')
    return `Vida ${arrow(d.hp[lv], d.hp[next])} · repara ${Math.round(d.repair[next < 0 ? lv : next] * 100)}%`;
  if (id === 'fire')
    return lv ? `Instalada · ahora dispara balas ${heavyFireOn(b) ? 'incendiarias' : 'normales'}` : '20% menos de daño directo, pero queman';
  return lv ? 'Activo: dispara sola cuando la dejas' : `Media cadencia · alcance ${d.range} px`;
}

export function renderTurret(game) {
  const b = current(game);
  if (!b) return;
  const p = game.player;
  game.$('tup-money').textContent = `$${game.money}`;
  const lv = heavyLevels(b);
  const order = shown(game, b);
  const total = order.reduce((n, id) => n + lv[id], 0);
  const all = order.reduce((n, id) => n + heavyMax(b, id), 0);
  game.$('tup-name').textContent = SHOP[b.kind].name;
  game.$('tup-kicker').textContent = total ? `Taller · ${total} de ${all} mejoras` : 'Taller · de fábrica';
  const hp = Math.max(0, Math.round(b.hp));
  const stat = (k, v, cls = '') => `<div class="tup-stat${cls}"><dt>${k}</dt><dd>${v}</dd></div>`;
  const life = stat('Vida', `${hp}<small>/${heavyMaxHp(b)}</small>`, hp < heavyMaxHp(b) * 0.35 ? ' low' : '');
  game.$('tup-stats').innerHTML = isMil(b)
    ? stat('Daño', Math.round(MIS_DMG * milDmg(b))) +
      stat('Recarga', `${milReload(b)}<small>s</small>`) +
      stat('Explosión', `${Math.round(MIS_R * milBlastR(b))}<small>px</small>`) +
      life +
      stat('Alcance', `${milRange(b)}<small>px</small>`) +
      stat('Misiles', milSalvo(b), milSalvo(b) > 1 ? ' on' : '')
    : stat('Daño', Math.round(GUN_DMG * heavyDmg(b))) +
      stat('Cadencia', `${heavyRate(b)}<small>/s</small>`) +
      stat('Explosión', `${heavyBlastR(b)}<small>px</small>`) +
      life +
      stat('Piloto', heavyAuto(b) ? 'Sí' : 'No', heavyAuto(b) ? ' on' : '') +
      stat('Balas', p.heavyAmmo, p.heavyAmmo ? '' : ' low');
  game.$('tup-list').innerHTML = order
    .map((id, i) => {
      const d = upDefs(b)[id];
      const max = heavyMax(b, id);
      const price = heavyPrice(b, id);
      const poor = price && game.money < price;
      const pips = Array.from({ length: max }, (_, k) => `<i class="${k < lv[id] ? 'on' : ''}"></i>`).join('');
      const btn = price
        ? `<button class="btn buy${poor ? ' poor' : ''}" data-tup="${id}" ${poor ? 'disabled' : ''}>$${price}</button>`
        : id === 'fire'
          ? `<button class="btn buy" data-tfire="1">${heavyFireOn(b) ? 'Usar normales' : 'Usar incendiarias'}</button>`
          : '<span class="tup-max">Máximo</span>';
      return `<div class="tup-item${price ? '' : ' done'}">
      <span class="tup-ic">${ICONS[id]}</span>
      <div class="shop-txt"><b>${d.name} <span class="pips${max > 5 ? ' many' : ''}">${pips}</span></b><span>${d.desc}</span><small>${stepText(b, id)}<span class="key"> · tecla ${i + 1}</span></small></div>
      ${btn}
    </div>`;
    })
    .join('');
  // en línea, en tu torreta: el permiso para que los demás se suban
  const mine = game.mode.viaServer() && !!b.owner && b.owner === p.sid;
  const sh = game.$('btn-tup-share');
  sh.hidden = !mine;
  sh.classList.toggle('on', !!b.shared);
  game.$('tup-share-t').textContent = b.shared ? 'Los demás pueden subirse' : 'Sólo tú puedes subirte';
  game.$('tup-share-d').textContent = b.shared
    ? 'Toca para quitar el permiso (quien la maneje se baja) · tecla L'
    : 'Toca para dejar que los demás se suban · tecla L';
  // la munición de la pesada se sigue comprando en la tienda; aquí sólo se recuerda el precio
  game.$('tup-note').textContent = isMil(b)
    ? `Las mejoras son de esta torreta. No necesita munición: lanza sola un misil cada ${milReload(b)} s y, si te subes con E, tú lanzas uno cada ${manualCd(b)} s.`
    : `Las mejoras son de esta torreta. Sus balas (${HEAVY.pack} por $${HEAVY.price}) se compran en la tienda y las comparte cualquier torreta que montes.`;
  game.tupSig = sig(game, b);
}

const sig = (game, b) => `${game.money}|${b.up || 0}|${Math.round(b.hp)}|${game.player.heavyAmmo}|${b.shared ? 1 : 0}`;

// Cada fotograma con el taller abierto: teclas, la torreta girando en la vista previa y, en línea,
// lo que cambie con la foto (dinero, mejoras compradas, golpes).
export function updateTurret(game, dt) {
  const inp = game.input;
  if (inp.consume('pause') || inp.consume('turret')) return closeTurret(game);
  if (inp.consume('share')) shareTurret(game, current(game));
  const s = inp.consume('slot');
  const was = current(game);
  if (s && was && shown(game, was)[s - 1]) buyTurretUp(game, shown(game, was)[s - 1]);
  const b = current(game);
  if (!b || b.hp <= 0 || !game.player.alive) {
    if (b?.hp <= 0 || !b) game.toast('La torreta fue destruida');
    return closeTurret(game);
  }
  if ((b.up || 0) !== game.tupUp) {
    // se compró una mejora: destello en la vista previa
    game.tupUp = b.up || 0;
    game.tupPulse = 1;
    game.sfx.buy();
    game.sfx.build();
  }
  if (sig(game, b) !== game.tupSig) renderTurret(game);
  game.tupT += dt;
  game.tupPulse = Math.max(0, game.tupPulse - dt * 1.6);
  const c = game.$('tup-view');
  drawHeavyPreview(c.getContext('2d'), b, c.width, c.height, game.tupT, game.tupPulse);
}

// Botones del taller y el botón táctil que lo abre.
export function bindTurret(game) {
  on(game, 'btn-tup-done', () => closeTurret(game));
  on(game, 'btn-tup-share', () => shareTurret(game, current(game)));
  game.$('tup-list').addEventListener('click', (e) => {
    const t = closest(e.target, '[data-tup]');
    if (t) buyTurretUp(game, t.dataset.tup);
    if (closest(e.target, '[data-tfire]')) toggleFire(game);
  });
}
