// Mundos guardados del modo en línea: lo que se guarda de una partida (la oleada o la parada de la Huida y,
// por jugador, dinero, nivel, mejoras, armas e inventario) para seguirla otro día. El servidor no guarda
// nada en disco: manda el mundo a cada jugador (mensaje 'save') al terminar una oleada o una parada y
// cuando alguien sale, y el navegador lo guarda (js/ui/worlds.js). Para seguirlo, el propietario lo vuelve
// a mandar a la sala ('world') y aquí se revisa todo (cleanWorld) antes de usarlo: lo que llega del
// navegador no es de fiar. Las mejoras no se guardan como números sueltos: se vuelven a aplicar las que
// eligió cada uno (taken), así nadie puede inventarse estadísticas.
import {
  ROBOT,
  SHOP_ORDER,
  START_WEAPON,
  WEAPON_ORDER,
  WEAPON_UP,
  WEAPONS,
  xpForLevel,
} from '../../../js/core/config.ts';
import { makeRoute } from '../../../js/sim/route.ts';
import { UPGRADES, isSource } from '../../../js/sim/upgrades.ts';
import { isClass } from '../../../js/sim/abilities.ts';
import type { ServerSim, Slot } from './ServerSim.ts';

export const WORLD_V = 1;
// tamaño máximo del mundo que se acepta (en caracteres de JSON)
export const WORLD_MAX = 60000;

export interface SavedPlayer {
  name: string;
  cls: string;
  money: number;
  level: number;
  xp: number;
  pending: number;
  bonus: string[];
  taken: Record<string, number>;
  inv: Record<string, number>;
  weapons: { id: string; mag: number; reserve: number; lv: number }[];
  heavyAmmo: number;
  robot: { hp: number } | null;
  kills: number;
}

export interface WorldSave {
  v: number;
  /** identificador del mundo (se conserva al seguirlo: así cada navegador lo reemplaza en vez de duplicarlo) */
  id: string;
  mode: 'waves' | 'escape';
  /** semilla del mapa (en la Huida, la de la ruta) */
  seed: number;
  /** oleadas superadas */
  wave: number;
  /** Huida: el viaje (la parada en la que van y si ya la superaron) */
  escape: {
    seed: number;
    at: number;
    visited: number[];
    stop: number;
    cleared: boolean;
    ups: Record<string, number>;
    medic: boolean;
  } | null;
  /** quién era el propietario y quiénes jugaban (para mostrarlo en la lista) */
  host: string;
  players: SavedPlayer[];
  at: number;
}

const UP_BY_ID = new Map<string, any>(UPGRADES.map((u: any) => [u.id, u]));
const num = (v: unknown, lo: number, hi: number, d = lo) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const int = (v: unknown, lo: number, hi: number, d = lo) => Math.round(num(v, lo, hi, d));
const nameKey = (n: string) =>
  String(n || '')
    .trim()
    .toLowerCase();

/** Un identificador nuevo de mundo. */
export const newWorldId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Lo que se guarda de un jugador. */
export function packSlot(s: Slot): SavedPlayer {
  const p = s.p;
  return {
    name: s.name,
    cls: p.cls,
    money: Math.round(s.money),
    level: s.level,
    xp: s.xp,
    pending: s.pending,
    bonus: [...s.bonus],
    taken: { ...s.taken },
    inv: { ...s.inv },
    weapons: p.weapons.map((w: any) => ({
      id: w.id,
      mag: w.mag,
      reserve: w.reserve === Infinity ? -1 : w.reserve,
      lv: w.lv || 0,
    })),
    heavyAmmo: p.heavyAmmo || 0,
    robot: s.robot.owned ? { hp: Math.round(s.robot.hp) } : null,
    kills: s.kills,
  };
}

/**
 * El mundo de esta partida. A mitad de oleada se guarda como si empezara esa oleada (se vuelve a jugar);
 * en la Huida, a mitad de parada se vuelve a jugar esa parada y, en la votación, se sigue votando.
 */
export function packWorld(sim: ServerSim, host: string): WorldSave {
  const d = sim.director;
  const e = sim.escape;
  return {
    v: WORLD_V,
    id: sim.worldId,
    mode: sim.mode,
    seed: e?.route ? e.route.seed : sim.seed,
    wave: d.state === 'waiting' ? d.wave : Math.max(0, d.wave - 1),
    escape:
      e && e.route
        ? {
            seed: e.route.seed,
            at: e.at,
            visited: [...e.visited],
            stop: e.stop,
            cleared: !!sim.vote,
            ups: { ...e.ups },
            medic: e.medic,
          }
        : null,
    host,
    players: [...sim.slots.values()].map(packSlot),
    at: Date.now(),
  };
}

/** Revisa un mundo que mandó un navegador: null si no sirve; si sirve, con todo dentro de lo posible. */
export function cleanWorld(raw: any): WorldSave | null {
  if (!raw || typeof raw !== 'object' || raw.v !== WORLD_V) return null;
  try {
    if (JSON.stringify(raw).length > WORLD_MAX) return null;
  } catch {
    return null;
  }
  const mode = raw.mode === 'escape' ? 'escape' : 'waves';
  const players: SavedPlayer[] = (Array.isArray(raw.players) ? raw.players : []).slice(0, 10).map((sp: any) => {
    const level = int(sp?.level, 1, 300, 1);
    const taken: Record<string, number> = {};
    for (const [k, v] of Object.entries(sp?.taken || {})) if (UP_BY_ID.has(k)) taken[k] = int(v, 0, 60);
    const inv: Record<string, number> = {};
    for (const k of SHOP_ORDER) inv[k] = int(sp?.inv?.[k], 0, 999);
    const weapons = (Array.isArray(sp?.weapons) ? sp.weapons : [])
      .filter((w: any) => w && Object.hasOwn(WEAPONS, w.id) && ((WEAPONS as any)[w.id].price || w.id === START_WEAPON))
      .slice(0, WEAPON_ORDER.length)
      .map((w: any) => ({
        id: String(w.id),
        mag: int(w.mag, 0, 5000),
        reserve: int(w.reserve, -1, 100000),
        lv: int(w.lv, 0, WEAPON_UP.max),
      }));
    return {
      name: String(sp?.name || '').slice(0, 24),
      cls: isClass(sp?.cls) ? sp.cls : '',
      money: int(sp?.money, 0, 1e7),
      level,
      xp: num(sp?.xp, 0, xpForLevel(level) * 2),
      pending: int(sp?.pending, 0, level),
      bonus: (Array.isArray(sp?.bonus) ? sp.bonus : []).filter((b: unknown) => isSource(b as string)).slice(0, 20),
      taken,
      inv,
      weapons,
      heavyAmmo: int(sp?.heavyAmmo, 0, 100000),
      robot: sp?.robot ? { hp: int(sp.robot.hp, 0, ROBOT.hp) } : null,
      kills: int(sp?.kills, 0, 1e7),
    };
  });
  let escape: WorldSave['escape'] = null;
  if (mode === 'escape' && raw.escape && typeof raw.escape === 'object') {
    const seed = int(raw.escape.seed, 1, 2 ** 31 - 1, 1);
    const route = makeRoute(seed);
    const at = int(raw.escape.at, 0, route.nodes.length - 1);
    const visited = (Array.isArray(raw.escape.visited) ? raw.escape.visited : [0])
      .map((v: unknown) => int(v, 0, route.nodes.length - 1))
      .slice(0, route.layers + 1);
    const ups: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw.escape.ups || {})) ups[k.slice(0, 12)] = int(v, 0, 5);
    escape = {
      seed,
      at,
      visited: visited.length ? visited : [0],
      stop: int(raw.escape.stop, 1, route.layers, route.nodes[at].layer + 1),
      cleared: !!raw.escape.cleared,
      ups,
      medic: !!raw.escape.medic,
    };
  }
  if (mode === 'escape' && !escape) return null;
  return {
    v: WORLD_V,
    id:
      String(raw.id || '')
        .replace(/[^a-z0-9]/gi, '')
        .slice(0, 20) || newWorldId(),
    mode,
    seed: int(escape ? escape.seed : raw.seed, 1, 2 ** 31 - 1, 1),
    wave: int(raw.wave, 0, 999),
    escape,
    host: String(raw.host || '').slice(0, 24),
    players,
    at: num(raw.at, 0, 9e15, Date.now()),
  };
}

/** Pone en una ranura lo guardado de su jugador: mejoras (volviéndolas a aplicar), armas, dinero, inventario. */
export function applySaved(s: Slot, sp: SavedPlayer) {
  const p = s.p;
  if (sp.cls) p.cls = sp.cls;
  for (const [id, n] of Object.entries(sp.taken)) {
    const u = UP_BY_ID.get(id);
    for (let i = 0; i < n; i++) u.apply(p);
  }
  s.taken = { ...sp.taken };
  s.money = sp.money;
  s.level = sp.level;
  s.xp = sp.xp;
  s.xpNeed = xpForLevel(sp.level);
  s.pending = sp.pending;
  s.bonus = sp.bonus as Slot['bonus'];
  s.kills = 0;
  Object.assign(s.inv, sp.inv);
  // armas: la de fábrica siempre; las demás como estaban (con su nivel de mejora)
  const start = p.makeWeapon(START_WEAPON);
  start.lv = sp.weapons.find((w) => w.id === START_WEAPON)?.lv || 0;
  p.weapons = [start];
  for (const w of sp.weapons) {
    if (w.id === START_WEAPON) continue;
    const slot = p.makeWeapon(w.id);
    slot.lv = w.lv;
    slot.mag = Math.min(w.mag, p.magSize(slot.def, w.lv));
    slot.reserve = slot.def.reserve === Infinity ? Infinity : Math.max(0, w.reserve);
    p.weapons.push(slot);
  }
  p.weapons.sort((a: any, b: any) => WEAPON_ORDER.indexOf(a.id) - WEAPON_ORDER.indexOf(b.id));
  p.wi = 0;
  p.heavyAmmo = sp.heavyAmmo;
  p.hp = p.stats.maxHp;
  if (sp.robot) {
    s.robot.owned = true;
    s.robot.hp = sp.robot.hp;
    s.robot.x = p.x + 70;
    s.robot.y = p.y;
  }
}

/** Sigue un mundo guardado en una partida recién creada (con la misma semilla y modo). */
export function restoreWorld(sim: ServerSim, w: WorldSave) {
  sim.worldId = w.id;
  // cada jugador recupera lo suyo (por nombre); quien no estaba en el mundo empieza poniéndose al día
  const byName = new Map(w.players.map((sp) => [nameKey(sp.name), sp]));
  const fresh: Slot[] = [];
  for (const s of sim.slots.values()) {
    const sp = byName.get(nameKey(s.name));
    if (sp) applySaved(s, sp);
    else fresh.push(s);
  }
  // (después de los que sí estaban: se ponen al día con ellos)
  for (const s of fresh) sim.catchUp(s);
  if (w.mode === 'escape' && w.escape && sim.escape) {
    const e = sim.escape;
    e.route = makeRoute(w.escape.seed);
    e.at = w.escape.at;
    e.visited = w.escape.visited;
    e.stop = w.escape.stop;
    e.ups = { ...w.escape.ups };
    e.medic = w.escape.medic;
    sim.enterStop();
    // la parada ya estaba superada: se sigue votando el camino
    if (w.escape.cleared) e.finish(sim.game, 'stop');
  } else {
    // entre oleadas: los jugadores dicen cuándo empieza la siguiente
    sim.director.wave = w.wave;
    sim.director.state = 'waiting';
    sim.director.queue.length = 0;
  }
}
