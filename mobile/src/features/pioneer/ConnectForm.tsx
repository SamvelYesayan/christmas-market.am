// Connect a real Magical Pioneer Card: 8-digit number + 3-digit code, sent once to the server, which verifies it
// with Magical. Neither value is stored on the phone; the code field is cleared after every attempt.
import { useState } from 'react';
import { View } from 'react-native';
import { api, isApiError } from '@/api';
import { useI18n } from '@/i18n';
import { formatCardNumber } from '@/lib/format';
import { space, colors } from '@/theme/tokens';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card, Row } from '@/components/ui/Surface';
import { Field } from '@/components/ui/Input';
import { FormError } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { toast } from '@/components/ui/Toast';
import { burst, celebrate } from '@/components/Celebration';
import { cardDigits, isValidCard, isValidCode } from './logic';

export function ConnectForm({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const { t } = useI18n();
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const numberBad = !isValidCard(number);
  const codeBad = !isValidCode(code);

  const submit = async () => {
    setTouched(true);
    if (numberBad || codeBad || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.pioneer.link(cardDigits(number), code);
      setCode('');
      burst();
      toast(t('pc.connected'), { tone: 'reward', icon: 'card' });
      if (r.achievement) celebrate(null, r.achievement);
      onDone();
    } catch (e) {
      setCode('');
      if (isApiError(e) && e.code === 'already_linked') { toast(e.message, { icon: 'card' }); onDone(); return; }
      const left = isApiError(e) ? (e.details as { attemptsLeft?: number } | undefined)?.attemptsLeft : undefined;
      setTouched(false);
      setError([e instanceof Error ? e.message : t('common.error'), Number.isInteger(left) && (left as number) > 0 ? t('pc.attemptsLeft', { n: left as number }) : null].filter(Boolean).join(' '));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: space.lg }}>
      <Text variant="subheading">{t('pc.formTitle')}</Text>
      <Text tone="muted">{t('pc.formBody')}</Text>
      <FormError error={error} />
      <Field
        testID="pc-number"
        label={t('pc.number')}
        value={number}
        onChangeText={(v) => setNumber(formatCardNumber(v))}
        keyboardType="number-pad"
        autoComplete="off"
        autoCorrect={false}
        importantForAutofill="no"
        placeholder="0000 0000"
        maxLength={9}
        error={touched && numberBad ? t('pc.numberError') : null}
        hint={t('pc.numberHint')}
      />
      <Field
        testID="pc-code"
        label={t('pc.code')}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 3))}
        keyboardType="number-pad"
        secureTextEntry
        autoComplete="off"
        importantForAutofill="no"
        placeholder="•••"
        maxLength={3}
        error={touched && codeBad ? t('pc.codeError') : null}
        hint={t('pc.codeHint')}
      />
      <Row gap={space.sm} align="flex-start">
        <Icon name="lock" size={16} color={colors.textFaint} />
        <Text variant="caption" tone="faint" style={{ flex: 1 }}>{t('m.secureNote')}</Text>
      </Row>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Button testID="pc-submit" label={busy ? t('pc.checking') : t('pc.submit')} loading={busy} onPress={submit} style={{ flex: 1 }} />
        {onCancel ? <Button variant="secondary" label={t('pc.cancel')} disabled={busy} onPress={onCancel} /> : null}
      </View>
    </Card>
  );
}
