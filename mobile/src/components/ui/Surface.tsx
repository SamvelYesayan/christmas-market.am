import { Pressable, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius, shadow, space } from '@/theme/tokens';
import { haptic } from '@/lib/haptics';
import { Text } from './Text';

/** The basic layered card. `tone="paper"` is the cream letter surface used for gifts, tickets and letters. */
export function Card({ children, style, tone = 'raised', padded = true, onPress, accessibilityLabel, ...rest }: ViewProps & { tone?: 'raised' | 'surface' | 'paper' | 'outline'; padded?: boolean; onPress?: () => void }) {
  const bg = tone === 'paper' ? colors.paper : tone === 'surface' ? colors.surface : tone === 'outline' ? 'transparent' : colors.raised;
  const base: StyleProp<ViewStyle> = [
    styles.card,
    { backgroundColor: bg, borderColor: tone === 'paper' ? colors.paperEdge : colors.border },
    tone !== 'outline' && shadow.card,
    padded && { padding: space.lg },
    style,
  ];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => { haptic.tap(); onPress(); }} style={({ pressed }) => [base, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]} {...rest}>
        {children}
      </Pressable>
    );
  }
  return <View style={base} accessibilityLabel={accessibilityLabel} {...rest}>{children}</View>;
}

export function Row({ children, gap = space.sm, align = 'center', justify, wrap, style }: { children: React.ReactNode; gap?: number; align?: ViewStyle['alignItems']; justify?: ViewStyle['justifyContent']; wrap?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: align, justifyContent: justify, gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Stack({ children, gap = space.md, style }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong }, style]} />;
}

/** Section title with an optional eyebrow and trailing action. */
export function SectionHeader({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.section}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text variant="eyebrow" tone="accent">{eyebrow}</Text> : null}
        <Text variant="heading" accessibilityRole="header">{title}</Text>
      </View>
      {action && onAction ? (
        <Pressable accessibilityRole="link" onPress={onAction} hitSlop={10}><Text variant="label" tone="accent">{action}</Text></Pressable>
      ) : null}
    </View>
  );
}

export function Badge({ label, tone = 'gold' }: { label: string; tone?: 'gold' | 'ember' | 'green' | 'muted' | 'test' }) {
  const map = {
    gold: [colors.accent, colors.onAccent],
    ember: [colors.primary, colors.onPrimary],
    green: [colors.green, '#04140E'],
    muted: [colors.raisedHi, colors.textMuted],
    test: ['#FFB347', '#2A1300'],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text variant="eyebrow" color={fg} style={{ letterSpacing: 0.8 }}>{label}</Text>
    </View>
  );
}

/** A thin gold ornament rule — the app's signature divider. */
export function OrnamentRule({ width = 120 }: { width?: number }) {
  return (
    <Svg width={width} height={12} viewBox="0 0 120 12" style={{ alignSelf: 'center' }}>
      <Path d="M0 6h48M72 6h48" stroke={colors.accentLo} strokeWidth={1} />
      <Path d="M60 1l3 5-3 5-3-5 3-5Z" fill={colors.accent} />
      <Path d="M52 6l2-2 2 2-2 2-2-2ZM64 6l2-2 2 2-2 2-2-2Z" fill={colors.accentLo} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  section: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, marginBottom: space.md },
});
