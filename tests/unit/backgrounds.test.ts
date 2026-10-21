import { describe, expect, it } from 'vitest';
import { homeBackgroundPresetUrl } from '../../src/ui/backgrounds';

function svgOf(url: string): string {
  return decodeURIComponent(url.replace('data:image/svg+xml,', ''));
}

describe('homeBackgroundPresetUrl', () => {
  it.each(['waves', 'mountains', 'dunes', 'forest', 'aurora', 'sunset'])(
    'returns an inline SVG for the %s preset',
    (preset) => {
      const url = homeBackgroundPresetUrl(preset);
      expect(url.startsWith('data:image/svg+xml,')).toBe(true);
      expect(svgOf(url)).toContain('<svg');
    },
  );

  it('uses waves by default and for an unknown preset', () => {
    const waves = homeBackgroundPresetUrl('waves');
    expect(homeBackgroundPresetUrl()).toBe(waves);
    expect(homeBackgroundPresetUrl('not-a-preset')).toBe(waves);
  });

  it('gives every preset its own artwork', () => {
    const urls = new Set(
      ['waves', 'mountains', 'dunes', 'forest', 'aurora', 'sunset'].map(
        homeBackgroundPresetUrl,
      ),
    );
    expect(urls.size).toBe(6);
  });
});
