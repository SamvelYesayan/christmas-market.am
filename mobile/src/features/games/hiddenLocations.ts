// Hidden objects store a website path as their location. Map it to the app screen that carries the same glimmer.
// Screens with a <HiddenWonder>: Home (golden-acorn), Shop (silver-key), Play (sugar-quill), Gift Finder
// (tiny-reindeer), Academy (moon-feather), Pioneer Card (compass-star).
const MAP: Record<string, string> = {
  '/': '/',
  '/shop': '/shop',
  '/games': '/games',
  '/gift-finder': '/gift-finder',
  '/academy': '/academy',
  '/pioneer': '/pioneer',
  '/advent': '/advent',
  '/account': '/account',
};

export function appPathFor(location: string | null | undefined): string | null {
  if (!location) return null;
  const path = location.split('?')[0].replace(/\/+$/, '') || '/';
  if (MAP[path]) return MAP[path];
  const root = `/${path.split('/')[1] ?? ''}`;
  return MAP[root] ?? null;
}
