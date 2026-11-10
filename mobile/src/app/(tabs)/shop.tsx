// The Market — catalog with search, categories, filters (price, magical, limited, offers), sorting and paging.
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import { useI18n, useLangStore } from '@/i18n';
import { colors, fontFamilies, radius, space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button, IconButton } from '@/components/ui/Button';
import { Row } from '@/components/ui/Surface';
import { Chip } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { ProductGrid } from '@/components/Product';
import { HiddenWonder } from '@/components/Common';

const SORTS = [['popular', 'shop.popular'], ['new', 'shop.new'], ['price_asc', 'shop.priceAsc'], ['price_desc', 'shop.priceDesc'], ['name', 'shop.name']] as const;
const PRICES: { key: string; label: string; min?: number; max?: number }[] = [
  { key: 'any', label: 'shop.anyPrice' },
  { key: 'u10', label: 'shop.under10', max: 10000 },
  { key: '10-25', label: 'shop.p10to25', min: 10000, max: 25000 },
  { key: '25-50', label: 'shop.p25to50', min: 25000, max: 50000 },
  { key: '50', label: 'shop.p50', min: 50000 },
];

type Sort = (typeof SORTS)[number][0];
interface Filters { sort: Sort; price: string; magic: boolean; limited: boolean; onSale: boolean }
const DEFAULT_FILTERS: Filters = { sort: 'popular', price: 'any', magic: false, limited: false, onSale: false };

export default function Shop() {
  const { t, lang } = useI18n();
  const font = fontFamilies[useLangStore((s) => s.lang)].body;
  const params = useLocalSearchParams<{ category?: string; q?: string; limited?: string; onSale?: string; magic?: string }>();
  const [category, setCategory] = useState<string | undefined>(params.category);
  const [search, setSearch] = useState(params.q ?? '');
  const [query, setQuery] = useState(params.q ?? '');
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS, limited: params.limited === 'true', onSale: params.onSale === 'true', magic: params.magic === 'true' });
  const [draft, setDraft] = useState(filters);
  const [sheet, setSheet] = useState(false);

  // Deep links / Home shortcuts change the params while the tab stays mounted: adopt them (during render, the
  // React-recommended way to reset state from props).
  const paramKey = [params.category, params.limited, params.onSale, params.magic].join('|');
  const [seenParams, setSeenParams] = useState(paramKey);
  if (seenParams !== paramKey) {
    setSeenParams(paramKey);
    setCategory(params.category);
    setFilters((f) => ({ ...f, limited: params.limited === 'true', onSale: params.onSale === 'true', magic: params.magic === 'true' }));
  }
  useEffect(() => {
    const h = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(h);
  }, [search]);

  const cats = useQuery({ queryKey: ['categories', lang], queryFn: ({ signal }) => api.catalog.categories({ signal }) });
  const price = PRICES.find((p) => p.key === filters.price)!;
  const q = useMemo(() => ({
    category, q: query || undefined, sort: filters.sort, min: price.min, max: price.max,
    magic: filters.magic ? 'true' : undefined, limited: filters.limited ? 'true' : undefined, onSale: filters.onSale ? 'true' : undefined, limit: 20,
  }), [category, query, filters, price]);
  const list = useInfiniteQuery({
    queryKey: ['products', lang, q],
    queryFn: ({ pageParam, signal }) => api.catalog.products({ ...q, page: pageParam }, { signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
  });
  const products = list.data?.pages.flatMap((p) => p.products) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;
  const activeFilters = (filters.price !== 'any' ? 1 : 0) + (filters.magic ? 1 : 0) + (filters.limited ? 1 : 0) + (filters.onSale ? 1 : 0) + (filters.sort !== 'popular' ? 1 : 0);

  return (
    <Screen
      tabBar
      title={t('shop.street')}
      refreshing={list.isRefetching}
      onRefresh={() => list.refetch()}
    >
      <HiddenWonder id="silver-key" style={{ right: 4, top: 4 }} />
      <Row gap={space.sm}>
        <View style={styles.search}>
          <Icon name="search" size={20} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('m.searchPlaceholder')}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={t('nav.searchLabel')}
            returnKeyType="search"
            onSubmitEditing={() => setQuery(search.trim())}
            style={[styles.searchInput, { fontFamily: font }]}
            selectionColor={colors.accent}
          />
          {search ? <IconButton icon="close" size={32} bg="transparent" label={t('shop.clear')} onPress={() => setSearch('')} /> : null}
        </View>
        <IconButton icon="filter" label={t('m.filters')} badge={activeFilters || undefined} onPress={() => { setDraft(filters); setSheet(true); }} bg={colors.surface} size={50} />
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ marginRight: -space.lg }}>
        <Chip label={t('shop.allStalls')} selected={!category} onPress={() => setCategory(undefined)} />
        {cats.data?.categories.map((c) => <Chip key={c.slug} label={c.name} selected={category === c.slug} onPress={() => setCategory(category === c.slug ? undefined : c.slug)} />)}
      </ScrollView>
      {list.isSuccess ? <Text variant="label" tone="muted">{t('shop.found', { n: total })}</Text> : null}
      {list.isLoading ? (
        <View style={{ gap: space.lg }}>{[0, 1].map((i) => <Row key={i} gap={space.md}><Skeleton height={230} width="48%" /><Skeleton height={230} width="48%" /></Row>)}</View>
      ) : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : products.length === 0 ? (
        <EmptyState title={t('shop.empty')} body={t('shop.emptyBody')} art={{ type: 'lantern', c1: '#1b2a5c', c2: '#a9c7ff' }} action={t('shop.ask')} onAction={() => router.push('/gift-finder')} />
      ) : <ProductGrid products={products} />}
      {list.hasNextPage ? <Button variant="secondary" label={list.isFetchingNextPage ? t('shop.bringing') : t('shop.more')} loading={list.isFetchingNextPage} onPress={() => list.fetchNextPage()} /> : null}

      <Sheet visible={sheet} onClose={() => setSheet(false)} title={t('m.filters')}>
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">{t('m.sortBy')}</Text>
          <Row wrap gap={space.sm}>{SORTS.map(([k, l]) => <Chip key={k} label={t(l)} selected={draft.sort === k} onPress={() => setDraft({ ...draft, sort: k })} />)}</Row>
        </View>
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">{t('m.priceRange')}</Text>
          <Row wrap gap={space.sm}>{PRICES.map((p) => <Chip key={p.key} label={t(p.label)} selected={draft.price === p.key} onPress={() => setDraft({ ...draft, price: p.key })} />)}</Row>
        </View>
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">{t('m.only')}</Text>
          <Row wrap gap={space.sm}>
            <Chip label={t('shop.magical')} selected={draft.magic} onPress={() => setDraft({ ...draft, magic: !draft.magic })} />
            <Chip label={t('shop.limited')} selected={draft.limited} onPress={() => setDraft({ ...draft, limited: !draft.limited })} />
            <Chip label={t('shop.offers')} selected={draft.onSale} onPress={() => setDraft({ ...draft, onSale: !draft.onSale })} />
          </Row>
        </View>
        <Row gap={space.sm}>
          <Button variant="secondary" label={t('m.resetFilters')} onPress={() => setDraft(DEFAULT_FILTERS)} style={{ flex: 1 }} />
          <Button label={t('m.applyFilters')} onPress={() => { setFilters(draft); setSheet(false); }} style={{ flex: 1 }} />
        </Row>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong, paddingLeft: space.lg, paddingRight: 4, height: 50 },
  searchInput: { flex: 1, color: colors.text, fontSize: 16, height: 48 },
});
