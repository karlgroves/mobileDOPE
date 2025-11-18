/**
 * Ammunition and optic manufacturers database
 */

/**
 * Common ammunition manufacturers
 */
export const AMMO_MANUFACTURERS = [
  'Federal',
  'Hornady',
  'Winchester',
  'Remington',
  'Barnes',
  'Nosler',
  'Sierra',
  'Berger',
  'Lapua',
  'Norma',
  'Black Hills',
  'HSM',
  'Sellier & Bellot',
  'Prvi Partizan',
  'IMI',
  'Aguila',
  'Fiocchi',
  'Magtech',
  'Speer',
  'Eley',
  'RWS',
  'Custom/Handload',
  'Other',
].sort();

/**
 * Common optic/scope manufacturers
 */
export const OPTIC_MANUFACTURERS = [
  'Nightforce',
  'Vortex',
  'Leupold',
  'Schmidt & Bender',
  'Kahles',
  'Zeiss',
  'Swarovski',
  'Steiner',
  'Bushnell',
  'Nikon',
  'Burris',
  'Trijicon',
  'Athlon',
  'Primary Arms',
  'Sig Sauer',
  'Tract',
  'Maven',
  'Meopta',
  'Tangent Theta',
  'March',
  'US Optics',
  'Premier',
  'Minox',
  'Valdada',
  'IOR',
  'Horus Vision',
  'Other',
].sort();

/**
 * Search manufacturers by name
 */
export function searchAmmoManufacturers(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  return AMMO_MANUFACTURERS.filter((m) => m.toLowerCase().includes(lowerQuery));
}

/**
 * Search optic manufacturers by name
 */
export function searchOpticManufacturers(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  return OPTIC_MANUFACTURERS.filter((m) => m.toLowerCase().includes(lowerQuery));
}
