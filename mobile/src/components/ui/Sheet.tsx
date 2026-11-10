// Bottom sheet built on Modal + Reanimated. Handles Android back (onRequestClose), backdrop tap and safe areas.
import { useEffect, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme/tokens';
import { useI18n } from '@/i18n';
import { useCalm } from '@/state/prefs';
import { Text } from './Text';
import { IconButton } from './Button';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** While true the sheet cannot be dismissed (e.g. a payment or redemption is in flight). */
  locked?: boolean;
  tone?: 'night' | 'paper';
}

export function Sheet({ visible, onClose, title, children, locked, tone = 'night' }: SheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const calm = useCalm();
  const y = useSharedValue(400);
  useEffect(() => {
    if (visible) y.set(calm ? 0 : withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) }));
    else y.set(400);
  }, [visible, calm, y]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const close = () => { if (!locked) onClose(); };
  const paper = tone === 'paper';
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.root}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t('common.close')} accessibilityRole="button" />
          <Animated.View style={[styles.sheet, { backgroundColor: paper ? colors.paper : colors.surface, paddingBottom: insets.bottom + space.lg }, a]} accessibilityViewIsModal>
            <View style={[styles.grabber, paper && { backgroundColor: colors.paperEdge }]} />
            <View style={styles.head}>
              <View style={{ flex: 1 }}>{title ? <Text variant="heading" tone={paper ? 'paper' : 'default'} accessibilityRole="header">{title}</Text> : null}</View>
              <IconButton icon="close" label={t('common.close')} onPress={close} disabled={locked} size={38} bg={paper ? colors.paperEdge : colors.raised} color={paper ? colors.paperInk : colors.text} />
            </View>
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.lg, paddingBottom: space.sm }}>
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.xl, paddingTop: space.sm, maxHeight: '92%' },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
});
