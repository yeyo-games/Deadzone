// Menú principal: preparar la escena de fondo, empezar o continuar una partida y el sonido.
import { rand, fmtTime, storage, TAU } from '../core/util.ts';
import { loadProgress } from '../save.js';
import { on } from './dom.js';
import { showClass } from './class.js';
import { refreshHall } from './board.js';
import { fitLook } from './look.js';
import { beginTuto, tutoDone } from './tutorial.js';
import { Solo } from '../net/mode.ts';
import { refreshEscapeMenu } from './escape.js';

export function setupMenu(game) {
  game.resetRun();
  game.player.alive = false;
  const { x, y } = game.world.spawn;
  for (let i = 0; i < 22; i++) {
    for (let t = 0; t < 8; t++) {
      const a = rand(0, TAU);
      const d = rand(160, 560);
      const zx = x + Math.cos(a) * d;
      const zy = y + Math.sin(a) * d;
      if (game.world.pointBlocked(zx, zy, 24)) continue;
      game.horde.spawn(i % 9 === 0 ? 'fat' : 'normal', zx, zy).spawnT = 0;
      break;
    }
  }
  game.setState('menu');
  // lo que esta cuenta no compró no se lleva puesto
  fitLook(game);
  const cur = game.accounts.current;
  game.$('acct-name').textContent = cur ? cur.name : 'Sin cuenta';
  game.$('acct-best').textContent =
    cur && cur.best ? `Tu récord: oleada ${cur.best.wave} · ${cur.best.kills} bajas` : '';
  const save = storage.get(game.accounts.saveKey(), null) || storage.get(game.accounts.checkKey(), null);
  game.$('btn-continue').hidden = !save;
  if (save) {
    game.$('btn-continue').textContent =
      save.dstate === 'active' ? `Continuar · ronda ${save.wave}` : `Continuar · ronda ${save.wave + 1}`;
  }
  game.$('btn-start').textContent = save ? 'Nueva partida' : 'Jugar';
  game.$('btn-start').classList.toggle('primary', !save);
  refreshHall(game);
  refreshEscapeMenu(game);
  const best = storage.get('dz-best', null);
  game.$('best').textContent = best ? `Récord: ${fmtTime(best.time)} · ${best.kills} bajas · oleada ${best.wave}` : '';
}

export function start(game, freshWorld) {
  game.sfx.unlock();
  // repetir el entrenamiento es sólo práctica: no toca la partida guardada
  const practice = !!game.forceTuto;
  // una partida nueva sustituye al progreso guardado
  if (!practice) {
    storage.remove(game.accounts.saveKey());
    storage.remove(game.accounts.checkKey());
  }
  if (freshWorld) game.newWorld();
  game.resetRun();
  // la práctica no se guarda ni cuenta para récords (como una partida separada)
  if (practice) game.mode = new Solo(game, true);
  game.player.cls = game.classPick;
  // modo Huida (botón del menú): no se guarda ni cuenta para la clasificación de oleadas por ahora
  const escape = game.runKind === 'escape';
  game.runKind = 'waves';
  game.lastKind = escape ? 'escape' : 'waves';
  if (escape) {
    game.mode = new Solo(game, true);
    // un viaje nuevo reemplaza al guardado
    storage.remove(`${game.accounts.saveKey()}-huida`);
  }
  game.analitica.iniciar('solo');
  game.input.reset();
  game.input.setRun(false);
  game.setState('play');
  if (escape) game.escape.begin(game);
  // la primera partida (o si se pidió repetirlo) empieza con el entrenamiento
  else if (practice || !tutoDone(game)) beginTuto(game, practice);
  game.updateHud(true);
}

export function syncSoundLabel(game) {
  game.$('btn-sound').textContent = `Sonido: ${game.sfx.muted ? 'desactivado' : 'activado'}`;
}

export function tryFullscreen(game) {
  if (game.input.mode !== 'touch') return;
  const el = document.documentElement;
  try {
    const r = el.requestFullscreen && el.requestFullscreen({ navigationUI: 'hide' });
    if (r && r.catch) r.catch(() => {});
  } catch {
    /* Safari en iPhone no admite pantalla completa para páginas */
  }
}

// Botones del menú: jugar, continuar y sonido.
export function bindMenu(game) {
  on(game, 'btn-start', () => {
    tryFullscreen(game);
    game.runKind = 'waves';
    showClass(game, false);
  });
  on(game, 'btn-continue', () => {
    tryFullscreen(game);
    if (!loadProgress(game)) start(game, false);
  });
  on(game, 'btn-sound', () => {
    game.sfx.setMuted(!game.sfx.muted);
    syncSoundLabel(game);
  });
  syncSoundLabel(game);
}
