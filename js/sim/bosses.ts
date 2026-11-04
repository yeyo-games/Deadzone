// Jefes: uno cada BOSS.every oleadas (BOSS_ORDER, fichas en BOSSES). Aquí su cabeza: elige un ataque de
// su lista, lo avisa en el suelo y lo ejecuta según su tipo (ver BossAtk en config); fases y furia,
// partes que se rompen, zonas que dejan, piedras que lanzan, el daño que reciben (bossDamage, desde
// combat.ts) y lo que se dibuja y viaja en la foto (bossFx, bossStatus). Lo usan el juego local y el
// servidor; el dibujo está en render/bosses.js.
//
// Estados (z.bs): walk (camina con la horda y elige ataque) → windup (prepara z.atk, con su aviso) →
// charge (embestida) · act (golpes seguidos o succión) · under (bajo tierra) · leap (en el aire) →
// recover (se repone; puede quedar expuesto) → walk.
import { BOSS, BOSS_ORDER, BOSS_ZONE_ORDER, BOSS_ZONES, BOSSES, ZOMBIES } from '../core/config.ts';
import type { BossAtk, BossDef } from '../core/config.ts';
import { angleTo, clamp, rand, TAU } from '../core/util.ts';
import type { GameHost, Zombie } from '../core/types.d.ts';
import type { Block } from './build.ts';
import type { Player } from './player.ts';
import type { Horde } from './zombies.ts';
import type { Obstacle } from './world.ts';

/** Lo que golpea un ataque al caer (anillo, línea o piedra). */
type Hit = Pick<BossAtk, 'hit' | 'push' | 'block' | 'slowK' | 'slowT' | 'root' | 'zone'>;
/** Piedra (o lo que sea) en el aire: sale de (x0, y0) y cae en (x, y) cuando t llega a dur. */
export interface Lob extends Hit {
  x0: number;
  y0: number;
  x: number;
  y: number;
  t: number;
  dur: number;
  r: number;
  by: Zombie;
}
/** Zona en el suelo: hace daño y frena a quien esté dentro desde arm s hasta life s. */
export interface Zone {
  x: number;
  y: number;
  r: number;
  t: number;
  life: number;
  arm: number;
  kind: string;
}
/** Un zombi caído hace poco (para la resurrección del Rey). */
export interface Fallen {
  type: string;
  x: number;
  y: number;
  t: number;
}

/** Avisos y cosas en el suelo: anillo · franja · piedra en el aire · zona · lanzando un hechizo. */
export const FX_RING = 1;
export const FX_LINE = 2;
export const FX_LOB = 3;
export const FX_ZONE = 4;
export const FX_CAST = 5;
/** Números por fila de bossFx: tipo, x, y, radio o largo, ángulo (o zona), t, dur, extra (ancho, armado u origen), y0. */
export const FX_N = 9;
/** Números por jefe en bossStatus: tipo, vida en milésimas, fase, piel dura, furia, ataque + 1, parte en %, bajo tierra, oculto. */
export const STATUS_N = 9;
/** Segundos que una zona avisa antes de hacer daño. */
const ARM = 0.8;

export const isBoss = (z: Pick<Zombie, 'def'>) => !!z.def?.boss;
const defOf = (z: Zombie): BossDef | undefined => BOSSES[z.type];

/** El jefe de la oleada w, o null. Tras el último, la lista vuelve a empezar. */
export function bossFor(w: number) {
  if (w <= 0 || w % BOSS.every) return null;
  return BOSS_ORDER[(w / BOSS.every - 1) % BOSS_ORDER.length];
}
/** Vueltas completas a la lista antes de la oleada w (cada una hace al jefe más duro). */
export const bossLoop = (w: number) => Math.floor((Math.max(1, w / BOSS.every) - 1) / BOSS_ORDER.length);

/** 0 normal, 1 enfurecido, 2 desesperado. */
export function bossPhase(z: Pick<Zombie, 'hp' | 'maxHp'>) {
  const k = z.hp / z.maxHp;
  return k > BOSS.rage ? 0 : k > BOSS.despair ? 1 : 2;
}

/** Multiplicador de vida del jefe (BOSS.hp) según cuántos juegan (n) y la vuelta a la lista (loop). */
export const bossHp = (n: number, loop = 0) => BOSS.hp * (1 + BOSS.perPlayer * Math.max(0, n - 1)) * BOSS.loop ** loop;

/** Cuántos juegan esta partida: los del servidor o uno solo. */
export const playersIn = (game: GameHost) => game.targets?.length || (game.mode?.inGroup() ? 2 : 1);

/** Hace aparecer al jefe type en (x, y) con la vida que le toca a este grupo (loop: vueltas a la lista). */
export function spawnBoss(game: GameHost, type: string, x: number, y: number, loop = 0) {
  const z = game.horde.spawn(type, x, y, bossHp(playersIn(game), loop), 1);
  const B = BOSSES[type];
  z.cd = 3;
  z.speed0 = z.speed;
  z.acds = {};
  // las de espera propia empiezan a medio cargar (no todo a la vez al llegar)
  for (const a of B?.atk || []) if (a.cd) z.acds[a.id] = a.cd * rand(0.3, 0.7);
  if (B?.part) z.partHp = z.partMax = z.maxHp * B.part.hp;
  z.partK = 1;
  z.dmgK = BOSS.dmg;
  return z;
}

// Todos los que pueden recibir golpes: los jugadores del servidor o el de este equipo.
const targetsOf = (game: GameHost): Player[] => (game.targets as Player[]) || (game.player ? [game.player] : []);

/** ¿Ya se rompió su parte? */
const partBroken = (z: Zombie) => !!defOf(z)?.part && !(z.partHp > 0);
/** ¿Puede hacer este ataque? (la parte rota apaga algunos). */
const canUse = (z: Zombie, a: BossAtk) => !(partBroken(z) && defOf(z)?.part?.off?.includes(a.id));

/** Cuánto del daño de una bala (o explosión) le entra; también le pega a su parte rompible. */
export function bossDamage(z: Zombie, b: { dx: number; dy: number; dmg?: number; blast?: boolean }) {
  const B = defOf(z);
  if (!B) return 1;
  if (z.under) return 0;
  const dot = b.dx * Math.cos(z.angle) + b.dy * Math.sin(z.angle);
  // por la espalda: la bala viaja hacia donde él mira; de frente, al revés
  const back = dot > 0.35;
  const front = dot < -0.35;
  let k = 1;
  if (back && B.back) {
    k *= B.back;
    z.backT = 0.2;
  }
  if (front && B.front !== undefined) {
    k *= B.front;
    z.blockT = 0.15;
  }
  if (z.selfA?.dmg) k *= z.selfA.dmg;
  if (z.vulnT > 0) k *= z.vulnK || 1;
  const a = z.bs === 'windup' ? z.atk : null;
  if (a?.vuln) k *= a.vuln;
  k *= z.furyDmg || 1;
  k *= z.partK || 1;
  const P = B.part;
  if (P && z.partHp > 0 && (P.from === 'any' || (P.from === 'back' && back) || (P.from === 'front' && front))) {
    const before = z.partHp;
    z.partHp -= (b.dmg || 0) * k * P.share;
    z.partHitT = 0.2;
    const step = z.partMax / (P.segs || 1);
    // cuántos tramos se rompieron con este golpe
    const was = Math.ceil(before / step);
    const now = Math.max(0, Math.ceil(z.partHp / step));
    if (now < was) z.partEvt = (z.partEvt || 0) + (was - now);
  }
  // las explosiones aturden a quien no las aguanta (la Cazadora)
  if (b.blast && B.stagger && z.bs === 'walk') {
    z.bs = 'recover';
    z.bt = B.stagger;
    z.tk = 0;
  }
  return k;
}

/**
 * Golpe en un círculo (r) o lo que caiga ahí: a cada jugador vivo dentro le quita hit (por el hambre
 * del jefe), lo avienta push desde el centro (negativo: lo atrae), lo frena o lo deja quieto; a las
 * barricadas les quita block y, si zone, deja una zona.
 */
export function areaHit(game: GameHost, h: Horde, z: Zombie, x: number, y: number, r: number, a: Hit, cause: string) {
  for (const p of targetsOf(game)) {
    if (!p.alive) continue;
    const dx = p.x - x;
    const dy = p.y - y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > r + p.r) continue;
    hurt(game, z, p, a, dx / d, dy / d, cause);
  }
  if (a.block) for (const b of blocksIn(game, x, y, r)) game.structures.damageBlock(game, b, a.block);
  if (a.zone) addZone(h, a.zone, x, y, r * 0.75, 5);
}

function hurt(game: GameHost, z: Zombie, p: Player, a: Hit, nx: number, ny: number, cause: string) {
  p.lastHit = cause;
  if (a.hit) {
    p.hurt(a.hit * (z.dmgK || 1), game);
    game.onZombieHit(z, p);
  }
  if (a.push) {
    p.kx += nx * a.push;
    p.ky += ny * a.push;
  }
  if (a.root) slow(p, 0, a.root);
  else if (a.slowK !== undefined && a.slowT) slow(p, a.slowK, a.slowT);
}

/** Frena al jugador a k de su velocidad durante t s (0: quieto); gana el freno más fuerte. */
export function slow(p: Player, k: number, t: number) {
  if (!((p.slowT || 0) > 0) || k <= (p.slowK ?? 1)) p.slowK = k;
  p.slowT = Math.max(p.slowT || 0, t);
}

const blocksIn = (game: GameHost, x: number, y: number, r: number) =>
  game.structures.blocks.filter((b) => {
    const bx = clamp(x, b.x, b.x + b.w) - x;
    const by = clamp(y, b.y, b.y + b.h) - y;
    return bx * bx + by * by < r * r;
  });

/** La barricada más cercana a (x, y) a menos de max px, o la más dura si strong. */
function pickBlock(game: GameHost, x: number, y: number, max: number, strong: boolean) {
  let best: Block | null = null;
  let score = Number.POSITIVE_INFINITY;
  for (const b of game.structures.blocks) {
    if (b.tempT !== undefined) continue;
    const d = Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y);
    if (d > max) continue;
    const s = strong ? -b.hp + d * 0.01 : d;
    if (s < score) {
      score = s;
      best = b;
    }
  }
  return best;
}

export function addZone(h: Horde, kind: string, x: number, y: number, r: number, life: number, arm = ARM) {
  if (h.zones.length > 60) h.zones.shift();
  h.zones.push({ x, y, r, t: 0, life, arm, kind });
}

/** Aviso en el suelo del ataque que prepara: tipo, dónde, radio (o largo), ángulo y ancho. */
function telegraph(z: Zombie, k: number, x: number, y: number, r: number, a = 0, w = 0) {
  z.tk = k;
  z.tx = x;
  z.ty = y;
  z.tr = r;
  z.ta = a;
  z.tw = w;
}

// Velocidad y ritmo de golpe según la furia, lo que se hizo a sí mismo y la parte rota.
function refresh(z: Zombie) {
  const B = defOf(z);
  if (!B) return;
  const f = z.fury && B.fury;
  const s = z.selfA;
  const pb = partBroken(z) && B.part?.speed;
  z.speed = (z.speed0 || z.speed) * (f ? f.speed : 1) * (s?.speed || 1) * (pb || 1);
  z.atkK = (f ? f.rate : 1) * (s?.rate || 1);
}

/**
 * La cabeza del jefe en cada paso (desde Horde.update). Devuelve true si este paso controla él su
 * movimiento; false: camina con la horda.
 */
export function bossThink(h: Horde, z: Zombie, p: Player, d: number, dt: number, game: GameHost) {
  const B = defOf(z);
  if (!B) return false;
  z.bt -= dt;
  z.cd -= dt;
  z.vulnT = (z.vulnT || 0) - dt;
  z.backT = (z.backT || 0) - dt;
  for (const id in z.acds) z.acds[id] -= dt;
  passives(h, z, B, dt, game);
  if (z.bs === 'walk') {
    z.tk = 0;
    if (z.selfA?.still) return true;
    if (z.cd > 0 || !p.alive || z.air > 0) return false;
    return choose(h, z, B, p, d, game);
  }
  if (z.bs === 'windup') return windingUp(h, z, p, dt, game);
  if (z.bs === 'charge') return charging(z, p, game, h);
  if (z.bs === 'act') return acting(h, z, p, dt, game);
  if (z.bs === 'under') return underground(h, z, p, dt, game);
  if (z.bs === 'leap') return leaping(h, z, game);
  if (z.bs === 'recover') {
    if (z.bt <= 0) z.bs = 'walk';
    return true;
  }
  z.bs = 'walk';
  return false;
}

// Lo que pasa solo: furia, hambre, rastro, aura, enjambre, efectos que terminan y partes rotas.
function passives(h: Horde, z: Zombie, B: BossDef, dt: number, game: GameHost) {
  const k = z.hp / z.maxHp;
  if (B.fury && !z.fury && k <= B.fury.at) {
    z.fury = true;
    z.furyDmg = B.fury.dmg || 1;
    z.waitK = B.fury.wait || 1;
    refresh(z);
    if (B.fury.summon) summon(game, z, B.fury.summon.n, B.fury.summon.types, 'self', nearest(game, z));
    game.particles.ring(z.x, z.y, z.r * 1.6, '255,150,80');
    game.camera.shake(0.6, z.x, z.y);
    game.sfx.bullRoar();
    game.banner(`¡${B.name} enfurece!`, 'Es su última fase: cuidado');
  }
  if (B.hunger) z.dmgK = BOSS.dmg * (1 + Math.floor((1 - k) / B.hunger.step) * B.hunger.dmg);
  if (z.selfA) {
    z.selfT -= dt;
    if (z.selfA.aura) {
      z.auraT = (z.auraT || 0) - dt;
      if (z.auraT <= 0) {
        z.auraT = 0.3;
        addZone(h, z.selfA.aura, z.x, z.y, z.r + 20, 2.5, 0.2);
      }
    }
    if (z.selfT <= 0) {
      const a = z.selfA;
      z.selfA = null;
      refresh(z);
      // tras la sobrecarga queda quieto y expuesto
      if (a.after) recover(z, a.after, a.vuln);
    }
  }
  if (B.trail && z.bs !== 'under' && z.bs !== 'leap') {
    z.trailT = (z.trailT || 0) - dt;
    if (z.trailT <= 0) {
      z.trailT = B.trail.every;
      const bx = z.x - Math.cos(z.angle) * z.r;
      const by = z.y - Math.sin(z.angle) * z.r;
      addZone(h, B.trail.kind, bx, by, B.trail.r, B.trail.life, 0.4);
    }
  }
  if (B.swarm && k <= B.swarm.at) {
    z.swarmT = (z.swarmT ?? 0) - dt;
    if (z.swarmT <= 0) {
      z.swarmT = B.swarm.every;
      summon(game, z, B.swarm.n, B.swarm.types, 'self', nearest(game, z));
    }
  }
  if (z.partEvt) partBreak(h, z, B, game);
}

// Se rompió (un tramo de) su parte.
function partBreak(h: Horde, z: Zombie, B: BossDef, game: GameHost) {
  const n = z.partEvt;
  z.partEvt = 0;
  const P = B.part!;
  game.particles.ring(z.x, z.y, z.r * 1.3, '255,230,140');
  game.camera.shake(0.5, z.x, z.y);
  game.sfx.blockBreak();
  if (P.segs) {
    // cada núcleo roto lo debilita y calma a la horda
    z.partK = (z.partK || 1) * (P.dmg || 1) ** n;
    for (const o of h.list) o.buffT = 0;
    const left = Math.max(0, Math.ceil(z.partHp / (z.partMax / P.segs)));
    game.banner(
      left ? `${P.name}: ${P.segs - left} de ${P.segs}` : `¡${P.name} destruida!`,
      'Recibe más daño y la horda se calma',
    );
    return;
  }
  if (P.dmg) z.partK = (z.partK || 1) * P.dmg;
  refresh(z);
  game.banner(`¡${P.name} destruida!`, P.speed ? 'Camina más lento' : 'Ya no puede usar algunos ataques');
}

// El jugador vivo más cercano al jefe (para lo que hace por su cuenta).
function nearest(game: GameHost, z: Zombie) {
  let best: Player | null = null;
  let bd = Number.POSITIVE_INFINITY;
  for (const p of targetsOf(game)) {
    const d = Math.hypot(p.x - z.x, p.y - z.y);
    if (p.alive && d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

// Elige un ataque (al azar con su peso) entre los que tocan y empieza a prepararlo.
function choose(h: Horde, z: Zombie, B: BossDef, p: Player, d: number, game: GameHost) {
  const ph = bossPhase(z);
  z.cd = rand(B.wait[0], B.wait[1]) * BOSS.cd[ph] * (z.waitK || 1);
  const ok = B.atk.filter((a) => {
    if (!canUse(z, a) || (z.acds[a.id] || 0) > 0 || ph < (a.phase || 0)) return false;
    if (a.k === 'self' && z.selfA) return false;
    if (a.at === 'block' || a.at === 'strong') return !!pickBlock(game, z.x, z.y, a.max || 600, a.at === 'strong');
    if (a.k === 'revive') return h.fallen.length > 3;
    return d >= (a.min || 0) && d <= (a.max ?? Number.POSITIVE_INFINITY);
  });
  if (!ok.length) {
    z.cd = 0.4;
    return false;
  }
  let w = ok.reduce((s, a) => s + (a.w || 1), 0) * Math.random();
  let a = ok[0];
  for (const q of ok) {
    w -= q.w || 1;
    if (w <= 0) {
      a = q;
      break;
    }
  }
  if (a.cd) z.acds[a.id] = a.cd;
  z.angle = Math.atan2(p.y - z.y, p.x - z.x);
  z.bs = 'windup';
  z.atk = a;
  z.ai = B.atk.indexOf(a);
  z.bt = a.windup;
  z.tdur = a.windup;
  z.tk = 0;
  z.tb = null;
  // dónde avisa: lo que no sigue al jugador se fija ahora
  if ((a.k === 'ring' || a.k === 'leap' || (a.k === 'lob' && a.n === 1)) && a.at !== 'self' && a.at !== 'front') {
    if (a.at === 'block' || a.at === 'strong') {
      const b = pickBlock(game, z.x, z.y, a.max || 600, a.at === 'strong')!;
      z.tb = b;
      telegraph(z, FX_RING, b.x + b.w / 2, b.y + b.h / 2, a.r!);
    } else telegraph(z, FX_RING, ...lead(p, a.windup * 0.5), a.r!);
  } else if (a.k === 'ring' && a.at === 'self') telegraph(z, FX_RING, z.x, z.y, a.r!);
  else if (a.k === 'zone' && a.at !== 'around') {
    const [x, y] = a.at === 'self' ? [z.x, z.y] : [p.x, p.y];
    telegraph(z, FX_RING, x, y, a.r!);
  } else if (a.k === 'walls') {
    if (a.kind === 'cage') telegraph(z, FX_RING, p.x, p.y, 110);
    else telegraph(z, FX_CAST, z.x, z.y, z.r * 1.8);
  } else if (a.k === 'pull' || a.k === 'emp') telegraph(z, FX_CAST, z.x, z.y, a.r!);
  else if (a.k !== 'charge' && a.k !== 'line' && a.k !== 'ring') telegraph(z, FX_CAST, z.x, z.y, z.r * 1.8);
  game.sfx.bullRoar();
  return true;
}

// Un poco adelante de donde va el jugador.
const lead = (p: Player, t: number): [number, number] => [p.x + (p.vx || 0) * t, p.y + (p.vy || 0) * t];

function windingUp(h: Horde, z: Zombie, p: Player, dt: number, game: GameHost) {
  const a = z.atk as BossAtk;
  z.anim += dt * 3;
  const aim = z.bt > z.tdur * 0.35;
  if (a.k === 'charge' || a.k === 'line') {
    // apunta mientras toma vuelo y fija el rumbo en el último tercio
    if (aim) z.angle = angleTo(z.angle, Math.atan2(p.y - z.y, p.x - z.x), 5 * dt);
    const len = a.k === 'charge' ? a.speed! * a.time! * 0.75 * (a.dashes ? 0.6 : 1) : a.len!;
    telegraph(z, FX_LINE, z.x, z.y, len, z.angle, a.k === 'charge' ? z.r + 4 : a.wid! / 2);
    if (Math.random() < dt * 12) game.particles.dust(z.x - Math.cos(z.angle) * z.r, z.y - Math.sin(z.angle) * z.r, 5);
  } else if (a.k === 'ring' && a.at === 'front') {
    if (aim) z.angle = angleTo(z.angle, Math.atan2(p.y - z.y, p.x - z.x), 5 * dt);
    telegraph(z, FX_RING, ...frontOf(z, a.r!), a.r!);
  } else if (z.tk === FX_CAST || (z.tk === FX_RING && a.at === 'self')) {
    z.tx = z.x;
    z.ty = z.y;
  } else if (z.tk === FX_RING) z.angle = angleTo(z.angle, Math.atan2(z.ty - z.y, z.tx - z.x), 4 * dt);
  else z.angle = angleTo(z.angle, Math.atan2(p.y - z.y, p.x - z.x), 4 * dt);
  if (z.bt > 0) return true;
  fire(h, z, a, p, game);
  return true;
}

const frontOf = (z: Zombie, r: number): [number, number] => [
  z.x + Math.cos(z.angle) * (z.r + r * 0.6),
  z.y + Math.sin(z.angle) * (z.r + r * 0.6),
];

// Los tipos de pieza que la pulsación electromagnética apaga.
const ELECTRIC: Record<string, boolean> = { turret: true, heavy: true, military: true };

// Ejecuta el ataque preparado.
function fire(h: Horde, z: Zombie, a: BossAtk, p: Player, game: GameHost) {
  const cause = `boss_${a.id}`;
  const tx = z.tx;
  const ty = z.ty;
  z.tk = 0;
  z.lunge = 1;
  switch (a.k) {
    case 'charge':
      z.bs = 'charge';
      z.bt = a.time!;
      z.dashLeft = (a.dashes || 1) - 1;
      z.cdx = Math.cos(z.angle);
      z.cdy = Math.sin(z.angle);
      z.chargeId = (z.chargeId || 0) + 1;
      game.sfx.bullCharge();
      return;
    case 'ring':
      z.hits = (a.n || 1) - 1;
      ringAt(h, z, a, tx, ty, game, cause);
      if (z.hits > 0) {
        z.bs = 'act';
        z.bt = a.gap || 0.4;
        return;
      }
      return recover(z, 0.5);
    case 'lob':
      throwLobs(h, z, a, p, tx, ty, game);
      return recover(z, 0.4);
    case 'line':
      lineHit(h, z, a, game, cause);
      return recover(z, 0.5);
    case 'summon':
      summon(game, z, a.n!, a.types!, a.at || 'self', p);
      game.particles.ring(z.x, z.y, z.r * 2, '170,110,200');
      return recover(z, 0.6);
    case 'buff':
      for (const o of h.list) {
        if (o === z || o.dead || o.def.boss) continue;
        if (a.r && Math.hypot(o.x - z.x, o.y - z.y) > a.r) continue;
        o.buffT = a.time!;
        o.buffK = a.speed || 1;
        o.buffRes = a.res ?? 1;
      }
      game.particles.ring(z.x, z.y, a.r || 600, '255,90,60');
      game.sfx.wave();
      return recover(z, 0.5);
    case 'self':
      z.selfA = a;
      z.selfT = a.time!;
      refresh(z);
      game.particles.ring(z.x, z.y, z.r * 1.4, a.dmg !== undefined && a.dmg < 1 ? '170,200,230' : '255,170,90');
      game.sfx.blockHit();
      return recover(z, 0.2);
    case 'zone':
      makeZones(h, z, a, p, tx, ty);
      return recover(z, 0.4);
    case 'burrow':
      z.bs = 'under';
      z.under = true;
      z.bt = a.time!;
      game.particles.dust(z.x, z.y, 30);
      game.camera.shake(0.4, z.x, z.y);
      return;
    case 'leap':
      z.bs = 'leap';
      z.bt = a.time!;
      z.lx0 = z.x;
      z.ly0 = z.y;
      z.tx = tx;
      z.ty = ty;
      z.tk = FX_RING;
      z.tdur = a.time!;
      return;
    case 'pull':
      z.bs = 'act';
      z.bt = a.time!;
      return;
    case 'emp':
      for (const b of game.structures.blocks) {
        if (!ELECTRIC[b.kind] || Math.hypot(b.x + b.w / 2 - z.x, b.y + b.h / 2 - z.y) > a.r!) continue;
        b.empT = a.time!;
        game.particles.ring(b.x + b.w / 2, b.y + b.h / 2, 40, '120,190,255');
      }
      game.particles.ring(z.x, z.y, a.r!, '120,190,255');
      game.sfx.miniBoom();
      return recover(z, 0.5);
    case 'walls':
      game.structures.addTemp(game, walls(z, a, p), a.life!);
      game.sfx.bullSlam(false);
      return recover(z, 0.5);
    case 'revive': {
      const now = game.time || 0;
      const list = h.fallen.filter((f) => now - f.t < 25).slice(-a.n!);
      h.fallen = h.fallen.filter((f) => !list.includes(f));
      const k = (game.director?.hpMult ?? 1) * 0.5;
      for (const f of list) {
        const o = h.spawn(f.type, f.x, f.y, k, game.director?.speedMult ?? 1);
        o.spawnT = 0.6;
        game.particles.ring(f.x, f.y, 24, '160,80,200');
      }
      game.sfx.wave();
      return recover(z, 0.6);
    }
  }
  recover(z, 0.3);
}

function ringAt(h: Horde, z: Zombie, a: BossAtk, tx: number, ty: number, game: GameHost, cause: string) {
  let x = tx;
  let y = ty;
  if (a.at === 'self') [x, y] = [z.x, z.y];
  else if (a.at === 'front') [x, y] = frontOf(z, a.r!);
  else if ((a.at === 'block' || a.at === 'strong') && z.tb) [x, y] = [z.tb.x + z.tb.w / 2, z.tb.y + z.tb.h / 2];
  areaHit(game, h, z, x, y, a.r!, a, cause);
  game.particles.ring(x, y, a.r!, a.zone ? BOSS_ZONES[a.zone].col : '210,180,140');
  game.particles.dust(x, y, 18);
  game.camera.shake(Math.min(1, 0.3 + a.r! / 400), x, y);
  game.sfx.bullSlam(a.r! > 150);
}

function throwLobs(h: Horde, z: Zombie, a: BossAtk, p: Player, tx: number, ty: number, game: GameHost) {
  const n = a.n || 1;
  for (let i = 0; i < n; i++) {
    let x: number;
    let y: number;
    if (a.at === 'radial') {
      const ang = (i / n) * TAU + rand(-0.2, 0.2);
      const d = (a.spread || 250) * rand(0.8, 1.2);
      x = z.x + Math.cos(ang) * d;
      y = z.y + Math.sin(ang) * d;
    } else if (n === 1) {
      x = tx ?? p.x;
      y = ty ?? p.y;
    } else {
      const s = a.spread || 0;
      x = p.x + (i ? rand(-s, s) : 0);
      y = p.y + (i ? rand(-s, s) : 0);
    }
    const x0 = z.x + Math.cos(z.angle) * z.r;
    const y0 = z.y + Math.sin(z.angle) * z.r;
    const lob: Lob = {
      x0,
      y0,
      x,
      y,
      t: 0,
      dur: (a.fly || 1) * (n > 1 ? rand(0.85, 1.15) : 1),
      r: a.r!,
      by: z,
      hit: a.hit,
      push: a.push,
      block: a.block,
      zone: a.zone,
    };
    h.lobs.push(lob);
  }
  game.particles.debris(z.x + Math.cos(z.angle) * z.r, z.y + Math.sin(z.angle) * z.r, 16, 'rock');
  game.sfx.punch();
}

// Golpe en línea recta desde su borde hacia donde mira.
function lineHit(h: Horde, z: Zombie, a: BossAtk, game: GameHost, cause: string) {
  const ux = Math.cos(z.angle);
  const uy = Math.sin(z.angle);
  const sx = z.x + ux * z.r * 0.6;
  const sy = z.y + uy * z.r * 0.6;
  const half = a.wid! / 2;
  for (const p of targetsOf(game)) {
    if (!p.alive) continue;
    const t = (p.x - sx) * ux + (p.y - sy) * uy;
    const off = Math.abs((p.x - sx) * -uy + (p.y - sy) * ux);
    if (t < -p.r || t > a.len! + p.r || off > half + p.r) continue;
    hurt(game, z, p, a, ux, uy, cause);
  }
  const hitB = new Set<Block>();
  for (let s = 0; s <= a.len!; s += 30) {
    const x = sx + ux * s;
    const y = sy + uy * s;
    if (a.block) for (const b of blocksIn(game, x, y, half)) hitB.add(b);
    if (s % 90 === 0) {
      game.particles.dust(x, y, 4);
      if (a.zone && s > 0) addZone(h, a.zone, x, y, Math.max(40, half), 5);
    }
  }
  for (const b of hitB) game.structures.damageBlock(game, b, a.block!);
  const col = a.zone ? BOSS_ZONES[a.zone].col : '230,210,180';
  game.particles.ring(sx + (ux * a.len!) / 2, sy + (uy * a.len!) / 2, half + 10, col);
  game.camera.shake(0.4, z.x, z.y);
  game.sfx.bullHit();
}

/** n zombis de types junto al jefe (at 'self') o junto al jugador (at 'target'). */
export function summon(game: GameHost, z: Zombie, n: number, types: string[], at: string, p: Player | null) {
  const cx = at === 'target' && p ? p.x : z.x;
  const cy = at === 'target' && p ? p.y : z.y;
  const near = at === 'target' ? 260 : z.r + 40;
  const far = at === 'target' ? 420 : z.r + 180;
  const hpK = game.director?.hpMult ?? 1;
  const spK = game.director?.speedMult ?? 1;
  // nunca dentro de una base (salvo que el jefe ya esté dentro y los llame a su lado)
  const fence = at === 'target' || !game.world.inBase(cx, cy);
  for (let i = 0; i < n; i++) {
    const type = types[i % types.length];
    const rr = (ZOMBIES as Record<string, { radius: number }>)[type]?.radius ?? 14;
    for (let t = 0; t < 12; t++) {
      const ang = rand(0, TAU);
      const d = rand(near, far);
      const x = cx + Math.cos(ang) * d;
      const y = cy + Math.sin(ang) * d;
      if (game.world.pointBlocked(x, y, rr + 2) || (fence && game.world.baseSpot(x, y))) continue;
      const o = game.horde.spawn(type, x, y, hpK, spK);
      o.spawnT = 0.5;
      if (i % 3 === 0) game.particles.dust(x, y, 8);
      break;
    }
  }
}

function makeZones(h: Horde, z: Zombie, a: BossAtk, p: Player, tx: number, ty: number) {
  for (let i = 0; i < (a.n || 1); i++) {
    let x = z.x;
    let y = z.y;
    if (a.at === 'target') [x, y] = [tx ?? p.x, ty ?? p.y];
    else if (a.at === 'around') {
      const s = a.spread || 200;
      x = p.x + (i ? rand(-s, s) : 0);
      y = p.y + (i ? rand(-s, s) : 0);
    }
    addZone(h, a.kind!, x, y, a.r!, a.life!);
  }
}

// Dónde van los bloques temporales: en anillo alrededor del jugador ('cage') o en fila entre los dos ('wall').
function walls(z: Zombie, a: BossAtk, p: Player) {
  const out: [number, number][] = [];
  const n = a.n || 6;
  if (a.kind === 'cage') {
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU;
      out.push([p.x + Math.cos(ang) * 95, p.y + Math.sin(ang) * 95]);
    }
    return out;
  }
  const ang = Math.atan2(p.y - z.y, p.x - z.x);
  const mx = (z.x + p.x) / 2;
  const my = (z.y + p.y) / 2;
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * 42;
    out.push([mx - Math.sin(ang) * o, my + Math.cos(ang) * o]);
  }
  return out;
}

function charging(z: Zombie, p: Player, game: GameHost, h: Horde) {
  const a = z.atk as BossAtk;
  const dt = h.dt;
  const sp = a.speed! * (z.fury ? 1.15 : 1);
  z.x += z.cdx * sp * dt;
  z.y += z.cdy * sp * dt;
  z.anim += (sp * dt) / (z.r * 0.55);
  if (Math.random() < dt * 24) game.particles.dust(z.x - z.cdx * z.r, z.y - z.cdy * z.r, 6);
  plow(h, z);
  // atropella a cada jugador una sola vez por embestida
  const mark = z.id * 1000 + z.chargeId;
  for (const q of targetsOf(game)) {
    if (!q.alive || q.bossHit === mark) continue;
    if (Math.hypot(q.x - z.x, q.y - z.y) > z.r + q.r + 6) continue;
    q.bossHit = mark;
    const side = (q.x - z.x) * -z.cdy + (q.y - z.y) * z.cdx >= 0 ? 1 : -1;
    hurt(game, z, q, { hit: a.hit }, 0, 0, `boss_${a.id}`);
    q.kx += (z.cdx * 0.8 - z.cdy * side * 0.6) * (a.throw || 0);
    q.ky += (z.cdy * 0.8 + z.cdx * side * 0.6) * (a.throw || 0);
    game.camera.shake(0.75, q.x, q.y);
    game.sfx.bullHit();
  }
  if (z.bt > 0) return true;
  if (z.dashLeft > 0) {
    // ataque relámpago: otra embestida corta, desviada
    z.dashLeft--;
    const ang = Math.atan2(p.y - z.y, p.x - z.x) + rand(-1, 1) * (a.spread || 0.5);
    z.angle = ang;
    z.cdx = Math.cos(ang);
    z.cdy = Math.sin(ang);
    z.bt = a.time!;
    z.chargeId++;
    return true;
  }
  recover(z, 0.7);
  return true;
}

// Golpes seguidos (anillos cada gap s) o la succión.
function acting(h: Horde, z: Zombie, p: Player, dt: number, game: GameHost) {
  const a = z.atk as BossAtk;
  if (a.k === 'pull') {
    for (const q of targetsOf(game)) {
      if (!q.alive) continue;
      const dx = z.x - q.x;
      const dy = z.y - q.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > a.r! || d < z.r + q.r) continue;
      q.kx += (dx / d) * a.force! * dt * 6;
      q.ky += (dy / d) * a.force! * dt * 6;
    }
    if (Math.random() < dt * 30) {
      const ang = rand(0, TAU);
      game.particles.dust(z.x + Math.cos(ang) * a.r! * 0.8, z.y + Math.sin(ang) * a.r! * 0.8, 3);
    }
    if (z.bt <= 0) recover(z, 0.4);
    return true;
  }
  if (z.bt > 0) return true;
  if (a.at === 'front') z.angle = Math.atan2(p.y - z.y, p.x - z.x);
  ringAt(h, z, a, p.x, p.y, game, `boss_${a.id}`);
  z.hits--;
  if (z.hits > 0) z.bt = a.gap || 0.4;
  else recover(z, 0.5);
  return true;
}

function underground(h: Horde, z: Zombie, p: Player, dt: number, game: GameHost) {
  const a = z.atk as BossAtk;
  // sigue al jugador bajo tierra hasta el último segundo; luego el punto queda fijo
  if (z.bt > 1 || z.tk !== FX_RING) telegraph(z, FX_RING, p.x, p.y, a.r!);
  z.tdur = 1;
  const k = Math.min(1, dt * 3);
  z.x += (z.tx - z.x) * k;
  z.y += (z.ty - z.y) * k;
  z.ox = z.x;
  z.oy = z.y;
  z.dustT = (z.dustT || 0) - dt;
  if (z.dustT <= 0) {
    z.dustT = 0.12;
    game.particles.dust(z.x, z.y, 6);
  }
  if (z.bt > 0) return true;
  // sale debajo de ti
  z.x = z.tx;
  z.y = z.ty;
  z.ox = z.x;
  z.oy = z.y;
  z.under = false;
  areaHit(game, h, z, z.x, z.y, a.r!, a, `boss_${a.id}`);
  game.particles.debris(z.x, z.y, 40, 'rock');
  game.particles.ring(z.x, z.y, a.r!, '200,170,120');
  game.camera.shake(0.9, z.x, z.y);
  game.sfx.bullSlam(true);
  recover(z, a.after || 1, a.vuln);
  return true;
}

function leaping(h: Horde, z: Zombie, game: GameHost) {
  const a = z.atk as BossAtk;
  const k = clamp(1 - z.bt / a.time!, 0, 1);
  z.x = z.lx0 + (z.tx - z.lx0) * k;
  z.y = z.ly0 + (z.ty - z.ly0) * k;
  z.ox = z.x;
  z.oy = z.y;
  z.air = Math.sin(Math.PI * k) * 90 + 0.01;
  z.airV = 0;
  z.angle = Math.atan2(z.ty - z.ly0, z.tx - z.lx0);
  if (z.bt > 0) return true;
  z.air = 0;
  z.tk = 0;
  areaHit(game, h, z, z.x, z.y, a.r!, a, `boss_${a.id}`);
  game.particles.ring(z.x, z.y, a.r!, '220,190,150');
  game.particles.dust(z.x, z.y, 20);
  game.camera.shake(0.6, z.x, z.y);
  game.sfx.bullSlam(false);
  recover(z, a.after || 0.6, a.vuln);
  return true;
}

function recover(z: Zombie, t: number, vuln?: number) {
  z.bs = 'recover';
  z.bt = t;
  z.tk = 0;
  if (vuln) {
    z.vulnT = t;
    z.vulnK = vuln;
  }
}

// La embestida arrolla a los zombis que tiene delante (los avienta a los lados).
const near: Zombie[] = [];
function plow(h: Horde, z: Zombie) {
  h.grid.query(z.x - z.r - 20, z.y - z.r - 20, z.x + z.r + 20, z.y + z.r + 20, near);
  const mark = z.id * 1000 + z.chargeId;
  for (const o of near) {
    if (o === z || o.dead || o.plowed === mark) continue;
    const ox = o.x - z.x;
    const oy = o.y - z.y;
    if (ox * ox + oy * oy > (z.r + o.r + 4) ** 2) continue;
    o.plowed = mark;
    const side = ox * -z.cdy + oy * z.cdx >= 0 ? 1 : -1;
    const k = 1 / Math.sqrt(o.mass);
    o.kx += (-z.cdy * side * 380 + z.cdx * 260) * k;
    o.ky += (z.cdx * side * 380 + z.cdy * 260) * k;
  }
}

/**
 * Choque del jefe contra lo que le cerró el paso (después de las colisiones). Embistiendo: la madera la
 * aplasta (si crush) y sigue; lo demás lo golpea fuerte y se detiene; contra un edificio queda aturdido.
 */
export function bossImpact(z: Zombie, bumped: boolean, block: Block | null, obs: Obstacle | null, game: GameHost) {
  if (z.bs !== 'charge') return;
  const a = z.atk as BossAtk;
  if (block) {
    if (block.kind === 'wood' && a.crush) {
      game.structures.crush(game, block);
      return;
    }
    game.structures.damageBlock(game, block, a.block || 0);
    game.particles.dust(z.x + z.cdx * z.r, z.y + z.cdy * z.r, 30);
    game.camera.shake(0.5, z.x, z.y);
    game.sfx.bullSlam(true);
    z.dashLeft = 0;
    recover(z, 0.6);
    return;
  }
  if (!bumped) return;
  if (obs?.smash && !obs.gone && a.crush && game.world.smash(obs)) {
    // un árbol o un coche no lo detienen
    const cx = obs.k === 0 ? obs.x + (obs.w || 0) / 2 : obs.x;
    const cy = obs.k === 0 ? obs.y + (obs.h || 0) / 2 : obs.y;
    game.particles.debris(cx, cy, obs.smash === 'car' ? 40 : 24, obs.smash);
    game.sfx.bullSlam(true);
    return;
  }
  // contra un edificio: se aturde (es el momento de dispararle)
  game.particles.dust(z.x + z.cdx * z.r, z.y + z.cdy * z.r, 26);
  game.camera.shake(0.6, z.x, z.y);
  game.sfx.bullSlam(true);
  z.dashLeft = 0;
  recover(z, a.stun || 1, a.vuln || 1.2);
}

/** Lo que cae y lo que quema en el suelo: piedras que aterrizan y zonas que dañan y frenan. */
export function updateBossWorld(h: Horde, dt: number, game: GameHost) {
  for (let i = h.lobs.length - 1; i >= 0; i--) {
    const l = h.lobs[i];
    l.t += dt;
    if (l.t < l.dur) continue;
    h.lobs.splice(i, 1);
    areaHit(game, h, l.by, l.x, l.y, l.r, l, 'boss_lob');
    game.particles.debris(l.x, l.y, 24, 'rock');
    game.particles.dust(l.x, l.y, 14);
    game.camera.shake(0.45, l.x, l.y);
    game.sfx.bullSlam(false);
  }
  for (let i = h.zones.length - 1; i >= 0; i--) {
    const zn = h.zones[i];
    zn.t += dt;
    if (zn.t >= zn.life) {
      h.zones.splice(i, 1);
      continue;
    }
    if (zn.t < zn.arm) continue;
    const Z = BOSS_ZONES[zn.kind];
    for (const p of targetsOf(game)) {
      if (!p.alive || Math.hypot(p.x - zn.x, p.y - zn.y) > zn.r + p.r * 0.5) continue;
      if (Z.slow < 1) slow(p, Z.slow, 0.25);
      if (!Z.dps) continue;
      // el daño se junta y entra de a pocos (no un golpe por fotograma)
      p.zoneAcc = (p.zoneAcc || 0) + Z.dps * BOSS.dmg * dt;
      if (p.zoneAcc >= 4) {
        p.lastHit = `boss_${zn.kind}`;
        p.hurt(p.zoneAcc, game);
        p.zoneAcc = 0;
      }
    }
  }
}

/** Al morir un zombi común: lo recuerda (resurrección) y cura a los jefes que se alimentan cerca. */
export function onFallen(game: GameHost, z: Zombie) {
  const h = game.horde;
  if (!h?.fallen || z.def?.boss || z.type === 'golden') return;
  h.fallen.push({ type: z.type, x: z.x, y: z.y, t: game.time || 0 });
  if (h.fallen.length > 80) h.fallen.shift();
  for (const b of h.list) {
    const H = !b.dead && defOf(b)?.heal;
    if (!H || Math.hypot(b.x - z.x, b.y - z.y) > H.r) continue;
    b.hp = Math.min(b.maxHp, b.hp + H.per * BOSS.hp);
    game.particles.ring(b.x, b.y, b.r * 1.1, '120,220,120');
  }
}

/** Avisos en el suelo, piedras en el aire y zonas, como filas de FX_N números (ver FX_*). */
export function bossFx(h: Pick<Horde, 'list' | 'lobs' | 'zones'>) {
  const out: number[][] = [];
  for (const z of h.list) {
    if (!z.def.boss || z.dead || !z.tk) continue;
    const dur = z.tdur || 1;
    out.push([z.tk, z.tx, z.ty, z.tr, z.ta || 0, clamp(dur - Math.max(0, z.bt), 0, dur), dur, z.tw || 0, 0]);
  }
  for (const l of h.lobs) out.push([FX_LOB, l.x, l.y, l.r, 0, l.t, l.dur, l.x0, l.y0]);
  for (const zn of h.zones)
    out.push([FX_ZONE, zn.x, zn.y, zn.r, BOSS_ZONE_ORDER.indexOf(zn.kind), zn.t, zn.life, zn.arm, 0]);
  return out;
}

/** Un jefe vivo para la barra de arriba. */
export interface BossBar {
  type: string;
  hp: number;
  phase: number;
  hard: boolean;
  fury: boolean;
  atk: number;
  part: number;
  under: boolean;
  cloak: boolean;
}

/** Los jefes vivos: tipo, vida (0..1), fase, piel dura, furia, ataque que prepara (-1: ninguno), parte (0..1, -1 sin parte). */
export function bossStatus(list: Zombie[]): BossBar[] {
  return list
    .filter((z) => z.def.boss && !z.dead)
    .map((z) => ({
      type: z.type,
      hp: Math.max(0, z.hp / z.maxHp),
      phase: bossPhase(z),
      hard: !!z.selfA && (z.selfA.dmg ?? 1) < 1,
      fury: !!z.fury,
      atk: z.bs === 'windup' ? (z.ai ?? -1) : -1,
      part: z.partMax ? Math.max(0, z.partHp / z.partMax) : -1,
      under: !!z.under,
      cloak: !!z.selfA?.cloak,
    }));
}

/** El nombre que se muestra del jefe type, el de su ataque i y el de su parte. */
export const bossName = (type: string) => BOSSES[type]?.name ?? type;
export const bossAtkName = (type: string, i: number) => BOSSES[type]?.atk[i]?.name ?? '';
export const bossPartName = (type: string) => BOSSES[type]?.part?.name ?? '';

/** Los tipos de zombi que son jefes. */
export const BOSS_TYPES = Object.keys(ZOMBIES).filter((k) => (ZOMBIES as Record<string, { boss?: boolean }>)[k].boss);
