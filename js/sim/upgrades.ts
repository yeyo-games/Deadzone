import { ABILITY, PERKS, RARITY, UPGRADE_SOURCES } from '../core/config.ts';
import { cooldownOf } from './abilities.ts';
import type { Player } from './player.ts';

// Cada mejora modifica las estadísticas reales del jugador. Las comunes son números; las raras,
// legendarias y sinergias cambian cómo juegas (lo que hacen vive en perks.ts, sus cifras en PERKS).
// rarity: clave de RARITY (comun si no se dice); multiplica su peso y fija el nivel desde el que sale.
export type Upgrade = {
  id: string;
  name: string;
  desc: string;
  icon: string;
  apply: (p: Player) => unknown;
  max?: number;
  repeat?: boolean;
  when?: (p: Player) => boolean;
  weight?: number;
  minLevel?: number;
  rarity?: string;
  weapon?: boolean;
};

const pct = (k: number) => `${Math.round(k * 100)}%`;

export const UPGRADES: Upgrade[] = [
  {
    id: 'dmg',
    name: 'Munición pesada',
    desc: '+15% daño de armas',
    icon: 'dmg',
    apply: (p) => (p.stats.dmgMult += 0.15),
  },
  {
    id: 'rate',
    name: 'Gatillo ligero',
    desc: '+10% velocidad de disparo',
    icon: 'rate',
    apply: (p) => (p.stats.rateMult += 0.1),
  },
  {
    id: 'hp',
    name: 'Aguante',
    desc: '+20% vida máxima',
    icon: 'hp',
    apply: (p) => {
      p.stats.maxHp += 20;
      p.hp += 20;
    },
  },
  {
    id: 'armor',
    name: 'Chaleco reforzado',
    desc: '+15% resistencia al daño',
    icon: 'armor',
    max: 5,
    apply: (p) => (p.stats.armor = 1 - (1 - p.stats.armor) * 0.85),
  },
  {
    id: 'stam',
    name: 'Pulmones de acero',
    desc: '+20% estamina máxima',
    icon: 'stam',
    apply: (p) => {
      p.stats.maxStamina += 20;
      p.stamina += 20;
    },
  },
  {
    id: 'regen',
    name: 'Segundo aliento',
    desc: '+15% recuperación de estamina',
    icon: 'regen',
    apply: (p) => (p.stats.staminaRegenMult += 0.15),
  },
  {
    id: 'speed',
    name: 'Botas ligeras',
    desc: '+10% velocidad de movimiento',
    icon: 'speed',
    max: 5,
    apply: (p) => (p.stats.speedMult += 0.1),
  },
  {
    id: 'ammo',
    name: 'Cargadores extendidos',
    desc: '+25% capacidad de munición',
    icon: 'ammo',
    max: 4,
    apply: (p) => {
      p.stats.ammoMult += 0.25;
      for (const w of p.weapons) {
        w.mag = p.magSize(w.def);
        if (w.reserve !== Infinity) w.reserve = Math.min(p.reserveMax(w.def), w.reserve + w.def.pickup);
      }
    },
  },
  {
    id: 'pierce',
    name: 'Balas perforantes',
    desc: 'Las balas atraviesan +1 enemigo',
    icon: 'pierce',
    max: 3,
    apply: (p) => (p.stats.pierce += 1),
  },
  {
    id: 'reload',
    name: 'Manos rápidas',
    desc: '+15% velocidad de recarga',
    icon: 'reload',
    max: 5,
    apply: (p) => (p.stats.reloadMult += 0.15),
  },
  {
    id: 'heal',
    name: 'Botiquín de campaña',
    desc: 'Recupera 40% de la vida',
    icon: 'heal',
    repeat: true,
    when: (p) => p.hp < p.stats.maxHp * 0.7,
    apply: (p) => (p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * 0.4)),
  },
  {
    id: 'abcd',
    name: 'Instinto táctico',
    desc: '-15% espera de la habilidad (mín. 20 s)',
    icon: 'cd',
    weight: 1.2,
    when: (p) => !!p.cls && cooldownOf(p) > ABILITY.minCooldown + 0.01,
    apply: (p) => (p.stats.cdMult *= ABILITY.cdStep),
  },

  /* ---------- raras ---------- */
  {
    id: 'incend',
    name: 'Balas incendiarias',
    desc: `Tus balas prenden fuego a los zombis (${String(PERKS.burn).replace('.', ',')} s más por nivel)`,
    icon: 'fire',
    rarity: 'rara',
    max: 2,
    apply: (p) => (p.stats.burn += PERKS.burn),
  },
  {
    id: 'ricochet',
    name: 'Rebote',
    desc: 'Cada bala salta a otro zombi cercano al impactar (+1 rebote por nivel)',
    icon: 'bounce',
    rarity: 'rara',
    max: 2,
    apply: (p) => (p.stats.bounce += 1),
  },
  {
    id: 'vamp',
    name: 'Sed de sangre',
    desc: `Cada zombi que matas a balazos te cura ${PERKS.vamp} de vida`,
    icon: 'vamp',
    rarity: 'rara',
    max: 3,
    apply: (p) => (p.stats.vamp += PERKS.vamp),
  },
  {
    id: 'greed',
    name: 'Codicia',
    desc: `+${pct(PERKS.greed)} de dinero por cada baja`,
    icon: 'greed',
    rarity: 'rara',
    max: 3,
    apply: (p) => (p.stats.greed += PERKS.greed),
  },
  {
    id: 'frenzy',
    name: 'Frenesí',
    desc: `+${pct(PERKS.frenzy)} de cadencia mientras tu racha esté activa`,
    icon: 'frenzy',
    rarity: 'rara',
    max: 2,
    apply: (p) => (p.stats.frenzy += PERKS.frenzy),
  },

  /* ---------- legendarias ---------- */
  {
    id: 'twin',
    name: 'Doble cañón',
    desc: 'Cada disparo lanza una bala más (no cohetes ni lanzallamas)',
    icon: 'twin',
    rarity: 'legendaria',
    max: 2,
    apply: (p) => (p.stats.twin += 1),
  },
  {
    id: 'volatile',
    name: 'Carga volátil',
    desc: `Los zombis que matas a balazos pueden estallar (${pct(PERKS.volatile.chance)})`,
    icon: 'volatile',
    rarity: 'legendaria',
    max: 1,
    apply: (p) => (p.stats.volatile = 1),
  },
  {
    id: 'laststand',
    name: 'Última oportunidad',
    desc: `Una vez por oleada, un golpe mortal te deja con ${pct(PERKS.lastStand.hp)} de vida y aparta a la horda`,
    icon: 'laststand',
    rarity: 'legendaria',
    max: 1,
    apply: (p) => (p.stats.lastStand = 1),
  },

  /* ---------- sinergias: sólo si ya tienes las dos mejoras que combinan ---------- */
  {
    id: 'inferno',
    name: 'Infierno',
    desc: 'Incendiarias + Volátil: todo zombi que muere ardiendo estalla y prende a los de alrededor',
    icon: 'inferno',
    rarity: 'sinergia',
    max: 1,
    when: (p) => p.stats.burn > 0 && p.stats.volatile > 0,
    apply: (p) => (p.stats.inferno = 1),
  },
  {
    id: 'chain',
    name: 'Reacción en cadena',
    desc: 'Rebote + Perforantes: los rebotes no pierden daño y cada bala rebota una vez más',
    icon: 'chain',
    rarity: 'sinergia',
    max: 1,
    when: (p) => p.stats.bounce > 0 && p.stats.pierce > 0,
    apply: (p) => {
      p.stats.bounce += 1;
      p.stats.bounceKeep = 1;
    },
  },
];

/** Rareza de una mejora (comun si no tiene). */
export const rarityOf = (u: Pick<Upgrade, 'rarity'>) => (u.rarity && RARITY[u.rarity] ? u.rarity : 'comun');

/** Peso de una mejora en la tanda: el suyo por el de su rareza. */
const weightOf = (u: Upgrade) => (u.weight || 1) * RARITY[rarityOf(u)].weight;

/** De dónde sale una tanda: subir de nivel, el zombi dorado o el cofre de un jefe (UPGRADE_SOURCES). */
export type UpgradeSource = 'level' | 'golden' | 'boss' | 'fuel';
export const isSource = (s: unknown): s is UpgradeSource => typeof s === 'string' && s in UPGRADE_SOURCES;

/** Saca de pool una mejora al azar según su peso. */
function draw(pool: Upgrade[]) {
  const total = pool.reduce((s, u) => s + weightOf(u), 0);
  let r = Math.random() * total;
  let idx = 0;
  for (; idx < pool.length; idx++) {
    r -= weightOf(pool[idx]);
    if (r <= 0) break;
  }
  return pool.splice(Math.min(idx, pool.length - 1), 1)[0];
}

/**
 * Tanda de `count` mejoras para elegir. opt.source: de dónde sale (subir de nivel por omisión) y
 * opt.wave: la oleada (al subir de nivel, cada rareza sale desde su RARITY.fromWave; sin oleada, todas).
 * El cofre del jefe trae siempre la sinergia que tengas lista; si a una fuente no le quedan mejoras de
 * su rareza, completa con las de la siguiente lista de UPGRADE_SOURCES.
 */
export function rollUpgrades(
  player: Player,
  level: number,
  taken: Record<string, number>,
  count = 3,
  opt: { source?: UpgradeSource; wave?: number } = {},
) {
  const src = UPGRADE_SOURCES[opt.source || 'level'];
  // antes de la primera oleada (o sin oleada) cuenta como la 1: las comunes siempre salen
  const wave = Math.max(1, opt.wave ?? Number.POSITIVE_INFINITY);
  const ok = (u: Upgrade) => {
    if (u.minLevel && level < u.minLevel) return false;
    if (opt.source === 'level' || !opt.source) if (wave < RARITY[rarityOf(u)].fromWave) return false;
    if (u.when && !u.when(player)) return false;
    if (u.max && (taken[u.id] || 0) >= u.max) return false;
    return true;
  };
  const out: Upgrade[] = [];
  for (const rarities of src.rarities) {
    const pool = UPGRADES.filter((u) => rarities.includes(rarityOf(u)) && !out.includes(u) && ok(u));
    // la sinergia lista no se sortea: va primero
    for (const u of pool.filter((x) => rarityOf(x) === 'sinergia'))
      if (out.length < count) out.push(pool.splice(pool.indexOf(u), 1)[0]);
    while (out.length < count && pool.length) out.push(draw(pool));
    if (out.length >= count) break;
  }
  return out;
}

const P = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
export const ICONS = {
  dmg: `<svg viewBox="0 0 24 24" ${P}><path d="M9 21V8l3-5 3 5v13z"/><path d="M9 16h6"/></svg>`,
  rate: `<svg viewBox="0 0 24 24" ${P}><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>`,
  hp: `<svg viewBox="0 0 24 24" ${P}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>`,
  armor: `<svg viewBox="0 0 24 24" ${P}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/></svg>`,
  stam: `<svg viewBox="0 0 24 24" ${P}><path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h7"/></svg>`,
  regen: `<svg viewBox="0 0 24 24" ${P}><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/></svg>`,
  speed: `<svg viewBox="0 0 24 24" ${P}><path d="m5 6 6 6-6 6"/><path d="m13 6 6 6-6 6"/></svg>`,
  ammo: `<svg viewBox="0 0 24 24" ${P}><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M10 7h4M10 11h4M10 15h4"/></svg>`,
  pierce: `<svg viewBox="0 0 24 24" ${P}><circle cx="9" cy="12" r="3"/><circle cx="16" cy="12" r="3"/><path d="M2 12h20M19 9l3 3-3 3"/></svg>`,
  reload: `<svg viewBox="0 0 24 24" ${P}><path d="M4 12a8 8 0 0 1 14-5l2 2"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5l-2-2"/><path d="M4 20v-5h5"/></svg>`,
  heal: `<svg viewBox="0 0 24 24" ${P}><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M12 10v6M9 13h6M9 6V4h6v2"/></svg>`,
  cd: `<svg viewBox="0 0 24 24" ${P}><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>`,
  gun: `<svg viewBox="0 0 24 24" ${P}><path d="M3 9h15l2 2v2h-8l-1 2H7l-1 5H3z"/><path d="M18 9V7"/></svg>`,
  fire: `<svg viewBox="0 0 24 24" ${P}><path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 5-5 8 0 4 3 7 7 7z"/><path d="M12 22c-2 0-3-1.5-3-3.5S11 15 12 13c1 2 3 3.5 3 5.5S14 22 12 22z"/></svg>`,
  bounce: `<svg viewBox="0 0 24 24" ${P}><circle cx="5" cy="17" r="2"/><circle cx="19" cy="17" r="2"/><path d="M6.5 15.5 12 6l5.5 9.5"/><path d="m9.5 7 2.5-1 1 2.5"/></svg>`,
  vamp: `<svg viewBox="0 0 24 24" ${P}><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/><path d="M10 15h4M12 13v4"/></svg>`,
  greed: `<svg viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="9"/><path d="M15 9c-.5-1.2-1.7-2-3-2-1.7 0-3 1-3 2.5S10.3 12 12 12s3 1 3 2.5S13.7 17 12 17c-1.3 0-2.5-.8-3-2M12 5v2M12 17v2"/></svg>`,
  frenzy: `<svg viewBox="0 0 24 24" ${P}><path d="M4 18 9 6l3 8 3-6 5 10"/><path d="M2 21h20"/></svg>`,
  twin: `<svg viewBox="0 0 24 24" ${P}><path d="M3 8h13l2 2"/><path d="M3 15h13l2 2"/><path d="M20 10h2M20 17h2"/></svg>`,
  volatile: `<svg viewBox="0 0 24 24" ${P}><path d="m12 2 2 6 6-2-3 5 5 3-6 1 1 6-5-4-5 4 1-6-6-1 5-3-3-5 6 2z"/></svg>`,
  laststand: `<svg viewBox="0 0 24 24" ${P}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="M12 16s-3-1.8-3-4a1.6 1.6 0 0 1 3-1 1.6 1.6 0 0 1 3 1c0 2.2-3 4-3 4z"/></svg>`,
  inferno: `<svg viewBox="0 0 24 24" ${P}><path d="M12 21c3.5 0 6-2.5 6-6 0-3-2-5-3-8-1.5 1.5-2.5 3-2.5 5-1-1-1.5-2-1.5-3.5C8.5 11 6 13 6 15c0 3.5 2.5 6 6 6z"/><path d="M3 12h2M19 12h2M5 5l1.5 1.5M19 5l-1.5 1.5"/></svg>`,
  chain: `<svg viewBox="0 0 24 24" ${P}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>`,
};
