// Personalización: el código que viaja en línea, las latas por oleada y lo que se compra con ellas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cansForWave, LOOK_SLOT_ORDER, LOOK_SLOTS } from '../js/core/config.ts';
import { cleanLook, DEFAULT_LOOK, LOOK_PARTS, lookCode, lookFromCode } from '../js/render/sprites.js';

test('latas: 1 por oleada al principio y más mientras más lejos llegas', () => {
  assert.deepEqual([1, 2, 4, 5, 9, 10, 15, 20].map(cansForWave), [1, 1, 1, 2, 2, 3, 4, 5]);
});

test('el aspecto completo va y vuelve por el código corto (y cabe en lo que acepta el servidor)', () => {
  const look = cleanLook({
    skin: LOOK_PARTS[0].colors.at(-1),
    hair: LOOK_PARTS[1].colors.at(-1),
    jacket: LOOK_PARTS[3].colors.at(-1),
    hat: 'crown',
    suit: 'gold',
    face: 'cyber',
    back: 'wings',
    aura: 'toxic',
  });
  const code = lookCode(look);
  assert.match(code, /^[0-9a-z]{1,16}$/);
  assert.equal(code.length, LOOK_PARTS.length + LOOK_SLOT_ORDER.length);
  assert.deepEqual(lookFromCode(code), look);
});

test('los códigos viejos (sólo colores y sombrero) siguen sirviendo', () => {
  const look = lookFromCode('3041204');
  assert.equal(look.hat, 'helmet');
  assert.equal(look.jacket, LOOK_PARTS[3].colors[1]);
  for (const k of ['suit', 'face', 'back', 'aura']) assert.equal(look[k], DEFAULT_LOOK[k]);
  assert.deepEqual(lookFromCode(''), DEFAULT_LOOK);
});

test('cleanLook descarta piezas que no existen; cada ranura tiene gratis la de fábrica y cosas de pago', () => {
  const look = cleanLook({ hat: 'nope', back: 'cape', aura: '<b>' });
  assert.equal(look.hat, 'none');
  assert.equal(look.back, 'cape');
  assert.equal(look.aura, 'none');
  for (const k of LOOK_SLOT_ORDER) {
    assert.ok(!LOOK_SLOTS[k][0].price, `${k}: la primera es gratis`);
    assert.ok(
      LOOK_SLOTS[k].some((i) => i.price > 0),
      `${k}: hay algo que comprar con latas`,
    );
    assert.ok(LOOK_SLOTS[k].length <= 36, 'cabe en un carácter base 36');
  }
});
