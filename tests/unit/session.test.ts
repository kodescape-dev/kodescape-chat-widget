import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from '../../src/core/session';
import type { ChatApi } from '../../src/core/api';

function fakeSession(overrides: Partial<{ expiresInMs: number }> = {}) {
  const expiresInMs = overrides.expiresInMs ?? 15 * 60 * 1000;
  return {
    resumeToken: 'resume-token-1',
    accessToken: 'access-token-1',
    visitorId: 'visitor-1',
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  };
}

describe('SessionManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a session on first use and reuses the access token while valid', async () => {
    const createSession = vi.fn().mockResolvedValue(fakeSession());
    const api = { createSession } as unknown as ChatApi;
    const session = new SessionManager(api, 'site-1');

    const first = await session.ensureAccessToken();
    const second = await session.ensureAccessToken();

    expect(first).toBe('access-token-1');
    expect(second).toBe('access-token-1');
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it('persists only the resume token to localStorage, never the access token', async () => {
    const createSession = vi.fn().mockResolvedValue(fakeSession());
    const api = { createSession } as unknown as ChatApi;
    const session = new SessionManager(api, 'site-1');

    await session.ensureAccessToken();

    expect(localStorage.getItem('kodescape_chat_resume_token:site-1')).toBe(
      'resume-token-1',
    );
    expect(localStorage.length).toBe(1);
  });

  it('sends the stored resume token on the next refresh', async () => {
    localStorage.setItem('kodescape_chat_resume_token:site-1', 'stored-resume');
    const createSession = vi.fn().mockResolvedValue(fakeSession());
    const api = { createSession } as unknown as ChatApi;
    const session = new SessionManager(api, 'site-1');

    await session.ensureAccessToken();

    expect(createSession).toHaveBeenCalledWith('site-1', 'stored-resume');
  });

  it('refreshes once an already-issued access token is close to expiry', async () => {
    const createSession = vi
      .fn()
      .mockResolvedValueOnce(fakeSession({ expiresInMs: 5_000 }))
      .mockResolvedValueOnce({
        ...fakeSession(),
        accessToken: 'access-token-2',
      });
    const api = { createSession } as unknown as ChatApi;
    const session = new SessionManager(api, 'site-1');

    const first = await session.ensureAccessToken();
    const second = await session.ensureAccessToken();

    expect(first).toBe('access-token-1');
    expect(second).toBe('access-token-2');
    expect(createSession).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight refresh across concurrent callers', async () => {
    let resolveCreate!: (value: ReturnType<typeof fakeSession>) => void;
    const createSession = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    const api = { createSession } as unknown as ChatApi;
    const session = new SessionManager(api, 'site-1');

    const call1 = session.ensureAccessToken();
    const call2 = session.ensureAccessToken();
    resolveCreate(fakeSession());

    const [token1, token2] = await Promise.all([call1, call2]);

    expect(token1).toBe('access-token-1');
    expect(token2).toBe('access-token-1');
    expect(createSession).toHaveBeenCalledTimes(1);
  });
});
