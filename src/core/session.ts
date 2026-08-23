import type { ChatApi } from './api';
import type { ChatSession, IdentifyResult } from './types';

const REFRESH_BUFFER_MS = 30_000;

export class SessionManager {
  private accessToken: string | null = null;
  private visitorId: string | null = null;
  private expiresAtMs = 0;
  private contactId: string | null = null;
  private inflight: Promise<ChatSession> | null = null;

  constructor(
    private readonly api: ChatApi,
    private readonly siteId: string,
  ) {}

  private get storageKey(): string {
    return `kodescape_chat_resume_token:${this.siteId}`;
  }

  private readStoredResumeToken(): string | undefined {
    try {
      return localStorage.getItem(this.storageKey) ?? undefined;
    } catch {
      return undefined;
    }
  }

  private writeStoredResumeToken(token: string): void {
    try {
      localStorage.setItem(this.storageKey, token);
    } catch {}
  }

  getVisitorId(): string | null {
    return this.visitorId;
  }

  getContactId(): string | null {
    return this.contactId;
  }

  hasResumedSession(): boolean {
    return this.readStoredResumeToken() !== undefined;
  }

  async ensureAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAtMs - REFRESH_BUFFER_MS) {
      return this.accessToken;
    }
    if (!this.inflight) {
      this.inflight = this.refresh();
    }
    try {
      const session = await this.inflight;
      return session.accessToken;
    } finally {
      this.inflight = null;
    }
  }

  private async refresh(): Promise<ChatSession> {
    const resumeToken = this.readStoredResumeToken();
    const session = await this.api.createSession(this.siteId, resumeToken);
    this.accessToken = session.accessToken;
    this.visitorId = session.visitorId;
    this.expiresAtMs = new Date(session.expiresAt).getTime();
    this.contactId = session.contactId;
    this.writeStoredResumeToken(session.resumeToken);
    return session;
  }

  applyIdentifySession(result: IdentifyResult): void {
    this.accessToken = result.accessToken;
    this.expiresAtMs = new Date(result.expiresAt).getTime();
    this.contactId = result.contactId;
    this.writeStoredResumeToken(result.resumeToken);
  }
}
