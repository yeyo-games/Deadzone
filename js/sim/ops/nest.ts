// Operación «Destruir el nido»: una zona infestada con tres puntos estructurales. Se coloca una carga en
// cada uno (H 3 s; un golpe o alejarse la corta) y cada carga despierta más al nido. Con la tercera
// empieza una cuenta atrás de 12 s: hay que salir del área marcada antes de que estalle. La explosión
// llega justo al acabar la cuenta y hiere fuerte (no mata de golpe) a quien siga dentro. Al elegir el
// lugar se comprueba que desde cada carga se sale caminando con margen.
import { NAV_CELL, OPS } from '../../core/config.ts';
import { rand, TAU } from '../../core/util.ts';
import type { GameHost, Vec } from '../../core/types.d.ts';
import {
  cellAt,
  clearAt,
  farFrom,
  newField,
  pickEntries,
  ringCells,
  robotRoute,
  routeDist,
  spot,
  type Op,
  type OpCtx,
  type OpDef,
  type Spot,
} from './common.ts';
import { dirOf } from './dir.ts';
import { WALK } from '../player.ts';

const N = OPS.nest;

type Data = {
  pts: Spot[];
  planted: number;
  /** s que le quedan a la cuenta atrás (null: aún no) */
  fuse: number | null;
  /** salidas seguras más cercanas a cada carga */
  exits: Vec[];
  /** agujeros del nido por donde salen infectados */
  holes: Vec[];
  blown: boolean;
  _obs?: any;
};

// Salida a pie más cercana desde (x, y) hasta fuera del área (R + margen) del nido en (cx, cy).
function exitFrom(game: GameHost, x: number, y: number, cx: number, cy: number) {
  const world = game.world;
  const f = newField(world);
  world.computeField(f, x, y);
  if (!f.ok) return null;
  const R = N.R + 36;
  let best = 65535;
  let bc = -1;
  for (let c = 0; c < f.dist.length; c++) {
    const d = f.dist[c];
    if (d >= best) continue;
    const q = cellAt(world, c);
    if (Math.hypot(q.x - cx, q.y - cy) < R) continue;
    best = d;
    bc = c;
  }
  if (bc < 0) return null;
  return { at: cellAt(world, bc), dist: best * NAV_CELL };
}

export const Nest: OpDef & { guards(ctx: OpCtx, n: number): void } = {
  setup(game: GameHost, home: Vec, avoid: Vec[]) {
    const world = game.world;
    const f = newField(world);
    world.computeField(f, home.x, home.y);
    let tries = 0;
    for (const c of ringCells(world, f, OPS.dist[0], OPS.dist[1])) {
      const q = cellAt(world, c);
      if (!farFrom(avoid, q.x, q.y) || Math.hypot(q.x - home.x, q.y - home.y) < N.R + 450) continue;
      if (!clearAt(world, q.x, q.y, N.core * 0.75)) continue;
      if (++tries > OPS.tries) break;
      // tres puntos alrededor, en suelo libre y con ruta desde donde se aceptó
      const a0 = rand(0, TAU);
      const pts: Spot[] = [];
      for (let k = 0; k < 3; k++) {
        for (const da of [0, 0.35, -0.35, 0.7, -0.7]) {
          const a = a0 + (k * TAU) / 3 + da;
          const x = q.x + Math.cos(a) * N.ring;
          const y = q.y + Math.sin(a) * N.ring;
          if (!clearAt(world, x, y, 24) || !Number.isFinite(routeDist(world, f, x, y))) continue;
          pts.push(spot(k + 1, x, y, N.plantT, 'charge'));
          break;
        }
      }
      if (pts.length < 3) continue;
      if (!Number.isFinite(robotRoute(world, home, pts[0]))) continue;
      // desde cada carga se sale a pie del área con margen antes de la explosión
      const exits: Vec[] = [];
      let ok = true;
      for (const s of pts) {
        const e = exitFrom(game, s.x, s.y, q.x, q.y);
        if (!e || e.dist / WALK > N.fuse * N.exitK) {
          ok = false;
          break;
        }
        exits.push({ x: Math.round(e.at.x), y: Math.round(e.at.y) });
      }
      if (!ok) continue;
      const nf = newField(world);
      world.computeField(nf, q.x, q.y);
      const far = pickEntries(world, nf, q.x, q.y, 620, 900, 3);
      // agujeros del nido: entre las cargas, pegados al núcleo
      const holes: Vec[] = [];
      for (let k = 0; k < 3; k++) {
        const a = a0 + (k * TAU) / 3 + TAU / 6;
        const x = q.x + Math.cos(a) * (N.core + 26);
        const y = q.y + Math.sin(a) * (N.core + 26);
        if (clearAt(world, x, y, 18)) holes.push({ x: Math.round(x), y: Math.round(y) });
      }
      if (far.length + holes.length < 2) continue;
      const d: Data = { pts, planted: 0, fuse: null, exits, holes, blown: false };
      return { x: q.x, y: q.y, d, entries: [...far, ...holes] };
    }
    return null;
  },

  spots(op: Op) {
    const d = op.d as Data;
    return d.fuse === null ? d.pts : [];
  },

  use(ctx: OpCtx) {
    const op = ctx.op;
    const d = op.d as Data;
    d.planted = d.pts.filter((p) => p.done).length;
    op.open = op.entries.map((_, i) => i);
    if (d.planted < 3) return ctx.say(`Nido: carga colocada (${d.planted}/3). El nido se agita`);
    d.fuse = N.fuse;
    ctx.say(`Nido: ¡cargas listas! Sal del área: ${N.fuse} s`);
  },

  update(ctx: OpCtx, dt: number) {
    const op = ctx.op;
    const d = op.d as Data;
    if (d.fuse === null || d.blown) return;
    d.fuse -= dt;
    if (d.fuse > 0) return;
    // la explosión: justo al acabar la cuenta
    d.fuse = 0;
    d.blown = true;
    const g = ctx.game;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU;
      const r = k ? N.R * 0.55 : 0;
      g.particles.explosion(op.x + Math.cos(a) * r, op.y + Math.sin(a) * r, k ? 160 : 260);
    }
    g.sfx.explosion();
    g.camera.shake(0.8, op.x, op.y);
    for (const z of g.horde.list) {
      if (z.dead || z.def?.boss || Math.hypot(z.x - op.x, z.y - op.y) > N.R) continue;
      z.hp = 0;
      g.killZombie(z);
    }
    // fuerte y anunciado: una parte de su vida máxima a quien siga dentro (en el robot, al robot)
    for (const q of ctx.who) {
      const p = q.p;
      if (q.away || !p.alive || Math.hypot(p.x - op.x, p.y - op.y) > N.R) continue;
      // sin bono de escape limpio
      op.dirty = true;
      p.lastHit = 'nest';
      p.hurt(p.stats.maxHp * N.blast, g);
    }
    if (d._obs) g.world.removeDynamic(d._obs);
    d._obs = undefined;
    if (ctx.who.some((q) => !q.away && q.p.alive)) ctx.win();
  },

  activity(op: Op) {
    const d = op.d as Data;
    if (op.state !== 'active' || d.blown) return 0;
    return N.activity[Math.min(3, d.planted)];
  },

  guards(ctx: OpCtx, n: number) {
    const op = ctx.op;
    let left = n;
    for (let k = 0; k < 40 && left > 0; k++) {
      const a = rand(0, TAU);
      const r = rand(N.core + 60, N.R + 60);
      left -= ctx.group(Math.min(left, 5), { x: op.x + Math.cos(a) * r, y: op.y + Math.sin(a) * r }, null, true);
    }
  },

  view(op: Op) {
    const d = op.d as Data;
    return {
      R: N.R,
      core: N.core,
      n: d.planted,
      pts: d.pts.map((s) => [s.x, s.y, s.done ? 1 : 0]),
      fu: d.fuse === null ? -1 : Math.round(d.fuse * 100) / 100,
      ex: d.exits.map((e) => [e.x, e.y]),
      ho: d.holes.map((e) => [e.x, e.y]),
      bl: d.blown ? 1 : 0,
    };
  },

  restore(ctx: OpCtx) {
    const op = ctx.op;
    const d = op.d as Data;
    if (d.blown) return;
    const s = N.core * 1.1;
    const obs = {
      k: 0,
      x: Math.round(op.x - s / 2),
      y: Math.round(op.y - s / 2),
      w: Math.round(s),
      h: Math.round(s),
      low: true,
      opObs: true,
    };
    ctx.game.world.addDynamic(obs as any);
    d._obs = obs;
  },

  clear(ctx: OpCtx) {
    const d = ctx.op.d as Data;
    if (d._obs) ctx.game.world.removeDynamic(d._obs);
    d._obs = undefined;
  },
};

/** Rumbo hacia la salida más cercana (para la radio y la flecha). */
export function nestExit(op: Op, x: number, y: number) {
  const d = op.d as Data;
  let best = d.exits[0];
  for (const e of d.exits) if (Math.hypot(e.x - x, e.y - y) < Math.hypot(best.x - x, best.y - y)) best = e;
  return { at: best, dir: dirOf(best.x - x, best.y - y) };
}
