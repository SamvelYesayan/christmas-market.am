import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, minTouch, radius, space } from '@/theme/tokens';
import { haptic } from '@/lib/haptics';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'ember' | 'secondary' | 'ghost' | 'paper' | 'paperOutline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  block?: boolean;
  style?: StyleProp<ViewStyle>;
}

const V: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.accent, fg: colors.onAccent },
  ember: { bg: colors.primary, fg: colors.onPrimary },
  secondary: { bg: 'transparent', fg: colors.text, border: colors.borderStrong },
  ghost: { bg: 'transparent', fg: colors.accent },
  paper: { bg: colors.paperInk, fg: colors.paper },
  paperOutline: { bg: 'transparent', fg: colors.paperInk, border: colors.paperMuted },
  danger: { bg: 'transparent', fg: colors.danger, border: 'rgba(255,122,136,0.45)' },
};
const S: Record<Size, { h: number; px: number; text: 'label' | 'bodyStrong' }> = {
  sm: { h: 36, px: space.md, text: 'label' },
  md: { h: 48, px: space.xl, text: 'bodyStrong' },
  lg: { h: 56, px: space.xxl, text: 'bodyStrong' },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ label, variant = 'primary', size = 'md', icon, iconRight, loading, disabled, block, style, onPress, ...rest }: ButtonProps) {
  const v = V[variant];
  const s = S[size];
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const inactive = disabled || loading;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPressIn={() => { scale.set(withSpring(0.97, { damping: 20, stiffness: 400 })); }}
      onPressOut={() => { scale.set(withSpring(1, { damping: 16, stiffness: 300 })); }}
      onPress={(e) => {
        haptic.press();
        onPress?.(e);
      }}
      style={[
        styles.base,
        { minHeight: Math.max(s.h, size === 'sm' ? 36 : minTouch), paddingHorizontal: s.px, backgroundColor: v.bg, borderColor: v.border ?? 'transparent', opacity: inactive && !loading ? 0.45 : 1 },
        block && styles.block,
        variant === 'ghost' && { paddingHorizontal: space.sm },
        anim,
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 19} color={v.fg} /> : null}
          <Text variant={s.text} color={v.fg} numberOfLines={1}>{label}</Text>
          {iconRight ? <Icon name={iconRight} size={size === 'sm' ? 16 : 18} color={v.fg} /> : null}
        </View>
      )}
    </AnimatedPressable>
  );
}

/** Round icon-only button with an accessible label. */
export function IconButton({ icon, label, onPress, color = colors.text, bg = colors.raised, size = 44, badge, disabled }: { icon: IconName; label: string; onPress?: () => void; color?: string; bg?: string; size?: number; badge?: number; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={() => { haptic.tap(); onPress?.(); }}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : disabled ? 0.4 : 1 }]}
    >
      <Icon name={icon} size={Math.round(size * 0.48)} color={color} />
      {badge ? (
        <View style={styles.badge}><Text variant="caption" font="bodyBold" color={colors.onAccent}>{badge > 99 ? '99+' : badge}</Text></View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  block: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
});
