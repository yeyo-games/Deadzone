// Escopeta reforzada (WEAPONS.rshotgun): 10 balas explosivas por disparo con el daño de un cohete de
// bazuca, retroceso brutal y 3 s de recarga.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CRATE_WEAPONS, ROCKET, WEAPON_ORDER, WEAPONS, ZOMBIES } from '../js/core/config.ts';
import { Structures } from '../js/sim/build.ts';
import { Bullets } from '../js/sim/bullets.ts';
import { bulletHit } from '../js/sim/combat.ts';
import { Player } from '../js/sim/player.ts';
import * as Rules from '../js/sim/rules.ts';
import { World } from '../js/sim/world.ts';
import { Horde } from '../js/sim/zombies.ts';
import { fakeGame, silent } from './helpers.js';

const R = WEAPONS.rshotgun;

function partida() {
  const world = new World(777);
  const horde = new Horde();
  const bullets = new Bullets();
  const structures = new Structures();
  const game = fakeGame({
    world,
    horde,
    bullets,
    structures,
    particles: silent,
    decals: silent,
    camera: silent,
    input: { mode: 'touch' },
    muzzle: 0,
    toast: () => {},
    killZombie: (z) => {
      z.dead = true;
    },
  });
  game.hitZombie = (z, b, hx, hy) => bulletHit(game, z, b, hx, hy);
  game.heavyBlast = (x, y, owner, r, p) => Rules.heavyBlast(game, x, y, owner, r, p);
  return { world, horde, bullets, structures, game };
}

test('es la escopeta reforzada de $18 000: 10 balas, recarga de 3 s y el daño de la bazuca', () => {
  assert.equal(R.name, 'Escopeta reforzada');
  assert.equal(R.price, 18000);
  assert.equal(R.pellets, 10);
  assert.equal(R.reload, 3);
  assert.equal(R.blastP, ROCKET.power, 'cada bala estalla como un cohete de bazuca');
  // la red manda el arma por su lugar: se agregó al final (después de la bazuca) y no se mueve;
  // y no sale en las cajas
  assert.equal(WEAPON_ORDER.indexOf('rshotgun'), 9);
  assert.ok(!CRATE_WEAPONS.includes('rshotgun'));
});

test('cada disparo lanza 10 balas explosivas y te avienta hacia atrás', () => {
  const t = partida();
  const p = new Player(t.world.spawn.x, t.world.spawn.y);
  p.unlock('rshotgun');
  p.angle = 0;
  // sin la pausa de sacar el arma
  p.fireCd = 0;
  const kx0 = p.kx;
  p.tryFire(t.game);
  const shot = t.bullets.list;
  assert.equal(shot.length, 10);
  for (const b of shot) {
    assert.equal(b.blast, true);
    assert.equal(b.blastP, ROCKET.power);
    assert.equal(b.blastR, R.blastR);
  }
  // retroceso brutal: mucho más que la escopeta normal
  assert.ok(kx0 - p.kx >= R.kick - 1, `retroceso ${kx0 - p.kx}`);
  assert.ok(R.kick > WEAPONS.shotgun.knock * 0.5 * 4);
});

test('una sola bala le quita cerca de la mitad de la vida a un super blindado', () => {
  const t = partida();
  const { x, y } = t.world.spawn;
  const z = t.horde.spawn('heavy', x + 160, y, 1, 0.001);
  z.spawnT = 0;
  t.horde.grid.clear();
  t.horde.grid.insert(z);
  t.bullets.spawn({
    x,
    y,
    dx: 1,
    dy: 0,
    speed: R.speed,
    life: R.range,
    dmg: R.damage,
    pierce: 0,
    knock: R.knock,
    shot: { hit: false },
    hits: null,
    blast: true,
    blastR: R.blastR,
    blastP: R.blastP,
  });
  for (let i = 0; i < 60 && t.bullets.list.length; i++) t.bullets.update(1 / 60, t.game);
  const lost = ZOMBIES.heavy.hp - z.hp;
  assert.ok(lost >= ZOMBIES.heavy.hp * 0.4 && lost <= ZOMBIES.heavy.hp * 0.65, `le quitó ${Math.round(lost)}`);
});
