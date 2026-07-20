/**
 * Optic reticle types and common scope models database
 */

export interface ReticleInfo {
  name: string;
  type: string;
  description: string;
  commonUse: string;
}

/**
 * Common reticle types
 */
export const RETICLE_TYPES: ReticleInfo[] = [
  // MIL-Based Reticles
  {
    name: 'MIL-Dot',
    type: 'MIL',
    description: 'Classic mil-dot reticle',
    commonUse: 'General purpose, military',
  },
  {
    name: 'Tremor 3',
    type: 'MIL',
    description: 'Horus Tremor3 ranging reticle',
    commonUse: 'Tactical, ranging',
  },
  {
    name: 'Tremor 5',
    type: 'MIL',
    description: 'Latest Horus ranging reticle',
    commonUse: 'Tactical, PRS',
  },
  {
    name: 'H59',
    type: 'MIL',
    description: 'Horus H59 grid reticle',
    commonUse: 'Tactical, military',
  },
  {
    name: 'MSR',
    type: 'MIL',
    description: 'Mil-spec ranging reticle',
    commonUse: 'Precision shooting',
  },
  {
    name: 'EBR-2C',
    type: 'MIL',
    description: 'Vortex Enhanced Battle Reticle',
    commonUse: 'Tactical, hunting',
  },
  {
    name: 'EBR-7C',
    type: 'MIL',
    description: 'Vortex competition reticle',
    commonUse: 'PRS, NRL22',
  },
  {
    name: 'XLR2',
    type: 'MIL',
    description: 'Nightforce XTLR',
    commonUse: 'Long-range precision',
  },
  {
    name: 'Mil-XT',
    type: 'MIL',
    description: 'Nightforce Mil-XT',
    commonUse: 'Competition, tactical',
  },
  {
    name: 'SCR MOA',
    type: 'MIL',
    description: 'Schmidt & Bender reticle',
    commonUse: 'Precision rifle',
  },
  {
    name: 'Gen 3 XR',
    type: 'MIL',
    description: 'Vortex Gen 3 Razor',
    commonUse: 'PRS competition',
  },
  {
    name: 'APLR5',
    type: 'MIL',
    description: 'Athlon Precision',
    commonUse: 'Long-range shooting',
  },
  {
    name: 'Christmas Tree',
    type: 'MIL',
    description: 'Generic tree-style reticle',
    commonUse: 'Holdover/wind',
  },

  // MOA-Based Reticles
  {
    name: 'Duplex',
    type: 'MOA',
    description: 'Traditional duplex crosshair',
    commonUse: 'Hunting, general purpose',
  },
  {
    name: 'Fine Crosshair',
    type: 'MOA',
    description: 'Simple fine crosshair',
    commonUse: 'Benchrest, hunting',
  },
  {
    name: 'TMR',
    type: 'MOA',
    description: 'Tactical Milling Reticle',
    commonUse: 'Tactical, ranging',
  },
  {
    name: 'Horus H58',
    type: 'MOA',
    description: 'H58 grid reticle',
    commonUse: 'Tactical',
  },
  {
    name: 'EBR-1C MOA',
    type: 'MOA',
    description: 'Vortex MOA version',
    commonUse: 'Hunting, tactical',
  },
  {
    name: 'MOAR',
    type: 'MOA',
    description: 'Nightforce MOAR',
    commonUse: 'Hunting, precision',
  },
  {
    name: 'SCR Reticle',
    type: 'MOA',
    description: 'Special Competitions Reticle',
    commonUse: 'F-Class',
  },
  {
    name: 'CCH',
    type: 'MOA',
    description: 'Center Crosshair',
    commonUse: 'Benchrest',
  },

  // Illuminated Variants
  {
    name: 'Illuminated Mil-Dot',
    type: 'MIL',
    description: 'Mil-dot with illumination',
    commonUse: 'Low-light tactical',
  },
  {
    name: 'Illuminated Duplex',
    type: 'MOA',
    description: 'Duplex with illuminated center',
    commonUse: 'Hunting twilight',
  },
  {
    name: 'FireDot',
    type: 'MOA',
    description: 'Illuminated center dot',
    commonUse: 'Hunting',
  },

  // Specialized
  {
    name: 'BDC',
    type: 'MOA',
    description: 'Bullet Drop Compensator',
    commonUse: 'Hunting specific loads',
  },
  {
    name: 'Custom Turret',
    type: 'MOA',
    description: 'Calibrated custom turret',
    commonUse: 'Hunting specific rifle',
  },
  {
    name: 'German #4',
    type: 'MOA',
    description: 'Classic European reticle',
    commonUse: 'Hunting',
  },
  {
    name: 'Plex',
    type: 'MOA',
    description: 'Simple plex crosshair',
    commonUse: 'Hunting',
  },
  {
    name: 'Ballistic Plex',
    type: 'MOA',
    description: 'BDC with ballistic markings',
    commonUse: 'Hunting',
  },

  // Competition Specific
  {
    name: 'PR1-MIL',
    type: 'MIL',
    description: 'Precision Rifle reticle',
    commonUse: 'PRS/NRL',
  },
  {
    name: 'GAP-10',
    type: 'MIL',
    description: 'GAP Precision reticle',
    commonUse: 'Precision rifle',
  },
  {
    name: 'SKMR3',
    type: 'MIL',
    description: 'S&B competition',
    commonUse: 'Long-range competition',
  },
  {
    name: 'TReMoR',
    type: 'MIL',
    description: 'Tactical Ranging reticle',
    commonUse: 'Military/LE',
  },

  // F-Class Specific
  {
    name: 'FCR-1',
    type: 'MOA',
    description: 'F-Class reticle',
    commonUse: 'F-Class competition',
  },
  {
    name: 'March FML-TR1',
    type: 'MOA',
    description: 'F-Class fine reticle',
    commonUse: 'F-Class benchrest',
  },
];

/**
 * Get reticle names only
 */
export function getReticleNames(): string[] {
  return RETICLE_TYPES.map((r) => r.name).sort();
}

/**
 * Get reticles by type (MIL or MOA)
 */
export function getReticlesByType(type: 'MIL' | 'MOA'): ReticleInfo[] {
  return RETICLE_TYPES.filter((r) => r.type === type);
}

/**
 * Search reticles by name or description
 */
export function searchReticles(query: string): ReticleInfo[] {
  const lowerQuery = query.toLowerCase();
  return RETICLE_TYPES.filter(
    (r) =>
      r.name.toLowerCase().includes(lowerQuery) ||
      r.description.toLowerCase().includes(lowerQuery) ||
      r.commonUse.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get reticle info by name
 */
export function getReticleByName(name: string): ReticleInfo | undefined {
  return RETICLE_TYPES.find((r) => r.name === name);
}

/**
 * Common scope models with typical specifications
 */
export interface ScopeModel {
  manufacturer: string;
  model: string;
  magnification: string;
  objectiveMM: number;
  tubeSize: number; // inches
  clickValue: number;
  clickType: 'MIL' | 'MOA';
  commonReticles: string[];
}

export const COMMON_SCOPE_MODELS: ScopeModel[] = [
  {
    manufacturer: 'Nightforce',
    model: 'ATACR 7-35x56',
    magnification: '7-35x',
    objectiveMM: 56,
    tubeSize: 34,
    clickValue: 0.1,
    clickType: 'MIL',
    commonReticles: ['Mil-XT', 'Tremor 3', 'H59'],
  },
  {
    manufacturer: 'Vortex',
    model: 'Razor Gen III 6-36x56',
    magnification: '6-36x',
    objectiveMM: 56,
    tubeSize: 34,
    clickValue: 0.1,
    clickType: 'MIL',
    commonReticles: ['EBR-7C', 'Gen 3 XR'],
  },
  {
    manufacturer: 'Schmidt & Bender',
    model: 'PMII 5-25x56',
    magnification: '5-25x',
    objectiveMM: 56,
    tubeSize: 34,
    clickValue: 0.1,
    clickType: 'MIL',
    commonReticles: ['P4F', 'MSR', 'Tremor 3'],
  },
  {
    manufacturer: 'Kahles',
    model: 'K525i',
    magnification: '5-25x',
    objectiveMM: 56,
    tubeSize: 34,
    clickValue: 0.1,
    clickType: 'MIL',
    commonReticles: ['SKMR3', 'AMR'],
  },
  {
    manufacturer: 'Leupold',
    model: 'Mark 5HD 5-25x56',
    magnification: '5-25x',
    objectiveMM: 56,
    tubeSize: 35,
    clickValue: 0.1,
    clickType: 'MIL',
    commonReticles: ['Tremor 3', 'H59', 'CCH'],
  },
];
