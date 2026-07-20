/**
 * Common bullet types database
 */

export interface BulletTypeInfo {
  name: string;
  abbreviation: string;
  description: string;
  commonUse: string;
}

export const BULLET_TYPES: BulletTypeInfo[] = [
  // Match/Target Bullets
  {
    name: 'Hollow Point Boat Tail',
    abbreviation: 'HPBT',
    description: 'Hollow point with boat tail for aerodynamics',
    commonUse: 'Match shooting, long-range precision',
  },
  {
    name: 'Open Tip Match',
    abbreviation: 'OTM',
    description: 'Manufacturing process creating open tip',
    commonUse: 'Match ammunition, precision shooting',
  },
  {
    name: 'Very Low Drag',
    abbreviation: 'VLD',
    description: 'Extremely streamlined for long-range',
    commonUse: 'Long-range competition',
  },
  {
    name: 'Boat Tail Hollow Point',
    abbreviation: 'BTHP',
    description: 'Boat tail with hollow point cavity',
    commonUse: 'Match and tactical',
  },

  // Hunting Bullets
  {
    name: 'Soft Point',
    abbreviation: 'SP',
    description: 'Exposed lead tip for expansion',
    commonUse: 'Hunting medium game',
  },
  {
    name: 'Soft Point Boat Tail',
    abbreviation: 'SPBT',
    description: 'Soft point with boat tail',
    commonUse: 'Long-range hunting',
  },
  {
    name: 'Ballistic Tip',
    abbreviation: 'BT',
    description: 'Polymer tip for expansion and BC',
    commonUse: 'Hunting and precision',
  },
  {
    name: 'AccuBond',
    abbreviation: 'AB',
    description: 'Bonded core with polymer tip',
    commonUse: 'Premium hunting',
  },
  {
    name: 'Partition',
    abbreviation: 'PT',
    description: 'Dual-core controlled expansion',
    commonUse: 'Dangerous game, large game',
  },
  {
    name: 'A-Frame',
    abbreviation: 'AF',
    description: 'Bonded core safari bullet',
    commonUse: 'African dangerous game',
  },

  // Hornady-Specific
  {
    name: 'ELD Match',
    abbreviation: 'ELD-M',
    description: 'Extremely Low Drag Match',
    commonUse: 'Long-range match shooting',
  },
  {
    name: 'ELD-X',
    abbreviation: 'ELD-X',
    description: 'Extremely Low Drag eXpanding',
    commonUse: 'Long-range hunting',
  },
  {
    name: 'A-MAX',
    abbreviation: 'AMAX',
    description: 'Aerodynamic Maximum (discontinued)',
    commonUse: 'Match shooting (older)',
  },
  {
    name: 'V-MAX',
    abbreviation: 'VMAX',
    description: 'Varmint polymer tip',
    commonUse: 'Varmint hunting',
  },
  {
    name: 'SST',
    abbreviation: 'SST',
    description: 'Super Shock Tip',
    commonUse: 'Hunting deer-sized game',
  },
  {
    name: 'InterLock',
    abbreviation: 'IL',
    description: 'Ring locks core and jacket',
    commonUse: 'Hunting',
  },

  // Sierra Bullets
  {
    name: 'MatchKing',
    abbreviation: 'SMK',
    description: 'Sierra MatchKing HPBT',
    commonUse: 'Match and tactical',
  },
  {
    name: 'Tipped MatchKing',
    abbreviation: 'TMK',
    description: 'MatchKing with polymer tip',
    commonUse: 'Long-range match',
  },
  {
    name: 'GameKing',
    abbreviation: 'SGK',
    description: 'Sierra hunting bullet',
    commonUse: 'Hunting',
  },

  // Berger Bullets
  {
    name: 'Berger Hybrid',
    abbreviation: 'Hybrid',
    description: 'Hybrid ogive design',
    commonUse: 'Competition and hunting',
  },
  {
    name: 'Berger VLD Hunting',
    abbreviation: 'VLD-H',
    description: 'VLD optimized for hunting',
    commonUse: 'Long-range hunting',
  },
  {
    name: 'Berger VLD Target',
    abbreviation: 'VLD-T',
    description: 'VLD optimized for target',
    commonUse: 'Match shooting',
  },

  // Barnes Bullets
  {
    name: 'Triple Shock X',
    abbreviation: 'TSX',
    description: 'All-copper expanding',
    commonUse: 'Hunting (lead-free)',
  },
  {
    name: 'Tipped Triple Shock X',
    abbreviation: 'TTSX',
    description: 'TSX with polymer tip',
    commonUse: 'Hunting (lead-free)',
  },
  {
    name: 'Long Range X',
    abbreviation: 'LRX',
    description: 'Long-range copper bullet',
    commonUse: 'Long-range hunting',
  },

  // Military/Tactical
  {
    name: 'Full Metal Jacket',
    abbreviation: 'FMJ',
    description: 'Fully jacketed, non-expanding',
    commonUse: 'Training, military',
  },
  {
    name: 'Full Metal Jacket Boat Tail',
    abbreviation: 'FMJBT',
    description: 'FMJ with boat tail',
    commonUse: 'Training, match',
  },
  {
    name: 'Armor Piercing',
    abbreviation: 'AP',
    description: 'Hardened core penetrator',
    commonUse: 'Military only',
  },
  {
    name: 'Tracer',
    abbreviation: 'TR',
    description: 'Pyrotechnic trace element',
    commonUse: 'Military training',
  },

  // Specialty
  {
    name: 'Solid Copper',
    abbreviation: 'SC',
    description: 'Monolithic copper construction',
    commonUse: 'Lead-free hunting',
  },
  {
    name: 'Solid Brass',
    abbreviation: 'SB',
    description: 'Monolithic brass construction',
    commonUse: 'Dangerous game',
  },
  {
    name: 'Frangible',
    abbreviation: 'FR',
    description: 'Breaks apart on impact',
    commonUse: 'Training, reduced ricochet',
  },
];

/**
 * Get bullet type abbreviations only (for simple picker)
 */
export function getBulletTypeAbbreviations(): string[] {
  return BULLET_TYPES.map((bt) => bt.abbreviation).sort();
}

/**
 * Get full bullet type names
 */
export function getBulletTypeNames(): string[] {
  return BULLET_TYPES.map((bt) => bt.name).sort();
}

/**
 * Search bullet types by name or abbreviation
 */
export function searchBulletTypes(query: string): BulletTypeInfo[] {
  const lowerQuery = query.toLowerCase();
  return BULLET_TYPES.filter(
    (bt) =>
      bt.name.toLowerCase().includes(lowerQuery) ||
      bt.abbreviation.toLowerCase().includes(lowerQuery) ||
      bt.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get bullet type by abbreviation
 */
export function getBulletTypeByAbbreviation(abbreviation: string): BulletTypeInfo | undefined {
  return BULLET_TYPES.find((bt) => bt.abbreviation === abbreviation);
}
