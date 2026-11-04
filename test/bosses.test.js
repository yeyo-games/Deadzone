// Jefes (sim/bosses.ts): cuándo llegan, el daño que reciben (espalda, escudo, coraza, partes), fases y
// furia, y cada tipo de ataque (embestida, anillo, piedra, línea, invocar, ánimo, zona, bajo tierra,
// salto, succión, pulso, muros y resurrección). Al final, una pelea de cada jefe sin errores.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOSS, BOSS_ORDER, BOSSES, SHOP, ZOMBIES } from '../js/core/config.ts';
import {
  bossDamage,
  bossFor,
  bossFx,
  bossHp,
  bossLoop,
  bossPhase,
  bossStatus,
  FX_CAST,
  FX_LINE,
  FX_LOB,
  FX_N,
  FX_RING,
  FX_ZONE,
  STATUS_N,
  spawnBoss,
} from '../js/sim/bosses.ts';
import { Structures } from '../js/sim/build.ts';
import { bulletHit } from '../js/sim/combat.ts';
import { Player } from '../js/sim/player.ts';
import * as Rules from '../js/sim/rules.ts';
import { World } from '../js/sim/world.ts';
import { Horde } from '../js/sim/zombies.ts';
import { encodeBosses } from '../js/net/snapshot.ts';
import { TYPES } from '../js/net/protocol.ts';
import { fakeGame, silent } from './helpers.js';

// Una partida mínima con el mundo, la horda y las barricadas de verdad.
function partida() {
  const world = new World(777);
  const horde = new Horde();
  const structures = new Structures();
  const player = new Player(world.spawn.x, world.spawn.y);
  const banners = [];
  const game = fakeGame({
    world,
    horde,
    structures,
    player,
    particles: silent,
    camera: silent,
    decals: silent,
    pickups: { drop: () => {} },
    bullets: { spawn: () => {}, list: [] },
    time: 0,
    state: 'play',
    hurtFlash: 0,
    hitZombie: () => {},
    killZombie: (z) => {
      z.dead = true;
    },
    onZombieHit: () => {},
    onGiantStep: () => {},
    onSuperPunch: () => {},
    onPlayerDeath: () => {},
    banner: (t, s) => banners.push([t, s]),
  });
  return { world, horde, structures, player, game, banners };
}

function jefe(t, type = 'supremo', dx = 0, dy = -300) {
  const z = spawnBoss(t.game, type, t.player.x + dx, t.player.y + dy);
  z.spawnT = 0;
  return z;
}

function pieza(game, kind, x, y) {
  const { hp, w, h } = SHOP[kind];
  const o = { k: 0, x, y, w, h, low: true, block: true, kind, hp, max: hp, hitT: 0, cd: 0, ang: 0, owner: null };
  game.structures.blocks.push(o);
  game.world.addDynamic(o);
  return o;
}

// Corre la horda s segundos (el jugador no muere) y llama a cada() en cada paso.
function correr(t, s, cada) {
  for (let i = 0; i < s * 60; i++) {
    t.player.hp = Math.max(t.player.hp, 50);
    t.game.time += 1 / 60;
    t.horde.update(1 / 60, t.game);
    t.structures.update(1 / 60, t.game);
    cada?.();
  }
}

// Mientras corre f, el jefe z sólo puede usar su ataque id (los demás quedan en espera) y lo usa ya.
function solo(type, id, z, f) {
  const B = BOSSES[type];
  z.cd = 0;
  z.acds = Object.fromEntries(B.atk.map((a) => [a.id, a.id === id ? 0 : 1e9]));
  return f(B.atk.find((a) => a.id === id));
}

// Pone al jugador en una calle por la que el jefe puede embestir dist px sin topar con un edificio y
// devuelve esa dirección.
function pasillo(t, dist, R = 56) {
  const libre = (x, y, ux, uy) => {
    for (let d = 0; d <= dist + 60; d += 20) if (t.world.pointBlocked(x + ux * d, y + uy * d, R)) return false;
    return true;
  };
  const { x: sx, y: sy } = t.world.spawn;
  for (let k = 0; k < 4000; k += 40)
    for (const [ox, oy] of [
      [k, 0],
      [-k, 0],
      [0, k],
      [0, -k],
    ])
      for (const [ux, uy] of [
        [0, -1],
        [1, 0],
      ])
        if (libre(sx + ox, sy + oy, ux, uy)) {
          t.player.x = sx + ox;
          t.player.y = sy + oy;
          return [ux, uy];
        }
  throw new Error('no hay pasillo libre');
}

test('un jefe cada 5 oleadas, en orden, y la lista vuelve a empezar más dura', () => {
  assert.equal(BOSS_ORDER.length, 15);
  BOSS_ORDER.forEach((b, i) => {
    assert.equal(bossFor((i + 1) * BOSS.every), b);
    assert.ok(ZOMBIES[b]?.boss, `${b} en ZOMBIES`);
    assert.ok(TYPES.includes(b), `${b} en TYPES`);
    assert.ok(BOSSES[b].atk.length >= 4, `${b} tiene sus ataques`);
  });
  for (const w of [1, 4, 6, 9, 74]) assert.equal(bossFor(w), null);
  assert.equal(bossFor(80), 'supremo');
  assert.equal(bossLoop(75), 0);
  assert.equal(bossLoop(80), 1);
  assert.equal(ZOMBIES.rey.hp, 1200000);
  assert.equal(bossHp(3), BOSS.hp * (1 + 2 * BOSS.perPlayer));
  assert.equal(bossHp(1, 1), BOSS.hp * BOSS.loop);
  const t = partida();
  t.game.targets = [t.player, new Player(0, 0)];
  assert.equal(jefe(t).maxHp, ZOMBIES.supremo.hp * bossHp(2));
});

test('espalda, escudo de frente, coraza y momentos expuestos cambian el daño', () => {
  const t = partida();
  const z = jefe(t);
  z.angle = 0;
  const frente = { dx: -1, dy: 0 };
  const espalda = { dx: 1, dy: 0 };
  assert.equal(bossDamage(z, frente), 1);
  assert.equal(bossDamage(z, espalda), BOSSES.supremo.back);
  z.selfA = { dmg: 0.5 };
  assert.equal(bossDamage(z, frente), 0.5);
  z.selfA = null;
  z.vulnT = 1;
  z.vulnK = 1.5;
  assert.equal(bossDamage(z, frente), 1.5);
  const c = jefe(t, 'carcelero');
  c.angle = 0;
  assert.equal(bossDamage(c, frente), BOSSES.carcelero.front, 'la puerta para casi todo');
  // bulletHit lo aplica y no lo frena ni lo empuja
  z.vulnT = 0;
  const hp = z.hp;
  bulletHit(t.game, z, { dmg: 100, dx: 1, dy: 0, knock: 60 }, z.x, z.y);
  assert.equal(z.hp, hp - 100 * BOSSES.supremo.back);
  assert.equal(z.kx, 0);
  // bajo tierra no le entra nada
  z.under = true;
  assert.equal(bossDamage(z, espalda), 0);
});

test('fases por la vida y, al final, la furia: corre y pega más rápido', () => {
  const t = partida();
  const z = jefe(t, 'supremo', 0, -900);
  assert.equal(bossPhase(z), 0);
  z.hp = z.maxHp * 0.5;
  assert.equal(bossPhase(z), 1);
  const sp = z.speed;
  z.hp = z.maxHp * 0.2;
  assert.equal(bossPhase(z), 2);
  correr(t, 0.05);
  assert.ok(z.fury);
  assert.equal(z.speed, sp * BOSSES.supremo.fury.speed);
  assert.equal(z.atkK, BOSSES.supremo.fury.rate);
  assert.match(t.banners.at(-1)[0], /enfurece/);
});

test('anillo (pisotón): avisa, golpea, avienta y daña barricadas', () => {
  const t = partida();
  const z = jefe(t, 'supremo', 0, -120);
  const muro = pieza(t.game, 'metal', Math.round(z.x / 20) * 20 + 60, Math.round(z.y / 20) * 20);
  const hp0 = t.player.hp;
  solo('supremo', 'stomp', z, (a) => {
    correr(t, 0.05);
    assert.equal(z.bs, 'windup');
    const fx = bossFx(t.horde);
    assert.equal(fx[0][0], FX_RING);
    assert.equal(fx[0][3], a.r);
    let golpe = false;
    correr(t, a.windup + 0.1, () => {
      golpe ||= t.player.hp < hp0;
    });
    assert.ok(golpe);
  });
  assert.ok(muro.hp < SHOP.metal.hp);
});

test('embestida: franja de aviso, aplasta la madera y atropella', () => {
  const t = partida();
  const p = t.player;
  const [ux, uy] = pasillo(t, 420);
  const z = jefe(t, 'supremo', ux * 420, uy * 420);
  const madera = pieza(
    t.game,
    'wood',
    Math.round((p.x + ux * 220) / 20) * 20 - 20,
    Math.round((p.y + uy * 220) / 20) * 20 - 20,
  );
  const hp0 = p.hp;
  let atropello = false;
  solo('supremo', 'charge', z, (a) => {
    correr(t, 0.05);
    assert.equal(bossFx(t.horde)[0][0], FX_LINE);
    correr(t, a.windup + a.time, () => {
      atropello ||= p.hp < hp0;
    });
  });
  assert.ok(!t.structures.blocks.includes(madera));
  assert.ok(atropello);
});

test('proyectiles: caen donde avisan; la lluvia corrosiva deja veneno', () => {
  const t = partida();
  const z = jefe(t, 'contaminado', 0, -400);
  solo('contaminado', 'rain', z, (a) => {
    correr(t, a.windup + 0.05);
    assert.equal(t.horde.lobs.length, a.n);
    assert.ok(bossFx(t.horde).some((f) => f[0] === FX_LOB));
    correr(t, a.fly * 1.2);
  });
  assert.equal(t.horde.lobs.length, 0);
  assert.ok(t.horde.zones.some((zn) => zn.kind === 'toxic'));
  assert.ok(bossFx(t.horde).some((f) => f[0] === FX_ZONE));
});

test('zonas: tras armarse, queman y frenan a quien está dentro', () => {
  const t = partida();
  const z = jefe(t, 'generador', 0, -500);
  const p = t.player;
  solo('generador', 'floor', z, (a) => correr(t, a.windup + 0.05));
  const zn = t.horde.zones[0];
  assert.equal(zn.kind, 'elec');
  zn.x = p.x;
  zn.y = p.y;
  const hp0 = p.hp;
  correr(t, 1.5);
  assert.ok(p.hp < hp0, 'quema');
  assert.ok(p.slowK < 1, 'frena');
});

test('línea con cadena: te atrae y te deja quieto', () => {
  const t = partida();
  const p = t.player;
  const z = jefe(t, 'carcelero', 0, -300);
  solo('carcelero', 'hook', z, (a) => correr(t, a.windup + 0.05));
  assert.ok(p.slowT > 0 && p.slowK === 0, 'quieto');
  assert.ok(p.ky < 0, 'jalado hacia el jefe');
});

test('invocar y animar: llegan zombis y van más rápido', () => {
  const t = partida();
  const z = jefe(t, 'campanero', 0, -400);
  const antes = t.horde.list.length;
  solo('campanero', 'call', z, (a) => correr(t, a.windup + 0.05));
  assert.ok(t.horde.list.length - antes >= 10, 'llamó a la horda');
  solo('campanero', 'war', z, (a) => correr(t, a.windup + 0.8));
  const otro = t.horde.list.find((o) => o !== z && !o.dead);
  assert.ok(otro.buffT > 0 && otro.buffK > 1);
});

test('la campana rota (por la espalda) apaga sus llamadas', () => {
  const t = partida();
  const z = jefe(t, 'campanero', 0, -400);
  z.angle = 0;
  bulletHit(t.game, z, { dmg: z.partMax * 2, dx: 1, dy: 0, knock: 0 }, z.x, z.y);
  correr(t, 0.05);
  assert.ok(!(z.partHp > 0));
  assert.match(t.banners.at(-1)[0], /Campana/);
  assert.equal(bossStatus(t.horde.list)[0].part, 0);
  let llamo = false;
  solo('campanero', 'call', z, () => correr(t, 2, () => (llamo ||= z.bs === 'windup')));
  assert.ok(!llamo);
});

test('bajo tierra: desaparece, sale debajo de ti y queda expuesto', () => {
  const t = partida();
  const p = t.player;
  const z = jefe(t, 'excavador', 0, -600);
  solo('excavador', 'dig', z, (a) => {
    correr(t, a.windup + 0.1);
    assert.ok(z.under);
    assert.equal(bossStatus(t.horde.list)[0].under, true);
    correr(t, a.time);
    assert.ok(!z.under);
    assert.ok(Math.hypot(z.x - p.x, z.y - p.y) < 140, 'salió junto a ti');
    assert.equal(z.bs, 'recover');
    assert.ok(z.vulnT > 0 && z.vulnK > 1);
  });
});

test('salto, y la explosión que la aturde (Cazadora)', () => {
  const t = partida();
  const p = t.player;
  const z = jefe(t, 'cazadora', 0, -500);
  solo('cazadora', 'leap', z, (a) => {
    correr(t, a.windup + a.time / 2);
    assert.equal(z.bs, 'leap');
    assert.ok(z.air > 10);
    correr(t, a.time);
  });
  assert.ok(Math.hypot(z.x - p.x, z.y - p.y) < 220, 'cayó cerca');
  z.bs = 'walk';
  z.angle = 0;
  bossDamage(z, { dx: 1, dy: 0, dmg: 10, blast: true });
  assert.equal(z.bs, 'recover', 'aturdida');
});

test('pulso apaga torretas, muros temporales se deshacen, succión te jala', () => {
  const t = partida();
  const p = t.player;
  const g = jefe(t, 'generador', 0, -300);
  const tor = pieza(t.game, 'turret', Math.round(g.x / 20) * 20 + 100, Math.round(g.y / 20) * 20);
  solo('generador', 'emp', g, (a) => correr(t, a.windup + 0.05));
  assert.ok(tor.empT > 0);
  g.dead = true;
  t.horde.removeDead();
  const c = jefe(t, 'carcelero', 0, -300);
  const n0 = t.structures.blocks.length;
  solo('carcelero', 'cage', c, (a) => correr(t, a.windup + 0.05));
  const temp = t.structures.blocks.filter((b) => b.tempT !== undefined);
  assert.ok(temp.length > 0, 'puso muros');
  correr(t, BOSSES.carcelero.atk.find((a) => a.id === 'cage').life + 0.2);
  assert.equal(t.structures.blocks.length, n0, 'se deshicieron');
  c.dead = true;
  t.horde.removeDead();
  const d = jefe(t, 'devorador', 0, -380);
  p.kx = p.ky = 0;
  solo('devorador', 'suck', d, (a) => correr(t, a.windup + 0.3));
  assert.ok(p.ky < -1, 'lo jala');
});

test('el Devorador se cura con las bajas cercanas y el hambre sube su daño', () => {
  const t = partida();
  const d = jefe(t, 'devorador', 0, -500);
  d.hp = d.maxHp * 0.5;
  const o = t.horde.spawn('normal', d.x + 100, d.y, 1, 1);
  const hp = d.hp;
  Rules.killZombie(t.game, o, { kills: {}, xp: () => {}, bounty: () => {}, golden: () => {}, toast: () => {} });
  assert.equal(d.hp, hp + BOSSES.devorador.heal.per * BOSS.hp);
  correr(t, 0.02);
  assert.ok(d.dmgK > BOSS.dmg);
});

test('los jefes tienen BOSS.hp de su vida y pegan BOSS.dmg veces más (golpe, ataques y zonas)', () => {
  assert.ok(BOSS.hp < 1 && BOSS.dmg > 1);
  const t = partida();
  const z = jefe(t);
  assert.equal(z.maxHp, ZOMBIES.supremo.hp * BOSS.hp);
  assert.equal(z.dmgK, BOSS.dmg);
});

test('el Rey levanta a los caídos y cada núcleo roto de su corona lo debilita', () => {
  const t = partida();
  const r = jefe(t, 'rey', 0, -600);
  for (let i = 0; i < 6; i++) {
    const o = t.horde.spawn('normal', r.x + 150 + i * 20, r.y, 1, 1);
    Rules.killZombie(t.game, o, { kills: {}, xp: () => {}, bounty: () => {}, golden: () => {}, toast: () => {} });
  }
  t.horde.removeDead();
  const vivos = t.horde.list.length;
  solo('rey', 'raise', r, (a) => correr(t, a.windup + 0.05));
  assert.equal(t.horde.list.length, vivos + 6);
  const k0 = r.partK;
  bulletHit(t.game, r, { dmg: (r.partMax / 3 / BOSSES.rey.part.share) * 1.05, dx: 1, dy: 0, knock: 0 }, r.x, r.y);
  correr(t, 0.02);
  assert.ok(r.partK > k0);
  assert.match(t.banners.at(-1)[0], /Corona: 1 de 3/);
});

test('derrotado: premio para cada jugador, botín y aviso', () => {
  const t = partida();
  const z = jefe(t, 'aplastador');
  const pagos = [];
  const drops = [];
  t.game.pickups = { drop: (k) => drops.push(k) };
  t.game.player.weapons = [{}, {}];
  Rules.killZombie(t.game, z, {
    kills: {},
    xp: () => {},
    bounty: () => {},
    golden: () => {},
    toast: () => {},
    boss: (_z, n) => pagos.push(n),
  });
  assert.deepEqual(pagos, [BOSSES.aplastador.reward]);
  assert.ok(drops.filter((k) => k === 'crate').length >= 2);
  assert.match(t.banners.at(-1)[0], /derrotado/);
});

test('la foto lleva la barra (ataque y parte) y los avisos', () => {
  const t = partida();
  const z = jefe(t, 'campanero', 0, -120);
  z.hp = z.maxHp * 0.4;
  solo('campanero', 'wave', z, () => correr(t, 0.05));
  const { bo, bf } = encodeBosses(t.horde);
  assert.equal(bo.length, STATUS_N);
  assert.equal(TYPES[bo[0]], 'campanero');
  assert.equal(bo[2], 1, 'enfurecido');
  assert.equal(
    bo[5] - 1,
    BOSSES.campanero.atk.findIndex((a) => a.id === 'wave'),
    'qué ataque prepara',
  );
  assert.equal(bo[6], 100, 'campana entera');
  assert.equal(bf.length % FX_N, 0);
  assert.equal(bf[0], FX_RING);
  // un ataque sin lugar fijo avisa con un círculo de hechizo
  let cast = false;
  solo('campanero', 'call', z, () => correr(t, 3, () => (cast ||= bossFx(t.horde).some((f) => f[0] === FX_CAST))));
  assert.ok(cast);
});

test('cada jefe pelea 40 s sin errores y usa varios de sus ataques', () => {
  for (const type of BOSS_ORDER) {
    const t = partida();
    const z = jefe(t, type, 0, -350);
    pieza(t.game, 'metal', Math.round(t.player.x / 20) * 20 + 80, Math.round(t.player.y / 20) * 20);
    pieza(t.game, 'turret', Math.round(t.player.x / 20) * 20 - 120, Math.round(t.player.y / 20) * 20);
    const usados = new Set();
    for (let s = 0; s < 40 * 60; s++) {
      t.player.hp = 1000;
      t.player.alive = true;
      t.game.time += 1 / 60;
      // el jugador se mueve en círculo para que el jefe use ataques de cerca y de lejos
      t.player.x = t.world.spawn.x + Math.cos(s / 120) * 240;
      t.player.y = t.world.spawn.y + Math.sin(s / 120) * 240;
      if (s === 20 * 60) z.hp = z.maxHp * 0.15;
      t.horde.update(1 / 60, t.game);
      t.structures.update(1 / 60, t.game);
      if (z.bs === 'windup') usados.add(z.atk.id);
      for (const o of t.horde.list) if (o !== z && o.hp <= 0) o.dead = true;
      t.horde.removeDead();
      if (t.horde.list.length > 150) t.horde.list.splice(1, 50);
      assert.ok(Number.isFinite(z.x) && Number.isFinite(z.y) && Number.isFinite(z.hp), `${type}: posición válida`);
    }
    assert.ok(usados.size >= 3, `${type} usó ${[...usados].join(', ')}`);
    assert.ok(z.fury || !BOSSES[type].fury, `${type} llegó a la furia`);
  }
});
