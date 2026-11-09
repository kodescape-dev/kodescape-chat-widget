const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface DraftStore {
  load(): Record<string, unknown> | null;
  save(value: unknown): void;
  clear(): void;
}

const noDraft: DraftStore = {
  load: () => null,
  save: () => undefined,
  clear: () => undefined,
};

export function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function createDraftStore(key: string | null): DraftStore {
  if (!key) return noDraft;
  return {
    load() {
      try {
        const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as {
          savedAt?: number;
          value?: Record<string, unknown>;
        } | null;
        if (!saved?.value || typeof saved.value !== 'object') return null;
        if (Date.now() - Number(saved.savedAt) > DRAFT_TTL_MS) {
          localStorage.removeItem(key);
          return null;
        }
        return saved.value;
      } catch {
        return null;
      }
    },
    save(value) {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ savedAt: Date.now(), value }),
        );
      } catch {}
    },
    clear() {
      try {
        localStorage.removeItem(key);
      } catch {}
    },
  };
}
