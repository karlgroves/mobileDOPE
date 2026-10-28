/**
 * Custom caliber rules (#67, "add caliber database management").
 *
 * The pure half of managing the shooter's own calibers: what a valid one is,
 * and how the saved list changes when one is added, edited or removed. What
 * happens to the rifle and ammo profiles that use one lives in
 * `services/CaliberService.ts`; the list itself is saved with the app settings.
 */

import { isSeededCaliber, type CustomCaliber } from '../constants/calibers';

/**
 * Accepted bullet diameters, in inches: .17 rimfire to .50 BMG, the span of
 * the built-in list and the legacy lookup in `spinDrift.ts`. The usual mistake
 * is typing the number from the cartridge name -- 6.5, or 308 -- which this
 * catches rather than handing the solver a bullet forty times too fat.
 */
const MIN_DIAMETER = 0.17;
const MAX_DIAMETER = 0.51;

/** Longest name accepted. Long enough for any cartridge, short enough for the picker. */
const MAX_NAME_LENGTH = 40;

/** What the add/edit form holds. The diameter is undefined until one is entered. */
export interface CustomCaliberInput {
  name: string;
  diameter: number | undefined;
}

/** The outcome of {@link validateCustomCaliber}: a caliber, or why not. */
export interface CustomCaliberValidation {
  caliber?: CustomCaliber;
  errors: { name?: string; diameter?: string };
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Check a custom caliber before it is saved.
 *
 * @param input - The form's contents.
 * @param existing - The custom calibers already saved.
 * @param original - The name of the caliber being edited, if this is an edit.
 */
export function validateCustomCaliber(
  input: CustomCaliberInput,
  existing: readonly CustomCaliber[],
  original?: string
): CustomCaliberValidation {
  const name = input.name.trim();
  const errors: CustomCaliberValidation['errors'] = {};

  if (!name) {
    errors.name = 'Caliber name is required';
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `Keep the name to ${MAX_NAME_LENGTH} characters or fewer`;
  } else if (isSeededCaliber(name)) {
    errors.name = 'That caliber is already built in';
  } else if (
    existing.some(
      (caliber) =>
        sameName(caliber.name, name) &&
        !(original !== undefined && sameName(caliber.name, original))
    )
  ) {
    errors.name = 'You already have a caliber with that name';
  }

  const { diameter } = input;
  if (diameter === undefined || Number.isNaN(diameter)) {
    errors.diameter = 'Bullet diameter is required';
  } else if (diameter < MIN_DIAMETER || diameter > MAX_DIAMETER) {
    errors.diameter =
      `Enter the bullet diameter in inches, between ${MIN_DIAMETER.toFixed(3)} ` +
      `and ${MAX_DIAMETER.toFixed(3)}`;
  }

  if (errors.name || errors.diameter || diameter === undefined) return { errors };
  return { caliber: { name, diameter }, errors };
}

const byName = (a: CustomCaliber, b: CustomCaliber) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * The list with `caliber` added, or replacing `original` when editing. Kept in
 * name order so the picker and the management screen read the same way.
 */
export function upsertCustomCaliber(
  list: readonly CustomCaliber[],
  original: string | undefined,
  caliber: CustomCaliber
): CustomCaliber[] {
  const rest = original === undefined ? [...list] : list.filter((c) => c.name !== original);
  return [...rest, caliber].sort(byName);
}

/** The list without the caliber called `name`. */
export function removeCustomCaliber(list: readonly CustomCaliber[], name: string): CustomCaliber[] {
  return list.filter((caliber) => caliber.name !== name);
}
