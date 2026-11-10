// Bottom tabs, the same five as the website: Home, Shop, Cart, Pioneer Card, Account.
// Calendar and Games stay routes in this group (the tab bar remains visible there) and open from Home and More.
import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { colors, radius, shadow, space } from '@/theme/tokens';
import { useI18n } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { Text } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useCart } from '@/api/queries';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: { name: string; icon: IconName; label: string }[] = [
  { name: 'index', icon: 'home', label: 'm.tabs.home' },
  { name: 'shop', icon: 'shop', label: 'm.tabs.shop' },
  { name: 'cart', icon: 'cart', label: 'm.tabs.cart' },
  { name: 'pioneer', icon: 'card', label: 'm.tabs.pioneer' },
  { name: 'account', icon: 'user', label: 'm.tabs.account' },
];

function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const cartCount = useCart().data?.count ?? 0;
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, space.sm) }]} pointerEvents="box-none">
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const tab = TABS.find((x) => x.name === route.name);
          if (!tab) return null;
          const focused = state.index === i;
          return (
            <TabButton
              key={route.key}
              icon={tab.icon}
              label={t(tab.label)}
              focused={focused}
              badge={tab.name === 'cart' ? cartCount : 0}
              onPress={() => {
                const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) {
                  haptic.tap();
                  navigateToTab(route.key);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabButton({ icon, label, focused, badge, onPress }: { icon: IconName; label: string; focused: boolean; badge: number; onPress: () => void }) {
  const pill = useAnimatedStyle(() => ({ opacity: withSpring(focused ? 1 : 0), transform: [{ scale: withSpring(focused ? 1 : 0.8) }] }));
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={badge ? `${label}, ${badge}` : label} onPress={onPress} style={styles.item}>
      <View style={styles.iconBox}>
        <Animated.View style={[styles.pill, pill]} />
        <Icon name={icon} size={22} color={focused ? colors.onAccent : colors.textMuted} strokeWidth={focused ? 2 : 1.75} />
        {badge > 0 ? <View style={styles.count}><Text variant="caption" font="bodyBold" color={colors.onPrimary}>{badge > 99 ? '99+' : badge}</Text></View> : null}
      </View>
      <Text variant="caption" font={focused ? 'bodyBold' : 'body'} color={focused ? colors.accent : colors.textMuted} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      {TABS.map((tab) => <Tabs.Screen key={tab.name} name={tab.name} />)}
      {/* In the group but not on the bar: opened from Home and More. */}
      <Tabs.Screen name="advent" />
      <Tabs.Screen name="games" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.md },
  bar: { flexDirection: 'row', backgroundColor: colors.raised, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong, paddingVertical: 8, ...shadow.lifted },
  item: { flex: 1, alignItems: 'center', gap: 2, minHeight: 52, justifyContent: 'center' },
  iconBox: { width: 48, height: 30, alignItems: 'center', justifyContent: 'center' },
  count: { position: 'absolute', top: -4, right: 2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  pill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.accent, borderRadius: radius.pill },
});
