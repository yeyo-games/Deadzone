// Bazuca mejorada (WEAPONS.mbazooka): la mejora de la bazuca. Pide tenerla, la reemplaza con su
// munición, carga 6 cohetes y cada uno hace 10 veces el daño del cohete normal.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROCKET, WEAPON_ORDER, WEAPONS } from '../js/core/config.ts';
import { Structures } from '../js/sim/build.ts';
import { Bullets } from '../js/sim/bullets.ts';
import { bulletHit } from '../js/sim/combat.ts';
import { Player } from '../js/sim/player.ts';
import * as Rules from '../js/sim/rules.ts';
import { World } from '../js/sim/world.ts';
import { Horde } from '../js/sim/zombies.ts';
import { fakeGame, silent } from './helpers.js';

const M = WEAPONS.mbazooka;

test('cuesta $30 000, carga 6 cohetes y cada uno hace 10 veces el daño', () => {
  assert.equal(M.name, 'Bazuca mejorada');
  assert.equal(M.price, 30000);
  assert.equal(M.mag, 6);
  assert.equal(M.rocketK, 10);
  assert.equal(M.upgradeOf, 'bazooka');
  assert.equal(WEAPON_ORDER.indexOf('mbazooka'), 10, 'la red manda el arma por su lugar: no se mueve');
});

test('sólo se compra con la bazuca, la reemplaza con sus cohetes y no se recompra la bazuca', () => {
  const p = new Player(0, 0);
  assert.equal(p.canBuy('mbazooka'), false, 'sin bazuca no');
  p.unlock('bazooka');
  const old = p.weapons.find((w) => w.id === 'bazooka');
  old.mag = 1;
  old.reserve = 5;
  assert.equal(p.canBuy('mbazooka'), true);
  assert.equal(p.buy('mbazooka'), true);
  assert.ok(!p.has('bazooka'), 'la bazuca se fue');
  assert.equal(p.weapon.id, 'mbazooka', 'queda en la mano');
  assert.equal(p.weapon.mag, 6);
  assert.equal(p.weapon.reserve, M.reserve + 6, 'se queda con los cohetes de la bazuca');
  assert.equal(p.canBuy('bazooka'), false, 'la bazuca ya mejorada no se vuelve a comprar');
  assert.equal(p.canBuy('mbazooka'), false);
});

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
    killZombie: (z) => {
      z.dead = true;
    },
  });
  game.hitZombie = (z, b, hx, hy) => bulletHit(game, z, b, hx, hy);
  game.rocketHit = (z, x, y, b) => Rules.rocketHit(game, z, x, y, b);
  game.rocketBlast = (x, y, owner, k) => Rules.rocketBlast(game, x, y, owner, k);
  return { world, horde, bullets, structures, game };
}

// Daño que le hace un cohete (k veces el normal) a un rocoso que tiene mucha vida.
function danio(k) {
  const t = partida();
  const { x, y } = t.world.spawn;
  const z = t.horde.spawn('rock', x + 150, y, 100, 0.001);
  z.spawnT = 0;
  t.horde.grid.clear();
  t.horde.grid.insert(z);
  const hp = z.hp;
  t.bullets.spawn({
    x,
    y,
    dx: 1,
    dy: 0,
    speed: 700,
    life: 1000,
    dmg: 0,
    pierce: 0,
    knock: 0,
    shot: { hit: false },
    hits: null,
    rocket: true,
    ...(k > 1 ? { rocketK: k } : {}),
  });
  for (let i = 0; i < 60 && t.bullets.list.length; i++) t.bullets.update(1 / 60, t.game);
  return hp - z.hp;
}

test('el cohete de la bazuca mejorada hace 10 veces el daño del normal', () => {
  const normal = danio(1);
  const mejorado = danio(10);
  assert.ok(normal > 0);
  assert.ok(Math.abs(mejorado / normal - 10) < 0.01, `${mejorado} contra ${normal}`);
  assert.ok(normal <= ROCKET.power + 1);
});

test('el disparo lleva su multiplicador y un cargador de 6 tiros', () => {
  const t = partida();
  t.game.input = { mode: 'touch' };
  t.game.toast = () => {};
  const p = new Player(t.world.spawn.x, t.world.spawn.y);
  p.unlock('bazooka');
  p.buy('mbazooka');
  p.angle = 0;
  p.fireCd = 0;
  p.tryFire(t.game);
  assert.equal(t.bullets.list.length, 1);
  assert.equal(t.bullets.list[0].rocketK, 10);
  assert.equal(p.weapon.mag, 5);
});
