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
import { BOSSES, ESCAPE, ESCAPE_ROUTE, ESCAPE_STOPS, EVENTS } from '../core/config.ts';
import type { EventDef } from '../core/config.ts';
import { rand, TAU } from '../core/util.ts';
import type { GameHost, Zombie } from '../core/types.d.ts';
import { spawnBoss } from './bosses.ts';
import { waveCounts } from './director.ts';
import { GOAL_TYPES, makeGoal, type Goal } from './ops/common.ts';
import type { Player } from './player.ts';
import { isFinal, makeRoute, type Route, type RouteNode } from './route.ts';

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

/** Una mejora a elegir para un jugador (gancho escapePick en línea; en solitario, bonusPicks). */
function pick(game: GameHost, src: string, p: Player | null) {
  if (game.escapePick) return game.escapePick(src, p);
  game.bonusPicks?.push(src);
}

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

  constructor() {
    this.route = null;
    this.at = 0;
    this.visited = [];
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
    return ESCAPE.need + Math.floor((this.stop - 1) / ESCAPE_ROUTE.needEvery);
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
    if (this.stop > 1) for (const pl of all) if (pl.alive) pl.hp += (pl.stats.maxHp - pl.hp) * ESCAPE_ROUTE.restHeal;
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
    const van: Van = { x: rx, y: ry, w: V.w, h: V.h, hp: V.hp, max: V.hp, hitT: 0, drive: 0 };
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
        ? `¡El puente! Junta ${this.need} bidones y cruza`
        : ev
          ? `${ev.name}: ${ev.desc.toLowerCase()}`
          : `Junta ${this.need} bidones de combustible y vuelve a la camioneta`,
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
    const kinds = [...ESCAPE.guardTypes].sort(() => Math.random() - 0.5);
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
    const k = this.phase === 'ready' ? ESCAPE.readyDmg : 1;
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
  prompt(game: GameHost, p: Player | null = game.player): { text: string; prog: number } | null {
    if (!this.active || !p?.alive || p.inVan) return null;
    if (this.phase === 'search' && this.have >= this.need && this.nearVan(game, 48, p))
      return { text: 'Cargar combustible', prog: this.holdT / ESCAPE.startT };
    if (this.phase === 'ready' && !this.bossAlive && this.nearVan(game, ESCAPE.boardReach, p))
      return { text: 'Subir a la camioneta', prog: this.holdT / ESCAPE.boardT };
    return null;
  }

  update(dt: number, game: GameHost) {
    if (!this.active) return;
    const van = this.van!;
    this.phaseT += dt;
    van.hitT = Math.max(0, van.hitT - dt);
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
    const holder = ps.find((q) => q.use && this.prompt(game, q));
    if (holder) this.holdT += dt;
    else this.holdT = 0;
    if (this.phase === 'search' && holder && this.holdT >= ESCAPE.startT) this.startFuel(game);
    else if (this.phase === 'ready' && holder && this.holdT >= ESCAPE.boardT) this.board(game);
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

  /** Un jugador recoge un bidón. */
  takeCan(c: Can, p: Player, game: GameHost) {
    c.taken = true;
    this.have++;
    game.particles.pickupFx(c.x, c.y, '#f0b030');
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
  e.active = true;
  return e.seedFor();
}
