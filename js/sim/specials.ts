// Zombis con habilidades (cifras en SPECIALS de config.ts): escupidor, chillón, excavador y saltador.
// Los usa Horde.update igual en el juego local y en el servidor; el dibujo está en render/sprites.js.
// Cada `...Think` devuelve true si ese fotograma el zombi no camina como los demás (prepara un ataque,
// va bajo tierra o en pleno salto). Reusan lo de los jefes: piedras en el aire (h.lobs), zonas en el
// suelo y golpes en área (areaHit), que ya viajan en la foto.
import { SPECIALS } from '../core/config.ts';
import { angleTo, clamp, rand } from '../core/util.ts';
import type { GameHost, Zombie } from '../core/types.d.ts';
import type { Block } from './build.ts';
import { areaHit } from './bosses.ts';
import type { Horde } from './zombies.ts';
import type { World } from './world.ts';

/** Lo que persigue un zombi (jugador, compañero o un objetivo de operación). */
type Target = { x: number; y: number; r: number; alive: boolean; vx?: number; vy?: number; isGoal?: boolean };

/** Tipo de piedra en el aire (fila FX_LOB): 0 piedra de jefe · 1 escupitajo de ácido. */
export const LOB_ACID = 1;

const near: Zombie[] = [];

/* ---------- escupidor ---------- */

/**
 * Escupidor: a distancia media se para, se prepara (z.bs = 'windup', el cliente lo ve temblar) y te
 * lanza ácido en arco, por encima de los muros, adonde vas a estar. Deja un charco unos segundos.
 */
export function spitterThink(h: Horde, z: Zombie, p: Target, d: number, dt: number, game: GameHost) {
  const S = SPECIALS.spitter;
  z.spitCd = (z.spitCd ?? rand(1, S.cd[1])) - dt;
  if (z.bs === 'windup') {
    z.bt -= dt;
    z.angle = angleTo(z.angle, Math.atan2(p.y - z.y, p.x - z.x), 8 * dt);
    if (z.bt > 0) return true;
    z.bs = 'walk';
    z.spitCd = rand(S.cd[0], S.cd[1]);
    if (!p.alive) return false;
    // apunta adonde vas a estar a medio vuelo
    const lead = S.fly * 0.5;
    const x0 = z.x + Math.cos(z.angle) * z.r;
    const y0 = z.y + Math.sin(z.angle) * z.r;
    h.lobs.push({
      x0,
      y0,
      x: p.x + (p.vx || 0) * lead,
      y: p.y + (p.vy || 0) * lead,
      t: 0,
      dur: S.fly,
      r: S.r,
      by: z,
      hit: S.hit,
      zone: S.zone,
      kind: LOB_ACID,
      cause: 'spitter',
    });
    z.lunge = 1;
    game.particles.ring(x0, y0, 14, '150,220,90');
    game.sfx.sizzle();
    return false;
  }
  if (z.spitCd > 0 || !p.alive || p.isGoal || z.spawnT > 0 || z.air > 0) return false;
  if (d < S.range[0] || d > S.range[1]) return false;
  z.bs = 'windup';
  z.bt = S.windup;
  return true;
}

/* ---------- chillón ---------- */

/**
 * Chillón: cuando te tiene cerca se para, infla el pecho y grita: los zombis de alrededor corren
 * más un rato (el mismo refuerzo que dan los jefes, buffT/buffK, sin resistencia extra).
 */
export function screamerThink(h: Horde, z: Zombie, p: Target, d: number, dt: number, game: GameHost) {
  const S = SPECIALS.screamer;
  z.yellCd = (z.yellCd ?? rand(1.5, 3)) - dt;
  if (z.bs === 'windup') {
    z.bt -= dt;
    if (z.bt > 0) return true;
    z.bs = 'walk';
    z.yellCd = rand(S.cd[0], S.cd[1]);
    scream(h, z, game);
    return false;
  }
  if (z.yellCd > 0 || !p.alive || z.spawnT > 0 || z.air > 0 || d > S.near) return false;
  z.bs = 'windup';
  z.bt = S.windup;
  game.particles.ring(z.x, z.y, 26, '220,90,200');
  return true;
}

/** El grito: acelera a los zombis comunes que estén a SPECIALS.screamer.r (también a él mismo). */
export function scream(h: Horde, z: Zombie, game: GameHost) {
  const S = SPECIALS.screamer;
  h.grid.query(z.x - S.r, z.y - S.r, z.x + S.r, z.y + S.r, near);
  for (const o of near) {
    if (o.dead || o.def?.boss || o.type === 'golden') continue;
    if (Math.hypot(o.x - z.x, o.y - z.y) > S.r + o.r) continue;
    if (o.buffT > 0) o.buffK = Math.max(o.buffK || 1, S.boost);
    else {
      o.buffK = S.boost;
      o.buffRes = 1;
    }
    o.buffT = Math.max(o.buffT || 0, S.time);
  }
  if (!(z.buffT > 0)) {
    z.buffK = S.boost;
    z.buffRes = 1;
  }
  z.buffT = Math.max(z.buffT || 0, S.time);
  game.particles.ring(z.x, z.y, S.r, '220,90,200');
  game.particles.ring(z.x, z.y, S.r * 0.55, '255,140,230');
  game.camera.shake(0.15, z.x, z.y);
  game.sfx.burnScream();
}

/* ---------- excavador ---------- */

/**
 * Excavador: al aparecer se entierra (z.under: no se ve, no choca y las balas no lo tocan) y va recto
 * hacia ti levantando polvo, sin que lo paren los muros. Cerca de ti avisa (anillo y tierra que se
 * levanta) y sale golpeando todo lo que esté encima; desde ahí es un zombi como los demás.
 */
export function diggerThink(h: Horde, z: Zombie, p: Target, d: number, dt: number, game: GameHost, world: World) {
  const S = SPECIALS.digger;
  if (z.dug === undefined) {
    z.dug = true;
    z.under = true;
    z.bs = 'dig';
    z.digT = 0;
    game.particles.dust(z.x, z.y, 14);
  }
  if (!z.under) return false;
  z.digT += dt;
  z.dustT = (z.dustT || 0) - dt;
  if (z.bs === 'windup') {
    z.bt -= dt;
    if (z.dustT <= 0) {
      z.dustT = 0.08;
      game.particles.dust(z.x + rand(-12, 12), z.y + rand(-12, 12), 5);
    }
    if (z.bt > 0) return true;
    emerge(h, z, game);
    return true;
  }
  // bajo tierra: recto hacia ti (o hacia donde estabas, si caíste)
  if (d > 1) {
    const sp = z.speed * S.speed * (z.slow > 0 ? 0.6 : 1);
    z.x = clamp(z.x + ((p.x - z.x) / d) * sp * dt, 40, world.size - 40);
    z.y = clamp(z.y + ((p.y - z.y) / d) * sp * dt, 40, world.size - 40);
    z.angle = Math.atan2(p.y - z.y, p.x - z.x);
  }
  z.ox = z.x;
  z.oy = z.y;
  z.anim += dt * 6;
  if (z.dustT <= 0) {
    z.dustT = 0.14;
    game.particles.dust(z.x, z.y, 4);
  }
  // sale cerca de ti (o tras S.max s) en un lugar libre: si debajo hay un muro, sigue cavando
  if ((d < S.emerge || z.digT > S.max) && !world.pointBlocked(z.x, z.y, z.r)) {
    z.bs = 'windup';
    z.bt = S.warn;
    game.particles.ring(z.x, z.y, S.r, '200,170,120');
  }
  return true;
}

/** Sale de la tierra: golpe y empujón a quien esté encima, piedras y polvo. */
export function emerge(h: Horde, z: Zombie, game: GameHost) {
  const S = SPECIALS.digger;
  z.under = false;
  z.bs = 'walk';
  z.ox = z.x;
  z.oy = z.y;
  z.stumbleT = 0;
  z.lunge = 1;
  areaHit(game, h, z, z.x, z.y, S.r, { hit: S.hit, push: 140 }, 'digger');
  game.particles.debris(z.x, z.y, 18, 'rock');
  game.particles.dust(z.x, z.y, 16);
  game.camera.shake(0.25, z.x, z.y);
  game.sfx.punch();
}

/* ---------- saltador ---------- */

/** Saltador en pleno salto: vuela de (lx0, ly0) a (tx, ty) en SPECIALS.jumper.time s, por encima de todo. */
export function jumperThink(z: Zombie, dt: number, game: GameHost) {
  const S = SPECIALS.jumper;
  z.jumpCd = (z.jumpCd || 0) - dt;
  if (z.bs !== 'leap') return false;
  z.bt -= dt;
  const k = clamp(1 - z.bt / S.time, 0, 1);
  z.x = z.lx0 + (z.tx - z.lx0) * k;
  z.y = z.ly0 + (z.ty - z.ly0) * k;
  z.ox = z.x;
  z.oy = z.y;
  z.air = Math.sin(Math.PI * k) * S.up + 0.01;
  z.airV = 0;
  z.anim += dt * 4;
  if (z.bt > 0) return true;
  z.air = 0;
  z.bs = 'walk';
  z.jumpCd = S.cd;
  z.stumbleT = 0;
  game.particles.dust(z.x, z.y, 10);
  return true;
}

/**
 * El saltador topó con una barricada: si es de una sola capa (nada apilado encima) y del otro lado hay
 * sitio, salta por encima de ella. Devuelve true si saltó (entonces no la muerde).
 */
export function tryJump(z: Zombie, blk: Block, game: GameHost, world: World) {
  const S = SPECIALS.jumper;
  if ((z.jumpCd || 0) > 0 || z.bs === 'leap' || z.air > 0) return false;
  if ((game.structures.topOf(blk).layer || 0) > 0) return false;
  // cruza la pieza de lado a lado: hacia su punto más cercano (o hacia donde iba, si está encima)
  let dx = clamp(z.x, blk.x, blk.x + blk.w) - z.x;
  let dy = clamp(z.y, blk.y, blk.y + blk.h) - z.y;
  let l = Math.hypot(dx, dy);
  if (l < 1) {
    dx = z.hx || Math.cos(z.angle);
    dy = z.hy || Math.sin(z.angle);
    l = Math.hypot(dx, dy) || 1;
  }
  dx /= l;
  dy /= l;
  // avanza hasta salir de la pieza (con su radio) y un poco más
  let t = l;
  const inside = (x: number, y: number) =>
    x > blk.x - z.r && x < blk.x + blk.w + z.r && y > blk.y - z.r && y < blk.y + blk.h + z.r;
  while (t < 260 && inside(z.x + dx * t, z.y + dy * t)) t += 4;
  t += S.over;
  const tx = z.x + dx * t;
  const ty = z.y + dy * t;
  if (world.pointBlocked(tx, ty, z.r)) return false;
  z.bs = 'leap';
  z.bt = S.time;
  z.lx0 = z.x;
  z.ly0 = z.y;
  z.tx = tx;
  z.ty = ty;
  z.angle = Math.atan2(dy, dx);
  game.particles.dust(z.x, z.y, 8);
  return true;
}
