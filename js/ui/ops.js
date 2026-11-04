// Pantalla de las operaciones de alto riesgo (la lógica está en sim/ops.ts): la oferta por radio con sus
// dos tarjetas, la línea de la operación en curso (objetivo, progreso, estado del objeto y distancia), el
// aviso de la tecla H, la retirada (manteniendo el botón), los mensajes de radio, el fundido del regreso y
// sus sonidos. Todo sale de lo que se ve (opsView): igual en solitario y en línea.
import { OPS, ROBOT } from '../core/config.ts';
import { fadeOf, OP_INFO, OP_LABELS, opsView } from '../sim/ops.ts';

const PLAN_NAMES = { decoy: 'señuelo sonoro', fire: 'munición incendiaria', repair: 'reparador de campo' };

/** ¿Ganó el equipo el plano k ('decoy', 'fire' o 'repair') en esta partida? */
export function hasPlan(game, k) {
  const v = opsView(game);
  const bit = { decoy: 1, fire: 2, repair: 4 }[k] || 0;
  return !!(v && v.pl & bit);
}

/** Índice de este jugador en la operación (0 en solitario). */
export const myIdx = (game) => (game.mode.viaServer() ? (game.online.me ? game.online.me.idx : -1) : 0);

/** ¿Lleva este jugador un cargamento? */
export function carrying(game, v) {
  const op = v && v.op;
  if (!op || op.k !== 'supply') return false;
  const me = myIdx(game);
  return (op.cr || []).some((c) => c[3] === me && !c[4]);
}

/** Lo que haría H ahora: { lb, prog } o null. */
export function opPrompt(game, v) {
  const p = game.player;
  if (!p || !p.alive || game.state !== 'play') return null;
  const me = myIdx(game);
  const reach = OPS.reach + (p.inRobot ? ROBOT.radius - 14 : 0);
  const op = v && v.op;
  const carry = carrying(game, v);
  let best = null;
  let bd = reach;
  if (op && op.s !== 'resolve') {
    for (const s of op.sp || []) {
      if ((s[2] === 'crate' && carry) || (s[4] >= 0 && s[4] !== me)) continue;
      const d = Math.hypot(s[0] - p.x, s[1] - p.y);
      if (d < bd) {
        bd = d;
        best = { lb: s[2], prog: s[4] === me ? s[3] / 100 : 0 };
      }
    }
  }
  if (!best && carry) return { lb: 'drop', prog: 0 };
  if (best) return best;
  let bb = null;
  bd = OPS.reach + 20 + (p.inRobot ? ROBOT.radius - 14 : 0);
  for (const b of game.structures.blocks) {
    if (b.kind !== 'decoy' && b.kind !== 'repair') continue;
    const d = Math.hypot(b.x + b.w / 2 - p.x, b.y + b.h / 2 - p.y) - b.w / 2;
    if (d < bd) {
      bd = d;
      bb = b;
    }
  }
  if (!bb || (bb.kind === 'decoy' && bb.up)) return null;
  const cd = bb.kind === 'repair' ? bb.up >> 2 : 0;
  return { lb: bb.kind, prog: 0, sub: bb.kind === 'repair' ? (cd ? `recarga ${cd} s` : `${OPS.plans.repair.charges - (bb.up & 3)} cargas`) : '' };
}

// El siguiente punto al que ir y qué decir de él.
export function nextPoint(game, v) {
  const op = v && v.op;
  const p = game.player;
  if (!op || !p || op.s === 'resolve') return null;
  const near = (list) => {
    let best = null;
    for (const q of list) if (!best || Math.hypot(q[0] - p.x, q[1] - p.y) < Math.hypot(best[0] - p.x, best[1] - p.y)) best = q;
    return best;
  };
  if (op.k === 'nest' && op.fu >= 0 && !op.bl) {
    const e = near(op.ex || []);
    return e && Math.hypot(p.x - op.x, p.y - op.y) < op.R + 20 ? { x: e[0], y: e[1], exit: true } : null;
  }
  if (op.k === 'supply') {
    if (carrying(game, v)) return { x: op.dz[0], y: op.dz[1] };
    const c = near((op.cr || []).filter((k) => k[3] < 0 && !k[4]).map((k) => [k[1], k[2]]));
    return c ? { x: c[0], y: c[1] } : { x: op.dz[0], y: op.dz[1] };
  }
  const s = near((op.sp || []).map((q) => [q[0], q[1]]));
  return s ? { x: s[0], y: s[1] } : { x: op.x, y: op.y };
}

// Frase corta del objetivo actual y su progreso.
function goalText(game, v) {
  const op = v.op;
  if (op.s === 'resolve')
    return op.res === 'win' ? '¡Operación completada!' : op.res === 'fail' ? 'Objetivo fallido' : 'Retirada';
  if (op.k === 'convoy') {
    if (op.s === 'prep') return 'Ve al convoy marcado (prepárate antes)';
    if (op.gl > 0) return `Elimina a los guardias: ${op.gl}`;
    if (op.u < 0) return `Conecta motor y batería: ${op.on.filter(Boolean).length}/2`;
    if (op.op) return 'Saca el contenido de la caja';
    return `Protege el desbloqueo: ${Math.floor(op.u)}/${OPS.convoy.unlockT} s${op.pz ? ' · EN PAUSA: acércate' : ''}`;
  }
  if (op.k === 'nest') {
    if (op.bl) return 'Nido destruido';
    if (op.fu >= 0) return `¡Sal del área! ${op.fu.toFixed(1)} s`;
    if (op.s === 'prep') return 'Llega al nido y coloca las cargas';
    return `Cargas colocadas: ${op.n}/3`;
  }
  const carry = carrying(game, v);
  return `Entregados: ${op.n}/3${carry ? ' · llévalo al punto de entrega' : op.s === 'prep' ? ' · recoge un cargamento' : ''}`;
}

export function bindOps(game) {
  game.$('op-offer').addEventListener('click', (e) => {
    const b = e.target.closest('[data-op]');
    if (!b || game.state !== 'play') return;
    game.sfx.unlock();
    const i = Number(b.dataset.op);
    if (game.mode.viaServer()) game.online.send('op', { k: 'vote', i });
    else {
      game.ops.vote(game, 'me', i);
      game.saveProgress();
    }
    game.updateHud(true);
  });
  for (const id of ['btn-op-shop', 'btn-op-shop2'])
    game.$(id).addEventListener('click', () => {
      if (game.state === 'play') game.openShop();
    });
  // retirada: hay que mantener el botón OPS.retreatHold s (así no se abandona sin querer)
  const ret = game.$('btn-op-ret');
  const stop = () => {
    game.opRetT = -1;
    ret.style.setProperty('--k', 0);
  };
  ret.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    game.opRetT = 0;
  });
  ret.addEventListener('pointerup', stop);
  ret.addEventListener('pointerleave', stop);
  ret.addEventListener('pointercancel', stop);
  game.opRetT = -1;
}

function retreat(game) {
  if (game.mode.viaServer()) game.online.send('op', { k: 'ret' });
  else game.ops.retreat(game, 'me');
}

const fmtM = (d) => `${Math.max(1, Math.round(d / 10))} m`;

/** Cada fotograma de juego: paneles, aviso de H, radio, fundido y sonidos. */
export function updateOpsHud(game, dt) {
  const $ = game.$;
  const v = game.state === 'menu' ? null : opsView(game);
  const op = v && v.op;
  const of = v && v.of && !op ? v.of : null;
  const root = game.root;
  root.classList.toggle('op-on', !!op);
  root.classList.toggle('op-offer', !!of);
  sounds(game, v);
  // oferta por radio
  const osig = of ? `${of.k.join()}|${of.t}|${of.v.join()}|${of.n}` : '';
  if (game.cache.opOffer !== osig) {
    game.cache.opOffer = osig;
    $('op-offer').hidden = !of;
    if (of) {
      const group = of.t >= 0;
      const me = myIdx(game);
      const mine = (() => {
        for (let i = 0; i < of.v.length; i += 2) if (of.v[i] === me) return of.v[i + 1];
        return -1;
      })();
      const votes = [0, 0, 0];
      for (let i = 1; i < of.v.length; i += 2) votes[of.v[i]]++;
      $('op-offer-sub').textContent = group
        ? `Votad: ${of.t} s · gana la mayoría (empate: el líder). Cada participante cobra la recompensa.`
        : 'Operación opcional entre oleadas: la siguiente oleada sigue esperando.';
      $('op-cards').innerHTML = of.k
        .map((k, i) => {
          const inf = OP_INFO[k];
          return `<button type="button" class="op-card${mine === i ? ' on' : ''}" data-op="${i}">
            <b>${inf.name}</b><span class="op-goal">${inf.goal}</span>
            <span class="op-threat">⚠ ${inf.threat}</span>
            <span class="op-rw">$${of.rw[i].toLocaleString('es-MX')}${group ? ' para cada uno' : ''}</span>
            <small>${inf.plan} (la primera vez)</small>${group ? `<em>${votes[i]} voto${votes[i] === 1 ? '' : 's'}</em>` : ''}
          </button>`;
        })
        .join('');
      $('btn-op-skip').classList.toggle('on', mine === 2);
      $('btn-op-skip').textContent = `Seguir con las oleadas${group ? ` (${votes[2]})` : ''}`;
    }
  }
  // la operación en curso
  $('op-hud').hidden = !op;
  const pr = op ? opPrompt(game, v) : opPrompt(game, null);
  if (op) {
    const inf = OP_INFO[op.k];
    $('op-title').textContent = inf.short.toUpperCase();
    $('op-goal').textContent = goalText(game, v);
    const np = nextPoint(game, v);
    const p = game.player;
    $('op-dist').textContent = np && p ? `${np.exit ? 'Salida' : 'Objetivo'}: ${fmtM(Math.hypot(np.x - p.x, np.y - p.y))}` : '';
    // estado del objeto importante
    let bar = -1;
    let lbl = '';
    if (op.k === 'convoy') {
      bar = op.hp / op.mx;
      lbl = `Camión ${Math.round(bar * 100)}%`;
    } else if (op.k === 'nest' && op.fu >= 0 && !op.bl) {
      bar = op.fu / OPS.nest.fuse;
      lbl = `Explosión en ${Math.ceil(op.fu)} s`;
    } else if (op.k === 'convoy' && op.u >= 0) bar = op.u / OPS.convoy.unlockT;
    $('op-bar').hidden = bar < 0;
    if (bar >= 0) {
      $('op-bar-fill').style.transform = `scaleX(${Math.max(0, Math.min(1, bar))})`;
      $('op-bar-lbl').textContent = lbl;
      $('op-bar').classList.toggle('hot', op.k === 'nest' || (op.k === 'convoy' && !!op.hit));
    }
    $('btn-op-shop').hidden = op.s !== 'prep';
    const rv = op.rv || [0, 1];
    $('btn-op-ret').hidden = op.s === 'resolve';
    $('op-ret-n').textContent = rv[0] ? ` ${rv[0]}/${rv[1]}` : '';
    $('op-hud').classList.toggle('danger', op.k === 'nest' && op.fu >= 0 && !op.bl);
    // retirada mantenida
    if (game.opRetT >= 0) {
      game.opRetT += dt;
      $('btn-op-ret').style.setProperty('--k', Math.min(1, game.opRetT / OPS.retreatHold));
      if (game.opRetT >= OPS.retreatHold) {
        game.opRetT = -1;
        $('btn-op-ret').style.setProperty('--k', 0);
        retreat(game);
      }
    }
  }
  // tecla H (y su botón en el celular)
  $('op-use').hidden = !pr;
  $('btn-use').classList.toggle('gone', !pr);
  if (pr) {
    const t = `${OP_LABELS[pr.lb] || ''}${pr.sub ? ` (${pr.sub})` : ''}`;
    if (game.cache.opUse !== t) {
      game.cache.opUse = t;
      $('op-use-t').textContent = t;
    }
    $('op-use').style.setProperty('--k', pr.prog || 0);
    $('btn-use').style.setProperty('--k', pr.prog || 0);
  }
  // radio: el último mensaje unos segundos (sólo cuando llega uno nuevo)
  const rd = v && v.rd;
  if (rd && rd[0] !== game.cache.opRadio) {
    const first = game.cache.opRadio === undefined;
    game.cache.opRadio = rd[0];
    if (!first || op || of) {
      $('op-radio-t').textContent = rd[1];
      $('op-radio').classList.add('show');
      game.sfx.radio();
      clearTimeout(game.opRadioT);
      game.opRadioT = setTimeout(() => $('op-radio').classList.remove('show'), 5200);
    }
  }
  // fundido del regreso y el resultado
  const fade = fadeOf(v);
  $('op-fade').style.opacity = fade.toFixed(3);
  $('op-fade').hidden = fade <= 0;
  if (fade > 0 && op) {
    $('op-fade-t').textContent =
      op.res === 'win' ? 'Operación completada' : op.res === 'fail' ? 'Operación fallida' : 'Retirada';
    $('op-fade-s').textContent =
      op.res === 'win'
        ? `+$${op.rw.toLocaleString('es-MX')}${op.pn ? ` · Plano nuevo: ${PLAN_NAMES[op.pn]}` : ''}`
        : 'Sin recompensa. Volvéis al descanso: la siguiente oleada sigue esperando';
  }
}

// Sonidos por cambios en lo que se ve (en línea no hay otra forma de saberlo): componente o carga
// terminada, golpe al camión, entrega, alerta de fase, cuenta atrás y recompensa.
function sounds(game, v) {
  const op = v && v.op;
  const was = game.opsPrev;
  game.opsPrev = op ? { id: op.id, k: op.k, s: op.s, res: op.res, hp: op.hp, ph: op.ph, on: op.on ? op.on.join() : '', o: op.op, n: op.n, fu: op.fu, bl: op.bl, car: (op.cr || []).map((c) => c[3]).join(), an: !!op.an, sp: (op.sp || []).length } : null;
  const sfx = game.sfx;
  if (!op || !was || was.id !== op.id) return;
  const now = game.opsPrev;
  if (now.res && !was.res) {
    if (now.res === 'win') sfx.reward();
    else sfx.opAlert();
  }
  if (op.k === 'convoy') {
    if (now.on !== was.on || (now.o && !was.o)) sfx.opDone();
    if (now.hp < was.hp && game.time - (game.opHitT || 0) > 0.35) {
      game.opHitT = game.time;
      sfx.opHit();
    }
    if (now.ph !== was.ph && now.ph > 0) sfx.opAlert();
  } else if (op.k === 'nest') {
    if (now.n > was.n) sfx.opCharge();
    if (now.fu >= 0 && was.fu >= 0 && Math.ceil(now.fu) !== Math.ceil(was.fu) && now.fu > 0) sfx.opTick(now.fu < 4);
    if (now.bl && !was.bl && game.mode.viaServer()) game.camera.shake(0.7);
  } else {
    if (now.n > was.n) sfx.opDeliver();
    else if (now.car !== was.car) sfx.opDone();
    if (now.an && !was.an) sfx.opAlert();
  }
}
