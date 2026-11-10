// More — everything beyond the five tabs, in one list (the same content as the website's menu).
import { router } from 'expo-router';
import { useI18n } from '@/i18n';
import { Screen } from '@/components/ui/Screen';
import { Menu } from '@/components/ui/Menu';

export default function More() {
  const { t } = useI18n();
  return (
    <Screen back title={t('nav.more')}>
      <Menu items={[
        { icon: 'gift', label: t('nav.offers'), onPress: () => router.push({ pathname: '/shop', params: { onSale: 'true' } }) },
        { icon: 'compass', label: t('nav.finder'), onPress: () => router.push('/gift-finder') },
        { icon: 'star', label: t('nav.advent'), onPress: () => router.push('/advent') },
        { icon: 'sparkle', label: t('nav.games'), onPress: () => router.push('/games') },
        { icon: 'wand', label: t('nav.academy'), onPress: () => router.push('/academy') },
        { icon: 'quill', label: t('m.wishes'), onPress: () => router.push('/wishes') },
      ]} />
      <Menu items={[
        { icon: 'truck', label: t('nav.track'), onPress: () => router.push('/track') },
        { icon: 'info', label: t('m.help'), onPress: () => router.push('/info/delivery') },
        { icon: 'settings', label: t('m.settings'), onPress: () => router.push('/account/settings') },
      ]} />
    </Screen>
  );
}
