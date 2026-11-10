// Hidden Wonders — the list of glimmers hidden around the app, with hints and where to search.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { colors, space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card, Row } from '@/components/ui/Surface';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { appPathFor } from '@/features/games/hiddenLocations';

export default function Hidden() {
  const { t, lang } = useI18n();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const q = useQuery({ queryKey: ['hidden', lang, signedIn], queryFn: ({ signal }) => api.games.hidden({ signal }) });
  const list = q.data?.objects ?? [];
  const found = list.filter((o) => o.found).length;
  return (
    <Screen back title={t('games.hidden.title')} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Text tone="muted">{t('games.hidden.intro')} {signedIn ? t('games.hidden.count', { f: found, t: list.length }) : t('games.hidden.signIn')}</Text>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <View style={{ gap: space.md }}>
          {list.map((o) => (
            <Card key={o.key} tone={o.found ? 'raised' : 'surface'} style={{ flexDirection: 'row', gap: space.md }}>
              <Icon name={o.found ? 'sparkle' : 'search'} color={o.found ? colors.accent : colors.textMuted} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="bodyStrong">{o.found ? o.name : t('games.hidden.glimmer')}</Text>
                <Text variant="caption" tone="muted">{o.hint}</Text>
                {!o.found && appPathFor(o.location) ? <Button size="sm" variant="ghost" label={t('games.hidden.search')} onPress={() => router.push(appPathFor(o.location) as never)} style={{ alignSelf: 'flex-start' }} /> : null}
              </View>
              <Row><Text variant="label" tone="accent">+{o.points}</Text></Row>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
