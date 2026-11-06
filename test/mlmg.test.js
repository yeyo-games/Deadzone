// Ametralladora mejorada (WEAPONS.mlmg): la mejora de la ametralladora. Pide tenerla, la reemplaza con
// sus balas, dispara 30 balas por segundo y carga 500 antes de recargar.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WEAPON_ORDER, WEAPONS } from '../js/core/config.ts';
import { Bullets } from '../js/sim/bullets.ts';
import { Player } from '../js/sim/player.ts';
import { World } from '../js/sim/world.ts';
import { fakeGame, silent } from './helpers.js';

const M = WEAPONS.mlmg;

test('cuesta $20 000, dispara 30 por segundo y carga 500 balas', () => {
  assert.equal(M.name, 'Ametralladora mejorada');
  assert.equal(M.price, 20000);
  assert.equal(M.rate, 30);
  assert.ok(M.rate >= WEAPONS.lmg.rate * 2, 'al menos el doble que la normal');
  assert.equal(M.mag, 500);
  assert.equal(M.upgradeOf, 'lmg');
  assert.equal(WEAPON_ORDER.at(-1), 'mlmg', 'la red manda el arma por su lugar: va al final');
});

test('sólo se compra con la ametralladora y la reemplaza con sus balas', () => {
  const p = new Player(0, 0);
  assert.equal(p.canBuy('mlmg'), false, 'sin ametralladora no');
  p.unlock('lmg');
  const old = p.weapons.find((w) => w.id === 'lmg');
  old.mag = 40;
  old.reserve = 100;
  assert.equal(p.buy('mlmg'), true);
  assert.ok(!p.has('lmg'));
  assert.equal(p.weapon.id, 'mlmg');
  assert.equal(p.weapon.mag, 500);
  assert.equal(p.weapon.reserve, M.reserve + 140);
  assert.equal(p.canBuy('lmg'), false, 'la ametralladora ya mejorada no se vuelve a comprar');
});

// Cuántas balas salen en `secs` segundos manteniendo el gatillo, a 60 cuadros por segundo.
function rafaga(id, secs) {
  const world = new World(777);
  const bullets = new Bullets();
  const game = fakeGame({
    world,
    bullets,
    particles: silent,
    decals: silent,
    camera: silent,
    input: { mode: 'touch' },
    toast: () => {},
  });
  const p = new Player(world.spawn.x, world.spawn.y);
  p.unlock(id);
  p.angle = 0;
  p.fireCd = 0;
  let n = 0;
  for (let i = 0; i < secs * 60; i++) {
    p.fireCd -= 1 / 60;
    const before = bullets.list.length;
    p.tryFire(game);
    n += bullets.list.length - before;
    bullets.list.length = 0;
  }
  return { n, p };
}

test('mantiene 30 balas por segundo a 60 cuadros y gasta la caja de 500', () => {
  const { n, p } = rafaga('mlmg', 2);
  assert.ok(n >= 59 && n <= 62, `${n} balas en 2 s`);
  assert.equal(p.weapon.mag, 500 - n);
  // la ametralladora normal no cambia
  assert.ok(rafaga('lmg', 2).n <= 24);
});
