// Piezas comunes de las operaciones de alto riesgo (sim/ops.ts): tipos, rutas por el mapa, puntos que se
// usan manteniendo H, refuerzos con presupuesto y objetivos que los zombis atacan. Cada operación
// (convoy.ts, nest.ts, supply.ts) usa esto y sólo escribe su propia lógica.
import { MAX_ALIVE, NAV_CELL, OPS, ROBOT, WORLD_SIZE } from '../../core/config.ts';
import { rand, TAU } from '../../core/util.ts';
import type { GameHost, Vec } from '../../core/types.d.ts';
import type { FlowField, World } from '../world.ts';

export type OpKind = 'convoy' | 'nest' | 'supply';
export const OP_ORDER: OpKind[] = ['convoy', 'nest', 'supply'];

/** Quien juega la operación: en solitario el jugador; en línea cada lugar de la sala. */
export interface Who {
  id: string;
  idx: number;
  name: string;
  p: any;
  robot: any;
  away: boolean;
}

/** Un punto que se usa manteniendo H (componente, carga, caja, cargamento). */
export interface Spot {
  id: number;
  x: number;
  y: number;
  /** segundos de H */
  t: number;
  /** qué dice el botón (OP_LABELS) */
  lb: string;
  done: boolean;
  /** 0..1 */
  prog: number;
  /** quién lo está usando ahora */
  by: string | null;
  /** su vida al empezar (si baja, se corta: nido) */
  hp0: number;
}

/** Objetivo al que van algunos zombis en lugar de a un jugador (el camión, un señuelo). */
export interface Goal {
  isGoal: true;
  x: number;
  y: number;
  r: number;
  mass: number;
  kx: number;
  ky: number;
  alive: boolean;
  /** es un señuelo (sim/plans.ts): no lo quita el final de una operación */
  decoy?: boolean;
  field: FlowField;
  rect: { x: number; y: number; w: number; h: number };
  hurt(dmg: number, game: GameHost): void;
  /** pone x, y en el punto del objetivo más cercano a (zx, zy): ahí le pega el zombi */
  aim(zx: number, zy: number): void;
}

/** Una operación en curso. `d` es lo propio de cada tipo. */
export interface Op {
  id: number;
  kind: OpKind;
  /** oleada tras la que se aceptó */
  wave: number;
  x: number;
  y: number;
  home: Vec;
  state: 'prep' | 'active' | 'resolve';
  /** segundos desde el primer uso del objetivo */
  t: number;
  guards: boolean;
  /** zombis que le quedan, cuántos había y su ritmo acumulado */
  budget: number;
  total: number;
  acc: number;
  /** tipos de la siguiente oleada con su peso */
  mix: [string, number][];
  hpK: number;
  spK: number;
  /** entradas por donde llegan los refuerzos (por rutas reales) y cuáles están abiertas */
  entries: Vec[];
  open: number[];
  d: any;
  result: '' | 'win' | 'fail' | 'retreat';
  outT: number;
  cleaned: boolean;
  paid: boolean;
  reward: number;
  /** plano que ganó al completarla ('' si ya lo tenía) */
  plan: string;
  /** último mensaje de radio: número y texto */
  radio: [number, string];
  /** quién pidió la retirada (en grupo hace falta la mayoría) */
  ret: string[];
}

/** Lo que tiene cada tipo de operación. */
export interface OpDef {
  /** Elige el lugar y arma sus datos alrededor de home, o null si no cabe en ninguna parte. */
  setup(game: GameHost, home: Vec, avoid: Vec[]): { x: number; y: number; d: any; entries: Vec[] } | null;
  /** Puntos que se pueden usar ahora. */
  spots(op: Op): Spot[];
  /** Alguien terminó de usar el punto s. */
  use(ctx: OpCtx, s: Spot, who: Who): void;
  /** Un paso de su lógica (victoria, fallo, fases). */
  update(ctx: OpCtx, dt: number): void;
  /** Ritmo de refuerzos ahora (1 = normal; 0 = ninguno). */
  activity(op: Op): number;
  /** Lo que su dibujo y su HUD necesitan (va en la foto). */
  view(op: Op): Record<string, unknown>;
  /** Al terminar: quita lo suyo del mapa. */
  clear?(ctx: OpCtx): void;
  /** Al cargar una partida guardada: vuelve a poner lo suyo en el mapa. */
  restore?(ctx: OpCtx): void;
}

/** Lo que una operación puede pedir mientras corre (lo da Ops). */
export interface OpCtx {
  game: GameHost;
  op: Op;
  who: Who[];
  say(text: string): void;
  win(): void;
  fail(why: string): void;
  spawn(type: string, x: number, y: number, goal?: Goal | null, guard?: boolean): any;
  /** Un grupito de n zombis de la mezcla de la oleada alrededor de at (guard: son guardias). */
  group(n: number, at: Vec, goal?: Goal | null, guard?: boolean): number;
}

/** Lo que pone el botón contextual en cada punto. */
export const OP_LABELS: Record<string, string> = {
  engine: 'Conectar el motor',
  power: 'Conectar la batería',
  loot: 'Sacar el contenido',
  charge: 'Colocar la carga',
  crate: 'Recoger el cargamento',
  drop: 'Soltar el cargamento',
  decoy: 'Activar el señuelo',
  repair: 'Usar el reparador',
};

/* ---------- mapa y rutas ---------- */

export function newField(world: World): FlowField {
  const n = world.navN;
  return { dist: new Uint16Array(n * n).fill(65535), cell: -1, ok: false };
}

/** Centro de la celda c. */
export function cellAt(world: World, c: number): Vec {
  const n = world.navN;
  return { x: (c % n) * NAV_CELL + NAV_CELL / 2, y: ((c / n) | 0) * NAV_CELL + NAV_CELL / 2 };
}

/** Distancia por ruta (px) desde el origen del campo hasta (x, y), o Infinity. */
export function routeDist(world: World, field: FlowField, x: number, y: number) {
  const n = world.navN;
  const i = Math.max(0, Math.min(n - 1, Math.floor(x / NAV_CELL)));
  const j = Math.max(0, Math.min(n - 1, Math.floor(y / NAV_CELL)));
  const d = field.dist[j * n + i];
  return field.ok && d < 65535 ? d * NAV_CELL : Number.POSITIVE_INFINITY;
}

/** Celdas a una distancia por ruta entre d0 y d1 px del origen del campo, en orden al azar. */
export function ringCells(world: World, field: FlowField, d0: number, d1: number) {
  const out: number[] = [];
  const a = d0 / NAV_CELL;
  const b = d1 / NAV_CELL;
  const dist = field.dist;
  for (let c = 0; c < dist.length; c++) if (dist[c] >= a && dist[c] <= b && dist[c] < 65535) out.push(c);
  for (let i = out.length - 1; i > 0; i--) {
    const k = (Math.random() * (i + 1)) | 0;
    [out[i], out[k]] = [out[k], out[i]];
  }
  return out;
}

/** ¿Hay un círculo libre de radio r en (x, y), dentro del mapa? */
export function clearAt(world: World, x: number, y: number, r: number) {
  if (x < r + 60 || y < r + 60 || x > WORLD_SIZE - r - 60 || y > WORLD_SIZE - r - 60) return false;
  return !world.pointBlocked(x, y, r);
}

/** Punto libre (radio r) más cercano a (x, y) en espiral, o null. */
export function freeNear(world: World, x: number, y: number, r: number, max = 260): Vec | null {
  if (clearAt(world, x, y, r)) return { x, y };
  for (let d = 12; d <= max; d += 12) {
    const n = Math.max(8, Math.round((d * TAU) / 18));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      if (clearAt(world, px, py, r)) return { x: px, y: py };
    }
  }
  return null;
}

/**
 * ¿Puede el robot ir de a a b? Búsqueda por celdas donde cabe su cuerpo (un poco más estrecho que el
 * real: se escurre de lado). Devuelve la distancia en px o Infinity.
 */
export function robotRoute(world: World, a: Vec, b: Vec) {
  const n = world.navN;
  const r = ROBOT.radius * 0.8;
  const ok = new Uint8Array(n * n);
  const cell = (p: Vec) =>
    Math.max(0, Math.min(n - 1, Math.floor(p.y / NAV_CELL))) * n +
    Math.max(0, Math.min(n - 1, Math.floor(p.x / NAV_CELL)));
  const free = (c: number) => {
    if (ok[c]) return ok[c] === 1;
    const q = cellAt(world, c);
    ok[c] = world.pointBlocked(q.x, q.y, r) ? 2 : 1;
    return ok[c] === 1;
  };
  const s = cell(a);
  const t = cell(b);
  const dist = new Int32Array(n * n).fill(-1);
  const q = new Int32Array(n * n);
  let head = 0;
  let tail = 0;
  dist[s] = 0;
  q[tail++] = s;
  while (head < tail) {
    const c = q[head++];
    if (c === t) return dist[c] * NAV_CELL;
    const ci = c % n;
    const cj = (c / n) | 0;
    for (let k = 0; k < 4; k++) {
      const i = ci + (k === 0 ? 1 : k === 1 ? -1 : 0);
      const j = cj + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (i < 0 || j < 0 || i >= n || j >= n) continue;
      const nc = j * n + i;
      if (dist[nc] >= 0 || (nc !== t && !free(nc))) continue;
      dist[nc] = dist[c] + 1;
      q[tail++] = nc;
    }
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * Entradas para los refuerzos alrededor de (x, y): celdas con ruta hasta el objetivo a una distancia por
 * ruta entre d0 y d1, separadas entre sí por ángulo (como mucho n). Son las calles por donde llegan.
 */
export function pickEntries(world: World, field: FlowField, x: number, y: number, d0: number, d1: number, n = 4) {
  const out: Vec[] = [];
  for (const c of ringCells(world, field, d0, d1)) {
    const q = cellAt(world, c);
    if (!clearAt(world, q.x, q.y, 26)) continue;
    const a = Math.atan2(q.y - y, q.x - x);
    if (
      out.some(
        (e) =>
          Math.abs(Math.atan2(Math.sin(a - Math.atan2(e.y - y, e.x - x)), Math.cos(a - Math.atan2(e.y - y, e.x - x)))) <
          1,
      )
    )
      continue;
    out.push(q);
    if (out.length >= n) break;
  }
  return out;
}

/** ¿El punto queda lejos de las zonas de las últimas operaciones? */
export const farFrom = (avoid: Vec[], x: number, y: number) =>
  avoid.every((v) => Math.hypot(v.x - x, v.y - y) >= OPS.gap);

/* ---------- puntos que se usan con H ---------- */

export function spot(id: number, x: number, y: number, t: number, lb: string): Spot {
  return { id, x: Math.round(x), y: Math.round(y), t, lb, done: false, prog: 0, by: null, hp0: 0 };
}

/* ---------- objetivos que atacan los zombis ---------- */

/** Un rectángulo que los zombis rodean por ruta y golpean (onHit decide qué pasa con el golpe). */
export function makeGoal(world: World, rect: Goal['rect'], onHit: (dmg: number, game: GameHost) => void): Goal {
  const field = newField(world);
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  world.computeField(field, cx, cy);
  return {
    isGoal: true,
    x: cx,
    y: cy,
    r: 6,
    mass: 999,
    kx: 0,
    ky: 0,
    alive: true,
    field,
    rect,
    hurt: onHit,
    aim(zx: number, zy: number) {
      this.x = Math.max(rect.x, Math.min(rect.x + rect.w, zx));
      this.y = Math.max(rect.y, Math.min(rect.y + rect.h, zy));
      this.kx = 0;
      this.ky = 0;
    },
  };
}

/** Zombis que pueden ir por un objetivo (no los jefes, el dorado, ni los que embisten recto). */
export const GOAL_TYPES = new Set(['normal', 'swat', 'sprinter', 'fat', 'heavy']);

/** Hay sitio para más zombis. */
export const room = (game: GameHost) => MAX_ALIVE - game.horde.list.length;

/** Un punto al azar alrededor de (x, y) a lo más r px. */
export const jitter = (x: number, y: number, r: number): Vec => ({ x: x + rand(-r, r), y: y + rand(-r, r) });
