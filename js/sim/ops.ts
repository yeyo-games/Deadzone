// Operaciones de alto riesgo: encuentros opcionales entre oleadas (desde la 20, cada 5). Corre donde se
// simula (solitario o el servidor en línea) y sólo durante el descanso: el director de oleadas se queda
// esperando, así que la oleada siguiente y la del jefe no cambian. Estados:
//   oferta  la radio propone dos operaciones (en grupo se vota 20 s) o seguir con las oleadas
//   prep    zona elegida y marcada: se puede comprar, construir y llegar; nada corre aún
//   active  empezó al usar por primera vez el objetivo: refuerzos, fases y temporizadores
//   resolve victoria, fallo o retirada: transición breve, se limpia lo de la operación y se vuelve
//           al lugar donde se aceptó, al descanso de antes de la siguiente oleada
// Cada tipo vive en sim/ops/<tipo>.ts; aquí lo común. Los planos ganados están en sim/plans.ts.
import { OP_PLAN, OPS, ROBOT, ZOMBIES } from '../core/config.ts';
import { rand, TAU } from '../core/util.ts';
import type { GameHost, Vec } from '../core/types.d.ts';
import {
  freeNear,
  GOAL_TYPES,
  jitter,
  OP_LABELS,
  OP_ORDER,
  room,
  type Goal,
  type Op,
  type OpCtx,
  type OpDef,
  type OpKind,
  type Spot,
  type Who,
} from './ops/common.ts';
import { Convoy } from './ops/convoy.ts';
import { Nest } from './ops/nest.ts';
import { Supply } from './ops/supply.ts';
import { dirOf } from './ops/dir.ts';
import { updatePlans, usePlanBlock } from './plans.ts';

export { OP_LABELS, OP_ORDER };
export type { Op, OpKind, Who };

export const OP_DEFS: Record<OpKind, OpDef> = { convoy: Convoy, nest: Nest, supply: Supply };

/** Nombre, objetivo y amenaza principal de cada operación (tarjetas de la radio y HUD). */
export const OP_INFO: Record<OpKind, { name: string; short: string; goal: string; threat: string; plan: string }> = {
  convoy: {
    name: 'Convoy militar perdido',
    short: 'Convoy militar',
    goal: 'Reactiva el camión accidentado y protege 60 s el desbloqueo de su caja de seguridad.',
    threat: 'Oleadas que llegan por dos calles y van por el camión.',
    plan: 'Plano: señuelo sonoro',
  },
  nest: {
    name: 'Destruir el nido',
    short: 'Nido infectado',
    goal: 'Coloca tres cargas en el nido y sal del área antes de que estalle (12 s).',
    threat: 'Infectados que salen del nido, cada vez más activos.',
    plan: 'Plano: munición incendiaria',
  },
  supply: {
    name: 'Recuperar suministros',
    short: 'Suministros',
    goal: 'Recoge tres cargamentos repartidos por la zona y llévalos al punto de entrega.',
    threat: 'Guardias resistentes y respuestas en el punto de entrega.',
    plan: 'Plano: reparador de campo',
  },
};

/** Dinero de una operación aceptada tras la oleada w (para cada participante). */
export function opReward(kind: OpKind, w: number) {
  const r = OPS.reward;
  return Math.round((r.base + r.perWave * Math.max(0, w - OPS.from)) * (r.mult[kind] ?? 1));
}

/** ¿Tras superar la oleada w llega una oferta por radio? */
export const offersAt = (w: number) => w >= OPS.from && (w - OPS.from) % OPS.every === 0;

/** Rumbo hacia (dx, dy) en palabras ('el norte'…), para la radio. */
export const dirName = dirOf;

type Offer = { kinds: OpKind[]; wave: number; t: number; votes: Record<string, number> };

/** Planos ganados en la partida. */
export type Plans = { decoy: boolean; fire: boolean; repair: boolean };

export class Ops {
  declare offer: Offer | null;
  declare op: Op | null;
  declare plans: Plans;
  /** oleada en que se completó por última vez cada tipo */
  declare last: Record<string, number>;
  /** zonas de las últimas operaciones (para no repetir lugar) */
  declare zones: Vec[];
  /** operaciones ya pagadas (una sola vez cada una) */
  declare paid: number[];
  declare nextId: number;
  declare radioN: number;
  /** partida de grupo: la oferta se vota y la retirada pide mayoría */
  declare group: boolean;
  /** líder de la sala: decide los empates */
  declare leader: string;
  /** señuelo activo (sim/plans.ts) */
  declare lure: { b: any; goal: Goal; t: number; scan: number } | null;
  declare who: Who[];
  declare cache: { t: number; v: any } | null;
  constructor(group = false) {
    this.group = group;
    this.leader = '';
    this.reset();
  }

  reset() {
    this.offer = null;
    this.op = null;
    this.plans = { decoy: false, fire: false, repair: false };
    this.last = {};
    this.zones = [];
    this.paid = [];
    this.nextId = 1;
    this.radioN = 0;
    this.lure = null;
    this.who = [];
    this.cache = null;
  }

  /** ¿Hay una oferta u operación que impide empezar la siguiente oleada? */
  busy() {
    return !!this.op;
  }

  /** ¿Se puede comprar ahora? (no durante el combate de una operación) */
  canShop() {
    return !this.op || this.op.state === 'prep';
  }

  hasPlan(k: string) {
    return !!(this.plans as Record<string, boolean>)[k];
  }

  /* ---------- oferta por radio ---------- */

  /** Tras superar la oleada w: si toca, la radio ofrece dos operaciones (la menos reciente siempre). */
  afterWave(game: GameHost, w: number) {
    this.offer = null;
    if (!offersAt(w) || this.op) return false;
    const age = (k: string) => this.last[k] ?? -1;
    const order = [...OP_ORDER].sort((a, b) => age(a) - age(b) || Math.random() - 0.5);
    const rest = order.slice(1);
    const kinds = [order[0], rest[(Math.random() * rest.length) | 0]];
    this.offer = { kinds, wave: w, t: OPS.voteT, votes: {} };
    this.say(`Radio: hay dos operaciones disponibles tras la oleada ${w}`);
    return true;
  }

  /** Voto (o elección en solitario) de id: 0 o 1 = esa operación, 2 = seguir con las oleadas. */
  vote(game: GameHost, id: string, choice: number) {
    const o = this.offer;
    if (!o || !(choice === 0 || choice === 1 || choice === 2)) return false;
    o.votes[id] = choice;
    if (!this.group) this.settle(game);
    return true;
  }

  /** Cierra la oferta: gana la mayoría; en empate decide el líder; si nadie votó, se sigue. */
  settle(game: GameHost) {
    const o = this.offer;
    if (!o) return;
    this.offer = null;
    const ids = Object.keys(o.votes);
    if (!ids.length) return;
    const n = [0, 0, 0];
    for (const id of ids) n[o.votes[id]]++;
    const top = Math.max(...n);
    const tied = [0, 1, 2].filter((i) => n[i] === top);
    let pick = tied[0];
    if (tied.length > 1) {
      const lv = o.votes[this.leader];
      pick = lv !== undefined && tied.includes(lv) ? lv : tied.includes(2) ? 2 : tied[0];
    }
    if (pick === 2) {
      this.say('Radio: entendido, seguid con las oleadas');
      return;
    }
    this.accept(game, o.kinds[pick], o.wave);
  }

  /** Empieza la operación kind (aceptada tras la oleada w) cerca del equipo, o avisa si no cabe. */
  accept(game: GameHost, kind: OpKind, w: number) {
    const who = this.whoNow(game);
    const live = who.filter((q) => !q.away && q.p.alive);
    if (!live.length) return false;
    let hx = 0;
    let hy = 0;
    for (const q of live) {
      hx += q.p.x;
      hy += q.p.y;
    }
    const home = { x: hx / live.length, y: hy / live.length };
    const def = OP_DEFS[kind];
    const got = def.setup(game, home, this.zones.slice(-3));
    if (!got) {
      game.toast(`${OP_INFO[kind].name}: no hay un lugar seguro en este mapa. Sigue la partida`);
      return false;
    }
    const d = game.director;
    const next = d.wave + 1;
    const c = d.composition(next);
    const mix: [string, number][] = (['normal', 'swat', 'sprinter', 'fat', 'heavy', 'bull', 'rock', 'demon'] as const)
      .map((k): [string, number] => [k, c[k]])
      .filter(([, n]) => n > 0);
    // el escalado del grupo (crowd) ya va en composition: se fija aquí y no cambia si alguien se va
    const total = Math.max(20, Math.round(mix.reduce((a, [, n]) => a + n, 0) * (OPS.budget[kind] ?? 0.6)));
    const op: Op = {
      id: this.nextId++,
      kind,
      wave: w,
      x: Math.round(got.x),
      y: Math.round(got.y),
      home,
      state: 'prep',
      t: 0,
      guards: false,
      budget: total,
      total,
      acc: 0,
      mix,
      hpK: d.hpAt(next),
      spK: d.speedAt(next),
      entries: got.entries.map((e) => ({ x: Math.round(e.x), y: Math.round(e.y) })),
      open: [],
      d: got.d,
      result: '',
      outT: 0,
      cleaned: false,
      paid: false,
      reward: opReward(kind, w),
      plan: '',
      radio: [this.radioN, ''],
      ret: [],
    };
    this.op = op;
    this.zones.push({ x: op.x, y: op.y });
    if (this.zones.length > 3) this.zones.shift();
    def.restore?.(this.ctx(game));
    const dx = op.x - home.x;
    const dy = op.y - home.y;
    this.say(`${OP_INFO[kind].short}: objetivo marcado hacia ${dirName(dx, dy)}. Prepárate y ve cuando quieras`);
    return true;
  }

  /* ---------- cada paso ---------- */

  /** Quienes juegan (los da quien simula: game.opsWho). */
  whoNow(game: GameHost): Who[] {
    this.who = game.opsWho ? game.opsWho() : [];
    return this.who;
  }

  update(dt: number, game: GameHost) {
    const who = this.whoNow(game);
    this.cache = null;
    updatePlans(this, game, dt, who);
    if (this.offer && this.group) {
      this.offer.t -= dt;
      const here = who.filter((q) => !q.away);
      const all = here.length > 0 && here.every((q) => this.offer!.votes[q.id] !== undefined);
      if (all || this.offer.t <= 0) this.settle(game);
    }
    const op = this.op;
    if (!op) {
      this.planUse(game, who);
      return;
    }
    const ctx = this.ctx(game);
    const def = OP_DEFS[op.kind];
    if (op.state === 'resolve') {
      op.outT -= dt;
      // a media transición (pantalla a oscuras): se quita lo de la operación y se vuelve
      if (!op.cleaned && op.outT <= OPS.outT / 2) this.cleanup(ctx);
      if (op.outT <= 0) this.finish(game);
      this.planUse(game, who);
      return;
    }
    if (op.state === 'active') op.t += dt;
    // guardias: al acercarse alguien a la zona
    if (!op.guards && who.some((q) => !q.away && q.p.alive && Math.hypot(q.p.x - op.x, q.p.y - op.y) < OPS.arrive)) {
      op.guards = true;
      this.guards(ctx);
    }
    this.interact(ctx, dt);
    def.update(ctx, dt);
    if (this.op !== op || op.state !== 'active') return;
    this.reinforce(ctx, dt);
    // en grupo, quien se desconectó no cuenta para la retirada
    if (this.group && op.ret.length) {
      const here = who.filter((q) => !q.away);
      op.ret = op.ret.filter((id) => here.some((q) => q.id === id));
    }
  }

  // Sin operación en curso, H sólo sirve para las piezas de plano (señuelo, reparador): al apretarla.
  planUse(game: GameHost, who: Who[]) {
    for (const q of who) {
      const p = q.p;
      if (!q.away && p.alive && p.use && !p.useWas) usePlanBlock(this, game, q);
      p.useWas = !!p.use;
    }
  }

  // Los puntos que cada uno usa con H: el más cercano a su alcance, libre o ya suyo. Soltarlo (o alejarse)
  // lo corta; en el nido también un golpe. Si no hay punto: soltar el cargamento o usar una pieza de plano.
  interact(ctx: OpCtx, dt: number) {
    const op = ctx.op;
    const def = OP_DEFS[op.kind];
    const list = def.spots(op);
    for (const q of ctx.who) {
      const p = q.p;
      const use = !q.away && p.alive && !!p.use;
      const s = use ? this.spotFor(list, p, q.id) : null;
      for (const o of list) {
        if (o.by === q.id && o !== s) {
          o.by = null;
          o.prog = 0;
        }
      }
      if (s) {
        if (s.by !== q.id) {
          s.by = q.id;
          s.prog = 0;
          s.hp0 = p.hp;
          if (op.state === 'prep') this.activate(ctx);
        }
        if (op.kind === 'nest' && p.hp < s.hp0 - 0.01) {
          s.prog = 0;
          s.hp0 = p.hp;
          this.toastTo(ctx.game, q.id, '¡Te golpearon! Vuelve a colocar la carga');
        }
        s.prog = Math.min(1, s.prog + dt / s.t);
        if (s.prog >= 1) {
          s.done = true;
          s.by = null;
          // hay que soltar H antes de volver a usarla (así no se suelta lo que se acaba de recoger)
          p.useLock = true;
          def.use(ctx, s, q);
        }
      } else if (use && p.cargo && op.kind === 'supply' && !p.useLock) {
        p.dropT = (p.dropT || 0) + dt;
        if (p.dropT >= OPS.supply.dropT) {
          p.dropT = 0;
          (def as typeof Supply).drop(ctx, q, true);
        }
      } else if (use && !p.useWas) usePlanBlock(this, ctx.game, q);
      if (!use) {
        p.dropT = 0;
        p.useLock = false;
      }
      p.useWas = !!p.use;
    }
  }

  spotFor(list: Spot[], p: any, id: string) {
    let best: Spot | null = null;
    let bd = OPS.reach + (p.inRobot ? ROBOT.radius - 14 : 0);
    for (const s of list) {
      if (s.done || (s.by && s.by !== id) || (s.lb === 'crate' && p.cargo)) continue;
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  /** Primer uso del objetivo: empiezan los refuerzos y los temporizadores. */
  activate(ctx: OpCtx) {
    const op = ctx.op;
    if (op.state !== 'prep') return;
    op.state = 'active';
    op.t = 0;
    if (!op.guards) {
      op.guards = true;
      this.guards(ctx);
    }
  }

  // Los guardias iniciales (parte del presupuesto): cerca del objetivo, del lado que nadie ve.
  guards(ctx: OpCtx) {
    const op = ctx.op;
    const def = OP_DEFS[op.kind] as OpDef & { guards?: (c: OpCtx, n: number) => void };
    const n = Math.min(op.budget, Math.round(op.total * (OPS.guards[op.kind] ?? 0.1)));
    if (def.guards) return def.guards(ctx, n);
    let left = n;
    for (let k = 0; k < 30 && left > 0; k++) {
      const a = rand(0, TAU);
      const r = rand(170, 340);
      left -= ctx.group(Math.min(left, 5), { x: op.x + Math.cos(a) * r, y: op.y + Math.sin(a) * r }, null, true);
    }
  }

  // Refuerzos: el presupuesto sale al ritmo de cada fase (activity) por las entradas abiertas, sin pasar
  // del tope de zombis vivos ni aparecer encima de nadie.
  reinforce(ctx: OpCtx, dt: number) {
    const op = ctx.op;
    if (op.budget <= 0) return;
    const k = OP_DEFS[op.kind].activity(op);
    if (k <= 0) return;
    op.acc = Math.min(OPS.burst * 2, op.acc + (dt * k * op.total) / OPS.pace);
    if (op.acc < Math.min(4, op.budget)) return;
    const ids = op.open.length ? op.open : op.entries.map((_, i) => i);
    if (!ids.length) return;
    const e = op.entries[ids[(Math.random() * ids.length) | 0]];
    const n = Math.min(Math.floor(op.acc), op.budget, OPS.burst, room(ctx.game));
    if (n <= 0) return;
    op.acc -= ctx.group(n, e, (OP_DEFS[op.kind] as any).goalFor?.(op) ?? null) || 0;
  }

  /* ---------- final ---------- */

  /** Termina la operación: transición breve y vuelta al descanso (la paga sólo al ganar y una vez). */
  resolve(ctx: OpCtx, result: 'win' | 'fail' | 'retreat', why = '') {
    const op = ctx.op;
    if (op.state === 'resolve') return;
    op.state = 'resolve';
    op.result = result;
    op.outT = OPS.outT;
    const g = ctx.game;
    if (result === 'win') {
      this.last[op.kind] = op.wave;
      if (!op.paid && !this.paid.includes(op.id)) {
        op.paid = true;
        this.paid.push(op.id);
        if (this.paid.length > 40) this.paid.shift();
        g.opsPay?.(op.reward);
        const plan = OP_PLAN[op.kind];
        if (plan && !this.hasPlan(plan)) {
          (this.plans as Record<string, boolean>)[plan] = true;
          op.plan = plan;
        }
      }
      this.say(`${OP_INFO[op.kind].short}: ¡operación completada! +$${op.reward}${op.plan ? ' y un plano nuevo' : ''}`);
    } else if (result === 'fail') this.say(`${OP_INFO[op.kind].short}: objetivo fallido. ${why}`);
    else this.say(`${OP_INFO[op.kind].short}: retirada. Volved a la base`);
  }

  /** Retirada pedida por id (en grupo hace falta más de la mitad de los presentes). */
  retreat(game: GameHost, id: string) {
    const op = this.op;
    if (!op || op.state === 'resolve') return false;
    const ctx = this.ctx(game);
    if (!this.group) {
      this.resolve(ctx, 'retreat');
      return true;
    }
    if (!op.ret.includes(id)) op.ret.push(id);
    const here = ctx.who.filter((q) => !q.away).length;
    if (op.ret.length * 2 > here) this.resolve(ctx, 'retreat');
    else {
      const q = ctx.who.find((x) => x.id === id);
      this.say(`${q ? q.name : 'Alguien'} pide la retirada (${op.ret.length}/${here})`);
    }
    return true;
  }

  // Quita sólo lo de la operación (sus zombis, objetivos, marcas) y lleva a todos de vuelta.
  cleanup(ctx: OpCtx) {
    const op = ctx.op;
    op.cleaned = true;
    const g = ctx.game;
    for (const z of g.horde.list) {
      if (z.op === op.id) z.dead = true;
      if (z.goal && !z.goal.decoy) z.goal = null;
    }
    g.horde.removeDead();
    OP_DEFS[op.kind].clear?.(ctx);
    for (const q of ctx.who) {
      q.p.cargo = 0;
      q.p.use = false;
    }
    this.sendHome(ctx);
  }

  // Cada uno vuelve junto al lugar donde se aceptó (a un punto libre cercano si está ocupado).
  sendHome(ctx: OpCtx) {
    const g = ctx.game;
    const op = ctx.op;
    const live = ctx.who.filter((q) => !q.away && q.p.alive);
    live.forEach((q, i) => {
      const p = q.p;
      if (p.manned) g.structures.leaveHeavy(p);
      const r = (p.inRobot ? ROBOT.radius : p.r) + 4;
      const a = (i / Math.max(1, live.length)) * TAU;
      const spot = freeNear(
        g.world,
        op.home.x + Math.cos(a) * 40 * Math.min(1, i),
        op.home.y + Math.sin(a) * 40 * Math.min(1, i),
        r,
        400,
      );
      if (!spot) return;
      p.x = spot.x;
      p.y = spot.y;
      p.vx = p.vy = p.kx = p.ky = 0;
      if (p.inRobot && q.robot) {
        q.robot.x = p.x;
        q.robot.y = p.y;
      }
    });
    g.opsMoved?.();
  }

  finish(game: GameHost) {
    const op = this.op;
    if (!op) return;
    if (!op.cleaned) this.cleanup(this.ctx(game));
    this.op = null;
    game.opsDone?.(op.result);
  }

  /* ---------- herramientas para cada tipo ---------- */

  ctx(game: GameHost): OpCtx {
    const op = this.op!;
    const self = this;
    return {
      game,
      op,
      who: this.who.length ? this.who : this.whoNow(game),
      say: (t: string) => self.say(t),
      win: () => self.resolve(self.ctx(game), 'win'),
      fail: (why: string) => self.resolve(self.ctx(game), 'fail', why),
      spawn: (type: string, x: number, y: number, goal: Goal | null = null, guard = false) =>
        self.spawn(game, type, x, y, goal, guard),
      group: (n: number, at: Vec, goal: Goal | null = null, guard = false) => self.spawnGroup(game, n, at, goal, guard),
    };
  }

  say(text: string) {
    this.radioN++;
    if (this.op) this.op.radio = [this.radioN, text];
    this.radioMsg = [this.radioN, text];
  }
  declare radioMsg: [number, string];

  toastTo(game: GameHost, id: string, msg: string) {
    if (game.opsToast) game.opsToast(id, msg);
    else game.toast(msg);
  }

  /** Un zombi de la operación (cuenta del presupuesto). */
  spawn(game: GameHost, type: string, x: number, y: number, goal: Goal | null, guard: boolean) {
    const op = this.op!;
    const z = game.horde.spawn(type, x, y, op.hpK, op.spK);
    z.op = op.id;
    if (goal && GOAL_TYPES.has(type)) z.goal = goal;
    if (guard) z.guard = true;
    op.budget--;
    return z;
  }

  /** Tipo al azar según la mezcla de la siguiente oleada. */
  pickType(op: Op) {
    let total = 0;
    for (const [, n] of op.mix) total += n;
    let r = Math.random() * total;
    for (const [t, n] of op.mix) if ((r -= n) <= 0) return t;
    return 'normal';
  }

  /**
   * n zombis alrededor de at (sin nadie a menos de 260 px, sin muros); con goal, una parte va por el
   * objetivo (OPS.convoy.truck). Devuelve cuántos salieron.
   */
  spawnGroup(game: GameHost, n: number, at: Vec, goal: Goal | null, guard = false) {
    const op = this.op!;
    const w = game.world;
    const targets: any[] = this.who.filter((q) => !q.away && q.p.alive).map((q) => q.p);
    let out = 0;
    for (let i = 0; i < n * 3 && out < n && op.budget > 0 && room(game) > 0; i++) {
      const type = this.pickType(op);
      const r = ((ZOMBIES as Record<string, { radius: number }>)[type]?.radius ?? 15) + 2;
      const q = jitter(at.x, at.y, 46);
      if (
        w.pointBlocked(q.x, q.y, r) ||
        w.baseSpot(q.x, q.y) ||
        targets.some((p) => Math.hypot(p.x - q.x, p.y - q.y) < 260)
      )
        continue;
      this.spawn(game, type, q.x, q.y, goal && Math.random() < OPS.convoy.truck ? goal : null, guard);
      out++;
    }
    return out;
  }

  /* ---------- lo que se ve (HUD, dibujo y foto en línea) ---------- */

  /** Estado para pintar y para la foto (el mismo en solitario y en línea). */
  view() {
    if (this.cache && this.cache.t === this.radioN * 1e6 + (this.op ? this.op.t + this.op.outT : 0))
      return this.cache.v;
    const idx = (id: string | null) => (id ? (this.who.find((q) => q.id === id)?.idx ?? -1) : -1);
    const v: any = { pl: (this.plans.decoy ? 1 : 0) | (this.plans.fire ? 2 : 0) | (this.plans.repair ? 4 : 0) };
    if (this.radioMsg) v.rd = this.radioMsg;
    const o = this.offer;
    if (o) {
      const votes: number[] = [];
      for (const id of Object.keys(o.votes)) votes.push(idx(id), o.votes[id]);
      v.of = {
        k: o.kinds,
        rw: o.kinds.map((k) => opReward(k, o.wave)),
        w: o.wave,
        t: this.group ? Math.max(0, Math.ceil(o.t)) : -1,
        v: votes,
        n: this.who.filter((q) => !q.away).length,
      };
    }
    const op = this.op;
    if (op) {
      const def = OP_DEFS[op.kind];
      v.op = {
        id: op.id,
        k: op.kind,
        x: op.x,
        y: op.y,
        hx: Math.round(op.home.x),
        hy: Math.round(op.home.y),
        s: op.state,
        t: Math.round(op.t * 10) / 10,
        res: op.result,
        ot: Math.round(op.outT * 100) / 100,
        rw: op.reward,
        pn: op.plan,
        rv: [op.ret.length, this.who.filter((q) => !q.away).length],
        en: op.open.map((i) => [op.entries[i].x, op.entries[i].y]),
        sp: def
          .spots(op)
          .filter((s) => !s.done)
          .map((s) => [s.x, s.y, s.lb, Math.round(s.prog * 100), idx(s.by)]),
        ...def.view(op),
      };
      // quién lleva qué (suministros): índice del jugador
      if (op.kind === 'supply')
        v.op.cr = op.d.crates.map((c: any) => [
          c.id,
          Math.round(c.x),
          Math.round(c.y),
          idx(c.by),
          c.dl ? 1 : 0,
          c.tier,
          c.robot ? 1 : 0,
        ]);
    }
    this.cache = { t: this.radioN * 1e6 + (op ? op.t + op.outT : 0), v };
    return v;
  }

  /** ¿No se puede construir en ese rectángulo? (ver viewForbids) */
  forbids(x: number, y: number, w: number, h: number) {
    return !!this.op && viewForbids(this.view(), x, y, w, h);
  }

  /* ---------- guardar y continuar (solitario) ---------- */

  serialize() {
    const skip = (k: string, v: unknown) => (k.startsWith('_') ? undefined : v);
    return JSON.parse(
      JSON.stringify(
        {
          offer: this.offer ? { kinds: this.offer.kinds, wave: this.offer.wave } : null,
          op: this.op,
          plans: this.plans,
          last: this.last,
          zones: this.zones,
          paid: this.paid,
          nextId: this.nextId,
        },
        skip,
      ),
    );
  }

  /** Vuelve al estado guardado (los zombis de la operación los pone save.js con restoreZombie). */
  restore(game: GameHost, d: any) {
    this.reset();
    if (!d || typeof d !== 'object') return;
    const pl = d.plans || {};
    this.plans = { decoy: !!pl.decoy, fire: !!pl.fire, repair: !!pl.repair };
    if (d.last && typeof d.last === 'object') this.last = { ...d.last };
    if (Array.isArray(d.zones)) this.zones = d.zones.filter((z: any) => Number.isFinite(z?.x)).slice(-3);
    if (Array.isArray(d.paid)) this.paid = d.paid.filter(Number.isInteger);
    this.nextId = Math.max(1, d.nextId | 0, ...this.paid.map((i) => i + 1));
    if (d.offer && OP_ORDER.includes(d.offer.kinds?.[0]) && OP_ORDER.includes(d.offer.kinds?.[1]))
      this.offer = { kinds: d.offer.kinds, wave: d.offer.wave | 0, t: OPS.voteT, votes: {} };
    const op = d.op;
    if (op && OP_ORDER.includes(op.kind) && op.d) {
      // una operación ya pagada o a media transición se da por terminada al cargar
      if (op.state === 'resolve' || op.paid || this.paid.includes(op.id)) return;
      this.op = { ...op, ret: [], radio: [0, ''], acc: 0 };
      this.whoNow(game);
      OP_DEFS[op.kind as OpKind].restore?.(this.ctx(game));
    }
  }

  /** Un zombi de la operación guardado: [tipo, x, y, vida, va por el objetivo, guardia]. */
  restoreZombie(game: GameHost, row: any[]) {
    const op = this.op;
    if (!op || !Array.isArray(row)) return;
    const [t, x, y, hp, goal, guard] = row;
    if (!(ZOMBIES as Record<string, unknown>)[t]) return;
    const z = game.horde.spawn(t, x, y, op.hpK, op.spK);
    z.hp = Math.min(Number(hp) || z.maxHp, z.maxHp);
    z.op = op.id;
    if (goal) z.goal = (OP_DEFS[op.kind] as any).goalFor?.(op) ?? null;
    if (guard) z.guard = true;
  }

  /** Los zombis de la operación para guardar. */
  saveZombies(game: GameHost) {
    const op = this.op;
    if (!op) return [];
    return game.horde.list
      .filter((z: any) => !z.dead && z.op === op.id)
      .map((z: any) => [z.type, Math.round(z.x), Math.round(z.y), Math.ceil(z.hp), z.goal ? 1 : 0, z.guard ? 1 : 0]);
  }
}

/** Lo que se ve de las operaciones: en línea llega con la foto; si no, sale de game.ops. */
export function opsView(game: GameHost): any {
  if (game.mode?.viaServer?.()) return game.opsNet || null;
  return game.ops ? game.ops.view() : null;
}

/**
 * ¿No se puede construir en ese rectángulo? Sale de lo que se ve, así que el servidor y la predicción
 * del cliente dicen lo mismo: el camión y el anillo para usarlo, todo el área del nido (nadie puede cerrar
 * la salida) y el centro del punto de entrega y los cargamentos en el suelo.
 */
export function viewForbids(v: any, x: number, y: number, w: number, h: number) {
  const op = v?.op;
  if (!op || op.s === 'resolve') return false;
  const rects: number[][] = [];
  if (op.k === 'convoy' && op.ob) rects.push([op.ob[0] - 48, op.ob[1] - 48, op.ob[2] + 96, op.ob[3] + 96]);
  if (op.k === 'nest' && !op.bl) rects.push([op.x - op.R, op.y - op.R, op.R * 2, op.R * 2]);
  if (op.k === 'supply') {
    if (op.dz) {
      const r = op.dz[2] * 0.6;
      rects.push([op.dz[0] - r, op.dz[1] - r, r * 2, r * 2]);
    }
    for (const c of op.cr || []) if (c[3] < 0 && !c[4]) rects.push([c[1] - 26, c[2] - 26, 52, 52]);
  }
  return rects.some(([rx, ry, rw, rh]) => x < rx + rw && x + w > rx && y < ry + rh && y + h > ry);
}

/** Segundos del regreso a oscuras (0..1) para el fundido. */
export function fadeOf(v: any) {
  const op = v?.op;
  if (!op || op.s !== 'resolve') return 0;
  const k = 1 - op.ot / OPS.outT;
  return k < 0.35 ? k / 0.35 : k < 0.65 ? 1 : (1 - k) / 0.35;
}
