// Pruebas de las operaciones de alto riesgo en la simulación autoritativa (js/sim/ops.ts dentro de
// ServerSim): oferta y votación, continuidad de las oleadas, las tres operaciones con varios jugadores,
// desconexiones, retirada, limpieza y pago único.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ServerSim } from '../src/sim/ServerSim.ts';
import { IN_USE } from '../../js/net/protocol.ts';
import { OPS, BOSS } from '../../js/core/config.ts';
import { Ops, opPayout, opReward, offersAt, rollMult, streakMult, viewForbids } from '../../js/sim/ops.ts';
import { bossFor } from '../../js/sim/bosses.ts';
import { Player } from '../../js/sim/player.ts';

type P = { id: string; idx: number; name: string };
const team = (n: number): P[] => Array.from({ length: n }, (_, i) => ({ id: `j${i}`, idx: i + 1, name: `J${i}` }));

// Partida en la que acaba de terminar la oleada w (sin zombis, todos casi inmortales).
function cleared(players: P[], w = 20, seed = 11) {
  const sim = new ServerSim(seed, players);
  for (const s of sim.slots.values()) {
    s.p.stats.maxHp = 1e7;
    s.p.hp = 1e7;
  }
  const d = sim.director;
  d.wave = w;
  d.state = 'active';
  d.queue.length = 0;
  for (const z of sim.horde.list) z.dead = true;
  sim.horde.removeDead();
  sim.step();
  return sim;
}

const seqs = new Map<string, number>();
// n pasos; hold: quién mantiene H (y dónde se queda quieto)
function run(sim: ServerSim, n: number, hold: Record<string, { x: number; y: number } | true> = {}) {
  for (let i = 0; i < n; i++) {
    for (const s of sim.slots.values()) {
      if (s.away) continue;
      const h = hold[s.id];
      if (h && h !== true) {
        s.p.x = h.x;
        s.p.y = h.y + 2;
      }
      const k = `${s.id}`;
      const q = (seqs.get(k) || 0) + 1;
      seqs.set(k, q);
      sim.push(s.id, [{ s: q, mx: 0, my: 0, f: h ? IN_USE : 0, a: 0, w: -1 }]);
    }
    sim.step();
  }
}
const sec = (s: number) => Math.round(s * 60);
// mata a los zombis de la operación (para probar la lógica sin pelear)
const clearZ = (sim: ServerSim) => {
  for (const z of sim.horde.list) z.dead = true;
  sim.horde.removeDead();
};

function accept(sim: ServerSim, kind: string) {
  const o = sim.ops.offer!;
  o.kinds = [kind as any, kind === 'convoy' ? 'nest' : 'convoy'];
  for (const s of sim.slots.values()) sim.opMsg(s.id, { k: 'vote', i: 0 });
  // en grupo se cierra la votación en el siguiente paso (cuando ya votaron todos)
  run(sim, 1);
  assert.ok(sim.ops.op, `empezó ${kind}`);
  return sim.ops.op!;
}

test('la radio ofrece operaciones tras la oleada 20, 25, 30… y no antes', () => {
  assert.ok(!offersAt(19) && offersAt(20) && !offersAt(21) && offersAt(25) && offersAt(30));
  assert.equal(cleared(team(2), 19).ops.offer, null);
  const sim = cleared(team(2), 20);
  const o = sim.ops.offer!;
  assert.ok(o, 'oferta tras la 20');
  assert.equal(o.kinds.length, 2);
  assert.notEqual(o.kinds[0], o.kinds[1]);
  // la tarjeta muestra la recompensa exacta (base + 150 por oleada pasada la 20, por su multiplicador)
  const v = sim.snapshot('j0', 0)!.op;
  assert.deepEqual(
    v.of.rw,
    o.kinds.map((k) => opReward(k, 20)),
  );
  assert.equal(opReward('convoy', 20), 8000);
  assert.equal(opReward('nest', 25), Math.round((8000 + 4000) * 1.25));
  assert.equal(opReward('supply', 30), Math.round((8000 + 8000) * 1.15));
});

test('prioriza la operación que no se completó hace poco', () => {
  for (let i = 0; i < 12; i++) {
    const ops = new Ops(false);
    ops.last = { convoy: 20, nest: 25 };
    const g: any = { sfx: {}, toast() {}, opsWho: () => [] };
    ops.afterWave(g, 30);
    assert.ok(ops.offer!.kinds.includes('supply'), 'siempre está la menos reciente');
  }
});

test('votación: gana la mayoría, el líder desempata y sin votos se sigue', () => {
  // mayoría por seguir
  let sim = cleared(team(3));
  sim.opMsg('j0', { k: 'vote', i: 2 });
  sim.opMsg('j1', { k: 'vote', i: 2 });
  sim.opMsg('j2', { k: 'vote', i: 0 });
  run(sim, 2);
  assert.equal(sim.ops.offer, null);
  assert.equal(sim.ops.op, null, 'ganó seguir con las oleadas');
  // empate 1-1: decide el líder
  sim = cleared(team(2));
  sim.ops.leader = 'j1';
  const kinds = sim.ops.offer!.kinds;
  sim.opMsg('j0', { k: 'vote', i: 0 });
  sim.opMsg('j1', { k: 'vote', i: 1 });
  run(sim, 2);
  assert.equal(sim.ops.op!.kind, kinds[1], 'el voto del líder');
  // nadie vota: a los 20 s sigue el descanso normal
  sim = cleared(team(2));
  run(sim, sec(OPS.voteT + 0.5));
  assert.equal(sim.ops.offer, null);
  assert.equal(sim.ops.op, null);
  assert.equal(sim.director.state, 'waiting');
});

test('la operación va entre oleadas: después sigue la 21 y el jefe sigue en la 25', () => {
  const sim = cleared(team(2));
  const op = accept(sim, 'convoy');
  assert.equal(op.wave, 20);
  // con la operación en marcha no se puede empezar la oleada
  sim.ready('j0');
  sim.ready('j1');
  run(sim, 3);
  assert.equal(sim.director.wave, 20);
  assert.equal(sim.director.state, 'waiting');
  // retirada (mayoría de 2: los dos) y vuelta al descanso
  sim.opMsg('j0', { k: 'ret' });
  assert.equal(sim.ops.op!.state, 'prep', 'uno solo no basta en grupo');
  sim.opMsg('j1', { k: 'ret' });
  assert.equal(sim.ops.op!.result, 'retreat');
  run(sim, sec(OPS.outT + 0.2));
  assert.equal(sim.ops.op, null);
  assert.equal(sim.director.wave, 20);
  sim.ready('j0');
  sim.ready('j1');
  run(sim, 2);
  assert.equal(sim.director.wave, 21, 'sigue la oleada 21');
  assert.ok(bossFor(25) && !bossFor(21) && BOSS.every === 5, 'el jefe sigue en la 25');
});

test('convoy: dos jugadores activan componentes distintos a la vez, se defiende y cada uno cobra una vez', () => {
  const sim = cleared(team(2));
  const op = accept(sim, 'convoy');
  const money0 = [...sim.slots.values()].map((s) => s.money);
  // llegar: salen los guardias (del presupuesto)
  for (const s of sim.slots.values()) {
    s.p.x = op.x;
    s.p.y = op.y + 150;
  }
  run(sim, 5);
  assert.ok(op.guards && op.budget < op.total, 'guardias del presupuesto');
  assert.ok(sim.snapshot('j0', 0)!.op.op.gl > 0, 'hay que eliminar a los guardias');
  clearZ(sim);
  run(sim, 2);
  const [a, b] = op.d.parts;
  run(sim, sec(OPS.convoy.partT + 0.3), { j0: a, j1: b });
  assert.ok(a.done && b.done, 'los dos componentes a la vez');
  assert.equal(op.state, 'active');
  assert.equal(op.open.length, 1, 'primera fase: una dirección');
  // el desbloqueo avanza solo con alguien cerca; sin nadie se pausa y conserva lo que llevaba
  run(sim, sec(5), { j0: { x: op.x, y: op.y + 110 } });
  const u = op.d.u;
  assert.ok(u > 4 && u < 6, `avanza: ${u}`);
  for (const s of sim.slots.values()) {
    s.p.x = op.x + 1200;
    s.p.y = op.y;
  }
  run(sim, sec(2));
  assert.ok(Math.abs(op.d.u - u) < 0.05 && op.d.paused, 'en pausa sin nadie cerca');
  // segunda y tercera fase (con el camión protegido de lo que llegue)
  for (let t = 0; t < 60 && !op.d.opened; t++) {
    clearZ(sim);
    run(sim, 60, { j0: { x: op.x, y: op.y + 110 } });
    if (op.d.u > 21 && op.d.u < 23) assert.equal(op.open.length, 2, 'segunda dirección');
  }
  assert.ok(op.d.opened, 'caja abierta a los 60 s');
  assert.ok(op.d.hp > 0);
  // fuego amigo y golpes enormes contra muros: el camión no cae de un golpe
  const hp0 = op.d.hp;
  op.d._goal.hurt(1e9, sim.game);
  assert.ok(hp0 - op.d.hp <= op.d.max * OPS.convoy.maxHit + 1e-6, 'un golpe aislado le quita poco');
  clearZ(sim);
  for (const s of sim.slots.values()) money0[s.idx - 1] = s.money;
  run(sim, sec(OPS.convoy.lootT + 0.3), { j1: op.d.box });
  assert.equal(op.result, 'win');
  const paid = [...sim.slots.values()].map((s, i) => s.money - money0[i]);
  for (const m of paid) assert.ok(m >= op.reward, `cada participante cobra: ${m}`);
  assert.ok(sim.ops.plans.decoy, 'plano del señuelo');
  // repetir la resolución no paga dos veces
  const before = [...sim.slots.values()].map((s) => s.money);
  sim.ops.resolve(sim.ops.ctx(sim.game), 'win');
  op.state = 'active';
  sim.ops.resolve(sim.ops.ctx(sim.game), 'win');
  assert.deepEqual(
    [...sim.slots.values()].map((s) => s.money),
    before,
    'sin doble pago',
  );
  run(sim, sec(OPS.outT + 0.3));
  assert.equal(sim.ops.op, null);
  assert.equal(sim.horde.list.filter((z: any) => z.op === op.id).length, 0, 'sin zombis de la operación');
  assert.ok(!sim.world.pointBlocked(op.x, op.y), 'el camión ya no está en el mapa');
});

test('convoy: si el camión cae la operación falla sin terminar la partida', () => {
  const sim = cleared(team(2));
  const op = accept(sim, 'convoy');
  const money = sim.slots.get('j0')!.money;
  op.state = 'active';
  for (let i = 0; i < 200 && op.d.hp > 0; i++) op.d._goal.hurt(500, sim.game);
  run(sim, 2);
  assert.equal(op.result, 'fail');
  run(sim, sec(OPS.outT + 0.3));
  assert.equal(sim.ops.op, null);
  assert.equal(sim.slots.get('j0')!.money, money, 'sin recompensa');
  assert.ok(!sim.over, 'la partida sigue');
  assert.equal(sim.ops.plans.decoy, false);
});

test('nido: cargas en puntos distintos a la vez, un punto no admite dos y explota justo a los 12 s', () => {
  const sim = cleared(team(2), 25);
  const op = accept(sim, 'nest');
  const [p1, p2, p3] = op.d.pts;
  // sin golpes de los refuerzos mientras se prueban las cargas (el daño que corta se prueba aparte)
  for (const s of sim.slots.values()) s.p.boostT = 99;
  // los dos quieren el mismo punto: sólo uno lo usa
  run(sim, sec(1), { j0: p1, j1: p1 });
  assert.ok(p1.by === 'j0' || p1.by === 'j1');
  clearZ(sim);
  // ahora cada uno el suyo
  run(sim, sec(OPS.nest.plantT + 0.3), { j0: p1, j1: p2 });
  assert.ok(p1.done && p2.done, 'dos a la vez');
  assert.equal(op.d.planted, 2);
  // recibir daño corta la colocación
  clearZ(sim);
  run(sim, sec(1.5), { j0: p3 });
  const before = p3.prog;
  sim.slots.get('j0')!.p.hp -= 50;
  run(sim, 1, { j0: p3 });
  assert.ok(p3.prog < before, 'un golpe la corta');
  // (sin más golpes de los refuerzos mientras termina)
  sim.slots.get('j0')!.p.boostT = 99;
  run(sim, sec(OPS.nest.plantT + 0.3), { j0: p3 });
  for (const s of sim.slots.values()) s.p.boostT = 0;
  assert.ok(p3.done);
  assert.equal(op.d.fuse !== null, true);
  // salir por la salida marcada: se llega caminando con margen
  for (const e of op.d.exits) assert.ok(Math.hypot(e.x - op.x, e.y - op.y) > OPS.nest.R, 'salida fuera del área');
  const exit = op.d.exits[0];
  const s0 = sim.slots.get('j0')!;
  const s1 = sim.slots.get('j1')!;
  s0.p.x = exit.x;
  s0.p.y = exit.y;
  // j1 se queda dentro: daño fuerte, no muerte oculta
  s1.p.stats.maxHp = 100;
  s1.p.hp = 100;
  s1.p.x = op.x + 40;
  s1.p.y = op.y + 140;
  const steps = Math.ceil(op.d.fuse * 60);
  clearZ(sim);
  run(sim, steps - 2);
  assert.ok(!op.d.blown, 'aún no');
  clearZ(sim);
  s1.p.hp = 100;
  s1.p.alive = true;
  s1.p.x = op.x + 40;
  s1.p.y = op.y + 140;
  run(sim, 3);
  assert.ok(op.d.blown, 'explota al acabar la cuenta');
  assert.equal(op.result, 'win');
  assert.ok(s1.p.alive && s1.p.hp <= 100 - 100 * OPS.nest.blast + 1, 'dentro: daño fuerte pero vivo');
  assert.ok(sim.ops.plans.fire, 'plano de munición incendiaria');
  // nadie puede construir dentro del área mientras dura (no se cierra la salida)
  const v = { op: { k: 'nest', x: op.x, y: op.y, R: OPS.nest.R, s: 'active', bl: 0 } };
  assert.ok(viewForbids(v, op.x + 100, op.y, 40, 40));
  assert.ok(!viewForbids(v, op.x + OPS.nest.R + 20, op.y, 40, 40));
});

test('suministros: llevarlo frena 15%, se suelta al desconectarse y se entrega una sola vez', () => {
  const sim = cleared(team(2), 30);
  const op = accept(sim, 'supply');
  const tiers = op.d.crates.map((c: any) => c.tier).sort();
  assert.deepEqual(tiers, [0, 1, 2], 'cercano, lejano y estrecho');
  const [c1, c2] = op.d.crates;
  // cada uno recoge uno distinto a la vez (y seguir con H un rato no lo suelta)
  run(sim, sec(OPS.supply.pickT + 1.2), { j0: c1, j1: c2 });
  const a = sim.slots.get('j0')!;
  const b = sim.slots.get('j1')!;
  assert.equal(a.p.cargo, c1.id);
  assert.equal(b.p.cargo, c2.id);
  assert.equal(op.state, 'active', 'la primera recogida activa los refuerzos');
  // 15% más lento (en campo abierto, sin muros ni zombis que estorben)
  const open = { world: { collide() {} }, sfx: { exhausted() {} } } as any;
  const walk = (cargo: number) => {
    const q = new Player(1000, 1000);
    q.cargo = cargo;
    for (let i = 0; i < 60; i++) q.move(1 / 60, 1, 0, false, open);
    return q.x - 1000;
  };
  const k = walk(1) / walk(0);
  assert.ok(Math.abs(k - (1 - OPS.supply.slow)) < 0.02, `más lento: ${k.toFixed(3)}`);
  // se desconecta quien lleva el suyo: cae en suelo libre cerca y otro lo puede recoger
  sim.setAway('j1', true);
  run(sim, 2);
  assert.equal(c2.by, null);
  assert.ok(!sim.world.pointBlocked(c2.x, c2.y, 10), 'en suelo libre');
  assert.equal(b.p.cargo, 0);
  // entregar el primero (una sola vez aunque vuelva a pasar por el punto)
  const drop = op.d.drop;
  run(sim, 2, { j0: { x: drop.x, y: drop.y } });
  assert.equal(op.d.n, 1);
  assert.ok(c1.dl);
  run(sim, 5, { j0: { x: drop.x, y: drop.y } });
  assert.equal(op.d.n, 1, 'no se entrega dos veces');
  // la reconexión recupera el estado (nada se reinicia)
  sim.setAway('j1', false);
  run(sim, 2);
  const v = sim.snapshot('j1', 0)!.op.op;
  assert.equal(v.n, 1);
  assert.equal(v.k, 'supply');
  // el resto
  for (const c of op.d.crates.filter((k: any) => !k.dl)) {
    clearZ(sim);
    run(sim, sec(OPS.supply.pickT + 0.3), { j1: c });
    run(sim, 1);
    assert.equal(b.p.cargo, c.id);
    run(sim, 2, { j1: { x: drop.x, y: drop.y } });
  }
  assert.equal(op.d.n, 3);
  assert.equal(op.result, 'win');
  assert.ok(sim.ops.plans.repair, 'plano del reparador');
});

test('cuatro jugadores: el presupuesto se fija al empezar y una baja revive al terminar la operación', () => {
  const sim = cleared(team(4));
  const op = accept(sim, 'convoy');
  const total = op.total;
  const want = Math.round(sim.director.composition(21).total * OPS.budget.convoy);
  assert.ok(Math.abs(total - want) <= 1, 'parte de la siguiente oleada con el escalado del grupo');
  sim.remove('j3');
  run(sim, 2);
  assert.equal(op.total, total, 'no cambia si alguien se va');
  const s = sim.slots.get('j2')!;
  s.p.hp = 0;
  s.p.alive = false;
  sim.onPlayerDeath();
  sim.opMsg('j0', { k: 'ret' });
  sim.opMsg('j1', { k: 'ret' });
  run(sim, sec(OPS.outT + 0.3));
  assert.equal(sim.ops.op, null);
  assert.ok(s.p.alive, 'revivió al terminar la operación');
  assert.equal(sim.director.wave, 20, 'sin avanzar la oleada');
});

test('guardar y continuar: una operación pagada no vuelve a pagarse', () => {
  const sim = cleared(team(1));
  const op = accept(sim, 'supply');
  const saved = JSON.parse(JSON.stringify(sim.ops.serialize()));
  const again = new Ops(false);
  again.restore(sim.game, saved);
  assert.equal(again.op!.id, op.id, 'la operación sigue al cargar');
  assert.equal(again.op!.kind, 'supply');
  sim.ops.resolve(sim.ops.ctx(sim.game), 'win');
  const paid = JSON.parse(JSON.stringify(sim.ops.serialize()));
  const third = new Ops(false);
  third.restore(sim.game, paid);
  assert.equal(third.op, null, 'ya cobrada: no se reanuda');
  assert.ok(third.paid.includes(op.id));
  assert.ok(third.plans.repair, 'el plano se conserva');
  assert.ok(third.nextId > op.id, 'la siguiente tiene otro identificador');
});

test('el reparador de campo funciona con H fuera de una operación', () => {
  const sim = cleared(team(1));
  assert.equal(sim.ops.op, null, 'sin operación');
  const p = sim.slots.get('j0')!.p;
  const rep: any = {
    kind: 'repair',
    x: p.x - 20,
    y: p.y + 30,
    w: 40,
    h: 40,
    hp: 100,
    max: 100,
    hitT: 0,
    up: 0,
    layer: 0,
  };
  const wall: any = {
    kind: 'wall',
    x: p.x + 60,
    y: p.y - 10,
    w: 20,
    h: 20,
    hp: 50,
    max: 400,
    hitT: 0,
    calm: 99,
    layer: 0,
  };
  sim.structures.blocks.push(rep, wall);
  const at = { x: p.x, y: p.y - 2 };
  run(sim, 1);
  run(sim, 1, { j0: at });
  assert.equal(wall.hp, 50 + 400 * OPS.plans.repair.heal, 'reparó la pared');
  assert.equal(rep.up & 3, 1, 'gastó una carga');
  // mantenerla apretada no gasta otra carga
  run(sim, 5, { j0: at });
  assert.equal(rep.up & 3, 1);
});

test('la paga de una misión: bonos logrados, bajas, ruleta del botín y racha', () => {
  const B = OPS.bonus;
  const op: any = {
    kind: 'convoy',
    wave: 25,
    reward: 10000,
    t: 60,
    down: false,
    dirty: false,
    d: { hp: 3000, max: 3200 },
  };
  const all = opPayout(op, 20, 1, 1);
  const kill = 20 * (B.kill + B.killWave * 5);
  assert.deepEqual(
    all.ln.map(([, n]) => n),
    [10000, 10000 * B.fast, 10000 * B.safe, 10000 * B.clean, kill],
  );
  assert.equal(all.total, 10000 * (1 + B.fast + B.safe + B.clean) + kill);
  // sin ningún bono: lenta, alguien cayó y el camión muy dañado
  const none = opPayout({ ...op, t: 999, down: true, d: { hp: 100, max: 3200 } }, 0, 1, 1);
  assert.equal(none.total, 10000);
  // la ruleta y la racha multiplican todo
  assert.equal(opPayout(op, 20, 2, 3).total, Math.round(all.sub * 2 * streakMult(3)));
  assert.equal(streakMult(1), 1);
  assert.ok(streakMult(3) > streakMult(2));
  assert.equal(streakMult(99), OPS.streak.max);
  // la ruleta: cada multiplicador en su franja de probabilidad, y el jackpot es raro
  assert.equal(rollMult(0), 1);
  assert.equal(rollMult(0.999), 4);
  const n = 20000;
  let jack = 0;
  for (let i = 0; i < n; i++) if (rollMult() === 4) jack++;
  assert.ok(jack / n > 0.02 && jack / n < 0.07, `jackpot ${jack / n}`);
});

test('completarla paga mucho más que antes, deja el informe a la vista y suma la racha; fallar la corta', () => {
  const sim = cleared(team(1));
  accept(sim, 'nest');
  const op = sim.ops.op!;
  const s = sim.slots.get('j0')!;
  const m0 = s.money;
  op.state = 'active';
  sim.ops.resolve(sim.ops.ctx(sim.game), 'win');
  assert.ok(s.money - m0 >= op.reward, `cobró ${s.money - m0}`);
  assert.ok(op.reward >= 8000);
  assert.equal(sim.ops.streak, 1);
  const v = sim.ops.view();
  assert.ok(v.rp && v.rp.tot === s.money - m0, 'el informe dice lo que cobró');
  assert.ok(v.rp.ln.length >= 2, 'recompensa y bonos');
  // el informe se apaga solo
  run(sim, sec(OPS.reportT + 0.5));
  assert.equal(sim.ops.view().rp, undefined);
  // una fallida corta la racha
  sim.ops.op = { ...op, id: op.id + 1, state: 'active', paid: false } as any;
  sim.ops.resolve(sim.ops.ctx(sim.game), 'fail', 'prueba');
  assert.equal(sim.ops.streak, 0);
});
