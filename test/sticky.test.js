// Bomba lapa (SHOP.sticky, STICKY): se pega al zombi más cercano a donde apuntas y estalla a los 2 s.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOSS_ORDER, SHOP, SHOP_ORDER, STICKY, THROWABLES } from '../js/core/config.ts';
import { Structures } from '../js/sim/build.ts';
import { bulletHit } from '../js/sim/combat.ts';
import { World } from '../js/sim/world.ts';
import { Horde } from '../js/sim/zombies.ts';
import { fakeGame, silent } from './helpers.js';

function partida() {
  const world = new World(777);
  const horde = new Horde();
  const structures = new Structures();
  const game = fakeGame({ world, horde, structures, particles: silent, camera: silent, decals: silent });
  game.killZombie = (z) => {
    z.dead = true;
  };
  game.hitZombie = (z, b, hx, hy) => {
    bulletHit(game, z, b, hx, hy);
    if (z.hp <= 0) game.killZombie(z);
  };
  const { x, y } = world.spawn;
  game.player = { x, y };
  return { world, horde, structures, game, x, y };
}

// Zombi quieto (sin avanzar) en (x, y).
function quieto(t, type, x, y, hpMult = 1) {
  const z = t.horde.spawn(type, x, y, hpMult, 0.001);
  z.spawnT = 0;
  return z;
}

function correr(t, secs) {
  for (let i = 0; i < Math.round(secs * 60); i++) {
    t.horde.grid.clear();
    for (const z of t.horde.list) if (!z.dead) t.horde.grid.insert(z);
    t.structures.updateStickies(1 / 60, t.game);
  }
}

test('se compra en la tienda como la granada y se usa una vez', () => {
  assert.ok(THROWABLES.includes('sticky'));
  assert.ok(SHOP_ORDER.includes('sticky'));
  assert.equal(SHOP.sticky.consumable, true);
  assert.equal(SHOP.sticky.price, 250);
  assert.equal(STICKY.fuse, 2);
  assert.equal(STICKY.dmg, 1000);
  assert.equal(STICKY.area, 500);
});

test('se pega al zombi más cercano a donde apuntas, lo sigue y estalla a los 2 s', () => {
  const t = partida();
  const big = quieto(t, 'swat', t.x + 150, t.y, 10);
  const lejos = quieto(t, 'swat', t.x + 150, t.y + 160, 10);
  t.horde.grid.clear();
  for (const z of t.horde.list) t.horde.grid.insert(z);
  // apunta un poco al lado: igual va a por el más cercano
  t.structures.throwSticky(t.game, t.x + 170, t.y + 30, 'ana');
  assert.equal(t.structures.stickies.length, 1);
  correr(t, 0.6);
  const s = t.structures.stickies[0];
  assert.ok(s.stuck && s.z === big, 'pegada al zombi');
  // se mueve con él
  big.x += 30;
  correr(t, 0.1);
  assert.ok(Math.hypot(s.x - big.x, s.y - big.y) <= big.r, 'va con el zombi');
  const hp = big.hp;
  const hp2 = lejos.hp;
  correr(t, STICKY.fuse);
  assert.equal(t.structures.stickies.length, 0, 'estalló');
  assert.equal(Math.round(hp - big.hp), STICKY.dmg, 'al que la lleva: 1000');
  assert.equal(Math.round(hp2 - lejos.hp), STICKY.area, 'a los de alrededor: 500');
  assert.ok(t.structures.scorches.length > 0);
});

test('revienta a los gordos de una, pegada o en el radio', () => {
  const t = partida();
  const a = quieto(t, 'fat', t.x + 150, t.y, 40);
  const b = quieto(t, 'fat', t.x + 150, t.y + 120, 40);
  t.horde.grid.clear();
  for (const z of t.horde.list) t.horde.grid.insert(z);
  t.structures.throwSticky(t.game, a.x, a.y);
  correr(t, STICKY.fuse + 1);
  assert.ok(a.dead && b.dead, 'los dos gordos reventados aunque tengan mucha vida');
});

test('al rocoso le quita la mitad de su vida (y un cuarto si sólo lo alcanza)', () => {
  const t = partida();
  const r = quieto(t, 'rock', t.x + 160, t.y, 3);
  const r2 = quieto(t, 'rock', t.x + 160, t.y + 150, 3);
  t.horde.grid.clear();
  for (const z of t.horde.list) t.horde.grid.insert(z);
  t.structures.throwSticky(t.game, r.x, r.y);
  correr(t, STICKY.fuse + 1);
  assert.ok(Math.abs(r.hp - r.maxHp * 0.5) < 1, 'la mitad');
  assert.ok(Math.abs(r2.hp - r2.maxHp * 0.75) < 1, 'un cuarto');
});

test('también se pega a los jefes', () => {
  const t = partida();
  const boss = quieto(t, BOSS_ORDER[0], t.x + 200, t.y);
  t.horde.grid.clear();
  for (const z of t.horde.list) t.horde.grid.insert(z);
  t.structures.throwSticky(t.game, boss.x, boss.y);
  correr(t, 0.7);
  assert.equal(t.structures.stickies[0].z, boss);
  const hp = boss.hp;
  correr(t, STICKY.fuse);
  assert.ok(hp - boss.hp >= STICKY.dmg * 0.5, 'le quitó un buen trozo');
});

test('sin zombi cae al suelo, se pega al primero que la toca y estalla igual', () => {
  const t = partida();
  t.structures.throwSticky(t.game, t.x + 200, t.y);
  correr(t, 0.7);
  const s = t.structures.stickies[0];
  assert.ok(s.fuse > 0 && !s.stuck, 'en el suelo, con la mecha encendida');
  const z = quieto(t, 'swat', s.x, s.y, 10);
  correr(t, 0.1);
  assert.equal(s.z, z, 'se le pegó al pisarla');
  const hp = z.hp;
  correr(t, STICKY.fuse);
  assert.equal(Math.round(hp - z.hp), STICKY.dmg);
});
