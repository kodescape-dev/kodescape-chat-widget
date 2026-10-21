import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatApi } from '../../src/core/api';

function stubFetch() {
  const fetchMock = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          statusCode: 200,
          message: '',
          data: { name: 'Chat' },
        }),
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('ChatApi.getWidgetSettings', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('never reuses a cached copy, so admin changes show up on the next page load', async () => {
    const fetchMock = stubFetch();

    await new ChatApi('http://api.test').getWidgetSettings('site-1');

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(init.cache).toBe('no-store');
    expect(init.method).toBe('GET');
  });

  it('asks for the settings of the given site, safely encoded', async () => {
    const fetchMock = stubFetch();

    await new ChatApi('http://api.test').getWidgetSettings('a b&c');

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe(
      'http://api.test/api/v1/public/chat/widget-settings?siteId=a%20b%26c',
    );
  });
});
