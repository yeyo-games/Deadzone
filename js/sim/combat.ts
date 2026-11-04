// Reglas de impacto compartidas por el juego local y el servidor en línea (mismo daño,
// frenado, heridas y empuje en los dos sitios).
import { rand } from '../core/util.ts';
import type { Bullet, GameHost, Zombie } from '../core/types.d.ts';
import { bossDamage } from './bosses.ts';

// Aplica una bala a un zombi. No lo mata: quien llama decide (y cuenta la baja).
export function bulletHit(game: GameHost, z: Zombie, b: Bullet, hx: number, hy: number) {
  // al jefe le entra más o menos según su piel y por dónde le pegas (sim/bosses.ts)
  // los que un jefe protege (dominio absoluto) aguantan más
  const res = z.buffT > 0 ? (z.buffRes ?? 1) : 1;
  z.hp -= (z.def?.boss ? b.dmg * bossDamage(z, b) : b.dmg) * res;
  z.flash = 0.08;
  // balas incendiarias (torreta pesada): fuego con tope, nunca se acumula más que su duración
  if (b.burn && !b.flame) z.burn = Math.max(z.burn, b.burn);
  // llamarada del lanzallamas: no frena ni empuja, lo deja ardiendo
  if (b.flame) {
    z.burn = Math.max(z.burn, b.burn || 0);
    z.lastDx = b.dx;
    z.lastDy = b.dy;
    return;
  }
  // reacción breve: sacudida hacia un lado y leve agrandado (no frena su comportamiento)
  z.hitT = 0.18;
  z.hitJolt = rand(0.2, 0.5) * (Math.random() < 0.5 ? -1 : 1) * (z.type === 'heavy' && !b.blast ? 0.25 : 1);
  z.lastDx = b.dx;
  z.lastDy = b.dy;
  if (Math.random() < 0.12) game.decals.splat(hx + b.dx * 14, hy + b.dy * 14, rand(7, 12));
  // el super blindado no se frena ni retrocede con las balas: sólo las explosiones lo mueven
  // ni el rocoso: es de piedra (ni los jefes)
  const armored = (z.type === 'heavy' || z.type === 'rock' || !!z.def?.boss) && !b.blast;
  // normales y velocistas: la bala no los avienta; se frenan, sangran y se arrastran
  const flesh = (z.type === 'normal' || z.type === 'sprinter') && !b.blast;
  if (flesh) {
    z.slow = 0.45;
    z.wounded = true;
    game.decals.splat(hx + b.dx * 6, hy + b.dy * 6, rand(8, 13));
  } else if (z.type !== 'giant' && !z.def?.boss && !armored) z.slow = 0.16;
  if (!armored && !flesh) {
    const kn = (b.knock * 3) / z.mass;
    z.kx += b.dx * kn;
    z.ky += b.dy * kn;
  }
  const big =
    z.type === 'fat' ||
    z.type === 'swat' ||
    z.type === 'heavy' ||
    z.type === 'bull' ||
    z.type === 'giant' ||
    z.type === 'rock' ||
    !!z.def?.boss;
  game.particles.hit(hx, hy, b.dx, b.dy, big);
  game.sfx.hit(big);
}
