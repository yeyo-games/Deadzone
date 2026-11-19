// Coloso, el muro caminante (cifras en COLOSO y ZOMBIES.coloso, config.ts). Llega al frente de la oleada
// cargando un pedazo de edificio o un montón de coches como escudo, y los demás zombis caminan detrás de él.
// El escudo para las balas y las explosiones (lo que queda detrás no recibe daño). Cuando se rompe, el
// coloso se enfurece: corre a la barricada más cercana y le pega golpes brutales. Sólo lógica: el dibujo
// del escudo está en render/coloso.js. Sirve igual en solitario y en el servidor.
import { COLOSO } from '../core/config.ts';
import { clamp, rand } from '../core/util.ts';
import type { GameHost, Zombie } from '../core/types.d.ts';

const segCircleT = (x: number, y: number, dx: number, dy: number, cx: number, cy: number, r: number) => {
  const fx = x - cx;
  const fy = y - cy;
  const a = dx * dx + dy * dy;
  if (a < 1e-9) return -1;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : c < 0 ? 0 : -1;
};

/** Pone el escudo al aparecer (de vida fija, como su cuerpo). */
export function initColoso(z: Zombie) {
  z.shield = COLOSO.shield;
  z.shieldMax = COLOSO.shield;
  z.rage = false;
  z.punchCd = 0;
  z.shieldKind = COLOSO.kinds[z.id % COLOSO.kinds.length];
}

/** Dónde está el escudo (el centro del círculo que para las balas). */
export function shieldAt(z: Zombie) {
  return { x: z.x + Math.cos(z.angle) * COLOSO.ahead, y: z.y + Math.sin(z.angle) * COLOSO.ahead };
}

/** Los colosos con escudo de la horda (los que protegen a los demás). */
export function shielded(list: Zombie[]) {
  const out: Zombie[] = [];
  for (const z of list) if (z.type === 'coloso' && !z.dead && z.shield > 0) out.push(z);
  return out;
}

/** ¿Una bala que va de (x, y) a (ex, ey) choca con algún escudo antes del punto t de su recorrido? */
export function shieldHit(cols: Zombie[], x: number, y: number, ex: number, ey: number, before = 2) {
  let best: Zombie | null = null;
  let bt = before;
  for (const z of cols) {
    const s = shieldAt(z);
    const t = segCircleT(x, y, ex - x, ey - y, s.x, s.y, COLOSO.shieldR);
    if (t >= 0 && t < bt) {
      bt = t;
      best = z;
    }
  }
  return best ? { z: best, t: bt } : null;
}

/** ¿Hay un escudo entre la explosión (x, y) y el zombi z? (el propio dueño del escudo, si está detrás) */
export function shieldBetween(cols: Zombie[], x: number, y: number, z: Zombie) {
  for (const c of cols) {
    const s = shieldAt(c);
    // la explosión del lado de atrás del escudo no la para
    if ((x - s.x) * Math.cos(c.angle) + (y - s.y) * Math.sin(c.angle) < 0) continue;
    if (segCircleT(x, y, z.x - x, z.y - y, s.x, s.y, COLOSO.shieldR) >= 0) return c;
  }
  return null;
}

/** El escudo recibe un golpe (bala o explosión); al llegar a cero se rompe y el coloso se enfurece. */
export function hitShield(game: GameHost, z: Zombie, dmg: number, x: number, y: number) {
  if (!(z.shield > 0)) return;
  z.shieldHitT = 0.12;
  if (Math.random() < 0.35) game.particles.impact(x, y, rand(-1, 1), rand(-1, 1));
  if (!game.mode.authority()) return;
  z.shield -= dmg;
  if (z.shield <= 0) breakShield(game, z);
}

function breakShield(game: GameHost, z: Zombie) {
  z.shield = 0;
  z.rage = true;
  z.speed *= COLOSO.rageSpeed;
  const s = shieldAt(z);
  const kind = z.shieldKind === 'cars' ? 'car' : 'tree';
  game.particles.debris(s.x, s.y, 60, kind);
  game.particles.debris(s.x + rand(-30, 30), s.y + rand(-30, 30), 40, kind);
  game.camera.shake(0.8, z.x, z.y);
  game.sfx.bullRoar();
  game.sfx.blockBreak();
  game.toast('¡Un muro caminante perdió su escudo y va por tus barricadas!');
}

/**
 * Cada fotograma: sin escudo va por la barricada más cercana y la golpea. true: este fotograma no camina
 * (está pegando). z.steer: hacia dónde ir (lo usa Horde.update en lugar de la ruta hacia el jugador).
 */
export function colosoThink(z: Zombie, dt: number, game: GameHost) {
  z.punchCd = (z.punchCd || 0) - dt;
  z.shieldHitT = Math.max(0, (z.shieldHitT || 0) - dt);
  z.steer = null;
  if (!z.rage) return false;
  const S = game.structures;
  let best = null;
  let bd = COLOSO.seek;
  let bx = 0;
  let by = 0;
  for (const b of S.blocks) {
    if (b.hp <= 0) continue;
    const cx = clamp(z.x, b.x, b.x + b.w);
    const cy = clamp(z.y, b.y, b.y + b.h);
    const d = Math.hypot(cx - z.x, cy - z.y);
    if (d < bd) {
      bd = d;
      best = b;
      bx = cx;
      by = cy;
    }
  }
  if (!best) return false;
  const a = Math.atan2(by - z.y, bx - z.x);
  if (bd < z.r + 16) {
    // a golpes: puñetazo que hace temblar todo
    z.angle = a;
    if (z.punchCd <= 0) {
      z.punchCd = COLOSO.punchCd;
      z.lunge = 1;
      if (game.mode.authority()) S.damageBlock(game, best, COLOSO.punch);
      game.particles.quake?.(bx, by, 90);
      game.camera.shake(0.7, bx, by);
      game.sfx.bullSlam(true);
    }
    return true;
  }
  z.steer = { x: Math.cos(a), y: Math.sin(a) };
  return false;
}

/**
 * Los demás zombis caminan detrás del coloso más cercano que lleve escudo (en columna, a su paso) mientras
 * estén más lejos del jugador que él. Devuelve hacia dónde ir y a qué velocidad máxima, o null.
 */
export function followColoso(cols: Zombie[], z: Zombie, px: number, py: number) {
  let c: Zombie | null = null;
  let cd = COLOSO.followR;
  for (const k of cols) {
    const d = Math.hypot(k.x - z.x, k.y - z.y);
    if (d < cd) {
      cd = d;
      c = k;
    }
  }
  if (!c) return null;
  // los que ya van delante de él no se regresan
  if (Math.hypot(z.x - px, z.y - py) < Math.hypot(c.x - px, c.y - py) - 30) return null;
  const fx = Math.cos(c.angle);
  const fy = Math.sin(c.angle);
  // cada uno en su lugar de la columna: atrás y un poco a un lado (según su número)
  const lat = (((z.wob * 7.3) % 1) * 2 - 1) * c.r * 1.2;
  const back = c.r + COLOSO.gap + ((z.wob * 3.1) % 1) * 120;
  const tx = c.x - fx * back - fy * lat;
  const ty = c.y - fy * back + fx * lat;
  const dx = tx - z.x;
  const dy = ty - z.y;
  const d = Math.hypot(dx, dy);
  if (d < 26) return { x: fx, y: fy, cap: c.speed };
  return { x: dx / d, y: dy / d, cap: d < 120 ? c.speed * 1.3 : 0 };
}
