// Redeem a store gift with Pioneer points — the mobile twin of the website's RedeemDialog.
//  • ONE requestId per opened sheet (created once, kept across retries): double taps, retries after a timeout and
//    re-sends return the same redemption on the server instead of debiting again.
//  • A synchronous in-flight guard blocks a second tap before React re-renders the disabled button.
//  • The cost, the balance check and the debit are decided by the server and Magical — never by the phone.
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { points } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { space } from '@/theme/tokens';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Row } from '@/components/ui/Surface';
import { FormError } from '@/components/ui/States';
import { CouponTicket } from '@/components/Common';
import { burst } from '@/components/Celebration';
import type { PioneerOffer, Redemption } from '@/api/types';

export function RedeemSheet({ offer, onClose }: { offer: PioneerOffer; onClose: (result: Redemption | null) => void }) {
  const { t } = useI18n();
  const [requestId] = useState(() => Crypto.randomUUID());
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<Redemption | null>(null);
  const [attempts, setAttempts] = useState(0);

  const redeem = async () => {
    if (inFlight.current || result) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setAttempts((n) => n + 1);
    try {
      const r = await api.pioneer.redeem(offer.id, requestId);
      setResult(r.redemption);
      if (r.redemption.status === 'completed') { haptic.success(); burst(); }
    } catch (e) {
      setError(e);
      haptic.error();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const done = result?.status === 'completed';
  const cost = points(offer.pointsCost ?? 0);
  return (
    <Sheet visible onClose={() => onClose(result)} locked={busy} tone="paper" title={!result ? t('pc.redeemTitle') : done ? t('pc.redeemedTitle') : t('pc.pendingTitle')}>
      {!result ? (
        <View style={{ gap: space.lg }}>
          <Text variant="subheading" tone="paper">{offer.title}</Text>
          <Text tone="paperMuted">{t('pc.redeemBody', { n: cost })}</Text>
          <FormError error={error} />
          {error && attempts > 0 ? <Text variant="caption" tone="paperMuted">{t('m.sameRequest')}</Text> : null}
          <Row gap={space.md}>
            <Button testID="redeem-confirm" variant="paper" label={busy ? t('pc.redeeming') : error ? t('m.retry') : t('pc.redeemYes')} loading={busy} disabled={busy} onPress={redeem} style={{ flex: 1 }} />
            <Button variant="paperOutline" label={t('pc.cancel')} disabled={busy} onPress={() => onClose(null)} />
          </Row>
        </View>
      ) : (
        <View style={{ gap: space.lg }} accessibilityLiveRegion="polite">
          {done && result.couponCode ? <CouponTicket code={result.couponCode} title={t('pc.yourCode')} /> : null}
          <Text tone="paperMuted">{done ? (result.couponCode ? '' : t('pc.redeemedCollect')) : t('pc.pendingBody')}</Text>
          {done && result.balanceAfter != null ? <Text variant="bodyStrong" tone="paper">{t('pc.pointsLeft', { n: points(result.balanceAfter) })}</Text> : null}
          <Row gap={space.md}>
            <Button variant="paper" label={t('common.close')} onPress={() => onClose(result)} style={{ flex: 1 }} />
            <Button variant="paperOutline" label={t('pc.goToCard')} onPress={() => { onClose(result); router.push('/account/pioneer'); }} />
          </Row>
        </View>
      )}
    </Sheet>
  );
}
