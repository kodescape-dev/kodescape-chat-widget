import { describe, it, expect } from 'vitest';
import {
  buildContextPayload,
  contextDedupeKey,
  detectClientInfo,
  truncate,
} from '../../src/core/context';

const CHROME_MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SAFARI_IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const SAFARI_IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

describe('truncate', () => {
  it('leaves short values untouched', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('cuts values down to the max length', () => {
    expect(truncate('a'.repeat(50), 10)).toHaveLength(10);
  });
});

describe('detectClientInfo', () => {
  it('identifies a desktop Chrome/macOS user agent', () => {
    expect(detectClientInfo(CHROME_MAC_UA)).toEqual({
      browser: 'Chrome',
      os: 'macOS',
      deviceType: 'desktop',
    });
  });

  it('identifies a mobile Safari/iOS user agent', () => {
    const info = detectClientInfo(SAFARI_IPHONE_UA);
    expect(info.os).toBe('iOS');
    expect(info.deviceType).toBe('mobile');
  });

  it('identifies an iPad as a tablet', () => {
    expect(detectClientInfo(SAFARI_IPAD_UA).deviceType).toBe('tablet');
  });
});

describe('buildContextPayload', () => {
  it('truncates and forwards every field', () => {
    const payload = buildContextPayload({
      currentUrl: 'https://example.com/page',
      currentPageTitle: 'a'.repeat(5000),
      initialUrl: 'https://example.com/landing',
      referrer: 'https://google.com',
      userAgent: CHROME_MAC_UA,
      timezone: 'America/New_York',
    });

    expect(payload.currentUrl).toBe('https://example.com/page');
    expect(payload.currentPageTitle).toHaveLength(300);
    expect(payload.initialUrl).toBe('https://example.com/landing');
    expect(payload.browser).toBe('Chrome');
    expect(payload.os).toBe('macOS');
    expect(payload.deviceType).toBe('desktop');
    expect(payload.timezone).toBe('America/New_York');
  });
});

describe('contextDedupeKey', () => {
  it('produces the same key for the same url/title pair', () => {
    const a = buildContextPayload({
      currentUrl: 'https://example.com/a',
      currentPageTitle: 'Page A',
      initialUrl: 'https://example.com/a',
      referrer: '',
      userAgent: CHROME_MAC_UA,
      timezone: 'UTC',
    });
    const b = buildContextPayload({
      currentUrl: 'https://example.com/a',
      currentPageTitle: 'Page A',
      initialUrl: 'https://example.com/a',
      referrer: '',
      userAgent: CHROME_MAC_UA,
      timezone: 'UTC',
    });

    expect(contextDedupeKey(a)).toBe(contextDedupeKey(b));
  });

  it('produces a different key when the current url changes', () => {
    const a = buildContextPayload({
      currentUrl: 'https://example.com/a',
      currentPageTitle: 'Page A',
      initialUrl: 'https://example.com/a',
      referrer: '',
      userAgent: CHROME_MAC_UA,
      timezone: 'UTC',
    });
    const b = buildContextPayload({
      currentUrl: 'https://example.com/b',
      currentPageTitle: 'Page A',
      initialUrl: 'https://example.com/a',
      referrer: '',
      userAgent: CHROME_MAC_UA,
      timezone: 'UTC',
    });

    expect(contextDedupeKey(a)).not.toBe(contextDedupeKey(b));
  });
});
