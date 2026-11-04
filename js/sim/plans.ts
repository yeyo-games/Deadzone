// Planos que se ganan en las operaciones (OPS.plans): las piezas «señuelo sonoro» y «reparador de campo»
// se usan con H junto a ellas. La munición incendiaria de la torreta pesada vive en heavy.ts.
//   señuelo: al activarlo atrae lure s a los zombis normales a radius px (no a los jefes ni a quien ya
//            está en pleno ataque especial); los zombis pueden romperlo; se gasta; uno activo a la vez
//   reparador: charges cargas; cada una repara heal de la vida máxima de la estructura o robot más
//            dañado a range px que lleve quiet s sin daño; cd s de espera; agotado, desaparece
// Su estado viaja en `up` de la pieza: señuelo 1 = sonando; reparador = cargas usadas + 4 × s de espera.
import { OPS, ROBOT } from '../core/config.ts';
import type { GameHost } from '../core/types.d.ts';
import { GOAL_TYPES, makeGoal, type Who } from './ops/common.ts';
import type { Ops } from './ops.ts';

const P = OPS.plans;

/** Espera de los reparadores y el señuelo que suena (cada paso, con o sin operación). */
export function updatePlans(ops: Ops, game: GameHost, dt: number, _who: Who[]) {
  const st = game.structures;
  for (const b of st.blocks as any[]) {
    if (b.kind !== 'repair' || !(b.cdT > 0)) continue;
    b.cdT = Math.max(0, b.cdT - dt);
    b.up = (b.up & 3) | (Math.ceil(b.cdT) << 2);
  }
  const L = ops.lure;
  if (!L) return;
  if (!st.blocks.includes(L.b) || L.b.hp <= 0) return endLure(ops, game, false);
  L.t -= dt;
  L.scan -= dt;
  if (L.scan <= 0) {
    L.scan = 0.5;
    const cx = L.b.x + L.b.w / 2;
    const cy = L.b.y + L.b.h / 2;
    for (const z of game.horde.list) {
      if (z.dead || z.def?.boss || z.goal || !GOAL_TYPES.has(z.type) || (z.bs && z.bs !== 'walk')) continue;
      if (Math.hypot(z.x - cx, z.y - cy) > P.decoy.radius) continue;
      z.goal = L.goal;
    }
  }
  if (L.t <= 0) endLure(ops, game, true);
}

// Se acabó el señuelo: los zombis vuelven a lo suyo y la pieza se gasta (si no la rompieron antes).
function endLure(ops: Ops, game: GameHost, spent: boolean) {
  const L = ops.lure;
  if (!L) return;
  ops.lure = null;
  L.goal.alive = false;
  for (const z of game.horde.list) if (z.goal === L.goal) z.goal = null;
  if (!spent) return;
  const st = game.structures;
  const i = st.blocks.indexOf(L.b);
  if (i < 0) return;
  st.blocks.splice(i, 1);
  game.world.removeDynamic(L.b);
  st.relayer();
  game.particles.dust(L.b.x + L.b.w / 2, L.b.y + L.b.h / 2, 14);
}

/** H junto a un señuelo o un reparador: lo usa. Devuelve true si había uno al alcance. */
export function usePlanBlock(ops: Ops, game: GameHost, q: Who) {
  const p = q.p;
  let best: any = null;
  let bd = OPS.reach + 20 + (p.inRobot ? ROBOT.radius - 14 : 0);
  for (const b of game.structures.blocks as any[]) {
    if (b.kind !== 'decoy' && b.kind !== 'repair') continue;
    const d = Math.hypot(b.x + b.w / 2 - p.x, b.y + b.h / 2 - p.y) - b.w / 2;
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  if (!best) return false;
  if (best.kind === 'decoy') useDecoy(ops, game, q, best);
  else useRepair(ops, game, q, best);
  return true;
}

function useDecoy(ops: Ops, game: GameHost, q: Who, b: any) {
  if (b.up) return;
  if (ops.lure) return ops.toastTo(game, q.id, 'Ya hay un señuelo sonando');
  b.up = 1;
  const goal = makeGoal(game.world, { x: b.x, y: b.y, w: b.w, h: b.h }, (dmg: number, g: GameHost) =>
    g.structures.damageBlock(g, b, dmg),
  );
  goal.decoy = true;
  ops.lure = { b, goal, t: P.decoy.lure, scan: 0 };
  game.sfx.decoy?.();
  ops.toastTo(game, q.id, `Señuelo activado: atrae a los zombis ${P.decoy.lure} s`);
}

// Lo que el reparador puede arreglar: estructuras en pie y robots, dañados y a su alcance.
function useRepair(ops: Ops, game: GameHost, q: Who, b: any) {
  if (b.cdT > 0) return ops.toastTo(game, q.id, `El reparador se recarga: ${Math.ceil(b.cdT)} s`);
  const R = P.repair;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  let best: { k: number; x: number; y: number; heal: () => number } | null = null;
  let hot = false;
  const consider = (x: number, y: number, hp: number, max: number, calm: number, heal: () => number) => {
    if (hp <= 0 || hp >= max - 0.5 || Math.hypot(x - cx, y - cy) > R.range) return;
    if (calm < R.quiet) {
      hot = true;
      return;
    }
    const k = hp / max;
    if (!best || k < best.k) best = { k, x, y, heal };
  };
  for (const o of game.structures.blocks as any[]) {
    if (o === b || o.tempT !== undefined) continue;
    consider(o.x + o.w / 2, o.y + o.h / 2, o.hp, o.max, o.calm ?? 99, () => {
      const n = Math.min(o.max - o.hp, o.max * R.heal);
      o.hp += n;
      return n;
    });
  }
  for (const w of ops.who) {
    const rb = w.robot;
    if (!rb || !rb.owned || rb.broken) continue;
    consider(rb.x, rb.y, rb.hp, ROBOT.hp, rb.calm ?? 99, () => {
      const n = Math.min(ROBOT.hp - rb.hp, ROBOT.hp * R.heal);
      rb.hp += n;
      return n;
    });
  }
  const pick = best as { k: number; x: number; y: number; heal: () => number } | null;
  if (!pick)
    return ops.toastTo(game, q.id, hot ? `Recibió daño hace poco: espera ${R.quiet} s sin golpes` : 'Nada que reparar a su alcance');
  const n = Math.round(pick.heal());
  const used = (b.up & 3) + 1;
  b.cdT = R.cd;
  b.up = used | (R.cd << 2);
  game.particles.pickupFx(pick.x, pick.y, '#86a892');
  game.sfx.repair?.();
  ops.toastTo(game, q.id, `Reparado: +${n} de vida (${R.charges - used} cargas)`);
  if (used < R.charges) return;
  const st = game.structures;
  const i = st.blocks.indexOf(b);
  if (i >= 0) st.blocks.splice(i, 1);
  game.world.removeDynamic(b);
  st.relayer();
  game.particles.dust(cx, cy, 12);
  ops.toastTo(game, q.id, 'Reparador agotado');
}
