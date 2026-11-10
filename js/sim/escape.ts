// Modo Huida: escapar de la ciudad en una camioneta, parada por parada (cifras en ESCAPE, ESCAPE_ROUTE y
// ESCAPE_STOPS de config.ts). El viaje es una ruta con ramas (sim/route.ts); cada parada es un mapa nuevo.
// Fases: search (juntar bidones con la amenaza subiendo cada minuto) → fuel (con H en la camioneta empieza
// la carga: la horda va por ella) → ready (con H suben todos; en el puente, antes hay que derrotar al jefe
// que lo bloquea) → leaving (la camioneta arranca y se va) o lost (la camioneta explotó) → done: en la
// última parada eso es escapar; en las demás, el mapa de ruta elige la siguiente y el juego cambia de mapa
// (travel + begin). En vez de oleadas, los zombis llegan sin parar: el director se queda en 'escape' y esto
// le llena la cola y lo hace repartirlos por las orillas (spawnGroup).
// Sirve igual en solitario (game.player) y en el servidor en línea (game.targets: todos los jugadores);
// lo que cambia (a quién se le paga, a quién se le da una mejora) lo ponen los ganchos escapePay y
// escapePick. packEscape / unpackEscape llevan el estado en la foto del servidor. Sólo lógica: el dibujo
// está en render/escape.js y la pantalla en ui/escape.js y ui/route.js.
import {
  BOSSES,
  ESCAPE,
  ESCAPE_OBJ,
  ESCAPE_OBJ_KINDS,
  ESCAPE_ROUTE,
  ESCAPE_STOPS,
  EVENTS,
  VAN_UP_ORDER,
  VAN_UPS,
  WEAPONS,
} from '../core/config.ts';
import type { VanUp } from '../core/config.ts';
import type { EventDef } from '../core/config.ts';
import { rand, TAU } from '../core/util.ts';
import type { GameHost, Zombie } from '../core/types.d.ts';
import { turretBullet } from './build.ts';
import { spawnBoss } from './bosses.ts';
import { waveCounts } from './director.ts';
import { GOAL_TYPES, makeGoal, type Goal } from './ops/common.ts';
import type { Player } from './player.ts';
import { isFinal, makeRoute, shuffle, type Route, type RouteNode } from './route.ts';

export type EscapePhase = 'search' | 'fuel' | 'ready' | 'leaving' | 'lost' | 'done';
/** Las fases en el orden en que viajan en la foto. */
export const PHASES: EscapePhase[] = ['search', 'fuel', 'ready', 'leaving', 'lost', 'done'];
/** Cómo terminó la parada, en la foto: '' · 'stop' (sigue el viaje) · 'won' (escaparon) · 'van' (explotó). */
export const RESULTS = ['', 'stop', 'won', 'van'];

/** Un bidón en el mapa (sale ya en el suelo; se recoge al tocarlo). */
export interface Can {
  x: number;
  y: number;
  taken: boolean;
  /** para que cada uno brille a su ritmo */
  ph: number;
  /** custodiado: el zombi con habilidad que sale al acercarte ('' si ya salió o no tiene) */
  guard?: string;
}

/** Barril explosivo (gasolineras): estalla con un disparo cerca o con otra explosión al lado. */
export interface Barrel {
  x: number;
  y: number;
  alive: boolean;
  ph: number;
}

/** La camioneta: rectángulo (obstáculo bajo, se dispara por encima) con vida, y el objetivo de la horda. */
export interface Van {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  max: number;
  /** golpe reciente (parpadeo) */
  hitT: number;
  /** recorrido de la salida (px) */
  drive: number;
}

/**
 * El objetivo propio de la parada (ESCAPE_OBJ): la bomba de la gasolinera, el médico de la clínica, la
 * armería de la comisaría o las provisiones del supermercado. x, y: dónde está (el médico se mueve) ·
 * prog: 0..1 (la bomba hacia el siguiente bidón) · state: 0 esperando, 1 en marcha (el médico te sigue),
 * 2 cumplido, 3 fallido · n: bidones que dio la bomba o provisiones juntadas · items: las provisiones.
 */
export interface StopObj {
  kind: string;
  x: number;
  y: number;
  prog: number;
  state: number;
  hp: number;
  n: number;
  items: { x: number; y: number; taken: boolean }[];
  /** el médico: hacia dónde mira y si lo acaban de golpear */
  ang: number;
  hitT: number;
}

/** Cómo se anuncia el guardia de un bidón. */
const GUARD_NAMES: Record<string, string> = {
  spitter: 'Un escupidor',
  screamer: 'Un chillón',
  bull: 'Un toro',
  digger: 'Un excavador',
  jumper: 'Un saltador',
};

/** Los jugadores de la parada: los del servidor o el de este equipo. */
const everyone = (game: GameHost): Player[] =>
  (game.targets as Player[] | undefined) || (game.player ? [game.player] : []);
/** Los que pueden actuar: vivos y fuera de la camioneta. */
const active = (game: GameHost) => everyone(game).filter((p) => p.alive && !p.inVan);

/** Paga a un jugador: en línea a su ranura (gancho escapePay); en solitario, al dinero de la partida. */
function pay(game: GameHost, n: number, p: Player | null) {
  if (game.escapePay) return game.escapePay(n, p);
  game.money = (game.money || 0) + n;
  game.moneyEarned = (game.moneyEarned || 0) + n;
  game.moneyPop?.(`+$${n}`, 'gold');
}

/** Nivel de una mejora de la camioneta y su cifra de ese nivel (lista por nivel, empieza en el 1). */
const lv = (ups: Record<string, number>, k: VanUp) => ups[k] || 0;
const at = <T>(a: readonly T[], n: number) => a[Math.min(a.length, n) - 1];

/** Una mejora a elegir para un jugador (gancho escapePick en línea; en solitario, bonusPicks). */
function pick(game: GameHost, src: string, p: Player | null) {
  if (game.escapePick) return game.escapePick(src, p);
  game.bonusPicks?.push(src);
}

/** Bidones que hacen falta en la parada número `stop` (uno más cada needEvery; el tanque grande, menos). */
export function needAt(stop: number, ups: Record<string, number> = {}) {
  const base = ESCAPE.need + Math.floor((stop - 1) / ESCAPE_ROUTE.needEvery);
  return Math.max(1, base - VAN_UPS.tank.cans * (ups.tank || 0));
}

/** "1 bidón" o "3 bidones". */
const cans = (n: number) => `${n} ${n === 1 ? 'bidón' : 'bidones'}`;

// consulta de la cuadrícula de la horda (se reusa)
const near: Zombie[] = [];

/** Peso de cada tipo en la mezcla de un nivel de amenaza (la composición de esa oleada, con su ronda especial). */
function mix(level: number, ev: EventDef | null): [string, number][] {
  const c = waveCounts(level, 1, ev) as unknown as Record<string, number>;
  return Object.entries(c).filter(([k, n]) => k !== 'total' && k !== 'boss' && n > 0);
}

function pickType(m: [string, number][]) {
  const total = m.reduce((s, [, n]) => s + n, 0);
  let r = Math.random() * total;
  for (const [k, n] of m) if ((r -= n) <= 0) return k;
  return m[0]?.[0] || 'normal';
}

export class Escape {
  declare active: boolean;
  declare phase: EscapePhase;
  declare stop: number;
  declare van: Van | null;
  declare cans: Can[];
  declare barrels: Barrel[];
  declare have: number;
  /** s en la parada, s de la fase actual y s con H mantenida */
  declare t: number;
  declare phaseT: number;
  declare holdT: number;
  declare fuelT: number;
  declare fuelMax: number;
  declare spawnAcc: number;
  /** por qué terminó: 'stop' | 'won' | 'van' | '' */
  declare result: string;
  declare goal: Goal | null;
  declare obs: object | null;
  declare mixCache: { level: number; m: [string, number][] } | null;
  /** la camioneta chocó con algo que no se rompe al salir: se queda ahí (y cuánto lleva así) */
  declare stuck: boolean;
  declare stuckT: number;
  /** el jefe que bloquea el puente (y su tipo, para el panel) */
  declare boss: Zombie | null;
  declare bossType: string;
  /** el viaje: la ruta, la parada en la que estás y las que ya pasaste (stop cuenta las paradas: 1, 2…) */
  declare route: Route | null;
  declare at: number;
  declare visited: number[];
  /** del viaje: mejoras de la camioneta (nivel por clave de VAN_UPS) y si el médico va a bordo */
  declare ups: Record<string, number>;
  declare medic: boolean;
  /** de la parada: claxon ya usado (y su onda), la torreta del techo (ángulo, recarga, fogonazo) */
  declare hornUsed: boolean;
  declare hornT: number;
  declare turretA: number;
  declare turretCd: number;
  declare turretFlash: number;
  /** el objetivo propio de la parada (o null) */
  declare obj: StopObj | null;

  constructor() {
    this.route = null;
    this.at = 0;
    this.visited = [];
    this.ups = {};
    this.medic = false;
    this.active = false;
    this.van = null;
    this.goal = null;
    this.obs = null;
    this.cans = [];
    this.barrels = [];
    this.resetState();
  }

  resetState() {
    this.phase = 'search';
    this.stop = 1;
    this.have = 0;
    this.t = 0;
    this.phaseT = 0;
    this.holdT = 0;
    this.fuelT = 0;
    this.fuelMax = ESCAPE.fuelT;
    this.spawnAcc = 0;
    this.result = '';
    this.mixCache = null;
    this.stuck = false;
    this.stuckT = 0;
    this.boss = null;
    this.bossType = '';
    this.hornUsed = false;
    this.hornT = 0;
    this.turretA = -Math.PI / 2;
    this.turretCd = 0;
    this.turretFlash = 0;
    this.obj = null;
  }

  /** La parada en la que estás (del mapa de ruta) y lo que trae su tipo. */
  get node(): RouteNode | null {
    return this.route?.nodes[this.at] ?? null;
  }
  get stopDef() {
    return ESCAPE_STOPS[this.node?.kind || 'start'] || ESCAPE_STOPS.start;
  }

  /** ¿Esta es la última parada? */
  get final() {
    return !!this.route && isFinal(this.route, this.at);
  }

  /** Paradas que tiene el viaje (de la salida al puente). */
  get total() {
    return this.route?.layers ?? ESCAPE_ROUTE.layers;
  }

  /** Bidones que hacen falta: uno más cada ESCAPE_ROUTE.needEvery paradas. */
  get need() {
    return needAt(this.stop, this.ups);
  }

  /** Amenaza al llegar: sube con cada parada recorrida y con el tipo de parada. */
  get baseLevel() {
    return ESCAPE.startLevel + Math.floor((this.stop - 1) * ESCAPE_ROUTE.levelPerStop) + (this.stopDef.level || 0);
  }

  /** El dinero de las bajas en esta parada (supermercado: el doble). */
  get payK() {
    return this.active ? this.stopDef.pay || 1 : 1;
  }

  /** Nivel de amenaza: el de llegada y sube cada ESCAPE.levelEvery s en la parada. */
  get level() {
    return this.baseLevel + Math.floor(this.t / ESCAPE.levelEvery);
  }

  /** 0..1 hacia el siguiente nivel de amenaza. */
  get levelProg() {
    return (this.t % ESCAPE.levelEvery) / ESCAPE.levelEvery;
  }

  /** Bidones de más (acortan la carga y pagan). */
  get extra() {
    return Math.max(0, Math.min(ESCAPE.extraMax, this.have - this.need));
  }

  /** ¿Sigue vivo el jefe del puente? (mientras tanto no se puede cruzar) */
  get bossAlive() {
    return !!this.boss && !this.boss.dead;
  }

  /** Deja de estar en modo Huida (al volver al menú o empezar una partida normal): también olvida el viaje. */
  clear(game: GameHost) {
    this.clearStop(game);
    this.active = false;
    this.route = null;
    this.at = 0;
    this.visited = [];
    this.ups = {};
    this.medic = false;
    this.resetState();
  }

  /** Quita lo de la parada actual (camioneta, bidones, fase) sin tocar el viaje. */
  clearStop(game: GameHost) {
    if (this.obs) game.world?.removeDynamic(this.obs as never);
    if (this.goal) this.goal.alive = false;
    this.obs = null;
    this.goal = null;
    this.van = null;
    this.cans = [];
    this.barrels = [];
    const stop = this.stop;
    this.resetState();
    this.stop = stop;
  }

  /** Empieza un viaje nuevo: una ruta con esta semilla, en la salida. */
  newTrip(seed = (Math.random() * 1e9) | 0) {
    this.route = makeRoute(seed);
    this.at = 0;
    this.visited = [0];
    this.stop = 1;
    this.ups = {};
    this.medic = false;
  }

  /** Lo que cuesta el siguiente nivel de esa mejora de la camioneta (0: ya está al máximo o no existe). */
  upCost(k: string) {
    const d = (VAN_UPS as Record<string, { price: number[] }>)[k];
    const n = this.ups[k] || 0;
    return d && n < d.price.length ? d.price[n] : 0;
  }

  /** Sube esa mejora un nivel (el dinero lo cobra quien llama). */
  buyUp(k: string) {
    if (!this.upCost(k)) return false;
    this.ups[k] = (this.ups[k] || 0) + 1;
    return true;
  }

  /** Sigue el viaje hacia la parada `id` (el juego cambia de mapa y llama a begin). */
  travel(id: number) {
    if (!this.route) return false;
    if (!this.route.nodes[this.at]?.next.includes(id)) return false;
    this.at = id;
    this.visited.push(id);
    this.stop++;
    return true;
  }

  /** Semilla del mapa de la parada `id` (la de la ruta y la parada). */
  seedFor(id = this.at) {
    return ((this.route?.seed ?? 0) + id * 7919) | 0;
  }

  /** Empieza una parada: pone la camioneta junto a los jugadores, los bidones, el botín y el reparto continuo. */
  begin(game: GameHost) {
    if (!this.route) this.newTrip();
    this.clearStop(game);
    this.active = true;
    const world = game.world;
    const all = everyone(game);
    // en el viaje se descansa: recupera parte de la vida perdida
    // (con el médico a bordo, cura todo)
    const heal = this.medic ? ESCAPE_OBJ.medic.heal : ESCAPE_ROUTE.restHeal;
    if (this.stop > 1) for (const pl of all) if (pl.alive) pl.hp += (pl.stats.maxHp - pl.hp) * heal;
    const anchor = all.find((q) => q.alive) || all[0] || world.spawn;
    const V = ESCAPE.van;
    // la camioneta en el sitio libre más cercano al punto de partida, con calle libre por delante para
    // salir (coches y árboles no cuentan: los destroza); si no hay, el primer sitio libre
    let rx = anchor.x - V.w / 2;
    let ry = anchor.y - V.h - 40;
    let first: { x: number; y: number } | null = null;
    found: for (let r = 0; r < 900; r += 20) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU;
        const x = anchor.x + Math.cos(a) * r - V.w / 2;
        const y = anchor.y + Math.sin(a) * r - V.h / 2;
        // con margen alrededor para que se pueda rodear
        if (!world.rectFree(x - 30, y - 30, V.w + 60, V.h + 60)) continue;
        first ||= { x, y };
        if (this.runwayFree(world, x, y, V.w, V.h)) {
          rx = x;
          ry = y;
          first = null;
          break found;
        }
      }
    }
    if (first) {
      rx = first.x;
      ry = first.y;
    }
    // el blindaje le da más vida
    const hp = V.hp * (1 + VAN_UPS.armor.hp * lv(this.ups, 'armor'));
    const van: Van = { x: rx, y: ry, w: V.w, h: V.h, hp, max: hp, hitT: 0, drive: 0 };
    this.van = van;
    this.restore(game);
    // los jugadores, junto a la puerta (uno al lado del otro)
    all.forEach((pl, i) => {
      pl.inVan = false;
      pl.kx = pl.ky = 0;
      pl.x = van.x + van.w / 2 + (i - (all.length - 1) / 2) * 34;
      pl.y = van.y + van.h + 26;
      if (world.pointBlocked(pl.x, pl.y, pl.r)) pl.y = van.y - 26;
    });
    const p0 = all[0];
    if (p0 && game.camera) {
      game.camera.x = p0.x;
      game.camera.y = p0.y;
    }
    if (p0) world.updateFlow(p0.x, p0.y);
    this.placeLoot(game);
    this.placeObj(game);
    // sin oleadas: el director sólo reparte lo que le toca (ver update)
    const d = game.director;
    d.state = 'escape';
    d.wave = this.level;
    d.queue.length = 0;
    // la ronda especial de la parada (niebla, apagón…): la ven la luz, la mezcla de zombis y el dinero
    const node = this.node!;
    d.event = node.mod && EVENTS.types[node.mod] ? node.mod : '';
    const ev = d.eventDef;
    game.banner(
      `Parada ${this.stop} · ${node.name}`,
      this.final
        ? `¡El puente! Junta ${cans(this.need)} y cruza`
        : ev
          ? `${ev.name}: ${ev.desc.toLowerCase()}`
          : `Junta ${cans(this.need)} de combustible y vuelve a la camioneta`,
    );
    game.sfx.wave();
  }

  /** ¿Hay ESCAPE.runway px de calle por delante (hacia +x) sin nada que la camioneta no pueda destrozar? */
  runwayFree(world: GameHost['world'], x: number, y: number, w: number, h: number) {
    for (let d = w + 10; d < w + ESCAPE.runway; d += 16) {
      for (let yy = y + 4; yy <= y + h - 4; yy += 10) {
        const o = world.pointBlocked(x + d, yy, 0) as { smash?: string } | boolean | null;
        if (o && !(typeof o === 'object' && o.smash)) return false;
      }
    }
    return true;
  }

  /** Pone la camioneta como obstáculo y como objetivo al que pueden ir los zombis. */
  restore(game: GameHost) {
    const van = this.van;
    if (!van) return;
    const world = game.world;
    const obs = { k: 0, x: van.x, y: van.y, w: van.w, h: van.h, low: true, opObs: true };
    world.addDynamic(obs as never);
    this.obs = obs;
    this.goal = makeGoal(world, { x: van.x, y: van.y, w: van.w, h: van.h }, (dmg, g) => this.hitVan(dmg, g));
  }

  /** Bidones a distancia de la camioneta (alcanzables y separados), barriles, cajas de armas y botiquines. */
  placeLoot(game: GameHost) {
    const van = this.van!;
    const world = game.world;
    const cx = van.x + van.w / 2;
    const cy = van.y + van.h / 2;
    const field = this.goal?.field;
    const spot = (min: number, max: number, taken: { x: number; y: number }[], gap: number) => {
      for (let i = 0; i < 300; i++) {
        const a = rand(0, TAU);
        const d = rand(min, max);
        const x = cx + Math.cos(a) * d;
        const y = cy + Math.sin(a) * d;
        if (world.pointBlocked(x, y, 22)) continue;
        if (field && !world.reachable(x, y, field)) continue;
        if (taken.some((o) => Math.hypot(o.x - x, o.y - y) < gap)) continue;
        return { x, y };
      }
      return null;
    };
    const [d0, d1] = ESCAPE.dist;
    const S = this.stopDef;
    for (let i = 0; i < ESCAPE.cans + (S.cans || 0) + Math.max(0, this.need - ESCAPE.need); i++) {
      // si el mapa no deja separarlos tanto, se acepta menos separación
      const s = spot(d0, d1, this.cans, ESCAPE.gap) || spot(d0 * 0.6, d1, this.cans, ESCAPE.gap * 0.4);
      if (s) this.cans.push({ x: s.x, y: s.y, taken: false, ph: rand(0, TAU) });
    }
    // los más lejanos van custodiados por un zombi con habilidad
    const far = [...this.cans].sort((a, b) => Math.hypot(b.x - cx, b.y - cy) - Math.hypot(a.x - cx, a.y - cy));
    const kinds = shuffle([...ESCAPE.guardTypes], Math.random);
    far.slice(0, ESCAPE.guards).forEach((c, i) => {
      c.guard = kinds[i % kinds.length];
    });
    const loot: { x: number; y: number }[] = [...this.cans];
    // gasolinera: barriles explosivos, unos cerca de la camioneta y otros junto a los bidones
    const B = ESCAPE.barrels;
    for (let i = 0; i < (S.barrels || 0); i++) {
      const near = i % 2 === 0;
      const c = this.cans[i % Math.max(1, this.cans.length)];
      let s: { x: number; y: number } | null = null;
      for (let k = 0; k < 60 && !s; k++) {
        const a = rand(0, TAU);
        const r = near ? rand(B.near[0], B.near[1]) : rand(60, 160);
        const x = (near || !c ? cx : c.x) + Math.cos(a) * r;
        const y = (near || !c ? cy : c.y) + Math.sin(a) * r;
        if (!world.pointBlocked(x, y, 16) && !loot.some((o) => Math.hypot(o.x - x, o.y - y) < 50)) s = { x, y };
      }
      if (!s) continue;
      loot.push(s);
      this.barrels.push({ x: s.x, y: s.y, alive: true, ph: rand(0, TAU) });
    }
    const put = (k: string, n: number) => {
      for (let i = 0; i < n; i++) {
        const s = spot(d0 * 0.5, d1, loot, 200);
        if (!s) continue;
        loot.push(s);
        game.pickups.drop(k, s.x, s.y);
        // lo de la parada no desaparece con el tiempo (el resto del botín sí)
        game.pickups.list[game.pickups.list.length - 1].t = -1e6;
      }
    };
    put('crate', ESCAPE.crates + (S.crates || 0));
    put('med', ESCAPE.meds + (S.meds || 0));
  }

  /** Un zombi le pega a la camioneta (ningún golpe le quita más de maxHit de su vida). */
  hitVan(dmg: number, game: GameHost) {
    const van = this.van;
    if (!van || van.hp <= 0 || (this.phase !== 'search' && this.phase !== 'fuel' && this.phase !== 'ready')) return;
    // con el tanque lleno el motor ya está en marcha: aguanta más (es el momento de subir)
    // (el blindaje quita una parte de cada golpe)
    const k = (this.phase === 'ready' ? ESCAPE.readyDmg : 1) * (1 - VAN_UPS.armor.cut * lv(this.ups, 'armor'));
    van.hp -= Math.min(dmg, van.max * ESCAPE.van.maxHit) * k;
    van.hitT = 0.2;
    game.particles.impact(van.x + Math.random() * van.w, van.y + Math.random() * van.h, rand(-1, 1), rand(-1, 1));
    if (Math.random() < 0.3) game.sfx.blockHit();
    if (van.hp <= 0) this.lose(game);
  }

  /** ¿Ese jugador (el de este equipo si no se dice) está junto a la camioneta? */
  nearVan(game: GameHost, pad = 48, p: Player | null = game.player) {
    const van = this.van;
    if (!van || !p) return false;
    const dx = Math.max(van.x - p.x, 0, p.x - (van.x + van.w));
    const dy = Math.max(van.y - p.y, 0, p.y - (van.y + van.h));
    return Math.hypot(dx, dy) < pad + p.r;
  }

  /** Lo que ese jugador puede hacer con H ahora (para el aviso en pantalla), o null. */
  prompt(game: GameHost, p: Player | null = game.player): { text: string; prog: number; k: string } | null {
    if (!this.active || !p?.alive || p.inVan) return null;
    if (this.phase === 'search' && this.have >= this.need && this.nearVan(game, 48, p))
      return { text: 'Cargar combustible', prog: this.holdT / ESCAPE.startT, k: 'fuel' };
    if (this.phase === 'ready' && !this.bossAlive && this.nearVan(game, ESCAPE.boardReach, p))
      return { text: 'Subir a la camioneta', prog: this.holdT / ESCAPE.boardT, k: 'board' };
    // el claxon: una vez por parada, mientras se busca o se carga (con el tanque lleno, H es subir)
    const live = this.phase === 'fuel' || (this.phase === 'search' && this.have < this.need);
    if (live && lv(this.ups, 'horn') && !this.hornUsed && this.nearVan(game, ESCAPE.boardReach, p))
      return { text: 'Tocar el claxon', prog: this.holdT / VAN_UPS.horn.hold, k: 'horn' };
    const o = this.obj;
    if (o?.kind === 'armory' && o.state === 0 && this.phase !== 'leaving' && this.phase !== 'lost')
      if (Math.hypot(o.x - p.x, o.y - p.y) < ESCAPE_OBJ.armory.reach + p.r)
        return { text: 'Abrir la armería', prog: this.holdT / ESCAPE_OBJ.armory.t, k: 'armory' };
    return null;
  }

  update(dt: number, game: GameHost) {
    if (!this.active) return;
    const van = this.van!;
    this.phaseT += dt;
    van.hitT = Math.max(0, van.hitT - dt);
    this.hornT = Math.max(0, this.hornT - dt);
    this.turretFlash = Math.max(0, this.turretFlash - dt);
    // dañada: humo del cofre y, muy dañada, fuego
    if (this.phase === 'search' || this.phase === 'fuel' || this.phase === 'ready') {
      const k = van.hp / van.max;
      const hx = van.x + van.w * 0.82;
      const hy = van.y + van.h / 2;
      if (k < 0.5 && Math.random() < dt * (k < 0.25 ? 14 : 6))
        game.particles.dust(hx + rand(-8, 8), hy + rand(-8, 8), 3);
      if (k < 0.25 && Math.random() < dt * 10) game.particles.burning(hx, hy, 12);
    }
    if (this.phase === 'leaving') return this.leave(dt, game);
    if (this.phase === 'lost') {
      if (this.phaseT >= ESCAPE.lostT) this.finish(game, 'van');
      return;
    }
    if (this.phase === 'done') return;
    this.t += dt;
    game.director.wave = this.level;
    const ps = active(game);
    // al acercarse alguien a un bidón custodiado sale su guardia
    for (const c of this.cans) {
      if (!c.guard || c.taken) continue;
      const p = ps.find((q) => Math.hypot(c.x - q.x, c.y - q.y) < ESCAPE.guardR);
      if (p) this.wakeGuard(c, p, game);
    }
    // recoger bidones al tocarlos (quien lo toca cobra el extra)
    for (const c of this.cans) {
      if (c.taken) continue;
      const p = ps.find((q) => Math.hypot(c.x - q.x, c.y - q.y) <= ESCAPE.grab + q.r);
      if (p) this.takeCan(c, p, game);
    }
    this.updateBarrels(game);
    // H mantenida en la camioneta (por cualquiera): empezar a cargar o subir
    // (y en la comisaría, la armería; con el claxon comprado, tocarlo)
    let held = '';
    let holder: Player | undefined;
    for (const q of ps) {
      const pr = q.use ? this.prompt(game, q) : null;
      if (!pr) continue;
      held = pr.k;
      holder = q;
      break;
    }
    if (holder) this.holdT += dt;
    else this.holdT = 0;
    if (held === 'fuel' && this.holdT >= ESCAPE.startT) this.startFuel(game);
    else if (held === 'board' && this.holdT >= ESCAPE.boardT) this.board(game);
    else if (held === 'horn' && this.holdT >= VAN_UPS.horn.hold) this.honk(game);
    else if (held === 'armory' && this.holdT >= ESCAPE_OBJ.armory.t) this.openArmory(holder!, game);
    this.updateObj(dt, ps, game);
    this.updateVanUps(dt, game);
    if (this.phase === 'fuel') {
      this.fuelT += dt;
      if (this.fuelT >= this.fuelMax) {
        this.phase = 'ready';
        this.phaseT = 0;
        this.holdT = 0;
        if (this.bossAlive) game.banner('¡Tanque lleno!', `Derrota a ${this.bossName()} para cruzar el puente`);
        else game.banner('¡Tanque lleno!', 'Sube a la camioneta para escapar');
        game.sfx.opDone();
      }
    }
    this.spawn(dt, game);
    game.director.herdStragglers(dt, game);
  }

  /* ---------- mejoras de la camioneta ---------- */

  /** La torreta del techo (cargando y con el tanque lleno) y los faros que deslumbran. */
  updateVanUps(dt: number, game: GameHost) {
    const van = this.van!;
    const cx = van.x + van.w / 2;
    const cy = van.y + van.h / 2;
    const L = lv(this.ups, 'lights');
    if (L) {
      const R = at(VAN_UPS.lights.r, L);
      const k = at(VAN_UPS.lights.slow, L);
      game.horde.grid.query(cx - R, cy - R, cx + R, cy + R, near);
      for (const z of near) {
        if (z.dead || z.def?.boss || (z.x - cx) ** 2 + (z.y - cy) ** 2 > R * R) continue;
        z.dazzleT = 0.25;
        z.dazzleK = k;
      }
    }
    const T = lv(this.ups, 'turret');
    if (!T || (this.phase !== 'fuel' && this.phase !== 'ready')) return;
    this.turretCd -= dt;
    const R = at(VAN_UPS.turret.range, T);
    // la torreta está en el techo, un poco atrás del centro
    const tx = van.x + van.w * 0.46;
    game.horde.grid.query(tx - R, cy - R, tx + R, cy + R, near);
    let best: Zombie | null = null;
    let bd = R * R;
    for (const z of near) {
      if (z.dead || z.under) continue;
      const d = (z.x - tx) ** 2 + (z.y - cy) ** 2;
      if (d < bd) {
        bd = d;
        best = z;
      }
    }
    if (!best) return;
    const want = Math.atan2(best.y - cy, best.x - tx);
    const diff = Math.atan2(Math.sin(want - this.turretA), Math.cos(want - this.turretA));
    this.turretA += Math.max(-dt * 8, Math.min(dt * 8, diff));
    if (this.turretCd > 0 || Math.abs(diff) > 0.3) return;
    this.turretCd = at(VAN_UPS.turret.cd, T);
    this.turretFlash = 0.06;
    const a = this.turretA + rand(-0.05, 0.05);
    const mx = tx + Math.cos(a) * 18;
    const my = cy + Math.sin(a) * 18;
    const b = turretBullet(mx, my, a, null);
    b.dmg = at(VAN_UPS.turret.dmg, T);
    b.life = R + 40;
    game.bullets.spawn(b);
    // en línea: el servidor avisa del disparo y cada cliente lanza su bala de adorno
    game.onTurretShot?.(mx, my, a);
    game.particles.muzzleSmoke(mx, my, a);
    game.sfx.turret();
  }

  /** El claxon: aturde y avienta a los zombis de alrededor (a los jefes sólo los aturde un poco). */
  honk(game: GameHost) {
    const van = this.van!;
    const n = lv(this.ups, 'horn');
    const R = at(VAN_UPS.horn.r, n);
    const stun = at(VAN_UPS.horn.stun, n);
    const cx = van.x + van.w / 2;
    const cy = van.y + van.h / 2;
    this.hornUsed = true;
    this.hornT = 0.8;
    this.holdT = 0;
    game.horde.grid.query(cx - R, cy - R, cx + R, cy + R, near);
    for (const z of near) {
      if (z.dead) continue;
      const dx = z.x - cx;
      const dy = z.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      if (d > R) continue;
      z.stumbleT = Math.max(z.stumbleT || 0, stun * (z.def?.boss ? 0.4 : 1));
      if (z.def?.boss) continue;
      const k = VAN_UPS.horn.push * (1 - (d / R) * 0.5);
      z.kx += (dx / d) * k;
      z.ky += (dy / d) * k;
      z.lunge = 0;
    }
    game.sfx.horn?.();
    game.camera?.shake?.(0.25, cx, cy);
    game.toast('¡Claxonazo!');
  }

  /* ---------- objetivo de la parada ---------- */

  /** Pone el objetivo de este tipo de parada (lejos de la camioneta, en un sitio al que se puede llegar). */
  placeObj(game: GameHost) {
    const kind = this.stopDef.obj;
    if (!kind) return;
    const van = this.van!;
    const world = game.world;
    const cx = van.x + van.w / 2;
    const cy = van.y + van.h / 2;
    const field = this.goal?.field;
    const avoid: { x: number; y: number }[] = [...this.cans, ...this.barrels];
    const spot = (d: number[], r: number, gap: number, taken: { x: number; y: number }[]) => {
      for (let i = 0; i < 400; i++) {
        const a = rand(0, TAU);
        const dd = rand(d[0], d[1]) * (i > 250 ? 0.6 : 1);
        const x = cx + Math.cos(a) * dd;
        const y = cy + Math.sin(a) * dd;
        if (world.pointBlocked(x, y, r)) continue;
        if (field && !world.reachable(x, y, field)) continue;
        if (i < 300 && [...avoid, ...taken].some((o) => Math.hypot(o.x - x, o.y - y) < gap)) continue;
        return { x, y };
      }
      return null;
    };
    const O = ESCAPE_OBJ;
    const d = (O as unknown as Record<string, { dist: number[] }>)[kind].dist;
    const base = spot(d, kind === 'pump' ? O.pump.r * 0.6 : 22, 120, []);
    if (!base) return;
    const o: StopObj = { kind, x: base.x, y: base.y, prog: 0, state: 0, hp: 0, n: 0, items: [], ang: 0, hitT: 0 };
    if (kind === 'medic') o.hp = O.medic.hp;
    if (kind === 'cart')
      for (let i = 0; i < O.cart.n; i++) {
        const s = i === 0 ? base : spot(d, 16, O.cart.gap, o.items);
        if (s) o.items.push({ x: s.x, y: s.y, taken: false });
      }
    this.obj = o;
  }

  /** La bomba llena bidones, el médico sigue al más cercano y sufre, las provisiones se juntan. */
  updateObj(dt: number, ps: Player[], game: GameHost) {
    const o = this.obj;
    if (!o) return;
    o.hitT = Math.max(0, o.hitT - dt);
    if (o.kind === 'pump') {
      const P = ESCAPE_OBJ.pump;
      if (o.state !== 0) return;
      const p = ps.find((q) => Math.hypot(q.x - o.x, q.y - o.y) < P.r);
      if (!p) return;
      o.prog += dt / P.t;
      if (o.prog < 1) return;
      o.prog = 0;
      o.n++;
      this.gainCan(o.x, o.y, p, game);
      if (o.n >= P.max) {
        o.state = 2;
        game.toast('La bomba se quedó seca');
      }
    } else if (o.kind === 'medic') this.updateMedic(dt, ps, game);
    else if (o.kind === 'cart') {
      const C = ESCAPE_OBJ.cart;
      for (const it of o.items) {
        if (it.taken) continue;
        const p = ps.find((q) => Math.hypot(it.x - q.x, it.y - q.y) <= C.grab + q.r);
        if (!p) continue;
        it.taken = true;
        o.n++;
        game.particles.pickupFx(it.x, it.y, '#86c08e');
        game.sfx.pickup();
        const left = o.items.filter((x) => !x.taken).length;
        game.toast(left ? `Provisiones ${o.n} de ${o.items.length}` : '¡Carrito lleno! Se venden al salir');
      }
    }
  }

  /** El médico: espera, sigue al jugador más cercano esquivando paredes y sube al llegar a la camioneta. */
  updateMedic(dt: number, ps: Player[], game: GameHost) {
    const o = this.obj!;
    const M = ESCAPE_OBJ.medic;
    if (o.state >= 2) return;
    let p: Player | null = null;
    let pd = Infinity;
    for (const q of ps) {
      const d = Math.hypot(q.x - o.x, q.y - o.y);
      if (d < pd) {
        pd = d;
        p = q;
      }
    }
    if (o.state === 0) {
      if (!p || pd > M.touch + p.r) return;
      o.state = 1;
      game.toast('¡El médico te sigue! Llévalo a la camioneta');
      game.sfx.radio();
    }
    // los zombis que lo tocan le pegan
    game.horde.grid.query(o.x - 40, o.y - 40, o.x + 40, o.y + 40, near);
    for (const z of near) {
      if (z.dead || z.air > 0 || Math.hypot(z.x - o.x, z.y - o.y) > z.r + 14) continue;
      o.hp -= M.dps * dt;
      o.hitT = 0.15;
      if (Math.random() < dt * 6) game.particles.blood?.(o.x, o.y, rand(-1, 1), rand(-1, 1), 3);
    }
    if (o.hp <= 0) {
      o.state = 3;
      game.particles.blood?.(o.x, o.y, 0, 0, 14);
      game.toast('El médico murió');
      game.sfx.opAlert();
      return;
    }
    // sigue al más cercano (sin pegarse: se queda a near px); ya cerca de la camioneta, va directo a ella
    const van = this.van!;
    const qx = Math.max(van.x, Math.min(o.x, van.x + van.w));
    const qy = Math.max(van.y, Math.min(o.y, van.y + van.h));
    const vd = Math.hypot(qx - o.x, qy - o.y);
    const home = vd < 150;
    const gx = home ? qx : p?.x;
    const gy = home ? qy : p?.y;
    const gd = home ? vd : pd;
    const gap = home ? 0 : M.near;
    if (p && gx !== undefined && gy !== undefined && gd > gap) {
      const a = Math.atan2(gy - o.y, gx - o.x);
      o.ang = a;
      const step = Math.min(gd - gap, M.speed * (pd > 260 ? 1.25 : 1) * dt);
      const nx = o.x + Math.cos(a) * step;
      const ny = o.y + Math.sin(a) * step;
      const w = game.world;
      // si choca con algo, se desliza por el otro eje
      if (!w.pointBlocked(nx, ny, 10)) {
        o.x = nx;
        o.y = ny;
      } else if (!w.pointBlocked(nx, o.y, 10)) o.x = nx;
      else if (!w.pointBlocked(o.x, ny, 10)) o.y = ny;
      // muy lejos (se atoró): corre hasta tu lado, para no quedarse atrás para siempre
      if (pd > 600) {
        const b = Math.atan2(p.y - o.y, p.x - o.x);
        o.x = p.x - Math.cos(b) * M.near;
        o.y = p.y - Math.sin(b) * M.near;
      }
    }
    // en la camioneta: sube y se queda todo el viaje
    const dx = Math.max(van.x - o.x, 0, o.x - (van.x + van.w));
    const dy = Math.max(van.y - o.y, 0, o.y - (van.y + van.h));
    if (Math.hypot(dx, dy) < 30) {
      o.state = 2;
      if (this.medic) {
        // ya traían uno: éste cura a todos y paga
        for (const q of everyone(game)) if (q.alive) q.hp = q.stats.maxHp;
        for (const q of everyone(game)) pay(game, M.pay, q);
        game.toast('Otro médico a bordo: los cura a todos');
      } else {
        this.medic = true;
        game.toast('¡Médico a bordo! Los curará entre paradas');
      }
      game.particles.pickupFx(o.x, o.y, '#e05a5a');
      game.sfx.opDone();
    }
  }

  /** La armería: el arma más cara que no tenga quien la abre (hasta el tope de la parada), y munición. */
  openArmory(p: Player, game: GameHost) {
    const o = this.obj!;
    const A = ESCAPE_OBJ.armory;
    o.state = 2;
    this.holdT = 0;
    const cap = A.cap[0] + A.cap[1] * this.stop;
    const W = WEAPONS as unknown as Record<string, { name: string; price: number }>;
    let best = '';
    for (const id of A.guns)
      if (W[id] && p.canBuy(id) && W[id].price <= cap && (!best || W[id].price > W[best].price)) best = id;
    if (best) {
      p.buy(best);
      const i = p.weapons.findIndex((w) => w.id === best);
      if (i >= 0) p.select(i);
      if (game.escapeGun) game.escapeGun(W[best].name, p);
      else game.toast(`Armería abierta: ${W[best].name}`);
    } else {
      pay(game, A.cash, p);
      game.toast(`Armería abierta: ya tenías todo, +$${A.cash}`);
    }
    game.pickups.drop('ammo', o.x + 20, o.y + 10);
    game.pickups.drop('ammo', o.x - 20, o.y + 10);
    game.sfx.opDone();
    game.updateHud?.(true);
  }

  /** Un jugador recoge un bidón. */
  takeCan(c: Can, p: Player, game: GameHost) {
    c.taken = true;
    this.gainCan(c.x, c.y, p, game);
  }

  /** Un bidón más (recogido del suelo o de la bomba de la gasolinera). */
  gainCan(x: number, y: number, p: Player | null, game: GameHost) {
    this.have++;
    game.particles.pickupFx(x, y, '#f0b030');
    game.sfx.pickup();
    if (this.have === this.need) {
      game.toast('¡Ya tienen el combustible! Vuelvan a la camioneta');
      game.sfx.radio();
    } else if (this.have > this.need) {
      pay(game, ESCAPE.extraPay, p);
      game.toast(`Bidón extra (${this.have}): carga más rápida y una mejora rara`);
      // una mejora rara a elegir (ui/levelup.js: "Bidón extra")
      pick(game, 'fuel', p);
    } else game.toast(`Bidón ${this.have} de ${this.need}`);
  }

  /** Barriles: estallan con una bala que pasa cerca o con una explosión al lado (y en cadena). */
  updateBarrels(game: GameHost) {
    if (!this.barrels.length) return;
    const B = ESCAPE.barrels;
    for (const b of this.barrels) {
      if (!b.alive) continue;
      let owner: string | null | undefined;
      for (const bl of game.bullets.list) {
        if (bl.fake || bl.dead) continue;
        if (Math.hypot(bl.x - b.x, bl.y - b.y) < B.hitR) {
          owner = bl.owner ?? null;
          bl.life = 0;
          break;
        }
      }
      if (owner === undefined) {
        const bs = game.structures.blasts.find((x) => x.t > 0.3 && Math.hypot(x.x - b.x, x.y - b.y) < B.chainR);
        if (bs) owner = null;
      }
      if (owner === undefined) continue;
      b.alive = false;
      const k = game.director?.hpMult ?? 1;
      game.structures.explode(game, { x: b.x, y: b.y, owner }, B.radius, B.power * k, 1);
      game.structures.ignite(game, b.x, b.y, owner);
    }
  }

  /** Reparto continuo: más zombis y más duros cuanto más tiempo llevas; durante la carga, muchos más. */
  spawn(dt: number, game: GameHost) {
    const L = this.level;
    // la carga atrae a la horda; con el tanque lleno vuelve el ritmo normal
    const hot = this.phase === 'fuel';
    const S = this.stopDef;
    const crowd = 1 + ESCAPE.perPlayer * Math.max(0, everyone(game).length - 1);
    const rate = (ESCAPE.rate[0] + ESCAPE.rate[1] * L) * (hot ? ESCAPE.fuelRate : 1) * (S.rate || 1) * crowd;
    const cap = (ESCAPE.alive[0] + ESCAPE.alive[1] * L) * (hot ? 1.3 : 1);
    this.spawnAcc += rate * dt;
    if (this.spawnAcc < 1) return;
    const n = Math.floor(this.spawnAcc);
    this.spawnAcc -= n;
    const room = Math.floor(cap - game.horde.list.length);
    if (room <= 0) return;
    if (!this.mixCache || this.mixCache.level !== L) {
      // comisaría: más policías con escudo (como el asedio)
      const ev = game.director.eventDef;
      const evx = S.swat ? ({ ...(ev || {}), swat: Math.max(S.swat, ev?.swat ?? 0) } as EventDef) : ev;
      this.mixCache = { level: L, m: mix(L, evx) };
    }
    const d = game.director;
    d.queue.length = 0;
    for (let i = 0; i < Math.min(n, room); i++) d.queue.push(pickType(this.mixCache.m));
    const before = game.horde.list.length;
    d.spawnGroup(game, d.queue.length);
    d.queue.length = 0;
    // durante la carga, parte de los que llegan va directo por la camioneta
    if (hot) for (let i = before; i < game.horde.list.length; i++) this.aimAtVan(game.horde.list[i]);
  }

  /** El guardia de un bidón: su zombi con habilidad y unos normales, alrededor del bidón (fuera de la vista). */
  wakeGuard(c: Can, p: Player, game: GameHost) {
    const type = c.guard!;
    c.guard = '';
    const d = game.director;
    const views = d.views(game);
    const pack = [type, ...Array(ESCAPE.guardPack).fill('normal')];
    let n = 0;
    for (let i = 0; i < 40 && n < pack.length; i++) {
      // del otro lado del bidón, mirando desde el jugador (así salen fuera de la pantalla)
      const a = Math.atan2(c.y - p.y, c.x - p.x) + rand(-1.1, 1.1);
      const r = rand(80, 240);
      const x = c.x + Math.cos(a) * r;
      const y = c.y + Math.sin(a) * r;
      if (game.world.pointBlocked(x, y, 24) || (i < 30 && d.seen(views, x, y, 20))) continue;
      game.horde.spawn(pack[n], x, y, d.hpMult, d.speedMult).spawnT = 0.5;
      n++;
    }
    game.toast(`¡${GUARD_NAMES[type] || 'Algo'} custodia este bidón!`);
    game.sfx.opAlert();
  }

  aimAtVan(z: Zombie) {
    if (this.goal?.alive && GOAL_TYPES.has(z.type) && Math.random() < ESCAPE.goalShare) z.goal = this.goal;
  }

  startFuel(game: GameHost) {
    this.phase = 'fuel';
    this.phaseT = 0;
    this.holdT = 0;
    this.fuelT = 0;
    this.fuelMax = ESCAPE.fuelT * (1 - ESCAPE.extraK * this.extra);
    // los que ya rondan también se lanzan por ella
    for (const z of game.horde.list) if (!z.dead) this.aimAtVan(z);
    if (this.final) this.spawnBridgeBoss(game);
    else game.banner('¡Cargando combustible!', `Defiende la camioneta ${Math.round(this.fuelMax)} s`);
    game.sfx.opAlert();
    game.camera?.shake?.(0.2);
  }

  /** Nombre del jefe del puente. */
  bossName() {
    return (BOSSES as Record<string, { name: string }>)[this.bossType]?.name || 'el jefe';
  }

  /** En el puente, al empezar la carga llega un jefe que lo bloquea (con menos vida que en las oleadas). */
  spawnBridgeBoss(game: GameHost) {
    const B = ESCAPE.boss;
    const type = B.pool[Math.floor(Math.random() * B.pool.length)];
    const d = game.director;
    const views = d.views(game);
    const van = this.van!;
    let x = van.x + van.w / 2 + 600;
    let y = van.y;
    for (let i = 0; i < 60; i++) {
      const c = d.edgePoint(game, rand(160, 260), views, i < 40);
      if (game.world.pointBlocked(c.x, c.y, 60) || !d.canReach(game, c.x, c.y)) continue;
      x = c.x;
      y = c.y;
      break;
    }
    const z = spawnBoss(game, type, x, y);
    z.hp *= B.hp;
    z.maxHp *= B.hp;
    if (z.partHp) {
      z.partHp *= B.hp;
      z.partMax *= B.hp;
    }
    this.boss = z;
    this.bossType = type;
    game.banner(`¡${this.bossName()} bloquea el puente!`, `Defiende la camioneta y derrótalo para cruzar`);
    game.sfx.bossQuake?.();
  }

  /** Suben a la camioneta: los que están vivos quedan dentro (sin recibir golpes) y arranca. */
  board(game: GameHost) {
    this.phase = 'leaving';
    this.phaseT = 0;
    for (const p of active(game)) {
      p.inVan = true;
      p.kx = p.ky = 0;
    }
    if (this.goal) this.goal.alive = false;
    if (this.obs) game.world.removeDynamic(this.obs as never);
    this.obs = null;
    game.sfx.boost();
    game.banner('¡Arranca!', this.final ? 'Cruzan el puente: la ciudad queda atrás' : 'Rumbo a la siguiente parada');
  }

  /** La salida: la camioneta acelera por su eje largo y atropella lo que encuentra. */
  leave(dt: number, game: GameHost) {
    const van = this.van!;
    const k = this.phaseT;
    // destroza los coches y árboles que tenga delante (como el rocoso); contra un edificio se detiene
    let step = this.stuck ? 0 : Math.min(600, 60 + k * 320) * dt;
    if (step > 0) {
      const fx = van.x + van.w + step + 3;
      for (let y = van.y + 4; y <= van.y + van.h - 4; y += 9) {
        const o = game.world.pointBlocked(fx, y, 0) as
          | { smash?: string; k?: number; x: number; y: number; w?: number; h?: number }
          | null
          | boolean;
        if (!o) continue;
        if (typeof o === 'object' && o.smash && game.world.smash(o as never)) {
          const cx = o.k === 0 ? o.x + (o.w || 0) / 2 : o.x;
          const cy = o.k === 0 ? o.y + (o.h || 0) / 2 : o.y;
          game.particles.debris(cx, cy, o.smash === 'car' ? 40 : 24, o.smash);
          game.camera?.shake?.(0.45, cx, cy);
          game.sfx.bullSlam(true);
          continue;
        }
        this.stuck = true;
        step = 0;
        game.camera?.shake?.(0.6, fx, y);
        game.sfx.bullSlam(true);
        break;
      }
    }
    van.drive += step;
    van.x += step;
    for (const p of everyone(game)) {
      if (!p.inVan) continue;
      p.x = van.x + van.w / 2;
      p.y = van.y + van.h / 2;
    }
    if (Math.random() < dt * 30) game.particles.dust(van.x - 6, van.y + van.h * rand(0.2, 0.8), 6);
    for (const z of game.horde.list) {
      if (z.dead || z.under || z.def?.boss) continue;
      if (z.x > van.x - z.r && z.x < van.x + van.w + z.r && z.y > van.y - z.r && z.y < van.y + van.h + z.r) {
        z.lastDx = 3;
        z.lastDy = rand(-1, 1);
        game.killZombie(z);
      }
    }
    // atorada contra algo que no se rompe: no hace esperar toda la salida
    if (this.stuck) this.stuckT += dt;
    if (k >= ESCAPE.leaveT || this.stuckT > 0.7) {
      // el premio de la parada, para cada uno; en la última, escaparon
      if (!this.final) for (const p of everyone(game)) pay(game, ESCAPE_ROUTE.stopPay * this.stop, p);
      // supermercado: las provisiones del carrito se venden (cada uno cobra lo de todas)
      const o = this.obj;
      if (o?.kind === 'cart' && o.n > 0) {
        const n = o.n * ESCAPE_OBJ.cart.pay * this.stop;
        for (const p of everyone(game)) pay(game, n, p);
        game.toast(`Vendieron ${o.n} provisiones: +$${n}`);
        o.n = 0;
      }
      this.finish(game, this.final ? 'won' : 'stop');
    }
  }

  /** La camioneta explota: se acaba la huida. */
  lose(game: GameHost) {
    const van = this.van!;
    this.phase = 'lost';
    this.phaseT = 0;
    if (this.goal) this.goal.alive = false;
    game.structures.explode(game, { x: van.x + van.w / 2, y: van.y + van.h / 2, owner: null }, 170, 500, 1);
    game.banner('¡La camioneta explotó!', 'Sin camioneta no hay huida');
  }

  /** Fin de la parada ('stop': sigue el viaje) o de la huida ('won': escaparon · 'van': explotó la camioneta). */
  finish(game: GameHost, result: string) {
    this.result = result;
    this.phase = 'done';
    game.onEscapeEnd?.(result);
  }
}

/* ---------- en la foto del servidor ---------- */

/**
 * El estado de la Huida como números: ruta (semilla, parada, recorridas), fase, cómo terminó, bidones,
 * amenaza, camioneta, carga, H, jefe, bidones del mapa y barriles. Lo arma el servidor y lo aplica el
 * cliente con unpackEscape (que deja la Huida lista para dibujarse, sin simularla).
 */
export function packEscape(e: Escape, bossType = -1): number[] {
  const v = e.van;
  const out = [
    e.route?.seed ?? 0,
    e.at,
    e.stop,
    PHASES.indexOf(e.phase),
    RESULTS.indexOf(e.result),
    e.have,
    Math.round(e.t * 10),
    v ? Math.round(v.x) : 0,
    v ? Math.round(v.y) : 0,
    v ? Math.ceil(v.hp) : 0,
    v ? v.max : 1,
    v && v.hitT > 0 ? 1 : 0,
    Math.round(e.fuelT * 10),
    Math.round(e.fuelMax * 10),
    Math.round(Math.min(1, e.holdT) * 100),
    bossType,
    e.boss && !e.boss.dead ? e.boss.id : -1,
    e.visited.length,
    ...e.visited,
    e.cans.length,
  ];
  for (const c of e.cans) out.push(Math.round(c.x), Math.round(c.y), c.taken ? 1 : 0);
  out.push(e.barrels.length);
  for (const b of e.barrels) out.push(Math.round(b.x), Math.round(b.y), b.alive ? 1 : 0);
  // mejoras de la camioneta, claxon, torreta y médico a bordo
  for (const k of VAN_UP_ORDER) out.push(e.ups[k] || 0);
  out.push(e.hornUsed ? 1 : 0, Math.round(e.hornT * 10), Math.round(e.turretA * 100), e.turretFlash > 0 ? 1 : 0);
  out.push(e.medic ? 1 : 0);
  // el objetivo de la parada
  const o = e.obj;
  if (!o) out.push(-1);
  else {
    out.push(ESCAPE_OBJ_KINDS.indexOf(o.kind), Math.round(o.x), Math.round(o.y), Math.round(o.prog * 100));
    out.push(o.state, Math.ceil(o.hp), o.n, Math.round(o.ang * 100), o.hitT > 0 ? 1 : 0, o.items.length);
    for (const it of o.items) out.push(Math.round(it.x), Math.round(it.y), it.taken ? 1 : 0);
  }
  return out;
}

/** Aplica en el cliente lo que mandó el servidor (ver packEscape). Devuelve la semilla del mapa de la parada. */
export function unpackEscape(e: Escape, a: number[], bossTypes: string[] = []) {
  let i = 0;
  const seed = a[i++];
  if (!e.route || e.route.seed !== seed) e.route = makeRoute(seed);
  e.at = a[i++];
  e.stop = a[i++];
  e.phase = PHASES[a[i++]] || 'search';
  e.result = RESULTS[a[i++]] || '';
  e.have = a[i++];
  e.t = a[i++] / 10;
  const vx = a[i++];
  const vy = a[i++];
  const hp = a[i++];
  const max = a[i++];
  const hit = a[i++];
  const V = ESCAPE.van;
  if (!e.van) e.van = { x: vx, y: vy, w: V.w, h: V.h, hp, max, hitT: 0, drive: 0 };
  const van = e.van;
  van.x = vx;
  van.y = vy;
  van.hp = hp;
  van.max = max;
  if (hit) van.hitT = 0.2;
  e.fuelT = a[i++] / 10;
  e.fuelMax = a[i++] / 10 || ESCAPE.fuelT;
  e.holdT = a[i++] / 100;
  const bt = a[i++];
  e.bossType = bt >= 0 ? bossTypes[bt] || '' : '';
  const bossId = a[i++];
  // el jefe vivo (el cliente sólo necesita saber si sigue: para el aviso de subir)
  e.boss = bossId >= 0 ? ({ id: bossId, dead: false } as Zombie) : null;
  const nv = a[i++];
  e.visited = a.slice(i, i + nv);
  i += nv;
  const nc = a[i++];
  const cans: Can[] = [];
  for (let k = 0; k < nc; k++, i += 3) cans.push({ x: a[i], y: a[i + 1], taken: !!a[i + 2], ph: (k * 1.7) % TAU });
  e.cans = cans;
  const nb = a[i++];
  const barrels: Barrel[] = [];
  for (let k = 0; k < nb; k++, i += 3) barrels.push({ x: a[i], y: a[i + 1], alive: !!a[i + 2], ph: k * 1.3 });
  e.barrels = barrels;
  for (const k of VAN_UP_ORDER) e.ups[k] = a[i++] || 0;
  e.hornUsed = !!a[i++];
  e.hornT = (a[i++] || 0) / 10;
  e.turretA = (a[i++] || 0) / 100;
  e.turretFlash = a[i++] ? 0.06 : 0;
  e.medic = !!a[i++];
  const ok = a[i++] ?? -1;
  if (ok < 0) e.obj = null;
  else {
    const o = (e.obj || { items: [] }) as StopObj;
    o.kind = ESCAPE_OBJ_KINDS[ok];
    o.x = a[i++];
    o.y = a[i++];
    o.prog = a[i++] / 100;
    o.state = a[i++];
    o.hp = a[i++];
    o.n = a[i++];
    o.ang = a[i++] / 100;
    o.hitT = a[i++] ? 0.15 : 0;
    const ni = a[i++];
    o.items = [];
    for (let k = 0; k < ni; k++, i += 3) o.items.push({ x: a[i], y: a[i + 1], taken: !!a[i + 2] });
    e.obj = o;
  }
  e.active = true;
  return e.seedFor();
}
