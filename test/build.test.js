// Barricadas (js/sim/build.ts): el daño que reciben y cuándo se rompen.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SHOP } from '../js/core/config.ts';
import { Structures } from '../js/sim/build.ts';
import { fakeGame, silent } from './helpers.js';

const pieza = (kind) => ({ kind, x: 0, y: 0, w: 80, h: 40, hp: SHOP[kind].hp, max: SHOP[kind].hp });

test('la barrera de concreto reforzado recibe un 10 % menos de daño; las demás, todo', () => {
  const removed = [];
  const game = fakeGame({ particles: silent, world: { removeDynamic: (o) => removed.push(o) } });
  const st = new Structures();
  const muro = pieza('reinforced');
  const hesco = { ...pieza('hesco'), x: 500 };
  st.blocks.push(muro, hesco);
  st.damageBlock(game, muro, 100);
  st.damageBlock(game, hesco, 100);
  assert.equal(muro.hp, SHOP.reinforced.hp - 90);
  assert.equal(hesco.hp, SHOP.hesco.hp - 100);
  assert.equal(SHOP.hesco.hp, 10000);
  assert.equal(SHOP.hesco.price, 800);
  // al quedarse sin vida desaparece y deja de bloquear el paso
  st.damageBlock(game, muro, SHOP.reinforced.hp);
  assert.ok(muro.hp > 0, 'con 18000 de daño todavía queda en pie');
  st.damageBlock(game, muro, 2000);
  assert.ok(muro.hp <= 0);
  assert.ok(!st.blocks.includes(muro));
  assert.deepEqual(removed, [muro]);
});

test('las explosiones seguidas no suben a un zombi más allá del tope (antes parecían gigantes)', async () => {
  const { AIR, ROCKET } = await import('../js/core/config.ts');
  const { Horde } = await import('../js/sim/zombies.ts');
  const { World } = await import('../js/sim/world.ts');
  const world = new World(777);
  const horde = new Horde();
  const st = new Structures();
  const player = { x: world.spawn.x, y: world.spawn.y, r: 14, alive: true, mass: 4, kx: 0, ky: 0, hurt() {} };
  const game = fakeGame({
    world,
    horde,
    structures: st,
    player,
    particles: silent,
    camera: silent,
    decals: silent,
    time: 0,
    state: 'play',
    hitZombie: () => {},
    killZombie: () => {},
    onZombieHit: () => {},
    onGiantStep: () => {},
    onSuperPunch: () => {},
  });
  const z = horde.spawn('sprinter', world.spawn.x + 300, world.spawn.y, 1, 1);
  z.spawnT = 0;
  let top = 0;
  for (let i = 0; i < 120; i++) {
    // un cohete cada 6 fotogramas, justo al lado
    if (i % 6 === 0) st.explode(game, { x: z.x - 10, y: z.y, owner: null }, ROCKET.radius, 1, 1.5);
    horde.update(1 / 60, game);
    top = Math.max(top, z.air);
  }
  assert.ok(top > AIR.max * 0.9, `vuela (${top})`);
  assert.ok(top <= AIR.max, `sin pasar el tope (${top})`);
});

test('modo construir: la pieza va donde apuntas, hasta BUILD.reach, atravesada y sin pisarte', async () => {
  const { BUILD } = await import('../js/core/config.ts');
  const { Horde } = await import('../js/sim/zombies.ts');
  const { World } = await import('../js/sim/world.ts');
  const world = new World(777);
  const horde = new Horde();
  const st = new Structures();
  const { x, y } = world.spawn;
  const game = fakeGame({ world, horde, structures: st, particles: silent, player: { x, y, r: 14, angle: 0 } });
  // cerca: justo ahí (alineada a 20 px), y los sacos atravesados a la dirección (se ponen hacia arriba)
  const a = st.placement(game, 'sandbag', x, y - 90);
  const cx = a.x + a.w / 2;
  const cy = a.y + a.h / 2;
  assert.ok(Math.abs(cx - x) <= 10 && Math.abs(cy - (y - 90)) <= 10, 'cae donde apuntas');
  assert.ok(a.w > a.h, 'atravesada a la dirección en que se pone');
  // lejos: se queda en el borde del alcance
  const b = st.placement(game, 'sandbag', x + 1000, y);
  assert.ok(Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) <= BUILD.reach + 15);
  assert.ok(b.h > b.w);
  // encima del jugador: se aparta lo justo para no pisarlo (el alambre sí puede ir debajo)
  const c = st.placement(game, 'wood', x + 2, y);
  assert.ok(c.x >= x + 14 - 10, 'no tapa al jugador');
  const w = st.placement(game, 'wire', x, y);
  assert.ok(w.x <= x && w.x + w.w >= x);
  // sin punto, delante (como antes)
  const d = st.placement(game, 'wood');
  assert.ok(d.x > x);
  // colocarla de verdad: la torreta mira hacia donde se puso
  assert.ok(st.place(game, 'turret', 'ana', x, y + 120));
  const t = st.blocks.at(-1);
  assert.equal(t.owner, 'ana');
  assert.ok(Math.abs(t.ang - Math.PI / 2) < 1e-9);
});

test('modo construir: cada pieza se pega a la de al lado (filas rectas, sin huecos) o se apila encima', async () => {
  const { Horde } = await import('../js/sim/zombies.ts');
  const { World } = await import('../js/sim/world.ts');
  const world = new World(777);
  const st = new Structures();
  const { x, y } = world.spawn;
  const game = fakeGame({
    world,
    horde: new Horde(),
    structures: st,
    particles: silent,
    player: { x, y, r: 14, angle: 0 },
  });
  const put = (kind, dx, dy) => {
    assert.ok(st.place(game, kind, null, x + dx, y + dy), `${kind} en ${dx},${dy}`);
    const b = st.blocks.at(-1);
    return [b.x - x, b.y - y, b.w, b.h, b.layer || 0];
  };
  const reset = () => {
    for (const b of st.blocks) world.removeDynamic(b);
    st.clear();
  };
  // madera: clics algo torcidos al norte, quedan en una sola fila y tocándose
  const fila = [
    [-60, -90],
    [-18, -97],
    [22, -84],
    [61, -93],
  ].map(([dx, dy]) => put('wood', dx, dy));
  for (let i = 1; i < fila.length; i++) {
    assert.equal(fila[i][1], fila[0][1], 'misma altura');
    assert.equal(fila[i][0], fila[i - 1][0] + 40, 'pegada a la anterior');
  }
  // HESCO: la del extremo (en diagonal) sigue la fila en vez de girarse y dejar un hueco
  reset();
  const a = put('hesco', -40, -100);
  put('hesco', 40, -100);
  const b = put('hesco', 120, -100);
  assert.deepEqual(b, [a[0] + 160, a[1], 80, 40, 0]);
  // apuntar sobre una pieza la apila justo encima, aunque el clic caiga un poco movido
  const c = put('sandbag', a[0] + 30, a[1] + 26);
  assert.deepEqual(c, [a[0], a[1] + 8, 80, 24, 1]);
  // la torreta no se apila: se arrima a la pieza
  const t = put('turret', a[0] + 40, a[1] + 34);
  assert.equal(t[1], a[1] + 40, 'debajo del muro, tocándolo');
  reset();
});

test('torretas con dueño: sólo él se sube y las presta; sin dueño (solitario), cualquiera', () => {
  const st = new Structures();
  const t = { ...pieza('heavy'), w: 40, h: 40, owner: 'a', manned: null };
  const libre = { ...pieza('military'), x: 2000, w: 60, h: 60, owner: null, manned: null };
  st.blocks.push(t, libre);
  const ana = { x: 20, y: 70, r: 14, sid: 'a', manned: null };
  const beto = { x: 20, y: 70, r: 14, sid: 'b', manned: null };
  assert.equal(st.nearHeavy(ana), t);
  assert.equal(st.nearHeavy(beto), null, 'la de otro, sin permiso, no');
  assert.equal(st.nearHeavy(beto, true), t, 'pero se sabe que está ahí');
  assert.equal(st.ownTurret(ana), t);
  assert.equal(st.ownTurret(beto), null);
  st.toggleShare(t);
  assert.equal(st.nearHeavy(beto), t, 'con permiso, sí');
  st.mountHeavy(beto, t);
  assert.equal(st.toggleShare(t), beto, 'al quitar el permiso baja a quien la maneja');
  assert.equal(t.manned, null);
  assert.equal(beto.manned, null);
  Object.assign(beto, { x: 2030, y: 100 });
  assert.equal(st.nearHeavy(beto), libre, 'sin dueño se sube cualquiera');
});
