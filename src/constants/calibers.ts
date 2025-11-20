/**
 * Common rifle calibers database
 * Organized by category for easier selection
 */

export interface CaliberInfo {
  name: string;
  category: string;
  description?: string;
}

export const COMMON_CALIBERS: CaliberInfo[] = [
  // Popular Precision Rifle Calibers
  { name: '.308 Winchester', category: 'Precision Rifle', description: '7.62x51mm NATO' },
  { name: '6.5 Creedmoor', category: 'Precision Rifle', description: 'Popular long-range' },
  { name: '.260 Remington', category: 'Precision Rifle', description: '6.5mm precision' },
  { name: '6mm Creedmoor', category: 'Precision Rifle', description: 'Low recoil precision' },
  { name: '6.5 PRC', category: 'Precision Rifle', description: 'Precision Rifle Cartridge' },
  { name: '.300 Winchester Magnum', category: 'Precision Rifle', description: 'Long-range magnum' },
  { name: '.338 Lapua Magnum', category: 'Precision Rifle', description: 'Extreme long-range' },
  { name: '6.5x47 Lapua', category: 'Precision Rifle', description: 'Match grade' },

  // Popular AR-15 Calibers
  { name: '.223 Remington', category: 'AR-15', description: '5.56x45mm' },
  { name: '5.56x45mm NATO', category: 'AR-15', description: 'Military standard' },
  { name: '.224 Valkyrie', category: 'AR-15', description: 'Long-range AR' },
  { name: '6.5 Grendel', category: 'AR-15', description: 'AR-15 long-range' },
  { name: '6mm ARC', category: 'AR-15', description: 'Advanced Rifle Cartridge' },
  { name: '.300 AAC Blackout', category: 'AR-15', description: 'Subsonic/supersonic' },

  // Popular AR-10 Calibers
  { name: '.308 Winchester', category: 'AR-10', description: '7.62x51mm NATO' },
  { name: '6.5 Creedmoor', category: 'AR-10', description: 'AR-10 precision' },
  { name: '.260 Remington', category: 'AR-10', description: 'AR-10 6.5mm' },

  // Classic Calibers
  { name: '.30-06 Springfield', category: 'Classic', description: 'Traditional hunting' },
  { name: '.270 Winchester', category: 'Classic', description: 'Flat shooting' },
  { name: '.243 Winchester', category: 'Classic', description: 'Varmint/deer' },
  { name: '7mm-08 Remington', category: 'Classic', description: 'Medium game' },
  { name: '7mm Remington Magnum', category: 'Classic', description: 'Long-range hunting' },

  // Match Calibers
  { name: '.223 Remington Match', category: 'Match', description: 'Competition .223' },
  { name: '.308 Winchester Match', category: 'Match', description: 'Competition .308' },
  { name: '6mm BR', category: 'Match', description: 'Benchrest' },
  { name: '6mm Dasher', category: 'Match', description: 'Improved 6BR' },
  { name: '.284 Winchester', category: 'Match', description: 'F-Class' },

  // Large Caliber
  { name: '.50 BMG', category: 'Large Caliber', description: 'Extreme long-range' },
  { name: '.416 Barrett', category: 'Large Caliber', description: 'ELR precision' },
  { name: '.375 CheyTac', category: 'Large Caliber', description: 'ELR match' },

  // Vintage/Classic
  { name: '.30-30 Winchester', category: 'Vintage', description: 'Lever action' },
  { name: '.45-70 Government', category: 'Vintage', description: 'Heavy bullet' },
  { name: '.303 British', category: 'Vintage', description: 'Military surplus' },

  // Wildcat/Custom
  { name: '6mm GT', category: 'Wildcat', description: 'PRS competition' },
  { name: '6.5x47 Lapua', category: 'Wildcat', description: 'Match wildcat' },
  { name: '6mm XC', category: 'Wildcat', description: 'Competition wildcat' },
];

/**
 * Get calibers by category
 */
export function getCalibersByCategory(category: string): CaliberInfo[] {
  return COMMON_CALIBERS.filter((c) => c.category === category);
}

/**
 * Get all unique categories
 */
export function getCaliberCategories(): string[] {
  const categories = new Set(COMMON_CALIBERS.map((c) => c.category));
  return Array.from(categories).sort();
}

/**
 * Search calibers by name
 */
export function searchCalibers(query: string): CaliberInfo[] {
  const lowerQuery = query.toLowerCase();
  return COMMON_CALIBERS.filter(
    (c) =>
      c.name.toLowerCase().includes(lowerQuery) || c.description?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get caliber names only (for simple picker)
 */
export function getCaliberNames(): string[] {
  return [...new Set(COMMON_CALIBERS.map((c) => c.name))].sort();
}
