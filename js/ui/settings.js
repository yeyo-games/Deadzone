// Ajustes del jugador (se guardan en este navegador): volumen de la música y de los efectos, cuánto tiembla
// la cámara, si salen los números de daño y la calidad del dibujo (automática o fija). Se abren desde el
// menú y desde la pausa en una ventana encima de la pantalla (#settings); no es un estado del juego.
import { storage } from '../core/util.ts';
import { resize } from '../render/scene.js';
import { on } from './dom.js';

const KEY = 'dz-ajustes';
export const DEFAULTS = { music: 1, fx: 1, shake: 1, numbers: true, quality: 'auto' };
// calidad fija: fracción de la resolución de dibujo (la automática la elige adaptQuality)
const QUALITY = { high: 1, mid: 0.75, low: 0.55 };

/** Los ajustes guardados (con los de fábrica para lo que falte). */
export function loadSettings() {
  const s = storage.get(KEY, null);
  return { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) };
}

/** Aplica los ajustes al sonido, la cámara, las partículas y la resolución. */
export function applySettings(game) {
  const s = game.settings;
  game.sfx.setVolumes(s.music, s.fx);
  game.camera.shakeK = s.shake;
  if (s.quality !== 'auto') {
    game.quality = QUALITY[s.quality] || 1;
    resize(game);
  }
  game.particles.thin = particleThin(game.quality || 1);
}

/** Con la calidad baja salen menos partículas (humo, chispas, polvo): 0 = todas. */
export const particleThin = (q) => (q <= 0.55 ? 0.5 : q <= 0.7 ? 0.3 : q <= 0.85 ? 0.12 : 0);

function save(game) {
  storage.set(KEY, game.settings);
  applySettings(game);
}

function render(game) {
  const s = game.settings;
  const $ = game.$;
  for (const k of ['music', 'fx', 'shake']) {
    $(`set-${k}`).value = String(Math.round(s[k] * 100));
    $(`set-${k}-v`).textContent = `${Math.round(s[k] * 100)} %`;
  }
  $('set-numbers').classList.toggle('on', !!s.numbers);
  $('set-numbers').textContent = s.numbers ? 'Sí' : 'No';
  for (const b of $('set-quality').querySelectorAll('button')) b.classList.toggle('on', b.dataset.q === s.quality);
}

export function openSettings(game) {
  render(game);
  game.$('settings').hidden = false;
}

export function closeSettings(game) {
  game.$('settings').hidden = true;
}

export function bindSettings(game) {
  const $ = game.$;
  on(game, 'btn-settings', () => openSettings(game));
  on(game, 'btn-pause-settings', () => openSettings(game));
  on(game, 'btn-settings-done', () => closeSettings(game));
  for (const k of ['music', 'fx', 'shake']) {
    $(`set-${k}`).addEventListener('input', (e) => {
      game.settings[k] = Number(e.target.value) / 100;
      $(`set-${k}-v`).textContent = `${e.target.value} %`;
      save(game);
      // un sonido de prueba para oír el volumen de los efectos
      if (k === 'fx') game.sfx.pickup();
    });
  }
  on(game, 'set-numbers', () => {
    game.settings.numbers = !game.settings.numbers;
    save(game);
    render(game);
  });
  $('set-quality').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-q]');
    if (!b) return;
    game.settings.quality = b.dataset.q;
    // al volver a la automática empieza por la máxima y adaptQuality la ajusta
    if (b.dataset.q === 'auto') {
      game.quality = 1;
      resize(game);
    }
    save(game);
    render(game);
  });
  // tocar fuera de la ventana la cierra
  $('settings').addEventListener('pointerdown', (e) => {
    if (e.target === $('settings')) closeSettings(game);
  });
}
