export const CORE_SHAPES = {
  nebula: {
    id: 'nebula',
    name: 'Nebula',
    description: 'Swirling cosmic clouds',
  },
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional radiant star',
  },
  plasma: {
    id: 'plasma',
    name: 'Plasma',
    description: 'Electric plasma ball',
  },
  crystal: {
    id: 'crystal',
    name: 'Crystal',
    description: 'Crystalline faceted gem',
  },
  pulse: {
    id: 'pulse',
    name: 'Pulse',
    description: 'Rhythmic pulsing orb',
  },
  nova: {
    id: 'nova',
    name: 'Nova',
    description: 'Explosive burst of light',
  },
};

export const COLOR_PALETTES = {
  celestial: {
    id: 'celestial',
    name: 'Celestial Blue',
    primary: '#60A5FA',
    secondary: '#3B82F6',
    glow: '#93C5FD',
    accent: '#818CF8',
  },
  solar: {
    id: 'solar',
    name: 'Solar Gold',
    primary: '#FBBF24',
    secondary: '#F59E0B',
    glow: '#FDE68A',
    accent: '#FB923C',
  },
  ember: {
    id: 'ember',
    name: 'Ember Orange',
    primary: '#FB923C',
    secondary: '#EA580C',
    glow: '#FDBA74',
    accent: '#F97316',
  },
  rose: {
    id: 'rose',
    name: 'Rose Pink',
    primary: '#F472B6',
    secondary: '#EC4899',
    glow: '#FBCFE8',
    accent: '#A78BFA',
  },
  violet: {
    id: 'violet',
    name: 'Violet Dream',
    primary: '#A78BFA',
    secondary: '#8B5CF6',
    glow: '#C4B5FD',
    accent: '#EC4899',
  },
  mint: {
    id: 'mint',
    name: 'Mint Green',
    primary: '#34D399',
    secondary: '#10B981',
    glow: '#6EE7B7',
    accent: '#2DD4BF',
  },
  arctic: {
    id: 'arctic',
    name: 'Arctic White',
    primary: '#E2E8F0',
    secondary: '#CBD5E1',
    glow: '#F1F5F9',
    accent: '#93C5FD',
  },
  ruby: {
    id: 'ruby',
    name: 'Ruby Red',
    primary: '#F87171',
    secondary: '#EF4444',
    glow: '#FECACA',
    accent: '#FB923C',
  },
  amber: {
    id: 'amber',
    name: 'Warm Amber',
    primary: '#FBBF77',
    secondary: '#D97706',
    glow: '#FDE68A',
    accent: '#F59E0B',
  },
  teal: {
    id: 'teal',
    name: 'Ocean Teal',
    primary: '#2DD4BF',
    secondary: '#14B8A6',
    glow: '#5EEAD4',
    accent: '#34D399',
  },
  indigo: {
    id: 'indigo',
    name: 'Deep Indigo',
    primary: '#818CF8',
    secondary: '#6366F1',
    glow: '#A5B4FC',
    accent: '#A78BFA',
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Blend',
    primary: '#F97316',
    secondary: '#DC2626',
    glow: '#FED7AA',
    accent: '#FBBF24',
  },
};

export const DEFAULT_STAR_PROFILE = {
  shape: 'classic',
  colorPalette: 'celestial',
  energy: 0.5,
};

const seededRandom = (seed) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
};

const pickRandom = (obj, seed) => {
  const keys = Object.keys(obj);
  const index = Math.floor(seededRandom(seed) * keys.length);
  return keys[index];
};

export function getStarVisuals(starProfile, personId = 'default') {
  const profile = { ...DEFAULT_STAR_PROFILE, ...starProfile };
  
  const shape = CORE_SHAPES[profile.shape] || CORE_SHAPES.classic;
  const palette = COLOR_PALETTES[profile.colorPalette] || COLOR_PALETTES.celestial;
  
  const seed = personId;
  const uniqueOffset = seededRandom(seed);
  
  return {
    shape: shape.id,
    colors: {
      primary: palette.primary,
      secondary: palette.secondary,
      glow: palette.glow,
      accent: palette.accent || palette.secondary,
    },
    energy: profile.energy,
    uniqueOffset,
  };
}

export function generateRandomStarProfile(personId = null) {
  const seed = personId || `${Date.now()}-${Math.random()}`;
  
  return {
    shape: pickRandom(CORE_SHAPES, seed + '-shape'),
    colorPalette: pickRandom(COLOR_PALETTES, seed + '-color'),
    energy: 0.3 + seededRandom(seed + '-energy') * 0.5,
  };
}
