// Muerte del jugador: los zombis que tiene encima se lo comen a mordidas (sangre que salta, trozos y
// alguna tripa) y al rato lo destripan: sus intestinos salen volando por todos lados y quedan regados
// en el suelo con charcos de sangre. Es sólo lo que se ve (no toca la simulación); DEATH en config.
import { DEATH } from '../core/config.ts';
import { rand, TAU } from '../core/util.ts';

/** Empieza el festín sobre el cuerpo en (x, y). */
export function startDeath(game, x, y) {
  game.feast = { x, y, t: 0, next: 0.05, burst: false };
  game.particles.bite(x, y, rand(0, TAU));
  game.decals.splat(x, y, 34);
  game.sfx.chomp();
}

// Un zombi pegado al cuerpo, para que la mordida salga de su lado y se le vea tirar el bocado.
function eater(game, f) {
  let best = null;
  let bd = Number.POSITIVE_INFINITY;
  for (const z of game.horde.list) {
    if (z.dead) continue;
    const d = Math.hypot(z.x - f.x, z.y - f.y) - z.r;
    if (d < 46 && d < bd + rand(-12, 12)) {
      bd = d;
      best = z;
    }
  }
  return best;
}

/** Mordidas y destripe mientras dura; luego se olvida. */
export function updateDeath(game, dt) {
  const f = game.feast;
  if (!f) return;
  f.t += dt;
  if (f.t > DEATH.time + 3) {
    game.feast = null;
    return;
  }
  f.next -= dt;
  if (f.next <= 0 && f.t < DEATH.time) {
    f.next = rand(DEATH.bite[0], DEATH.bite[1]);
    const z = eater(game, f);
    let a = rand(0, TAU);
    if (z) {
      a = Math.atan2(z.y - f.y, z.x - f.x) + Math.PI + rand(-0.6, 0.6);
      z.lunge = 1;
      z.angle = Math.atan2(f.y - z.y, f.x - z.x);
    }
    const bx = f.x + rand(-8, 8);
    const by = f.y + rand(-8, 8);
    game.particles.bite(bx, by, a);
    if (Math.random() < 0.45) game.particles.guts(bx, by, 1, 0.6);
    game.decals.splat(bx + Math.cos(a) * rand(10, 30), by + Math.sin(a) * rand(10, 30), rand(12, 24));
    game.sfx.chomp();
    game.camera.shake(0.18, f.x, f.y);
  }
  if (!f.burst && f.t >= DEATH.burst) {
    // lo abren: tripas por todos lados
    f.burst = true;
    game.particles.guts(f.x, f.y, 16, 1.4);
    game.particles.gore(f.x, f.y, 70);
    game.decals.splat(f.x, f.y, 80);
    for (let i = 0; i < 8; i++) {
      const a = rand(0, TAU);
      const d = rand(30, 150);
      game.decals.splat(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, rand(14, 34));
    }
    game.sfx.gore();
    game.camera.shake(0.75, f.x, f.y);
  }
}
