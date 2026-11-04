// Operación «Convoy militar perdido»: un camión accidentado con una caja de seguridad. Se eliminan los
// guardias, se conectan dos componentes (motor y batería, H 2 s cada uno) y empieza el desbloqueo:
// 60 s que sólo avanzan con alguien cerca y en tres fases (una calle, dos calles, presión y un grupo
// resistente). Si el camión cae, falla. Al abrirse la caja se saca el contenido con H.
import { OPS } from '../../core/config.ts';
import type { GameHost, Vec } from '../../core/types.d.ts';
import {
  cellAt,
  farFrom,
  makeGoal,
  newField,
  pickEntries,
  ringCells,
  robotRoute,
  spot,
  type Goal,
  type Op,
  type OpCtx,
  type OpDef,
  type Spot,
} from './common.ts';
import { dirOf } from './dir.ts';

const C = OPS.convoy;

type Data = {
  rect: { x: number; y: number; w: number; h: number };
  horiz: boolean;
  hp: number;
  max: number;
  parts: Spot[];
  box: Spot;
  /** segundos de desbloqueo acumulados (null: aún no empieza) */
  u: number | null;
  phase: number;
  opened: boolean;
  /** nadie cerca: el desbloqueo está en pausa */
  paused: boolean;
  /** guardias vivos */
  gl: number;
  /** s del último golpe al camión (para que parpadee) */
  hitT: number;
  /** s para rehacer la ruta hacia el camión */
  ft?: number;
  _goal?: Goal;
  _obs?: any;
};

function goalOf(op: Op): Goal | null {
  return (op.d as Data)._goal ?? null;
}

export const Convoy: OpDef & { goalFor(op: Op): Goal | null } = {
  setup(game: GameHost, home: Vec, avoid: Vec[]) {
    const world = game.world;
    const f = newField(world);
    world.computeField(f, home.x, home.y);
    const cells = ringCells(world, f, OPS.dist[0], OPS.dist[1]).slice(0, OPS.tries * 4);
    let tries = 0;
    for (const c of cells) {
      const q = cellAt(world, c);
      if (!farFrom(avoid, q.x, q.y) || Math.hypot(q.x - home.x, q.y - home.y) < 600) continue;
      if (++tries > OPS.tries) break;
      for (const horiz of Math.random() < 0.5 ? [true, false] : [false, true]) {
        const w = horiz ? C.w : C.h;
        const h = horiz ? C.h : C.w;
        const x = Math.round(q.x - w / 2);
        const y = Math.round(q.y - h / 2);
        // el camión con un anillo libre alrededor: para usarlo, defenderlo y construir
        const pad = 70;
        if (!world.rectFree(x - pad, y - pad, w + pad * 2, h + pad * 2)) continue;
        if (!Number.isFinite(robotRoute(world, home, q))) continue;
        const tf = newField(world);
        world.computeField(tf, q.x, q.y);
        const entries = pickEntries(world, tf, q.x, q.y, 540, 860, 4);
        if (entries.length < 2) continue;
        const cx = x + w / 2;
        const cy = y + h / 2;
        // motor en la cabina (un extremo), batería en un costado y la caja atrás (el otro extremo)
        const engine = horiz ? spot(1, x + w + 30, cy, C.partT, 'engine') : spot(1, cx, y + h + 30, C.partT, 'engine');
        const power = horiz ? spot(2, cx - 16, y - 30, C.partT, 'power') : spot(2, x - 30, cy - 16, C.partT, 'power');
        const box = horiz ? spot(3, x - 30, cy, C.lootT, 'loot') : spot(3, cx, y - 30, C.lootT, 'loot');
        const d: Data = {
          rect: { x, y, w, h },
          horiz,
          hp: C.hp,
          max: C.hp,
          parts: [engine, power],
          box,
          u: null,
          phase: 0,
          opened: false,
          paused: false,
          gl: 0,
          hitT: 0,
        };
        return { x: cx, y: cy, d, entries };
      }
    }
    return null;
  },

  // Los componentes sólo cuando no quedan guardias cerca; la caja, al terminar el desbloqueo.
  spots(op: Op) {
    const d = op.d as Data;
    if (d.gl > 0) return [];
    if (d.opened) return d.box.done ? [] : [d.box];
    return d.parts;
  },

  use(ctx: OpCtx, s: Spot) {
    const d = ctx.op.d as Data;
    const op = ctx.op;
    if (s.lb === 'loot') return ctx.win();
    const n = d.parts.filter((p) => p.done).length;
    if (n < 2) return ctx.say(`Convoy: ${s.lb === 'engine' ? 'motor' : 'batería'} conectado (${n}/2)`);
    // empieza el desbloqueo: la primera calle de ataque se anuncia
    d.u = 0;
    d.phase = 1;
    op.open = [0];
    const e = op.entries[0];
    ctx.say(`Convoy: desbloqueo en marcha. Vienen por ${dirOf(e.x - op.x, e.y - op.y)}: protege el camión`);
  },

  update(ctx: OpCtx, dt: number) {
    const op = ctx.op;
    const d = op.d as Data;
    d.hitT = Math.max(0, d.hitT - dt);
    // la ruta hacia el camión se rehace de vez en cuando (por las barricadas que pongan alrededor)
    d.ft = (d.ft ?? 0) - dt;
    if (d.ft <= 0 && d._goal) {
      d.ft = 1.5;
      d._goal.field.cell = -1;
      ctx.game.world.computeField(d._goal.field, op.x, op.y);
    }
    let gl = 0;
    for (const z of ctx.game.horde.list)
      if (z.guard && !z.dead && z.op === op.id && Math.hypot(z.x - op.x, z.y - op.y) < 520) gl++;
    d.gl = op.guards ? gl : 0;
    if (d.hp <= 0) return ctx.fail('El camión quedó destruido');
    if (d.u === null || d.opened) return;
    const near = ctx.who.some((q) => !q.away && q.p.alive && Math.hypot(q.p.x - op.x, q.p.y - op.y) < C.near);
    d.paused = !near;
    if (near) d.u = Math.min(C.unlockT, d.u + dt);
    const ph = d.u < C.phase ? 1 : d.u < C.phase * 2 ? 2 : 3;
    if (ph !== d.phase) {
      d.phase = ph;
      if (ph === 2) {
        op.open = [0, 1];
        const e = op.entries[1];
        ctx.say(`Convoy: ¡se abre otro frente por ${dirOf(e.x - op.x, e.y - op.y)}!`);
      } else {
        op.open = op.entries.map((_, i) => i);
        const e = op.entries[op.entries.length > 2 ? 2 : 0];
        ctx.say(`Convoy: últimos 20 s. Un grupo blindado llega por ${dirOf(e.x - op.x, e.y - op.y)}`);
        // el grupo resistente (del presupuesto)
        for (const [t, n] of Object.entries(C.heavy))
          for (let i = 0; i < n && op.budget > 0; i++)
            ctx.spawn(t, e.x + (i % 3) * 30 - 30, e.y + Math.floor(i / 3) * 30, null);
      }
    }
    if (d.u >= C.unlockT) {
      d.opened = true;
      ctx.say('Convoy: ¡caja abierta! Saca el contenido');
    }
  },

  activity(op: Op) {
    const d = op.d as Data;
    if (op.state !== 'active') return 0;
    if (d.u === null) return 0.3;
    if (d.opened) return 0.4;
    return C.activity[d.phase - 1] ?? 1;
  },

  goalFor(op: Op) {
    return goalOf(op);
  },

  view(op: Op) {
    const d = op.d as Data;
    const r = d.rect;
    return {
      ob: [r.x, r.y, r.w, r.h],
      hz: d.horiz ? 1 : 0,
      hp: Math.max(0, Math.ceil(d.hp)),
      mx: d.max,
      u: d.u === null ? -1 : Math.round(d.u * 10) / 10,
      ph: d.phase,
      on: d.parts.map((p) => (p.done ? 1 : 0)),
      op: d.opened ? 1 : 0,
      pz: d.paused ? 1 : 0,
      gl: d.gl,
      hit: d.hitT > 0 ? 1 : 0,
    };
  },

  // Pone el camión como obstáculo y el objetivo al que van los zombis (al empezar o al cargar).
  restore(ctx: OpCtx) {
    const op = ctx.op;
    const d = op.d as Data;
    const w = ctx.game.world;
    const r = d.rect;
    const obs = { k: 0, x: r.x, y: r.y, w: r.w, h: r.h, low: true, opObs: true };
    w.addDynamic(obs as any);
    d._obs = obs;
    d._goal = makeGoal(w, r, (dmg: number, game: GameHost) => {
      if (d.hp <= 0 || op.state === 'resolve') return;
      // ningún golpe le quita más de maxHit de su vida
      d.hp -= Math.min(dmg, d.max * C.maxHit);
      d.hitT = 0.25;
      game.particles.impact(
        r.x + Math.random() * r.w,
        r.y + Math.random() * r.h,
        Math.random() - 0.5,
        Math.random() - 0.5,
      );
      if (d.hp <= 0 && d._goal) d._goal.alive = false;
    });
  },

  clear(ctx: OpCtx) {
    const d = ctx.op.d as Data;
    if (d._obs) ctx.game.world.removeDynamic(d._obs);
    d._obs = undefined;
    if (d._goal) d._goal.alive = false;
  },
};
