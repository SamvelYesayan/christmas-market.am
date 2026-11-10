import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, space } from '@/theme/tokens';
import { useI18n } from '@/i18n';
import { Text } from './Text';
import { IconButton } from './Button';

export interface ScreenProps {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
  /** Show a back button (pushed screens). */
  back?: boolean;
  right?: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  /** Pinned at the bottom above the safe area (e.g. checkout button). */
  footer?: ReactNode;
  /** Extra bottom space when a tab bar overlays the screen. */
  tabBar?: boolean;
  keyboard?: boolean;
}

export const TAB_BAR_SPACE = 92;

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Standard screen: safe areas, header row, scrolling content, optional pull-to-refresh and pinned footer. */
export function Screen({ children, title, eyebrow, back, right, scroll = true, refreshing, onRefresh, contentStyle, footer, tabBar, keyboard }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const header = title || back || right ? (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      {back ? <IconButton icon="back" label={t('common.back')} onPress={goBack} /> : null}
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text variant="eyebrow" tone="accent" numberOfLines={1}>{eyebrow}</Text> : null}
        {title ? <Text variant={back ? 'heading' : 'title'} accessibilityRole="header" numberOfLines={2}>{title}</Text> : null}
      </View>
      {right}
    </View>
  ) : <View style={{ height: insets.top }} />;
  const bottom = (tabBar && !footer ? TAB_BAR_SPACE : 0) + (footer ? 0 : insets.bottom) + space.xxl;
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.content, { paddingBottom: bottom }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.raised} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, styles.contentFlat, contentStyle]}>{children}</View>
  );
  const inner = (
    <View style={styles.root}>
      {header}
      {body}
      {footer ? <View style={[styles.footer, { paddingBottom: (tabBar ? TAB_BAR_SPACE + space.xs : insets.bottom + space.md) }]}>{footer}</View> : null}
    </View>
  );
  if (!keyboard) return inner;
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{inner}</KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.md },
  content: { paddingHorizontal: space.lg, gap: space.xl },
  contentFlat: { paddingHorizontal: space.lg },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface },
});
