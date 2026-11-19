// Coloso, el muro caminante (js/sim/coloso.ts): sale desde la oleada 16 al frente, tiene vida fija, su escudo
// para balas y explosiones, y sin escudo va por las barricadas a golpes de 2000.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLOSO, WAVES, ZOMBIES } from '../js/core/config.ts';
import { followColoso, hitShield, shieldAt, shieldBetween, shieldHit, shielded } from '../js/sim/coloso.ts';
import { waveCounts } from '../js/sim/director.ts';
import { Horde } from '../js/sim/zombies.ts';
import { fakeGame, silent } from './helpers.js';

const juego = () =>
  fakeGame({
    particles: silent,
    camera: silent,
    toast: () => {},
    structures: { blocks: [], damageBlock: (_g, b, d) => (b.hp -= d) },
  });

test('sale desde la oleada COLOSO.from, al frente y sin pasar de COLOSO.max', () => {
  const m = WAVES.count;
  for (let w = 1; w < COLOSO.from; w++) assert.equal(waveCounts(w, m, null).coloso, 0, `oleada ${w}`);
  assert.equal(waveCounts(COLOSO.from, m, null).coloso, COLOSO.first);
  assert.equal(waveCounts(200, m, null).coloso, COLOSO.max);
});

test('vida fija de 2 millones (no crece con la oleada) y escudo puesto', () => {
  const h = new Horde();
  const z = h.spawn('coloso', 0, 0, 9, 1);
  assert.equal(z.hp, 2000000);
  assert.equal(z.maxHp, ZOMBIES.coloso.hp);
  assert.equal(z.shield, COLOSO.shield);
  assert.ok(COLOSO.kinds.includes(z.shieldKind));
});

test('el escudo para las balas y protege lo de atrás de las explosiones', () => {
  const h = new Horde();
  const c = h.spawn('coloso', 500, 500, 1, 1);
  c.angle = Math.PI; // mira hacia la izquierda
  const cols = shielded(h.list);
  const s = shieldAt(c);
  // una bala que viene de la izquierda choca con el escudo antes que con su cuerpo
  const hit = shieldHit(cols, 200, 500, 700, 500);
  assert.ok(hit && hit.z === c);
  assert.ok(200 + 500 * hit.t < c.x - c.r, 'antes de su cuerpo');
  // un zombi detrás del coloso, una explosión delante: el escudo está en medio
  const behind = h.spawn('normal', 620, 500, 1, 1);
  assert.equal(shieldBetween(cols, s.x - 60, s.y, behind), c);
  // la explosión detrás de él no la para
  assert.equal(shieldBetween(cols, 700, 500, behind), null);
});

test('al romperse el escudo se enfurece y va a golpes de 2000 por la barricada más cercana', async () => {
  const { colosoThink } = await import('../js/sim/coloso.ts');
  const g = juego();
  const h = new Horde();
  const z = h.spawn('coloso', 100, 100, 1, 1);
  const speed = z.speed;
  hitShield(g, z, COLOSO.shield + 1, 0, 0);
  assert.equal(z.shield, 0);
  assert.ok(z.rage);
  assert.ok(z.speed > speed * 2, 'corre como Hulk');
  const b = { x: 300, y: 80, w: 40, h: 40, hp: 5000, kind: 'wood' };
  g.structures.blocks.push(b);
  colosoThink(z, 1 / 60, g);
  assert.ok(z.steer && z.steer.x > 0.9, 'va hacia la barricada');
  z.x = b.x - z.r - 5;
  z.y = 100;
  assert.equal(colosoThink(z, 1 / 60, g), true, 'pegando, no camina');
  assert.equal(b.hp, 5000 - COLOSO.punch);
});

test('los demás zombis caminan detrás del coloso, a su paso', () => {
  const h = new Horde();
  const c = h.spawn('coloso', 500, 500, 1, 1);
  c.angle = Math.PI; // va hacia el jugador, a la izquierda
  const cols = shielded(h.list);
  const z = h.spawn('normal', 800, 500, 1, 1);
  const fo = followColoso(cols, z, 0, 500);
  assert.ok(fo, 'lo sigue');
  // el que ya va delante del coloso no se regresa
  const ahead = h.spawn('normal', 300, 500, 1, 1);
  assert.equal(followColoso(cols, ahead, 0, 500), null);
});
