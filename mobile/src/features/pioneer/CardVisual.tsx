// The Magical Pioneer Card, drawn natively: black lacquer, gold foil, chip and star. Tilts gently on touch.
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import { colors, radius, shadow } from '@/theme/tokens';
import { useI18n } from '@/i18n';
import { useCalm } from '@/state/prefs';
import { Text } from '@/components/ui/Text';
import { starPoints } from '@/components/ui/Icon';

export function CardVisual({ masked, holder, empty }: { masked?: string | null; holder?: string | null; empty?: boolean }) {
  const { t } = useI18n();
  const calm = useCalm();
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const w = useSharedValue(1);
  const pan = Gesture.Pan()
    .enabled(!calm)
    .onBegin((e) => { ry.set(((e.x / w.value) - 0.5) * 14); })
    .onUpdate((e) => { ry.set(((e.x / w.value) - 0.5) * 14); rx.set(-e.translationY / 12); })
    .onFinalize(() => { rx.set(withSpring(0)); ry.set(withSpring(0)); });
  const a = useAnimatedStyle(() => ({ transform: [{ perspective: 800 }, { rotateX: `${rx.value}deg` }, { rotateY: `${ry.value}deg` }] }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        onLayout={(e) => { w.set(e.nativeEvent.layout.width); }}
        style={[{ aspectRatio: 1.586, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#14110B', borderWidth: 1, borderColor: empty ? colors.borderStrong : colors.accentLo }, shadow.lifted, a]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={empty ? t('pc.brand') : `${t('pc.brand')} ${masked ?? ''} ${holder ?? ''}`}
      >
        <Svg width="100%" height="100%" viewBox="0 0 317 200" preserveAspectRatio="none" style={{ position: 'absolute' }}>
          <Defs>
            <LinearGradient id="pc-gold" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFF1C9" /><Stop offset="0.5" stopColor="#F2C46D" /><Stop offset="1" stopColor="#A87A1C" /></LinearGradient>
            <LinearGradient id="pc-sheen" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" /><Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.07" /><Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" /></LinearGradient>
          </Defs>
          <Path d="M0 150 Q160 90 317 130" stroke="#F2C46D" strokeOpacity={empty ? 0.15 : 0.35} strokeWidth={1} fill="none" />
          <Path d="M0 168 Q170 110 317 150" stroke="#F2C46D" strokeOpacity={empty ? 0.08 : 0.2} strokeWidth={1} fill="none" />
          <Rect x={0} y={0} width={317} height={200} fill="url(#pc-sheen)" />
          <Rect x={24} y={58} width={40} height={30} rx={6} fill={empty ? '#3a3326' : 'url(#pc-gold)'} />
          <Path d="M24 73h40M44 58v30" stroke="#14110B" strokeOpacity={0.35} />
          <Polygon points={starPoints(282, 36, 16)} fill={empty ? '#3a3326' : 'url(#pc-gold)'} />
        </Svg>
        <View style={{ flex: 1, padding: 22, justifyContent: 'space-between' }}>
          <Text variant="eyebrow" color={colors.accent} style={{ letterSpacing: 3 }}>Magical Pioneer</Text>
          <View style={{ gap: 6 }}>
            <Text variant="heading" color={empty ? colors.textFaint : colors.accentHi} style={{ letterSpacing: 3, fontVariant: ['tabular-nums'] }}>{empty ? '•••• ••••' : masked}</Text>
            <Text variant="label" color={empty ? colors.textFaint : colors.text} uppercase numberOfLines={1}>{empty ? t('pc.brand') : holder || t('pc.member')}</Text>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
