// Product and decorative illustrations (the same original drawings as the website) and the product visual,
// which prefers an uploaded photo.
import { memo, useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Image } from 'expo-image';
import { mediaUrl } from '@/lib/config';
import { colors, radius } from '@/theme/tokens';
import type { Art as ArtSpec } from '@/api/types';
import { ArtDefs, DRAW } from './art/drawings';

const GOLD = '#f2c46d';

export const Art = memo(function Art({ art, glow = true, label }: { art?: ArtSpec | null; glow?: boolean; label?: string }) {
  const rid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const spec = art ?? {};
  const type = spec.type && DRAW[spec.type] ? spec.type : 'giftbox';
  const c1 = (spec.c1 as string) ?? '#c8102e';
  const c2 = (spec.c2 as string) ?? GOLD;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 200 200" accessibilityRole={label ? 'image' : undefined} accessibilityLabel={label} accessible={!!label}>
      <ArtDefs id={rid} c1={c1} c2={c2} />
      {glow ? <Circle cx={100} cy={104} r={96} fill={`url(#${rid}-glow)`} /> : null}
      {DRAW[type](rid, { ...spec, c1, c2 })}
    </Svg>
  );
});

/** Uploaded product photo when there is one, otherwise the procedural illustration on a soft stage. */
export function ProductVisual({ product, style, rounded = true }: { product: { image?: string | null; art?: ArtSpec | null; name?: string }; style?: StyleProp<ViewStyle>; rounded?: boolean }) {
  const uri = mediaUrl(product.image);
  return (
    <View style={[styles.stage, rounded && { borderRadius: radius.md }, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityLabel={product.name} />
      ) : (
        <View style={styles.pad}><Art art={product.art} label={product.name} /></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { aspectRatio: 1, backgroundColor: colors.surface, overflow: 'hidden' },
  pad: { flex: 1, padding: '8%' },
});
