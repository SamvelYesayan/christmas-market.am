// Account — orders, Pioneer Card, rewards and wishlist first; then codes, picks, and everything else.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import { useDashboard } from '@/api/queries';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { usePrefs } from '@/state/prefs';
import { radius, space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card, SectionHeader } from '@/components/ui/Surface';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { Menu } from '@/components/ui/Menu';
import { Art } from '@/components/Art';
import { ProductRail } from '@/components/Product';
import { CouponTicket, Crest, SignInGate } from '@/components/Common';
import { couponLabel } from '@/features/account/coupon';

function Tile({ eyebrow, value, sub, onPress, children }: { eyebrow: string; value?: string; sub?: string; onPress?: () => void; children?: React.ReactNode }) {
  return (
    <Card style={{ width: '47.5%', gap: 4, minHeight: 112 }} onPress={onPress} accessibilityLabel={`${eyebrow} ${value ?? ''}`}>
      <Text variant="eyebrow" tone="faint">{eyebrow}</Text>
      {value ? <Text variant="heading" tone="accent" numberOfLines={1}>{value}</Text> : null}
      {children}
      {sub ? <Text variant="caption" tone="muted" numberOfLines={2}>{sub}</Text> : null}
    </Card>
  );
}

export default function Account() {
  const { t } = useI18n();
  const user = useSession((s) => s.user);
  const persona = usePrefs((s) => s.persona);
  const dash = useDashboard();
  const recs = useQuery({ queryKey: ['recs', user?.id], queryFn: ({ signal }) => api.me.recommendations({ signal }), enabled: !!user });

  const common = [
    { icon: 'menu' as const, label: t('nav.more'), onPress: () => router.push('/more') },
    { icon: 'truck' as const, label: t('nav.track'), onPress: () => router.push('/track') },
    { icon: 'settings' as const, label: t('m.settings'), onPress: () => router.push('/account/settings') },
    { icon: 'info' as const, label: t('m.help'), onPress: () => router.push('/info/delivery') },
  ];

  if (!user) {
    return (
      <Screen tabBar title={persona ? t('m.greetingName', { name: persona.name }) : t('m.greetingGuest')}>
        <SignInGate body={t('auth.keeps')} />
        <Menu items={[{ icon: 'sparkle', label: t('m.persona'), onPress: () => router.push('/account/welcome') }, { icon: 'card', label: t('nav.pioneer'), onPress: () => router.push('/pioneer') }, ...common]} />
      </Screen>
    );
  }

  const d = dash.data;
  const house = user.profile.house;
  return (
    <Screen tabBar title={`${t('account.welcome')} ${user.profile.displayName?.split(' ')[0] ?? user.name}`} refreshing={dash.isRefetching} onRefresh={() => dash.refetch()}>
      {dash.isError ? <ErrorState error={dash.error} onRetry={() => dash.refetch()} compact /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        {d ? (
          <>
            <Tile eyebrow={t('account.orders')} value={String(d.orders.length)} sub={d.orders[0]?.number} onPress={() => router.push('/account/orders')} />
            <Tile eyebrow={t('pc.tab')} value={user.pioneer?.cardMasked} sub={user.pioneer ? t('pc.manage') : t('pc.connectShort')} onPress={() => router.push('/account/pioneer')} />
            <Tile eyebrow={t('account.rewards')} value={String(d.stardust)} sub={t('common.stardust')} onPress={() => router.push('/account/rewards')} />
            <Tile eyebrow={t('account.wishlist')} value={String(d.wishlistCount)} sub={t('account.open')} onPress={() => router.push('/account/wishlist')} />
          </>
        ) : [0, 1, 2, 3].map((i) => <Skeleton key={i} height={112} width="47.5%" radius={radius.lg} />)}
      </View>

      {d?.coupons.length ? (
        <View style={{ gap: space.md }}>
          <SectionHeader title={t('account.codes')} />
          {d.coupons.map((c) => <CouponTicket key={c.code} code={c.code} title={couponLabel(c, t)} note={c.description} />)}
        </View>
      ) : null}

      {recs.data?.products.length ? (
        <View>
          <SectionHeader title={t('account.pickedFor', { name: user.profile.displayName?.split(' ')[0] ?? user.name })} />
          <ProductRail products={recs.data.products} />
        </View>
      ) : null}

      <Card tone="surface" onPress={() => router.push('/academy')} style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
        {house ? <Crest color={house.color} accent={house.accent} size={56} /> : <View style={{ width: 56, height: 56 }}><Art art={{ type: 'wand', c1: '#e8dcc4', c2: '#a9c7ff' }} /></View>}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="eyebrow" tone="faint">{t('account.identity')}</Text>
          {house ? (
            <>
              <Text variant="subheading" font="displayItalic">{user.profile.identity?.magicalName ?? user.name}</Text>
              <Text variant="caption" tone="muted">{house.name} · {house.animal}</Text>
            </>
          ) : (
            <>
              <Text variant="subheading">{t('account.notSorted')}</Text>
              <Text variant="caption" tone="accent">{t('account.visitAcademy')}</Text>
            </>
          )}
        </View>
      </Card>

      <Menu items={[
        { icon: 'star', label: t('account.advent'), detail: d ? `${d.advent.opened}/${d.advent.total}` : undefined, onPress: () => router.push('/advent') },
        { icon: 'sparkle', label: t('m.persona'), onPress: () => router.push('/account/welcome') },
      ]} />
      <Menu items={common} />
      {user.role === 'admin' ? <Text variant="caption" tone="faint" align="center">{t('m.adminOnWeb')}</Text> : null}
      <Button variant="ghost" icon="logout" label={t('common.signOut')} onPress={() => router.push('/account/settings')} />
    </Screen>
  );
}
