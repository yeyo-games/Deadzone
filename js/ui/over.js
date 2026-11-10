// Pantalla de fin de partida (resultados y récord personal) y sus botones.
import { fmtTime, storage } from '../core/util.ts';
import { on } from './dom.js';
import { showClass } from './class.js';
import { comboMult, multText } from '../sim/combo.ts';
import { recordEscape } from './escape.js';

export function gameOver(game) {
  game.setState('over');
  const p = game.player;
  const escape = game.lastKind === 'escape';
  // la huida terminó (escapaste o no): ya no hay viaje que continuar
  if (escape) storage.remove(`${game.accounts.saveKey()}-huida`);
  // título y frase según cómo terminó (Huida: escapaste, explotó la camioneta o caíste)
  const res = escape ? game.escapeResult : '';
  const title = game.root.querySelector('#screen-over .dead-title');
  const lead = game.root.querySelector('#screen-over .lead');
  const kicker = game.root.querySelector('#screen-over .kicker');
  game.$('screen-over').classList.toggle('won', res === 'won');
  kicker.textContent = escape ? 'Fin de la huida' : 'Fin de la partida';
  title.textContent = res === 'won' ? '¡Escapaste!' : res === 'van' ? 'Sin camioneta' : 'Has caído';
  lead.textContent = escape
    ? res === 'won'
      ? `Cruzaste el puente tras ${game.escape.stop} paradas: la ciudad queda atrás.`
      : res === 'van'
        ? 'La horda destrozó la camioneta: sin ella no hay forma de salir.'
        : 'Te alcanzaron antes de llegar a la camioneta.'
    : 'Perdiste todo tu progreso: la próxima partida empieza desde la oleada 1.';
  const total = game.totalKills();
  const acc = p.shotsFired ? Math.round((p.shotsHit / p.shotsFired) * 100) : 0;
  // mejor racha de la partida y récord de este dispositivo
  const combo = p.combo.best;
  const comboBest = storage.get('dz-combo', 0) || 0;
  if (combo > comboBest) storage.set('dz-combo', combo);
  const mult = comboMult(combo);
  const comboTxt = `${combo}${mult > 1 ? ` (${multText(mult)})` : ''}${combo > comboBest && comboBest ? ' · récord' : ''}`;
  const e = game.escape;
  const rows = [
    ['Tiempo sobrevivido', fmtTime(game.time)],
    ...(escape
      ? [
          ['Parada', `${e.stop} de ${e.total}`],
          ['Bidones', e.have],
          ['Amenaza alcanzada', e.level],
        ]
      : [['Oleada alcanzada', game.director.wave]]),
    ['Nivel', game.level],
    ['sep'],
    ['Zombis eliminados', total],
    ['Normales', game.kills.normal],
    ['Policías SWAT', game.kills.swat],
    ['Velocistas', game.kills.sprinter],
    ['Gordos', game.kills.fat],
    ['Dorados', game.kills.golden || 0],
    ['Super blindados', game.kills.heavy],
    ['Toros', game.kills.bull || 0],
    ['Rocosos', game.kills.rock || 0],
    ['Demonios rojos', game.kills.demon || 0],
    ['sep'],
    ['Mejor racha', comboTxt],
    ['Precisión', `${acc}%`],
    ['Daño recibido', Math.round(p.damageTaken)],
    ['Dinero ganado', `$${game.moneyEarned}`],
  ];
  const dl = game.$('results');
  dl.innerHTML = '';
  for (const [k, v] of rows) {
    if (k === 'sep') {
      const s = document.createElement('div');
      s.className = 'sep';
      dl.appendChild(s);
      continue;
    }
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }
  if (game.devUsed) {
    game.$('over-best').textContent = 'Partida con modo desarrollador: no cuenta para los récords';
    return;
  }
  // la Huida tiene su propio récord (paradas, veces que escapaste y la huida más rápida)
  if (escape) {
    game.$('over-best').textContent = recordEscape(game);
    return;
  }
  const best = storage.get('dz-best', null);
  const record = !best || game.time > best.time;
  if (record) storage.set('dz-best', { time: game.time, kills: total, wave: game.director.wave });
  game.$('over-best').textContent = record
    ? 'Nuevo récord personal'
    : `Récord: ${fmtTime(best.time)} · ${best.kills} bajas`;
}

// Botones de reiniciar y volver al menú (de la pausa y del fin de partida).
export function bindOver(game) {
  const again = () => {
    const why = game.mode.restartBlocked();
    if (why) return game.toast(why);
    // otra huida
    if (game.lastKind === 'escape') {
      game.runKind = 'escape';
      return showClass(game, true);
    }
    // venías de una sala en línea: al menú, donde sigue tu partida normal
    if (game.mode.detached) {
      game.newWorld();
      return game.setupMenu();
    }
    showClass(game, true);
  };
  on(game, 'btn-restart', again);
  on(game, 'btn-again', again);
  const toMenu = () => {
    game.online.leave();
    game.newWorld();
    game.setupMenu();
  };
  on(game, 'btn-menu', toMenu);
  on(game, 'btn-over-menu', toMenu);
}
