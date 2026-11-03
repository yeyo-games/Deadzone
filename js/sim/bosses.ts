// Jefes: uno cada BOSS.every oleadas (BOSS_ORDER, ajustes en BOSSES). Aquí su cabeza (ataques con aviso
// en el suelo, fases según la vida), el daño que reciben (bossDamage, desde combat.ts), las piedras que
// lanzan (horde.lobs) y lo que se dibuja y viaja en la foto (bossFx, bossStatus). Lo usan el juego local
// y el servidor; el dibujo está en render/bosses.js.
//
// Estados (z.bs): walk (camina con la horda y elige ataque) → windup (z.wk: el ataque que prepara, con su
// aviso) → charge (embestida) o recover (se repone) → walk.
import { BOSS, BOSS_ORDER, BOSSES, ZOMBIES } from '../core/config.ts';
import { angleTo, clamp, rand } from '../core/util.ts';
import type { GameHost, Zombie } from '../core/types.d.ts';
import type { Block } from './build.ts';
import type { Player } from './player.ts';
import type { Horde } from './zombies.ts';
import type { Obstacle } from './world.ts';

type BossDef = (typeof BOSSES)['supremo'];
/** Piedra en el aire: sale de (x0, y0) y cae en (x, y) cuando t llega a dur. */
export interface Lob {
  x0: number;
  y0: number;
  x: number;
  y: number;
  t: number;
  dur: number;
  r: number;
  hit: number;
  push: number;
  block: number;
  by: Zombie;
}

/** Avisos: 1 anillo en el suelo · 2 franja de una embestida · 3 piedra en el aire (con su origen). */
export const FX_RING = 1;
export const FX_LINE = 2;
export const FX_LOB = 3;
/** Números por fila de bossFx: tipo, x, y, radio o largo, ángulo, t, dur, x0, y0. */
export const FX_N = 9;
/** Números por jefe en bossStatus: tipo (TYPES), vida en milésimas, fase, piel endurecida, furia. */
export const STATUS_N = 5;

export const isBoss = (z: Pick<Zombie, 'def'>) => !!z.def?.boss;
const defOf = (z: Zombie) => (BOSSES as Record<string, BossDef>)[z.type];

/** El jefe de la oleada w, o null si no le toca (o aún no hay jefe para ella). */
export function bossFor(w: number) {
  return w > 0 && w % BOSS.every === 0 ? (BOSS_ORDER[w / BOSS.every - 1] ?? null) : null;
}

/** 0 normal, 1 enfurecido, 2 desesperado. */
export function bossPhase(z: Pick<Zombie, 'hp' | 'maxHp'>) {
  const k = z.hp / z.maxHp;
  return k > BOSS.rage ? 0 : k > BOSS.despair ? 1 : 2;
}

/** Multiplicador de vida del jefe según cuántos juegan (n). */
export const bossHp = (n: number) => 1 + BOSS.perPlayer * Math.max(0, n - 1);

/** Cuántos juegan esta partida: los del servidor, dos en el cooperativo o uno solo. */
export const playersIn = (game: GameHost) => game.targets?.length || (game.mode?.inGroup() ? 2 : 1);

/** Hace aparecer al jefe type en (x, y) con la vida que le toca a este grupo. */
export function spawnBoss(game: GameHost, type: string, x: number, y: number) {
  const z = game.horde.spawn(type, x, y, bossHp(playersIn(game)), 1);
  z.cd = 3;
  z.skinCd = 6;
  return z;
}

/** Cuánto del daño de una bala (o explosión) le entra: la piel endurecida lo baja, la espalda lo sube. */
export function bossDamage(z: Zombie, b: { dx: number; dy: number }) {
  const d = defOf(z);
  if (!d) return 1;
  let k = 1;
  if (z.hardT > 0) k *= 1 - d.skin.k;
  // por la espalda: la bala viaja hacia donde él mira
  if (b.dx * Math.cos(z.angle) + b.dy * Math.sin(z.angle) > 0.35) {
    k *= d.back;
    z.backT = 0.2;
  }
  return k;
}

// Todos los que pueden recibir golpes: los jugadores del servidor o el de este equipo.
const targetsOf = (game: GameHost): Player[] => (game.targets as Player[]) || (game.player ? [game.player] : []);

/**
 * Golpe en un área (pisotón, piedra): a cada jugador vivo dentro de r le quita hit y lo avienta push
 * desde el centro; a las barricadas les quita block.
 */
export function areaHit(
  game: GameHost,
  z: Zombie,
  x: number,
  y: number,
  r: number,
  hit: number,
  push: number,
  block: number,
  cause: string,
) {
  for (const p of targetsOf(game)) {
    if (!p.alive) continue;
    const dx = p.x - x;
    const dy = p.y - y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > r + p.r) continue;
    p.lastHit = cause;
    p.hurt(hit, game);
    game.onZombieHit(z, p);
    p.kx += (dx / d) * push;
    p.ky += (dy / d) * push;
  }
  if (block <= 0) return;
  for (const b of [...game.structures.blocks]) {
    const bx = clamp(x, b.x, b.x + b.w) - x;
    const by = clamp(y, b.y, b.y + b.h) - y;
    if (bx * bx + by * by < r * r) game.structures.damageBlock(game, b, block);
  }
}

/** Aviso en el suelo del ataque que prepara: tipo, dónde, radio (o largo) y ángulo. */
function telegraph(z: Zombie, k: number, x: number, y: number, r: number, a = 0) {
  z.tk = k;
  z.tx = x;
  z.ty = y;
  z.tr = r;
  z.ta = a;
  z.tdur = z.bt;
}

/**
 * La cabeza del jefe en cada paso (desde Horde.update). Devuelve true si este paso controla él su
 * movimiento (preparando, embistiendo o reponiéndose); false: camina con la horda.
 */
export function bossThink(h: Horde, z: Zombie, p: Player, d: number, dt: number, game: GameHost) {
  const B = defOf(z);
  if (!B) return false;
  z.bt -= dt;
  z.cd -= dt;
  z.hardT = (z.hardT || 0) - dt;
  z.skinCd = (z.skinCd || 0) - dt;
  z.backT = (z.backT || 0) - dt;
  const ph = bossPhase(z);
  if (ph === 2 && !z.fury) {
    // furia de piedra: corre y pega más rápido hasta el final
    z.fury = true;
    z.speed *= B.fury.speed;
    z.atkK = B.fury.rate;
    game.particles.ring(z.x, z.y, z.r * 1.6, '255,150,80');
    game.camera.shake(0.6, z.x, z.y);
    game.sfx.bullRoar();
    game.banner(`¡${B.name} enfurece!`, 'Corre y golpea más rápido');
  }
  if (z.bs === 'walk') {
    z.tk = 0;
    if (z.cd > 0 || !p.alive || z.air > 0) return false;
    z.cd = rand(B.wait[0], B.wait[1]) * BOSS.cd[ph];
    z.angle = Math.atan2(p.y - z.y, p.x - z.x);
    if (z.skinCd <= 0 && z.hp < z.maxHp * 0.92) return windup(z, 'skin', B.skin.windup, game);
    if (d < B.stomp.range + z.r) return windup(z, 'stomp', B.stomp.windup, game);
    const charge = d > B.charge.min && d < B.charge.max;
    const rock = d > B.rock.min && d < B.rock.max;
    if (charge && (!rock || Math.random() < 0.5))
      return windup(z, 'charge', B.charge.windup * (ph ? 0.85 : 1), game, p);
    if (rock) return windup(z, 'rock', B.rock.windup, game, p);
    z.cd = 0.4;
    return false;
  }
  if (z.bs === 'windup') {
    z.anim += dt * 3;
    if (z.wk === 'charge') {
      // apunta mientras toma vuelo y fija el rumbo en el último tercio
      if (z.bt > z.tdur * 0.35) z.angle = angleTo(z.angle, Math.atan2(p.y - z.y, p.x - z.x), 5 * dt);
      telegraph(z, FX_LINE, z.x, z.y, B.charge.speed * B.charge.time * 0.75, z.angle);
      z.tdur = B.charge.windup;
      if (Math.random() < dt * 16) game.particles.dust(z.x - Math.cos(z.angle) * z.r, z.y - Math.sin(z.angle) * z.r, 6);
      if (z.bt <= 0) {
        z.bs = 'charge';
        z.bt = B.charge.time;
        z.cdx = Math.cos(z.angle);
        z.cdy = Math.sin(z.angle);
        z.chargeId = (z.chargeId || 0) + 1;
        z.tk = 0;
        game.sfx.bullCharge();
      }
      return true;
    }
    if (z.wk === 'stomp') {
      telegraph(z, FX_RING, z.x, z.y, B.stomp.r);
      z.tdur = B.stomp.windup;
      if (z.bt <= 0) {
        areaHit(game, z, z.x, z.y, B.stomp.r, B.stomp.hit, B.stomp.push, B.stomp.block, 'boss_stomp');
        game.particles.ring(z.x, z.y, B.stomp.r, '200,180,150');
        game.particles.dust(z.x, z.y, 30);
        game.camera.shake(0.9, z.x, z.y);
        game.sfx.bullSlam(true);
        recover(z, 0.5);
      }
      return true;
    }
    if (z.wk === 'rock') {
      z.angle = angleTo(z.angle, Math.atan2(z.ty - z.y, z.tx - z.x), 6 * dt);
      if (Math.random() < dt * 10) game.particles.dust(z.x + Math.cos(z.angle) * z.r, z.y + Math.sin(z.angle) * z.r, 4);
      if (z.bt <= 0) {
        // arranca una piedra del suelo y la lanza adonde estabas
        const x0 = z.x + Math.cos(z.angle) * z.r;
        const y0 = z.y + Math.sin(z.angle) * z.r;
        const lob: Lob = { x0, y0, x: z.tx, y: z.ty, t: 0, dur: B.rock.fly, by: z, ...B.rock };
        h.lobs.push(lob);
        game.particles.debris(x0, y0, 16, 'rock');
        game.sfx.punch();
        z.lunge = 1;
        z.tk = 0;
        recover(z, 0.4);
      }
      return true;
    }
    // piel endurecida: se encoge, la piedra se cierra y aguanta la mitad del daño
    if (z.bt <= 0) {
      z.hardT = B.skin.time;
      z.skinCd = B.skin.cd;
      game.particles.ring(z.x, z.y, z.r * 1.3, '180,190,200');
      game.sfx.blockHit();
      recover(z, 0.2);
    }
    return true;
  }
  if (z.bs === 'charge') {
    const sp = B.charge.speed * (z.fury ? 1.15 : 1);
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
      q.lastHit = 'boss_charge';
      q.hurt(B.charge.hit, game);
      game.onZombieHit(z, q);
      const side = (q.x - z.x) * -z.cdy + (q.y - z.y) * z.cdx >= 0 ? 1 : -1;
      q.kx += (z.cdx * 0.8 - z.cdy * side * 0.6) * B.charge.throw;
      q.ky += (z.cdy * 0.8 + z.cdx * side * 0.6) * B.charge.throw;
      game.camera.shake(0.75, q.x, q.y);
      game.sfx.bullHit();
    }
    if (z.bt <= 0) recover(z, 0.7);
    return true;
  }
  if (z.bs === 'recover') {
    if (z.bt <= 0) z.bs = 'walk';
    return true;
  }
  z.bs = 'walk';
  return false;
}

function windup(z: Zombie, wk: string, t: number, game: GameHost, p?: Player) {
  z.bs = 'windup';
  z.wk = wk;
  z.bt = t;
  z.tk = 0;
  if (wk === 'rock' && p) {
    // apunta un poco adelante de donde vas
    const B = defOf(z);
    const lead = B ? B.rock.windup * 0.5 : 0;
    telegraph(z, FX_RING, p.x + (p.vx || 0) * lead, p.y + (p.vy || 0) * lead, B?.rock.r ?? 80);
  } else if (wk === 'stomp') telegraph(z, FX_RING, z.x, z.y, defOf(z)?.stomp.r ?? 200);
  game.sfx.bullRoar();
  return true;
}

function recover(z: Zombie, t: number) {
  z.bs = 'recover';
  z.bt = t;
  z.tk = 0;
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
 * aplasta y sigue; lo demás lo golpea fuerte y se detiene; contra un edificio queda aturdido.
 */
export function bossImpact(z: Zombie, bumped: boolean, block: Block | null, obs: Obstacle | null, game: GameHost) {
  const B = defOf(z);
  if (!B || z.bs !== 'charge') return;
  if (block) {
    if (block.kind === 'wood') {
      game.structures.crush(game, block);
      return;
    }
    game.structures.damageBlock(game, block, B.charge.block);
    game.particles.dust(z.x + z.cdx * z.r, z.y + z.cdy * z.r, 30);
    game.camera.shake(0.5, z.x, z.y);
    game.sfx.bullSlam(true);
    recover(z, 0.6);
    return;
  }
  if (!bumped) return;
  if (obs?.smash && !obs.gone && game.world.smash(obs)) {
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
  recover(z, B.charge.stun);
}

/** Las piedras en el aire: al caer golpean el área (jugadores y barricadas). */
export function updateLobs(h: Horde, dt: number, game: GameHost) {
  for (let i = h.lobs.length - 1; i >= 0; i--) {
    const l = h.lobs[i];
    l.t += dt;
    if (l.t < l.dur) continue;
    h.lobs.splice(i, 1);
    areaHit(game, l.by, l.x, l.y, l.r, l.hit, l.push, l.block, 'boss_rock');
    game.particles.debris(l.x, l.y, 30, 'rock');
    game.particles.dust(l.x, l.y, 18);
    game.camera.shake(0.5, l.x, l.y);
    game.sfx.bullSlam(false);
  }
}

/** Avisos en el suelo y piedras en el aire, como filas de FX_N números (ver FX_*). */
export function bossFx(h: Pick<Horde, 'list' | 'lobs'>) {
  const out: number[][] = [];
  for (const z of h.list) {
    if (!z.def.boss || z.dead || !z.tk) continue;
    out.push([z.tk, z.tx, z.ty, z.tr, z.ta || 0, Math.max(0, z.tdur - z.bt), z.tdur, z.x, z.y]);
  }
  for (const l of h.lobs) out.push([FX_LOB, l.x, l.y, l.r, 0, l.t, l.dur, l.x0, l.y0]);
  return out;
}

/** Los jefes vivos para la barra de arriba: tipo, vida (0..1), fase, piel endurecida y furia. */
export function bossStatus(list: Zombie[]) {
  return list
    .filter((z) => z.def.boss && !z.dead)
    .map((z) => ({
      type: z.type,
      hp: Math.max(0, z.hp / z.maxHp),
      phase: bossPhase(z),
      hard: (z.hardT || 0) > 0,
      fury: !!z.fury,
    }));
}

/** El nombre que se muestra del jefe type. */
export const bossName = (type: string) => (BOSSES as Record<string, BossDef>)[type]?.name ?? type;

/** Los tipos de zombi que son jefes. */
export const BOSS_TYPES = Object.keys(ZOMBIES).filter((k) => (ZOMBIES as Record<string, { boss?: boolean }>)[k].boss);
