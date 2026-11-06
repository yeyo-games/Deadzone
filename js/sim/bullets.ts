import { IMPROV, WEAPONS } from '../core/config.ts';
import { rand, segCircleT } from '../core/util.ts';
import type { Bullet, GameHost, Zombie } from '../core/types.d.ts';

const near: Zombie[] = [];
// Parte de las balas rebota en la armadura del super blindado (sin hacer daño).
const RICOCHET = 0.45;

// Llamarada del lanzallamas: corta, lenta y crece mientras vuela (life0 es su vida al salir).
// fake: la de adorno que se ve salir del lanzallamas de otro jugador en línea (no hace daño).
export function flameBullet(x: number, y: number, a: number, dmg: number, fake = false) {
  const d = WEAPONS.flamer;
  const life = d.range * rand(0.8, 1);
  return {
    x,
    y,
    dx: Math.cos(a),
    dy: Math.sin(a),
    speed: d.speed * rand(0.85, 1.1),
    life,
    life0: life,
    dmg,
    pierce: 0,
    knock: 0,
    hits: null,
    flame: true,
    burn: d.burn,
    fake,
    seed: Math.random() * 10,
  };
}

export class Bullets {
  declare list: Bullet[];
  constructor() {
    this.list = [];
  }

  spawn(b: Omit<Bullet, 'trail'> & { trail?: number }) {
    b.trail = 0;
    this.list.push(b as Bullet);
  }

  clear() {
    this.list.length = 0;
  }

  update(dt: number, game: GameHost) {
    const list = this.list;
    const world = game.world;
    const grid = game.horde.grid;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      if (b.rocket || b.improv) {
        // el cohete cabecea y se tambalea en el aire, sin perder del todo el rumbo (el improvisado, más)
        const wb = b.improv ? IMPROV.wobble : 1;
        if (b.base === undefined) {
          b.base = Math.atan2(b.dy, b.dx);
          b.ph = Math.random() * 10;
          b.drift = 0;
          b.age = 0;
        }
        b.age += dt;
        b.drift = Math.max(-0.09 * wb, Math.min(0.09 * wb, b.drift + (Math.random() - 0.5) * dt * 1.6 * wb));
        const a =
          b.base + b.drift + (Math.sin(b.age * 17 + b.ph) * 0.09 + Math.sin(b.age * 7.3 + b.ph * 2) * 0.05) * wb;
        b.dx = Math.cos(a);
        b.dy = Math.sin(a);
        game.particles.rocketTrail(b.x, b.y, b.dx, b.dy);
      }
      if (b.atgm) game.particles.atgmTrail(b.x, b.y, b.dx, b.dy, Math.min(b.speed * dt, b.life));
      let step = b.speed * dt;
      if (step > b.life) step = b.life;
      const x = b.x;
      const y = b.y;

      // ¿choca contra un obstáculo alto?
      let stop = 1;
      let wall = false;
      const n = Math.max(1, Math.ceil(step / 8));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        if (world.pointBlocked(x + b.dx * step * t, y + b.dy * step * t, 0, true)) {
          stop = (k - 1) / n;
          wall = true;
          break;
        }
      }
      const segLen = step * stop;
      const ex = x + b.dx * segLen;
      const ey = y + b.dy * segLen;
      const pad = 48;
      grid.query(Math.min(x, ex) - pad, Math.min(y, ey) - pad, Math.max(x, ex) + pad, Math.max(y, ey) + pad, near);

      let dead = wall;
      let endT = 1;
      let bounce = null;
      // procesar impactos en orden a lo largo del segmento
      for (;;) {
        let best = null;
        let bt = 2;
        for (let k = 0; k < near.length; k++) {
          const z = near[k];
          if (z.dead || (b.hits && b.hits.includes(z))) continue;
          const t = segCircleT(x, y, ex - x, ey - y, z.x, z.y, z.r);
          if (t >= 0 && t < bt) {
            bt = t;
            best = z;
          }
        }
        if (!best) break;
        (b.hits || (b.hits = [])).push(best);
        const hx = x + (ex - x) * bt;
        const hy = y + (ey - y) * bt;
        if (b.atgm) {
          // misil antitanque: estalla en el primero que toca
          b.exploded = true;
          if (!b.fake) game.structures.missileBlast(game, hx, hy, b.owner, b.blastK, b.blastRK);
          dead = true;
          wall = false;
          endT = bt;
          break;
        }
        if (b.improv) {
          // misil improvisado: estalla en el primero que toca (no se clava como el cohete)
          b.exploded = true;
          game.structures.improvBlast(game, hx, hy, b.owner);
          dead = true;
          wall = false;
          endT = bt;
          break;
        }
        if (b.rocket) {
          // el cohete no rebota ni atraviesa: impacta en el primero que toca
          game.rocketHit(best, hx, hy, b);
          b.exploded = true;
          dead = true;
          wall = false;
          endT = bt;
          break;
        }
        if (b.blast) {
          // bala explosiva (torreta pesada): pega y estalla ahí mismo, también en los blindados
          game.hitZombie(best, b, hx, hy);
          game.heavyBlast(hx, hy, b.owner, b.blastR, b.blastP);
          dead = true;
          wall = false;
          endT = bt;
          break;
        }
        if (b.flame) {
          // la llamarada atraviesa a todos y los deja ardiendo; el gigante la ataja
          if (!b.fake) game.hitZombie(best, b, hx, hy);
          if (!best.def.blocksBullets) continue;
          dead = true;
          wall = false;
          endT = bt;
          break;
        }
        if (best.type === 'heavy' && Math.random() < RICOCHET) {
          // rebote: se refleja sobre la placa con algo de desvío y pierde fuerza
          const nl = Math.hypot(hx - best.x, hy - best.y) || 1;
          const nx = (hx - best.x) / nl;
          const ny = (hy - best.y) / nl;
          const dot = b.dx * nx + b.dy * ny;
          const a = Math.atan2(b.dy - 2 * dot * ny, b.dx - 2 * dot * nx) + (Math.random() - 0.5) * 0.9;
          bounce = { dx: Math.cos(a), dy: Math.sin(a) };
          game.particles.impact(hx, hy, bounce.dx, bounce.dy);
          game.sfx.ricochet();
          best.flash = 0.05;
          wall = false;
          endT = bt;
          break;
        }
        game.hitZombie(best, b, hx, hy);
        // el gigante absorbe la bala: protege a los que vienen detrás
        if (best.def.blocksBullets || b.pierce <= 0) {
          dead = true;
          wall = false;
          endT = bt;
          break;
        }
        b.pierce--;
        b.dmg *= 0.8;
      }

      b.x = x + (ex - x) * endT;
      b.y = y + (ey - y) * endT;
      b.life -= step;
      b.trail = Math.min(b.trail + step * endT, 26);
      if (bounce) {
        b.dx = bounce.dx;
        b.dy = bounce.dy;
        b.x += b.dx * 3;
        b.y += b.dy * 3;
        b.trail = 0;
        b.dmg *= 0.5;
        b.pierce = 0;
        b.life = Math.min(b.life, 240);
      }
      if (b.atgm && !b.exploded && (wall || b.life <= 0)) {
        b.exploded = true;
        if (!b.fake) game.structures.missileBlast(game, b.x - b.dx * 4, b.y - b.dy * 4, b.owner, b.blastK, b.blastRK);
      } else if (b.improv && !b.exploded && (wall || b.life <= 0)) {
        b.exploded = true;
        game.structures.improvBlast(game, b.x - b.dx * 4, b.y - b.dy * 4, b.owner);
      } else if (b.rocket && !b.exploded && (wall || b.life <= 0))
        game.rocketBlast(b.x - b.dx * 4, b.y - b.dy * 4, b.owner, b.rocketK || 1);
      else if (b.blast && wall) game.heavyBlast(b.x - b.dx * 4, b.y - b.dy * 4, b.owner, b.blastR, b.blastP);
      else if (wall && !b.flame) game.particles.impact(b.x, b.y, b.dx, b.dy);
      if (dead || b.life <= 0) {
        b.dead = true;
        list[i] = list[list.length - 1];
        list.pop();
      }
    }
  }
}
