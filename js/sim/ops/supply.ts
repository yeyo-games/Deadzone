// Operación «Recuperar suministros»: tres cargamentos repartidos por calles distintas y un punto de
// entrega. Cada jugador lleva uno (va un 15% más lento; en el robot no se nota) y puede disparar igual;
// con H se recoge (1 s) o se suelta. Al morir o desconectarse, el cargamento cae en suelo libre cerca.
// Uno está cerca y con poca guardia, otro lejos con espacio y otro en un sitio estrecho con guardias
// resistentes. La primera recogida trae refuerzos y cada entrega una respuesta anunciada junto al punto.
import { NAV_CELL, OPS } from '../../core/config.ts';
import { rand, TAU } from '../../core/util.ts';
import type { GameHost, Vec } from '../../core/types.d.ts';
import {
  cellAt,
  clearAt,
  farFrom,
  freeNear,
  newField,
  pickEntries,
  ringCells,
  robotRoute,
  spot,
  type Op,
  type OpCtx,
  type OpDef,
  type Spot,
  type Who,
} from './common.ts';
import { dirOf } from './dir.ts';

const S = OPS.supply;
/** cerca (defensa moderada), lejos (espacio para maniobrar), estrecho (guardias resistentes) */
const TIERS = ['near', 'far', 'narrow'] as const;
// parte de los guardias que cuida cada cargamento y sus tipos (los resistentes, en el estrecho)
const GUARD_SHARE = [0.25, 0.3, 0.45];
const TOUGH = ['heavy', 'heavy', 'rock', 'fat', 'swat'];

type Crate = {
  id: number;
  x: number;
  y: number;
  tier: number;
  by: string | null;
  dl: boolean;
  /** sus guardias ya salieron */
  gd: boolean;
  /** lo lleva un robot */
  robot: boolean;
};
type Data = {
  drop: Vec;
  crates: Crate[];
  spots: Spot[];
  n: number;
  /** guardias que quedan por repartir */
  gb: number;
  /** respuesta tras una entrega: segundos de aviso y por qué entrada */
  ans: { t: number; e: number } | null;
};

// ¿Qué tan encerrado está (x, y)? Celdas bloqueadas en un cuadro de 5×5 alrededor.
function tight(game: GameHost, x: number, y: number) {
  const w = game.world;
  const n = w.navN;
  const ci = Math.floor(x / NAV_CELL);
  const cj = Math.floor(y / NAV_CELL);
  let k = 0;
  for (let j = cj - 2; j <= cj + 2; j++)
    for (let i = ci - 2; i <= ci + 2; i++) if (i < 0 || j < 0 || i >= n || j >= n || w.blocked[j * n + i]) k++;
  return k;
}

function crateSpot(c: Crate): Spot {
  return spot(c.id, c.x, c.y, S.pickT, 'crate');
}

export const Supply: OpDef & {
  drop(ctx: OpCtx, who: Who, voluntary: boolean): void;
  guards(ctx: OpCtx, n: number): void;
} = {
  setup(game: GameHost, home: Vec, avoid: Vec[]) {
    const world = game.world;
    const f = newField(world);
    world.computeField(f, home.x, home.y);
    let tries = 0;
    for (const c of ringCells(world, f, OPS.dist[0] * 0.8, OPS.dist[1] * 0.85)) {
      const q = cellAt(world, c);
      if (!farFrom(avoid, q.x, q.y) || !clearAt(world, q.x, q.y, S.dropR + 8)) continue;
      if (++tries > OPS.tries) break;
      if (!Number.isFinite(robotRoute(world, home, q))) continue;
      const df = newField(world);
      world.computeField(df, q.x, q.y);
      const crates: Crate[] = [];
      const bands = [S.near, S.far, S.narrow];
      for (let t = 0; t < 3; t++) {
        let best: Vec | null = null;
        let bs = -1;
        let seen = 0;
        for (const cc of ringCells(world, df, bands[t][0], bands[t][1])) {
          const p = cellAt(world, cc);
          if (!clearAt(world, p.x, p.y, 22) || crates.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 380)) continue;
          if (Math.hypot(p.x - q.x, p.y - q.y) < 300) continue;
          if (t === 1 && !Number.isFinite(robotRoute(world, q, p))) continue;
          // el estrecho: el más encerrado de unos cuantos; los otros, el primero que sirva
          const score = t === 2 ? tight(game, p.x, p.y) : 0;
          if (score > bs) {
            bs = score;
            best = p;
          }
          if (t !== 2 || ++seen > 40) break;
        }
        if (!best) break;
        crates.push({
          id: t + 1,
          x: Math.round(best.x),
          y: Math.round(best.y),
          tier: t,
          by: null,
          dl: false,
          gd: false,
          robot: false,
        });
      }
      if (crates.length < 3) continue;
      const entries = pickEntries(world, df, q.x, q.y, 420, 700, 4);
      if (!entries.length) continue;
      const d: Data = { drop: { x: q.x, y: q.y }, crates, spots: crates.map(crateSpot), n: 0, gb: 0, ans: null };
      return { x: q.x, y: q.y, d, entries };
    }
    return null;
  },

  // Los cargamentos en el suelo (ni entregados ni en manos de nadie).
  spots(op: Op) {
    const d = op.d as Data;
    return d.spots.filter((s) => {
      const c = d.crates.find((k) => k.id === s.id);
      return c && !c.dl && !c.by;
    });
  },

  use(ctx: OpCtx, s: Spot, who: Who) {
    const d = ctx.op.d as Data;
    const c = d.crates.find((k) => k.id === s.id);
    if (!c || c.by || c.dl || who.p.cargo) {
      s.done = false;
      s.prog = 0;
      return;
    }
    c.by = who.id;
    who.p.cargo = c.id;
    s.done = false;
    s.prog = 0;
    const first = d.crates.every((k) => k === c || (!k.by && !k.dl));
    if (first) ctx.say('Suministros: cargamento recogido. Los infectados os han oído');
    else ctx.say(`Suministros: ${who.name || 'cargamento'} recogido. Llévalo al punto de entrega`);
  },

  // Suelta el cargamento de who en suelo libre cerca (voluntario con H, o al caer o irse).
  drop(ctx: OpCtx, who: Who, voluntary: boolean) {
    const d = ctx.op.d as Data;
    const c = d.crates.find((k) => k.by === who.id);
    who.p.cargo = 0;
    if (!c) return;
    const at = freeNear(ctx.game.world, who.p.x, who.p.y, 18, 300) || { x: c.x, y: c.y };
    c.x = Math.round(at.x);
    c.y = Math.round(at.y);
    c.by = null;
    c.robot = false;
    const s = d.spots.find((k) => k.id === c.id);
    if (s) {
      s.x = c.x;
      s.y = c.y;
      s.done = false;
      s.prog = 0;
      s.by = null;
    }
    if (voluntary) ctx.game.toast?.('Cargamento en el suelo');
    else {
      // sin bono de entrega perfecta
      ctx.op.dirty = true;
      ctx.say('Suministros: ¡un cargamento quedó en el suelo!');
    }
  },

  update(ctx: OpCtx, dt: number) {
    const op = ctx.op;
    const d = op.d as Data;
    const g = ctx.game;
    for (const c of d.crates) {
      // sus guardias salen cuando alguien se acerca a él
      if (
        !c.gd &&
        !c.dl &&
        ctx.who.some((q) => !q.away && q.p.alive && Math.hypot(q.p.x - c.x, q.p.y - c.y) < OPS.arrive)
      ) {
        c.gd = true;
        Supply.guards(ctx, -1 - c.tier);
      }
      if (!c.by) continue;
      const q = ctx.who.find((k) => k.id === c.by);
      if (!q || q.away || !q.p.alive) {
        // al caer o desconectarse, el cargamento queda donde estaba su portador
        if (q) Supply.drop(ctx, q, false);
        else {
          c.by = null;
          const s = d.spots.find((k) => k.id === c.id);
          if (s) {
            s.x = c.x;
            s.y = c.y;
          }
        }
        continue;
      }
      c.x = q.p.x;
      c.y = q.p.y;
      c.robot = !!q.p.inRobot;
      if (Math.hypot(c.x - d.drop.x, c.y - d.drop.y) < S.dropR) {
        c.dl = true;
        c.by = null;
        c.robot = false;
        c.x = Math.round(d.drop.x + Math.cos(c.id * 2.1) * 30);
        c.y = Math.round(d.drop.y + Math.sin(c.id * 2.1) * 30);
        q.p.cargo = 0;
        d.n++;
        if (d.n >= 3) return ctx.win();
        // respuesta anunciada junto al punto de entrega
        const e = (Math.random() * op.entries.length) | 0;
        d.ans = { t: S.answer[0], e };
        const at = op.entries[e];
        ctx.say(
          `Suministros: entregados ${d.n}/3. ¡Respuesta en ${S.answer[0]} s por ${dirOf(at.x - d.drop.x, at.y - d.drop.y)}!`,
        );
      }
    }
    if (d.ans) {
      d.ans.t -= dt;
      if (d.ans.t <= 0) {
        const at = op.entries[d.ans.e];
        d.ans = null;
        let left = Math.round(op.total * S.answer[1]);
        for (let k = 0; k < 12 && left > 0 && op.budget > 0; k++) left -= ctx.group(Math.min(left, 6), at);
      }
    }
  },

  // Guardias: n > 0 al llegar a la zona (se guardan para repartir entre los cargamentos); n < 0 los del
  // cargamento -n - 1 al acercarse alguien a él.
  guards(ctx: OpCtx, n: number) {
    const op = ctx.op;
    const d = op.d as Data;
    if (n >= 0) {
      d.gb = n;
      return;
    }
    const t = -n - 1;
    const c = d.crates.find((k) => k.tier === t);
    if (!c) return;
    let left = Math.min(op.budget, Math.round(d.gb * GUARD_SHARE[t]) + 3);
    for (let k = 0; k < 40 && left > 0; k++) {
      const a = rand(0, TAU);
      const r = rand(70, 220);
      const x = c.x + Math.cos(a) * r;
      const y = c.y + Math.sin(a) * r;
      if (
        ctx.game.world.pointBlocked(x, y, 26) ||
        ctx.game.world.baseSpot(x, y) ||
        ctx.who.some((q) => Math.hypot(q.p.x - x, q.p.y - y) < 280)
      )
        continue;
      const type = t === 2 ? TOUGH[k % TOUGH.length] : t === 1 && k % 4 === 0 ? 'fat' : 'normal';
      ctx.spawn(type, x, y, null, true);
      left--;
    }
  },

  activity(op: Op) {
    return op.state === 'active' ? 0.8 : 0;
  },

  view(op: Op) {
    const d = op.d as Data;
    return {
      dz: [Math.round(d.drop.x), Math.round(d.drop.y), S.dropR],
      n: d.n,
      an: d.ans ? [op.entries[d.ans.e].x, op.entries[d.ans.e].y, Math.ceil(d.ans.t)] : null,
    };
  },

  // Al cargar: quien llevaba un cargamento lo sigue llevando (si ya no está, queda en el suelo).
  restore(ctx: OpCtx) {
    const d = ctx.op.d as Data;
    for (const c of d.crates) {
      if (!c.by) continue;
      const q = ctx.who.find((k) => k.id === c.by);
      if (q && q.p.alive) q.p.cargo = c.id;
      else c.by = null;
    }
    for (const s of d.spots) {
      const c = d.crates.find((k) => k.id === s.id);
      if (c) {
        s.x = c.x;
        s.y = c.y;
      }
      s.prog = 0;
      s.by = null;
    }
  },

  clear(ctx: OpCtx) {
    for (const q of ctx.who) q.p.cargo = 0;
  },
};
