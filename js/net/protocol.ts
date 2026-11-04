// Contrato de red compartido por el cliente (online.js) y el servidor: tablas de índices
// y bits de la entrada. No importa nada, así que carga igual en el navegador y en Node.
// El formato de la foto del mundo está en snapshot.js (quien la codifica) y como tipo en core/types.d.ts (WorldSnap).
//
// Mensajes del servidor en línea (Colyseus): snap (foto: WorldSnap + lo propio de cada jugador) · load · go · resume
//   · results · notice · error · shutdown · p; el cliente manda in · act · buy · pick · next · ready · cls · start · loaded
//   · op (operaciones: votar la oferta { k: 'vote', i } o pedir la retirada { k: 'ret' }).

// índices que viajan en las fotos en lugar de los nombres
export const TYPES = [
  'normal',
  'swat',
  'sprinter',
  'fat',
  'heavy',
  'golden',
  'bull',
  'giant',
  'rock',
  'supremo',
  'aplastador',
  'campanero',
  'contaminado',
  'carcelero',
  'cazadora',
  'excavador',
  'generador',
  'reina',
  'devorador',
  'incendiario',
  'arquitecto',
  'tormenta',
  'titan',
  'rey',
];
export const PICKS = ['ammo', 'med', 'crate'];

// bits de la entrada
export const IN_RUN = 1;
export const IN_FIRE = 2;
export const IN_RELOAD = 4;
// tecla H (o su botón) mantenida: operaciones y piezas de plano (sim/ops.ts)
export const IN_USE = 8;

// efectos que el cliente genera por su cuenta (no hace falta mandarlos)
export const PARTICLE_SKIP = new Set([
  'constructor',
  'add',
  'update',
  'draw',
  'clear',
  'rocketTrail',
  'atgmTrail',
  'burning',
]);
export const SFX_SYNC = [
  'shot',
  'hit',
  'kill',
  'stomp',
  'explosion',
  'acid',
  'ricochet',
  'blockHit',
  'blockBreak',
  'build',
  'turret',
  'goldenSpawn',
  'punch',
  'bullRoar',
  'bullCharge',
  'bullHit',
  'bullSlam',
  'throwBottle',
  'molotov',
  'crackle',
  'burnScream',
  'rocketStick',
  'rocketArm',
  'gore',
  'wave',
  'missile',
  'atgm',
  'boost',
  'miniBoom',
  'decoy',
  'repair',
];
export const DECAL_SYNC = ['corpse', 'splat', 'drip', 'acid'];
