// The full Christmas Wishes wall: a random batch (with "show others" excluding what was seen) and the newest, paged.
import { useState } from 'react';
import { View } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Input';
import { ErrorState, LoadingState, EmptyState } from '@/components/ui/States';
import { WishCard, WishForm } from '@/features/wishes/WishesPreview';

export default function WishesScreen() {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<'wall' | 'recent'>('wall');
  const [seen, setSeen] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const wall = useQuery({
    queryKey: ['wishes', 'wall', lang, seen.join(',')],
    queryFn: ({ signal }) => api.wishes.batch(seen.slice(-40), 12, { signal }),
    enabled: mode === 'wall',
  });
  const recent = useInfiniteQuery({
    queryKey: ['wishes', 'recent', lang],
    queryFn: ({ pageParam, signal }) => api.wishes.recent(pageParam, { signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    enabled: mode === 'recent',
  });
  const list = mode === 'wall' ? wall.data?.items ?? [] : recent.data?.pages.flatMap((p) => p.items) ?? [];
  const q = mode === 'wall' ? wall : recent;
  return (
    <Screen back eyebrow={t('wishes.eyebrow')} title={t('wishes.title')} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Text tone="muted">{t('wishes.lede')}</Text>
      <Button label={t('wishes.write')} icon="quill" onPress={() => setOpen(true)} />
      <Segmented value={mode} onChange={setMode} options={[{ value: 'wall', label: t('wishes.carousel') }, { value: 'recent', label: t('m.recent') }]} />
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : list.length === 0 ? (
        <EmptyState title={t('wishes.emptyTitle')} body={t('wishes.emptyBody')} art={{ type: 'scroll', c1: '#f5ecd7', c2: '#c8102e' }} />
      ) : (
        <View style={{ gap: space.md }}>
          {list.map((w) => <WishCard key={w.id} wish={w} />)}
        </View>
      )}
      {mode === 'wall' && list.length > 0 ? (
        <Button variant="secondary" icon="refresh" label={t('m.newBatch')} onPress={() => setSeen((s) => [...s, ...list.map((w) => w.id)].slice(-40))} />
      ) : null}
      {mode === 'recent' && recent.hasNextPage ? (
        <Button variant="secondary" label={t('m.loadMore')} loading={recent.isFetchingNextPage} onPress={() => recent.fetchNextPage()} />
      ) : null}
      <WishForm visible={open} onClose={() => setOpen(false)} />
    </Screen>
  );
}
