// Rumbo en palabras para la radio de las operaciones (arriba de la pantalla es el norte).
import { TAU } from '../../core/util.ts';

const NAMES = ['el este', 'el sureste', 'el sur', 'el suroeste', 'el oeste', 'el noroeste', 'el norte', 'el noreste'];

/** 'el norte', 'el sureste'… hacia (dx, dy). */
export function dirOf(dx: number, dy: number) {
  return NAMES[Math.round((Math.atan2(dy, dx) / TAU) * 8 + 8) % 8];
}
