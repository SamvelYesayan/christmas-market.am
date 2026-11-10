// Help pages (delivery & returns, privacy, terms) — same text as the website's /info/:topic.
import { router, useLocalSearchParams } from 'expo-router';
import { useI18n } from '@/i18n';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Chip } from '@/components/ui/Input';
import { Row } from '@/components/ui/Surface';
import { EmptyState } from '@/components/ui/States';

const TOPICS = ['delivery', 'privacy', 'terms'] as const;

export default function Info() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const { t, list } = useI18n();
  if (!TOPICS.includes(topic as (typeof TOPICS)[number])) {
    return <Screen back><EmptyState title={t('info.notFound')} action={t('info.home')} onAction={() => router.replace('/')} /></Screen>;
  }
  return (
    <Screen back eyebrow={t('info.help')} title={t(`info.${topic}.title`)}>
      <Row wrap>{TOPICS.map((k) => <Chip key={k} label={t(`info.${k}.title`)} selected={k === topic} onPress={() => router.setParams({ topic: k })} />)}</Row>
      {list(`info.${topic}.body`).map((p, i) => <Text key={i} tone="muted">{p}</Text>)}
      <Text variant="caption" tone="faint">{t('footer.address')} · {t('footer.hours')} · {t('footer.prices')}</Text>
    </Screen>
  );
}
