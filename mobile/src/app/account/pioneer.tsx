// My Pioneer Card: connect a card, or the live dashboard (balance, refresh, rewards & eligibility, store activity,
// history, disconnect). "Refresh balance" asks the server to read Magical again (?fresh=1).
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { refreshUserData } from '@/api/queries';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Surface';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { SignInGate } from '@/components/Common';
import { CardVisual } from '@/features/pioneer/CardVisual';
import { ConnectForm } from '@/features/pioneer/ConnectForm';
import { Dashboard } from '@/features/pioneer/Dashboard';
import { usePioneerSummary } from '@/features/pioneer/usePioneerSummary';

export default function MyPioneerCard() {
  const { t } = useI18n();
  const user = useSession((s) => s.user);
  const [open, setOpen] = useState(false);
  const s = usePioneerSummary(!!user);
  if (!user) return <Screen back title={t('pc.title')}><SignInGate body={t('pc.signIn')} next="/account/pioneer" /></Screen>;
  const changed = async () => { setOpen(false); await refreshUserData(); void s.refetch(); };
  const data = s.data;
  return (
    <Screen back title={t('pc.title')} refreshing={s.refreshing} onRefresh={s.refresh}>
      {s.isLoading ? <LoadingState /> : s.isError || !data ? <ErrorState error={s.error} onRetry={() => s.refetch()} /> : data.linked ? (
        <Dashboard s={data} refreshing={s.refreshing} onRefresh={s.refresh} onChanged={changed} />
      ) : (
        <View style={{ gap: space.xl }}>
          <CardVisual empty />
          {data.unlinkedRemotely ? <Text tone="danger">{t('pc.unlinkedRemotely')}</Text> : null}
          <View style={{ gap: space.sm }}>
            <Text variant="title">{t('pc.notLinkedTitle')}</Text>
            <Text tone="muted">{t('pc.notLinkedBody')}</Text>
            {[t('pc.benefit1', { p: data.discountPercent }), t('pc.benefit2'), t('pc.benefit3')].map((b) => <Text key={b} variant="label">· {b}</Text>)}
          </View>
          {!data.available ? (
            <Card tone="surface" style={{ gap: space.xs }}><Text variant="bodyStrong">{t('pc.soonTitle')}</Text><Text tone="muted">{t('pc.soonBody')}</Text></Card>
          ) : open ? <ConnectForm onDone={changed} onCancel={() => setOpen(false)} /> : (
            <Button label={t('pc.connect')} icon="card" onPress={() => setOpen(true)} testID="pc-open-connect" />
          )}
          <Button variant="ghost" label={t('pc.offersTitle')} onPress={() => router.push('/pioneer')} />
        </View>
      )}
    </Screen>
  );
}
