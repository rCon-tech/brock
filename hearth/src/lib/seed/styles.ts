import type { StyleSlug } from '@/lib/taxonomy';

/**
 * What each style looks like, used to generate a realistic synthetic catalogue for development
 * and tests (no API keys or network needed). Real catalogue items get these from the tagger.
 */
export interface StyleProfile {
  materials: string[];
  colours: string[];
  lines: string[];
  finishes: string[];
  moods: string[];
  /** Words used to name products. */
  names: string[];
}

export const STYLE_PROFILES: Record<StyleSlug, StyleProfile> = {
  industrial: {
    materials: ['metal_black', 'concrete', 'dark_wood', 'leather', 'brass'],
    colours: ['charcoal', 'black', 'grey', 'rust'],
    lines: ['clean_lines', 'geometric', 'chunky'],
    finishes: ['matte', 'distressed'],
    moods: ['dramatic', 'earthy'],
    names: ['Foundry', 'Loft', 'Forge'],
  },
  minimalist: {
    materials: ['light_wood', 'oak', 'linen', 'ceramic', 'metal_black'],
    colours: ['white', 'cream', 'greige', 'grey'],
    lines: ['clean_lines', 'slim_legs', 'rounded_edges'],
    finishes: ['matte', 'natural'],
    moods: ['calm', 'airy'],
    names: ['Plain', 'Nord', 'Lumen'],
  },
  japandi: {
    materials: ['oak', 'light_wood', 'linen', 'ceramic', 'jute', 'walnut'],
    colours: ['beige', 'cream', 'greige', 'charcoal'],
    lines: ['clean_lines', 'rounded_edges', 'slim_legs'],
    finishes: ['matte', 'natural'],
    moods: ['calm', 'earthy'],
    names: ['Kinto', 'Shoji', 'Haru'],
  },
  scandinavian: {
    materials: ['light_wood', 'oak', 'wool', 'linen', 'ceramic'],
    colours: ['white', 'grey', 'beige', 'blush'],
    lines: ['clean_lines', 'slim_legs', 'rounded_edges'],
    finishes: ['matte', 'natural'],
    moods: ['airy', 'cosy'],
    names: ['Fjord', 'Hygge', 'Birk'],
  },
  mid_century: {
    materials: ['walnut', 'brass', 'leather', 'wool', 'ceramic'],
    colours: ['mustard', 'olive', 'rust', 'navy'],
    lines: ['slim_legs', 'curved', 'geometric'],
    finishes: ['natural', 'lacquered'],
    moods: ['playful', 'earthy'],
    names: ['Eames', 'Atlas', 'Sputnik'],
  },
  modern_farmhouse: {
    materials: ['oak', 'linen', 'metal_black', 'ceramic', 'jute'],
    colours: ['white', 'cream', 'sage', 'grey'],
    lines: ['chunky', 'clean_lines'],
    finishes: ['distressed', 'matte'],
    moods: ['cosy', 'calm'],
    names: ['Barn', 'Meadow', 'Hearth'],
  },
  coastal: {
    materials: ['rattan', 'linen', 'jute', 'light_wood', 'glass'],
    colours: ['white', 'navy', 'sage', 'beige'],
    lines: ['curved', 'rounded_edges'],
    finishes: ['natural', 'distressed'],
    moods: ['airy', 'calm'],
    names: ['Harbour', 'Dune', 'Tide'],
  },
  boho: {
    materials: ['rattan', 'cane', 'jute', 'wool', 'velvet'],
    colours: ['terracotta', 'mustard', 'rust', 'multicolour'],
    lines: ['curved', 'tufted'],
    finishes: ['natural', 'distressed'],
    moods: ['playful', 'earthy'],
    names: ['Marrakesh', 'Sahara', 'Kilim'],
  },
  traditional: {
    materials: ['dark_wood', 'velvet', 'leather', 'brass', 'wool'],
    colours: ['navy', 'cream', 'rust', 'olive'],
    lines: ['ornate', 'tufted'],
    finishes: ['lacquered', 'gloss'],
    moods: ['cosy', 'dramatic'],
    names: ['Chesterfield', 'Regent', 'Windsor'],
  },
  art_deco: {
    materials: ['brass', 'velvet', 'marble', 'glass', 'chrome'],
    colours: ['black', 'navy', 'blush', 'mustard'],
    lines: ['geometric', 'curved', 'ornate'],
    finishes: ['gloss', 'lacquered'],
    moods: ['dramatic', 'playful'],
    names: ['Gatsby', 'Savoy', 'Chrysler'],
  },
  maximalist: {
    materials: ['velvet', 'brass', 'marble', 'wool', 'ceramic'],
    colours: ['multicolour', 'rust', 'navy', 'blush'],
    lines: ['ornate', 'tufted', 'chunky'],
    finishes: ['gloss', 'lacquered'],
    moods: ['dramatic', 'playful'],
    names: ['Folly', 'Opulent', 'Baroque'],
  },
  rustic: {
    materials: ['oak', 'dark_wood', 'leather', 'wool', 'jute', 'metal_black'],
    colours: ['rust', 'olive', 'beige', 'charcoal'],
    lines: ['chunky'],
    finishes: ['distressed', 'natural'],
    moods: ['cosy', 'earthy'],
    names: ['Cabin', 'Timber', 'Hollow'],
  },
  contemporary: {
    materials: ['metal_black', 'glass', 'marble', 'leather', 'light_wood'],
    colours: ['grey', 'white', 'charcoal', 'black'],
    lines: ['clean_lines', 'geometric', 'rounded_edges'],
    finishes: ['matte', 'gloss'],
    moods: ['calm', 'dramatic'],
    names: ['Axis', 'Prism', 'Vertex'],
  },
  mediterranean: {
    materials: ['travertine', 'ceramic', 'rattan', 'linen', 'oak'],
    colours: ['terracotta', 'white', 'cream', 'olive'],
    lines: ['curved', 'rounded_edges'],
    finishes: ['natural', 'distressed'],
    moods: ['airy', 'earthy'],
    names: ['Amalfi', 'Sorrento', 'Ibiza'],
  },
  wabi_sabi: {
    materials: ['travertine', 'linen', 'jute', 'oak', 'ceramic', 'concrete'],
    colours: ['beige', 'greige', 'cream', 'charcoal'],
    lines: ['rounded_edges', 'curved'],
    finishes: ['distressed', 'natural', 'matte'],
    moods: ['calm', 'earthy'],
    names: ['Kintsugi', 'Mono', 'Ma'],
  },
  hollywood_regency: {
    materials: ['velvet', 'brass', 'marble', 'glass', 'chrome'],
    colours: ['black', 'blush', 'white', 'navy'],
    lines: ['ornate', 'geometric'],
    finishes: ['gloss', 'lacquered'],
    moods: ['dramatic', 'playful'],
    names: ['Sunset', 'Starlet', 'Bel Air'],
  },
  french_country: {
    materials: ['oak', 'linen', 'ceramic', 'wool', 'brass'],
    colours: ['cream', 'sage', 'blush', 'beige'],
    lines: ['ornate', 'curved'],
    finishes: ['distressed', 'natural'],
    moods: ['cosy', 'calm'],
    names: ['Provence', 'Lavande', 'Chateau'],
  },
  transitional: {
    materials: ['oak', 'linen', 'wool', 'brass', 'leather'],
    colours: ['greige', 'beige', 'grey', 'navy'],
    lines: ['clean_lines', 'rounded_edges'],
    finishes: ['matte', 'natural'],
    moods: ['calm', 'cosy'],
    names: ['Bridge', 'Haven', 'Common'],
  },
  organic_modern: {
    materials: ['oak', 'boucle', 'travertine', 'linen', 'ceramic'],
    colours: ['cream', 'beige', 'sage', 'greige'],
    lines: ['curved', 'rounded_edges'],
    finishes: ['natural', 'matte'],
    moods: ['calm', 'earthy'],
    names: ['Pebble', 'Moss', 'Cloud'],
  },
  eclectic: {
    materials: ['velvet', 'rattan', 'brass', 'wool', 'ceramic', 'marble'],
    colours: ['multicolour', 'mustard', 'terracotta', 'navy'],
    lines: ['curved', 'geometric', 'tufted'],
    finishes: ['gloss', 'natural'],
    moods: ['playful', 'dramatic'],
    names: ['Magpie', 'Collage', 'Patchwork'],
  },
  cottagecore: {
    materials: ['oak', 'linen', 'wool', 'ceramic', 'cane'],
    colours: ['cream', 'sage', 'blush', 'mustard'],
    lines: ['ornate', 'curved', 'rounded_edges'],
    finishes: ['distressed', 'natural'],
    moods: ['cosy', 'playful'],
    names: ['Bramble', 'Primrose', 'Orchard'],
  },
  warm_minimal: {
    materials: ['oak', 'linen', 'metal_black', 'concrete', 'walnut'],
    colours: ['beige', 'greige', 'charcoal', 'cream'],
    lines: ['clean_lines', 'rounded_edges'],
    finishes: ['matte', 'natural'],
    moods: ['calm', 'earthy'],
    names: ['Ember', 'Haven', 'Dusk'],
  },
  brutalist: {
    materials: ['concrete', 'metal_black', 'travertine', 'dark_wood', 'glass'],
    colours: ['grey', 'charcoal', 'black', 'greige'],
    lines: ['chunky', 'geometric', 'clean_lines'],
    finishes: ['matte', 'distressed'],
    moods: ['dramatic', 'calm'],
    names: ['Slab', 'Monolith', 'Bunker'],
  },
  shaker: {
    materials: ['oak', 'wool', 'linen', 'ceramic', 'metal_black'],
    colours: ['cream', 'sage', 'navy', 'white'],
    lines: ['clean_lines', 'slim_legs'],
    finishes: ['matte', 'natural'],
    moods: ['calm', 'cosy'],
    names: ['Meeting', 'Peg', 'Plain'],
  },
  retro_70s: {
    materials: ['rattan', 'velvet', 'wool', 'brass', 'walnut'],
    colours: ['rust', 'mustard', 'olive', 'terracotta'],
    lines: ['curved', 'rounded_edges', 'chunky'],
    finishes: ['gloss', 'natural'],
    moods: ['playful', 'earthy'],
    names: ['Disco', 'Shag', 'Groove'],
  },
};
