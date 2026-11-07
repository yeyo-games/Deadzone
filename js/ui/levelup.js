// Mejoras: las tarjetas y la elección (en línea las ofrece y aplica el servidor). Una tanda sale de subir
// de nivel o es un premio: el botín del zombi dorado (una rara) o el cofre de un jefe (una legendaria o la
// sinergia lista); los premios pendientes van en game.bonusPicks y se ofrecen antes que los niveles.
import { RARITY, UPGRADE_SOURCES } from '../core/config.ts';
import { rollUpgrades, ICONS, rarityOf } from '../sim/upgrades.ts';

export function openLevelUp(game) {
  game.setState('levelup');
  game.sfx.level();
  const lvl = game.level - game.pendingLevels + 1;
  // en línea las ofrece el servidor (es quien aplica la mejora) y dice de dónde salen
  const src = game.mode.viaServer() ? game.online.upSource() : game.bonusPicks?.[0] || 'level';
  game.choiceSrc = src;
  game.$('level-kicker').textContent = UPGRADE_SOURCES[src]?.title || `Nivel ${lvl} alcanzado`;
  game.choices = game.mode.viaServer()
    ? game.online.upChoices()
    : rollUpgrades(game.player, lvl, game.taken, 3, { source: src, wave: game.director.wave });
  const wrap = game.$('cards');
  wrap.classList.remove('ready');
  wrap.classList.toggle('prize', src !== 'level');
  wrap.innerHTML = '';
  game.choices.forEach((u, i) => {
    const b = document.createElement('button');
    const r = rarityOf(u);
    b.className = 'card' + (u.weapon ? ' weapon' : ` r-${r}`);
    const n = game.taken[u.id] || 0;
    // la rareza va en la etiqueta (Rara, Legendaria, Sinergia) y, si ya la tienes, el nivel que sigue
    const rn = r === 'comun' ? '' : RARITY[r].name;
    const tag = u.weapon ? 'Arma nueva' : n ? `${rn ? `${rn} · ` : ''}Nivel ${n + 1}` : rn || 'Mejora';
    b.innerHTML = `<span class="ic">${ICONS[u.icon]}</span><span class="nm"></span><span class="ds"></span><span class="tg">${tag} <span class="key">· tecla ${i + 1}</span></span>`;
    b.querySelector('.nm').textContent = u.name;
    b.querySelector('.ds').textContent = u.desc;
    b.addEventListener('click', () => chooseUpgrade(game, i));
    wrap.appendChild(b);
  });
  // breve espera para no elegir sin querer al estar disparando
  game.levelReadyAt = performance.now() + 450;
  setTimeout(() => wrap.classList.add('ready'), 450);
}

export function chooseUpgrade(game, i) {
  if (game.state !== 'levelup' || performance.now() < game.levelReadyAt) return;
  const u = game.choices[i];
  if (!u) return;
  game.analitica.eleccion(
    game.level - game.pendingLevels + 1,
    game.choices.map((c) => c.id),
    u.id,
  );
  if (game.mode.viaServer()) {
    // la siguiente tanda (si quedan niveles o premios) llega con la próxima foto del servidor
    game.online.pickUpgrade(i);
    game.taken[u.id] = (game.taken[u.id] || 0) + 1;
    game.input.reset();
    game.last = performance.now();
    return game.setState('play');
  }
  u.apply(game.player);
  game.taken[u.id] = (game.taken[u.id] || 0) + 1;
  // un premio se cobra aparte: no gasta un nivel
  if (game.choiceSrc !== 'level' && game.bonusPicks?.length) game.bonusPicks.shift();
  else game.pendingLevels--;
  if (u.weapon) game.toast(`${u.name} equipada`);
  if (game.pendingLevels > 0 || game.bonusPicks?.length) openLevelUp(game);
  else {
    game.input.reset();
    game.last = performance.now();
    game.setState('play');
  }
}
