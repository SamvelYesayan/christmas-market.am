import { stripDecor, translate, translateList } from '@/i18n';
import { mobileEn, mobileHy } from '@/i18n/mobile';
import hy from '@/i18n/hy.web';
import en from '@/i18n/en.web';

const keys = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));

describe('i18n', () => {
  it('Armenian is the default and English is complete for the website dictionary', () => {
    expect(keys(en).sort()).toEqual(keys(hy).sort());
  });
  it('every mobile string exists in both languages', () => {
    expect(keys(mobileEn).sort()).toEqual(keys(mobileHy).sort());
  });
  it('interpolates variables', () => {
    expect(translate('en', 'advent.dayLabel', { day: 7 })).toBe('December 7');
  });
  it('falls back to Armenian, then to the key', () => {
    expect(translate('en', 'no.such.key')).toBe('no.such.key');
  });
  it('strips decorative emoji the app replaces with its own icons', () => {
    expect(stripDecor('🎄 Merry ✨')).toBe('Merry');
    expect(stripDecor('12,500 ֏')).toBe('12,500 ֏');
  });
  it('reads paragraph lists', () => {
    expect(translateList('en', 'info.terms.body').length).toBeGreaterThan(1);
  });
});
