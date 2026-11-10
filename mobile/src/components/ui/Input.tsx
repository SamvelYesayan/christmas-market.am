import { useState, type Ref } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fontFamilies, radius, space } from '@/theme/tokens';
import { useLangStore, useI18n } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { Text } from './Text';
import { Icon } from './Icon';

export interface FieldProps extends TextInputProps {
  ref?: Ref<React.ComponentRef<typeof TextInput>>;
  label: string;
  hint?: string;
  error?: string | null;
  optional?: string;
}

export function Field({ ref, label, hint, error, optional, secureTextEntry, style, multiline, ...rest }: FieldProps) {
  const lang = useLangStore((s) => s.lang);
  const { t } = useI18n();
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  const border = error ? colors.danger : focused ? colors.accent : colors.borderStrong;
  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="muted">{label}{optional ? <Text variant="label" tone="faint">{`  ${optional}`}</Text> : null}</Text>
      <View style={[styles.box, { borderColor: border }, multiline && { minHeight: 104, alignItems: 'flex-start' }]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          secureTextEntry={secureTextEntry && !reveal}
          multiline={multiline}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          style={[styles.input, { fontFamily: fontFamilies[lang].body }, multiline && { textAlignVertical: 'top', paddingTop: 12 }, style]}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable accessibilityRole="button" accessibilityLabel={reveal ? t('m.passwordHide') : t('m.passwordShow')} onPress={() => setReveal((r) => !r)} hitSlop={10} style={styles.eye}>
            <Icon name={reveal ? 'eyeOff' : 'eye'} size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">{error}</Text> : hint ? <Text variant="caption" tone="faint">{hint}</Text> : null}
    </View>
  );
}

export function Toggle({ label, body, value, onChange, disabled }: { label: string; body?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => { haptic.tap(); onChange(!value); }}
      style={styles.toggle}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{label}</Text>
        {body ? <Text variant="caption" tone="muted">{body}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => { haptic.tap(); onChange(v); }}
        disabled={disabled}
        trackColor={{ false: colors.raisedHi, true: colors.accentLo }}
        thumbColor={value ? colors.accent : colors.textMuted}
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

/** Square checkbox row for consents. */
export function Check({ label, value, onChange, error }: { label: React.ReactNode; value: boolean; onChange: (v: boolean) => void; error?: string | null }) {
  return (
    <View style={{ gap: 4 }}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value }} onPress={() => { haptic.tap(); onChange(!value); }} style={styles.check} hitSlop={4}>
        <View style={[styles.box2, value && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
          {value ? <Icon name="check" size={15} color={colors.onAccent} strokeWidth={2.5} /> : null}
        </View>
        <View style={{ flex: 1 }}>{typeof label === 'string' ? <Text variant="body" tone="muted">{label}</Text> : label}</View>
      </Pressable>
      {error ? <Text variant="caption" tone="danger">{error}</Text> : null}
    </View>
  );
}

/** Selectable pill. */
export function Chip({ label, selected, onPress, disabled }: { label: string; selected?: boolean; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled }}
      disabled={disabled}
      onPress={() => { haptic.tap(); onPress?.(); }}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && { opacity: 0.8 }, disabled && { opacity: 0.4 }]}
    >
      <Text variant="label" color={selected ? colors.onAccent : colors.text}>{label}</Text>
    </Pressable>
  );
}

/** Two-to-four option segmented control. */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.seg} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { haptic.tap(); onChange(o.value); }} style={[styles.segItem, on && styles.segOn]}>
            <Text variant="label" color={on ? colors.onAccent : colors.textMuted} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  box: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, backgroundColor: colors.surface, minHeight: 50 },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingHorizontal: space.md, paddingVertical: 10 },
  eye: { paddingHorizontal: space.md, height: 48, justifyContent: 'center' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, minHeight: 52 },
  check: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  box2: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  chip: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  seg: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  segItem: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: 10 },
  segOn: { backgroundColor: colors.accent },
});
