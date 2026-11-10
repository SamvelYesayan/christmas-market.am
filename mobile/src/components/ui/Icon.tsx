// The app's own line icon set (24×24, 1.75 stroke). No emoji, no icon font.
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';
import { colors } from '@/theme/tokens';

export type IconName =
  | 'menu'
  | 'home' | 'shop' | 'calendar' | 'play' | 'user' | 'cart' | 'heart' | 'heartFill' | 'search' | 'close' | 'back'
  | 'chevron' | 'chevronDown' | 'plus' | 'minus' | 'check' | 'lock' | 'refresh' | 'card' | 'star' | 'sparkle' | 'gift'
  | 'ticket' | 'compass' | 'wand' | 'scroll' | 'bell' | 'globe' | 'settings' | 'truck' | 'logout' | 'filter' | 'copy'
  | 'info' | 'alert' | 'eye' | 'eyeOff' | 'trash' | 'pen' | 'map' | 'clock' | 'quill' | 'snow';

const P = {
  home: 'M4 11.5 12 4l8 7.5M6.5 9.5V20h11V9.5M10 20v-5h4v5',
  shop: 'M4 9h16l-1.2 10.2a1 1 0 0 1-1 .8H6.2a1 1 0 0 1-1-.8L4 9Zm4 0V7a4 4 0 0 1 8 0v2',
  calendar: 'M4.5 9.5h15M8 3.5v3M16 3.5v3M5.5 5.5h13a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Zm6.5 7v5M9.5 15h5',
  play: 'M12 3.5l2.3 5.2 5.7.5-4.3 3.8 1.3 5.6L12 15.7l-5 2.9 1.3-5.6L4 9.2l5.7-.5L12 3.5Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8a7.5 7.5 0 0 1 15 0',
  cart: 'M3 6.5h2.5l2 9.5h10l2-7H7m2.5 11.5a1 1 0 1 0 0-.01m7 .01a1 1 0 1 0 0-.01',
  heart: 'M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10Z',
  heartFill: 'M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10Z',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm4.7-1.8L20 20',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  chevronDown: 'M5 9l7 7 7-7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  lock: 'M7 10.5V8a5 5 0 0 1 10 0v2.5M6 10.5h12a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1Zm6 4v2',
  refresh: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4',
  card: 'M3.5 6.5h17a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Zm-1 4h19M6 14.5h4',
  star: 'M12 3.5l2.3 5.2 5.7.5-4.3 3.8 1.3 5.6L12 15.7l-5 2.9 1.3-5.6L4 9.2l5.7-.5L12 3.5Z',
  sparkle: 'M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3Z',
  gift: 'M4 10h16v10H4V10Zm-1-3.5h18V10H3V6.5ZM12 6.5V20M12 6.5C10.5 3 7 3.5 7.5 5.5c.4 1.2 2.7 1 4.5 1Zm0 0c1.5-3.5 5-3 4.5-1-.4 1.2-2.7 1-4.5 1Z',
  ticket: 'M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7Zm10 0v10',
  menu: 'M4 7h16M4 12h16M4 17h16',
  compass: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17Zm3.5-12-2 5-5 2 2-5 5-2Z',
  wand: 'M4.5 19.5l11-11M14 5l1-2 1 2 2 1-2 1-1 2-1-2-2-1 2-1Zm4 7 .6-1.2L19.8 10l-1.2-.6L18 8.2l-.6 1.2-1.2.6 1.2.6.6 1.4Z',
  scroll: 'M7 4.5h11a1.5 1.5 0 0 1 1.5 1.5v1.5H16M7 4.5A1.5 1.5 0 0 0 5.5 6v12A1.5 1.5 0 0 0 7 19.5h9.5A1.5 1.5 0 0 0 18 18V7.5M7 4.5A1.5 1.5 0 0 1 8.5 6v12a1.5 1.5 0 0 1-3 0M11 10h4M11 13h4',
  bell: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2ZM10 20.5a2 2 0 0 0 4 0',
  globe: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17Zm-8.5-8.5h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5Z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-2-1.2L14.6 3h-4l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7.5 7.5 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z',
  truck: 'M3 6.5h11v9H3v-9Zm11 3h3.5l3 3v3H14M7 18.5a1.5 1.5 0 1 0 0-.01m10 .01a1.5 1.5 0 1 0 0-.01',
  logout: 'M14 4.5h4.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H14M10 8l-4 4 4 4M6 12h10',
  filter: 'M4 6.5h16M7 12h10M10 17.5h4',
  copy: 'M9 9h10v11H9V9Zm-4 6V4h10',
  info: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17Zm0-9.5v5m0-8v.5',
  alert: 'M12 4 2.8 19.5h18.4L12 4Zm0 6v4.5m0 2.5v.5',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'M4 4l16 16M9.9 6A9.6 9.6 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-2.6 3.4M6.5 7.6A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4-.9',
  trash: 'M5 7h14M10 7V4.5h4V7m-7 0 1 12.5h8L17 7',
  pen: 'M4.5 19.5l1-4L16 5l3 3L8.5 18.5l-4 1Z',
  map: 'M12 20.5s6-5.5 6-10.5a6 6 0 0 0-12 0c0 5 6 10.5 6 10.5Zm0-8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17Zm0-13v4.5l3 2',
  quill: 'M19.5 4.5C12 5 7 10 5.5 18.5M19.5 4.5c-.5 6-4 10-10 11M9 12h4',
  snow: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5',
} satisfies Record<IconName, string>;

export function Icon({ name, size = 22, color = colors.text, strokeWidth = 1.75 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const filled = name === 'heartFill';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={P[name]} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill={filled ? color : 'none'} />
    </Svg>
  );
}

/** Five-point star helper used by art and badges. */
export const starPoints = (cx: number, cy: number, r: number, inner = 0.45, points = 5) =>
  Array.from({ length: points * 2 }, (_, i) => {
    const rr = i % 2 ? r * inner : r;
    const a = (i * Math.PI) / points - Math.PI / 2;
    return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }).join(' ');

export function StarMark({ size = 16, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon points={starPoints(12, 12.5, 10)} fill={color} />
    </Svg>
  );
}

export function Dot({ size = 8, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      <Circle cx={5} cy={5} r={5} fill={color} />
    </Svg>
  );
}

export function LockBadge({ size = 14, color = colors.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={10.5} width={14} height={9.5} rx={1.5} stroke={color} strokeWidth={2} />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke={color} strokeWidth={2} />
    </Svg>
  );
}
