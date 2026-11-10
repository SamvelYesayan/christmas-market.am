import type { Art as ArtSpec } from '@/api/types';

export const GAME_ART: Record<string, ArtSpec> = {
  catch: { type: 'sleigh', c1: '#c8102e' },
  tree: { type: 'tree', c1: '#0f6b4f', c2: '#f2c46d' },
  mystery: { type: 'giftbox', c1: '#2a4fa8', c2: '#f2c46d', mystery: true },
  quiz: { type: 'book', c1: '#7a2a1e' },
  hidden: { type: 'key', c1: '#f2c46d' },
  wheel: { type: 'wheel' },
};
