// Mejoras con mecánicas (las raras, legendarias y sinergias de upgrades.ts): lo que hacen al disparar,
// al rebotar una bala, al matar y al recibir un golpe mortal. Lo usan igual el juego en solitario y el
// servidor en línea (sólo quien simula de verdad aplica bajas y explosiones). Cifras en PERKS (config.ts).
import { PERKS } from '../core/config.ts';
import type { Bullet, GameHost, Zombie } from '../core/types.d.ts';
import { comboTier } from './combo.ts';
import type { Player } from './player.ts';

const near: Zombie[] = [];

/** ¿Es una bala del arma del jugador? (no torretas, explosiones, cohetes ni misiles) */
export const ownShot = (b: Bullet) => !b.blast && !b.rocket && !b.turret && !b.auto && !b.atgm && !b.improv && !b.fake;

/** Cadencia extra de Frenesí: sólo con la racha activa (×1,5 o más). */
export const frenzyMult = (p: Player) =>
  p.stats.frenzy > 0 && comboTier(p.combo?.n || 0) > 0 ? 1 + p.stats.frenzy : 1;

/** Lo que las mejoras le añaden a cada bala del arma (fuego y rebotes). */
export function shotExtras(p: Player, d: { flame?: boolean; rocket?: boolean; blast?: boolean }) {
  if (d.flame || d.rocket || d.blast) return null;
  const s = p.stats;
  if (!(s.burn > 0) && !(s.bounce > 0)) return null;
  return {
    ...(s.burn > 0 ? { burn: s.burn } : {}),
    ...(s.bounce > 0 ? { bounce: s.bounce, bounceKeep: s.bounceKeep > 0 } : {}),
  };
}

/** Balas de más por disparo (Doble cañón): no en cohetes, lanzallamas ni balas explosivas. */
export const extraShots = (p: Player, d: { flame?: boolean; rocket?: boolean; blast?: boolean }) =>
  d.flame || d.rocket || d.blast ? 0 : p.stats.twin | 0;

/**
 * Rebote: la bala que se iba a quedar en un zombi salta al más cercano que no haya tocado.
 * Devuelve la nueva dirección o null si no hay a quién saltar.
 */
export function bounceTarget(game: GameHost, b: Bullet, hx: number, hy: number) {
  if (!(b.bounce > 0)) return null;
  const R = PERKS.bounce.range;
  game.horde.grid.query(hx - R, hy - R, hx + R, hy + R, near);
  let best: Zombie | null = null;
  let bd = R * R;
  for (const z of near) {
    if (z.dead || b.hits?.includes(z)) continue;
    const d = (z.x - hx) ** 2 + (z.y - hy) ** 2;
    if (d < bd) {
      bd = d;
      best = z;
    }
  }
  if (!best) return null;
  const d = Math.sqrt(bd) || 1;
  return { dx: (best.x - hx) / d, dy: (best.y - hy) / d };
}

/**
 * Una baja: lo que hacen las mejoras de quien la hizo. shotKill: la mató una bala de su arma.
 * Las explosiones se encolan (structures.queueDeathBlast) para que las cadenas no se pisen.
 */
export function onKill(game: GameHost, z: Zombie, p: Player | null) {
  if (!p || !p.alive) return;
  const s = p.stats;
  if (z.shotKill) {
    if (s.vamp > 0) p.hp = Math.min(s.maxHp, p.hp + s.vamp);
    if (s.volatile > 0 && Math.random() < PERKS.volatile.chance) {
      const V = PERKS.volatile;
      game.structures.queueDeathBlast('perk', z.x, z.y, {
        owner: z.lastOwner ?? null,
        R: V.radius,
        power: V.power * (game.director.hpMult || 1) * s.dmgMult,
      });
      return;
    }
  }
  // Infierno: el que muere ardiendo estalla y prende a los de alrededor (y ellos, al morir, igual)
  if (s.inferno > 0 && z.burnt) {
    const I = PERKS.inferno;
    game.structures.queueDeathBlast('perk', z.x, z.y, {
      owner: z.lastOwner ?? null,
      R: I.radius,
      power: I.power * (game.director.hpMult || 1),
      burn: I.burn,
    });
  }
}

/** Explosión de una mejora (Carga volátil, Infierno): microexplosión y, si lleva burn, fuego alrededor. */
export function perkBlast(
  game: GameHost,
  x: number,
  y: number,
  o: { owner?: string | null; R?: number; power?: number; burn?: number },
) {
  const R = o.R || PERKS.volatile.radius;
  if (o.burn) {
    game.horde.grid.query(x - R - 40, y - R - 40, x + R + 40, y + R + 40, near);
    for (const z of near) {
      if (z.dead || Math.hypot(z.x - x, z.y - y) > R + z.r) continue;
      z.burn = Math.max(z.burn || 0, o.burn);
      z.lastOwner = o.owner ?? z.lastOwner;
    }
  }
  game.structures.explode(game, { x, y, owner: o.owner ?? null }, R, o.power || 0, 0, true);
}

/**
 * Última oportunidad: un golpe mortal te deja en pie con parte de la vida (una vez por oleada) y una
 * onda aparta a los zombis. Devuelve true si te salvó.
 */
export function lastStand(game: GameHost, p: Player) {
  const wave = game.director?.wave ?? 0;
  if (!(p.stats.lastStand > 0) || p.lastStandWave === wave) return false;
  const L = PERKS.lastStand;
  p.lastStandWave = wave;
  p.hp = p.stats.maxHp * L.hp;
  game.structures.explode(game, { x: p.x, y: p.y, owner: p.sid ?? null }, L.radius, L.power, 1);
  game.toast('¡Última oportunidad!');
  return true;
}
