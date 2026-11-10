import { router } from 'expo-router';
import { useI18n } from '@/i18n';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/States';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <Screen back>
      <EmptyState title={t('notFound.title')} body={t('notFound.body')} art={{ type: 'lantern', c1: '#1b2a5c', c2: '#a9c7ff' }} action={t('notFound.back')} onAction={() => router.replace('/')} />
    </Screen>
  );
}
