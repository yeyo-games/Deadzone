// Modo Huida en pantalla (la lógica está en sim/escape.ts): el botón del menú, el panel de arriba (objetivo,
// bidones, amenaza, camioneta y carga), el aviso de la tecla H y el final de la huida.
import { on } from './dom.js';
import { showClass } from './class.js';
import { gameOver } from './over.js';
import { tryFullscreen } from './menu.js';
import { fade, openRoute, travelOnline, vanIcon } from './route.js';
import { unpackEscape } from '../sim/escape.ts';
import { TYPES } from '../net/protocol.ts';
import { storage } from '../core/util.ts';
import { xpForLevel } from '../core/config.ts';
import { applyPlayer, packPlayer } from '../save.js';
import { isSource } from '../sim/upgrades.ts';
import { makeRoute } from '../sim/route.ts';
import { Solo } from '../net/mode.ts';
import { addCans } from './look.js';
import { ESCAPE_CANS, ESCAPE_OBJ, VAN_UP_ORDER, VAN_UPS } from '../core/config.ts';

const CAN_SVG =
  '<svg viewBox="0 0 24 24"><path d="M7 5h7l4 4v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M9 3h4v2H9zM9 11l6 6M15 11l-6 6"/></svg>';

/* ---------- el viaje guardado: entre paradas, para seguirlo otro día ---------- */

const tripKey = (game) => `${game.accounts.saveKey()}-huida`;

/** Guarda el viaje en el mapa de ruta (no a mitad de una parada). */
export function saveTrip(game) {
  const e = game.escape;
  if (!e.route || game.devUsed || !game.player?.alive) return;
  storage.set(tripKey(game), {
    v: 1,
    seed: e.route.seed,
    at: e.at,
    visited: e.visited,
    stop: e.stop,
    time: game.time,
    kills: game.kills,
    level: game.level,
    xp: game.xp,
    pending: game.pendingLevels,
    taken: game.taken,
    bonus: game.bonusPicks,
    money: game.money,
    moneyEarned: game.moneyEarned,
    inv: game.inv,
    player: packPlayer(game.player),
    robot: game.robot.owned ? { hp: game.robot.hp } : null,
    ups: e.ups,
    medic: e.medic,
  });
}

export const clearTrip = (game) => storage.remove(tripKey(game));

/** El viaje guardado de esta cuenta, o null. */
export const savedTrip = (game) => {
  const d = storage.get(tripKey(game), null);
  return d && d.v === 1 ? d : null;
};

/** Sigue un viaje guardado: vuelve al mapa de ruta de la última parada superada. */
export function loadTrip(game) {
  const d = savedTrip(game);
  if (!d) return false;
  game.sfx.unlock();
  game.resetRun();
  game.mode = new Solo(game, true);
  game.lastKind = 'escape';
  Object.assign(game.kills, d.kills);
  game.time = d.time;
  game.level = d.level;
  game.xp = d.xp;
  game.xpNeed = xpForLevel(d.level);
  game.pendingLevels = d.pending || 0;
  game.taken = d.taken || {};
  game.bonusPicks = Array.isArray(d.bonus) ? d.bonus.filter(isSource) : [];
  game.money = d.money;
  game.moneyEarned = d.moneyEarned;
  Object.assign(game.inv, d.inv);
  applyPlayer(game, d.player);
  if (d.robot) {
    game.robot.owned = true;
    game.robot.hp = d.robot.hp;
  }
  const e = game.escape;
  e.route = makeRoute(d.seed);
  e.at = d.at;
  e.visited = d.visited;
  e.stop = d.stop;
  e.ups = d.ups && typeof d.ups === 'object' ? { ...d.ups } : {};
  e.medic = !!d.medic;
  e.active = true;
  game.analitica.iniciar('solo');
  openRoute(game);
  return true;
}

/* ---------- récord de la Huida (por cuenta) ---------- */

const bestKey = (game) => `${game.accounts.saveKey()}-huida-best`;

/** Guarda el récord de la huida que acaba de terminar y devuelve el texto para la pantalla final. */
export function recordEscape(game) {
  const e = game.escape;
  const won = game.escapeResult === 'won';
  const best = storage.get(bestKey(game), null) || { stop: 0, wins: 0, time: 0 };
  const better = won ? !best.wins || game.time < best.time || best.stop < e.total : e.stop > best.stop;
  const next = {
    stop: Math.max(best.stop, won ? e.total : e.stop),
    wins: best.wins + (won ? 1 : 0),
    time: won && (!best.wins || game.time < best.time) ? game.time : best.time,
  };
  if (!game.devUsed) storage.set(bestKey(game), next);
  if (game.devUsed) return 'Partida con modo desarrollador: no cuenta para los récords';
  if (won && !best.wins) return '¡Primera vez que escapas de la ciudad!';
  if (won) return better ? 'Tu huida más rápida' : `Has escapado ${next.wins} veces`;
  return better ? 'Nuevo récord: llegaste más lejos que nunca' : `Tu récord: parada ${best.stop} de ${e.total}`;
}

/** Texto del récord para el botón del menú. */
function bestText(game) {
  const b = storage.get(bestKey(game), null);
  if (!b) return 'Escapa de la ciudad en camioneta';
  return b.wins ? `Escapaste ${b.wins} ${b.wins === 1 ? 'vez' : 'veces'}` : `Récord: parada ${b.stop} de 7`;
}

/** El botón del menú para seguir el viaje guardado. */
export function refreshEscapeMenu(game) {
  game.$('esc-best').textContent = bestText(game);
  const d = savedTrip(game);
  const b = game.$('btn-esc-continue');
  b.hidden = !d;
  if (d) b.textContent = `Continuar huida · parada ${d.stop + 1}`;
}

// Botón "Huida" del menú: elegir clase y empezar en modo Huida (un viaje nuevo borra el guardado).
export function bindEscape(game) {
  on(game, 'btn-escape', () => {
    tryFullscreen(game);
    game.runKind = 'escape';
    showClass(game, true);
  });
  on(game, 'btn-esc-continue', () => {
    tryFullscreen(game);
    loadTrip(game);
  });
  on(game, 'btn-esc-shop', () => {
    if (game.state === 'play' && game.escape.phase === 'search') game.openShop();
  });
}

/** Objetivo de ahora, en una línea. */
function goalText(e) {
  if (e.phase === 'search')
    return e.have >= e.need ? 'Vuelve a la camioneta y carga el combustible' : 'Encuentra los bidones';
  if (e.phase === 'fuel')
    return e.bossAlive
      ? `Defiende la camioneta y derrota a ${e.bossName()}`
      : 'Defiende la camioneta mientras se carga';
  if (e.phase === 'ready')
    return e.bossAlive ? `Derrota a ${e.bossName()} para cruzar el puente` : '¡Sube a la camioneta!';
  if (e.phase === 'leaving') return 'Escapando…';
  if (e.phase === 'lost') return 'La camioneta explotó';
  return '';
}

const CROSS_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>';

/** El objetivo de la parada en el panel: texto y cuánto lleva (0..1, o -1 sin barra). */
function objLine(e) {
  const o = e.obj;
  if (!o) return null;
  if (o.kind === 'pump') {
    const max = ESCAPE_OBJ.pump.max;
    if (o.state === 2) return { t: 'La bomba ya está seca', k: -1, done: true };
    return { t: `Bomba de gasolina · ${o.n}/${max} bidones`, k: o.prog };
  }
  if (o.kind === 'medic') {
    if (o.state === 0) return { t: 'Rescata al médico de la clínica', k: -1 };
    if (o.state === 1)
      return { t: 'Médico: llévalo a la camioneta', k: Math.max(0, o.hp / ESCAPE_OBJ.medic.hp), hurt: true };
    if (o.state === 2) return { t: 'Médico a bordo: cura entre paradas', k: -1, done: true };
    return { t: 'El médico murió', k: -1, fail: true };
  }
  if (o.kind === 'armory') {
    if (o.state === 0) return { t: 'Armería cerrada · mantén H en la puerta', k: -1 };
    return { t: 'Armería abierta', k: -1, done: true };
  }
  if (o.kind === 'cart') {
    const n = o.items.length;
    const got = o.items.filter((x) => x.taken).length;
    if (!n) return null;
    return { t: `Provisiones para el carrito · ${got}/${n}`, k: got / n, done: got === n };
  }
  return null;
}

// Cada fotograma (en partida): el panel de arriba.
export function updateEscapeHud(game) {
  const e = game.escape;
  const on = e.active && game.state !== 'menu';
  game.root.classList.toggle('esc-on', on);
  const $ = game.$;
  $('esc-hud').hidden = !on;
  if (!on) return;
  // lo que cambia poco se reescribe sólo si cambió
  const sig = `${e.phase}|${e.have}|${e.level}|${e.bossAlive}|${e.need}`;
  if (game.cache.escHud !== sig) {
    game.cache.escHud = sig;
    $('esc-stop').textContent = `Parada ${e.stop}/${e.total} · ${e.stopDef.name}`;
    $('esc-goal').textContent = goalText(e);
    const total = Math.max(e.need, e.cans.length);
    let cans = '';
    for (let i = 0; i < total; i++) {
      const cls = (i < e.have ? 'on' : '') + (i >= e.need ? ' extra' : '');
      cans += `<i class="${cls}">${CAN_SVG}</i>`;
    }
    $('esc-cans').innerHTML = cans;
    $('esc-lvl').textContent = e.level;
    $('btn-esc-shop').hidden = e.phase !== 'search';
  }
  $('esc-threat-fill').style.transform = `scaleX(${e.levelProg.toFixed(3)})`;
  const van = e.van;
  const vk = van ? Math.max(0, van.hp / van.max) : 0;
  $('esc-van-fill').style.transform = `scaleX(${vk.toFixed(3)})`;
  $('esc-van').classList.toggle('hit', !!van && van.hitT > 0);
  $('esc-van').classList.toggle('low', vk < 0.35);
  const fueling = e.phase === 'fuel';
  $('esc-fuel').hidden = !fueling;
  if (fueling) {
    $('esc-fuel-fill').style.transform = `scaleX(${Math.min(1, e.fuelT / e.fuelMax).toFixed(3)})`;
    $('esc-fuel-lbl').textContent = `Cargando · ${Math.ceil(e.fuelMax - e.fuelT)} s`;
  }
  $('esc-hud').classList.toggle('danger', fueling || vk < 0.35);
  // el objetivo de la parada
  const ol = e.phase === 'leaving' || e.phase === 'lost' ? null : objLine(e);
  $('esc-obj').hidden = !ol;
  if (ol) {
    const osig = `${ol.t}|${ol.k >= 0}|${!!ol.done}|${!!ol.fail}|${!!ol.hurt}`;
    if (game.cache.escObj !== osig) {
      game.cache.escObj = osig;
      $('esc-obj-t').textContent = ol.t;
      $('esc-obj').className =
        `esc-obj ${e.obj.kind}${ol.done ? ' done' : ''}${ol.fail ? ' fail' : ''}${ol.hurt ? ' hurt' : ''}`;
      $('esc-obj-fill').parentElement.hidden = ol.k < 0;
    }
    if (ol.k >= 0) $('esc-obj-fill').style.transform = `scaleX(${Math.min(1, ol.k).toFixed(3)})`;
  }
  // mejoras de la camioneta y el médico a bordo
  const usig = `${VAN_UP_ORDER.map((k) => e.ups[k] || 0).join('')}|${e.medic}|${e.hornUsed}`;
  if (game.cache.escUps !== usig) {
    game.cache.escUps = usig;
    let h = '';
    for (const k of VAN_UP_ORDER) {
      const n = e.ups[k] || 0;
      if (!n) continue;
      const off = k === 'horn' && e.hornUsed ? ' off' : '';
      h += `<i class="eu ${k}${off}" title="${VAN_UPS[k].name}">${vanIcon(k)}${n > 1 ? `<b>${n}</b>` : ''}</i>`;
    }
    if (e.medic) h += `<i class="eu medic" title="Médico a bordo">${CROSS_SVG}</i>`;
    $('esc-ups').innerHTML = h;
    $('esc-ups').hidden = !h;
  }
}

/** Lo que se hace con H en la Huida (lo muestra el mismo aviso que las operaciones). */
export function escapePrompt(game) {
  return game.escape.active ? game.escape.prompt(game) : null;
}

/* ---------- en línea: el servidor manda el viaje en cada foto ---------- */

/** Aplica la Huida de la foto: la parada, el mapa de ruta para votar y el cambio de mapa al viajar. */
export function onlineEscape(game, s) {
  const e = game.escape;
  const from = e.active ? e.at : 0;
  const seed = unpackEscape(e, s.hu, TYPES);
  game.routeVotes = Array.isArray(s.hv) ? s.hv : null;
  // dentro de la camioneta (al salir y entre paradas) el jugador no se ve ni se mueve
  const p = game.player;
  if (p) p.inVan = p.alive && (e.phase === 'leaving' || (e.phase === 'done' && e.result === 'stop'));
  if (game.world.seedBase !== seed) {
    // parada nueva: en el mapa, la camioneta viaja y luego cambia el mapa; si no, de una vez
    if (game.state === 'route') travelOnline(game, from, e.at, () => arriveOnline(game, seed));
    else if (!game.arriving) arriveOnline(game, seed);
    return;
  }
  // parada superada: latas y al mapa a votar el camino
  // (también si estaba en pausa, en la tienda o eligiendo una mejora: si no, se quedaba sin votar)
  const busy = ['play', 'pause', 'levelup', 'shop', 'turret'].includes(game.state);
  // (una vez por parada de este viaje: la semilla distingue una partida de la siguiente en la misma sesión)
  const key = `${e.route.seed}:${e.stop}`;
  if (e.phase === 'done' && e.result === 'stop' && busy && game.routeStop !== key) {
    game.routeStop = key;
    addCans(game, ESCAPE_CANS.stop);
    // (si mientras se funde ya se viajó, no se abre el mapa)
    fade(game, () => {
      if (e.phase === 'done' && e.result === 'stop' && game.world.seedBase === seed) openRoute(game);
    });
  }
}

/** Cambia al mapa de la parada nueva (lo demás lo trae la próxima foto del servidor). */
export function arriveOnline(game, seed) {
  game.newWorld(seed);
  game.horde.list = [];
  game.structures.clear();
  game.pickups.clear();
  game.bullets.clear();
  game.particles.clear();
  game.decals.clear();
  game.cache = {};
  game.remote.blkGeo = '';
  game.arriving = false;
  if (game.state === 'route' || game.state === 'shop') {
    game.input.reset();
    game.setState('play');
  }
  game.updateHud(true);
}

/** Fin de la huida: escapaste o explotó la camioneta. */
export function escapeEnd(game, result) {
  // parada superada: al mapa de ruta para elegir la siguiente
  if (result === 'stop') {
    addCans(game, ESCAPE_CANS.stop);
    return fade(game, () => {
      openRoute(game);
      saveTrip(game);
    });
  }
  if (result === 'won') addCans(game, ESCAPE_CANS.won);
  game.escapeResult = result;
  game.analitica.muerte(result === 'won' ? 'huida' : 'camioneta');
  gameOver(game);
}
