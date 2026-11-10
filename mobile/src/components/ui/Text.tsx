import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useLangStore } from '@/i18n';
import { colors, fontFamilies, type as typeRamp, type TypeVariant, type FontRole } from '@/theme/tokens';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  color?: string;
  tone?: 'default' | 'muted' | 'faint' | 'accent' | 'danger' | 'success' | 'paper' | 'paperMuted' | 'onAccent';
  align?: TextStyle['textAlign'];
  font?: FontRole;
  uppercase?: boolean;
}

const TONES = {
  default: colors.text,
  muted: colors.textMuted,
  faint: colors.textFaint,
  accent: colors.accent,
  danger: colors.danger,
  success: colors.success,
  paper: colors.paperInk,
  paperMuted: colors.paperMuted,
  onAccent: colors.onAccent,
} as const;

/** Text that picks the right typeface for the language (Armenian glyphs need Noto). */
export function Text({ variant = 'body', color, tone = 'default', align, font, uppercase, style, ...rest }: AppTextProps) {
  const lang = useLangStore((s) => s.lang);
  const t = typeRamp[variant];
  const family = fontFamilies[lang][font ?? t.role];
  const eyebrow = variant === 'eyebrow';
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={1.6}
      style={[
        {
          fontFamily: family,
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          color: color ?? TONES[tone],
          textAlign: align,
          letterSpacing: eyebrow ? 1.4 : variant === 'hero' || variant === 'title' ? -0.3 : 0,
          textTransform: eyebrow || uppercase ? 'uppercase' : undefined,
        },
        style,
      ]}
    />
  );
}
