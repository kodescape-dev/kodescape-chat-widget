import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/ui/styles.css', 'utf8');
const section = css.slice(css.indexOf('/* ---------- contact channels'));

describe('contact channel and booking styles', () => {
  it('take every color from the appearance variables, not fixed values', () => {
    const withoutFallbacks = section.replace(
      /var\(--[\w-]+,\s*(#[0-9a-f]{3,8}|[^()]*)\)/gi,
      'var(--theme)',
    );
    const fixed = withoutFallbacks.match(/#[0-9a-f]{3,8}\b|rgba?\(/gi) ?? [];
    expect(fixed.filter((value) => value.toLowerCase() !== '#ef4444')).toEqual(
      [],
    );
  });
});
