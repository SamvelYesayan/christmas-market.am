// Grouped list of navigation rows (Account, More).
import { Pressable, View } from 'react-native';
import { colors, space } from '@/theme/tokens';
import { Text } from './Text';
import { Card } from './Surface';
import { Icon, type IconName } from './Icon';

export interface MenuItem { icon: IconName; label: string; detail?: string; onPress: () => void }

function MenuRow({ icon, label, detail, onPress }: MenuItem) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={detail ? `${label}, ${detail}` : label} onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={18} color={colors.accent} /></View>
      <Text variant="bodyStrong" style={{ flex: 1 }}>{label}</Text>
      {detail ? <Text variant="label" tone="muted">{detail}</Text> : null}
      <Icon name="chevron" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

export function Menu({ items }: { items: MenuItem[] }) {
  return (
    <Card padded={false} style={{ paddingVertical: space.xs }}>
      {items.map((it, i) => (
        <View key={it.label}>
          <MenuRow {...it} />
          {i < items.length - 1 ? <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 64 }} /> : null}
        </View>
      ))}
    </Card>
  );
}
