import type {
  ApiEnvelope,
  ChatSession,
  ContextPayload,
  IdentifyResult,
  MessageAttachment,
  MessagesPage,
  ServerMessage,
  WidgetSettings,
} from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  let body: ApiEnvelope<T> | undefined;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    body = undefined;
  }
  if (!response.ok || !body?.success) {
    throw new ApiError(
      body?.message ?? `Request failed (${response.status})`,
      response.status,
    );
  }
  return body.data as T;
}

export class ChatApi {
  constructor(private readonly apiBaseUrl: string) {}

  getWidgetSettings(siteId: string): Promise<WidgetSettings> {
    return request<WidgetSettings>(
      `${this.apiBaseUrl}/api/v1/public/chat/widget-settings?siteId=${encodeURIComponent(siteId)}`,
      { method: 'GET' },
    );
  }

  createSession(
    siteId: string,
    resumeToken: string | undefined,
  ): Promise<ChatSession> {
    return request<ChatSession>(
      `${this.apiBaseUrl}/api/v1/public/chat/session?siteId=${encodeURIComponent(siteId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeToken }),
      },
    );
  }

  getMessages(
    accessToken: string,
    params: { cursor?: string; after?: string; limit?: number } = {},
  ): Promise<MessagesPage> {
    const query = new URLSearchParams();
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.after) query.set('after', params.after);
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<MessagesPage>(
      `${this.apiBaseUrl}/api/v1/public/chat/messages${qs ? `?${qs}` : ''}`,
      { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  sendMessage(
    accessToken: string,
    clientMessageId: string,
    content: string,
    attachmentIds: string[] = [],
    replyToMessageId?: string,
  ): Promise<ServerMessage> {
    return request<ServerMessage>(
      `${this.apiBaseUrl}/api/v1/public/chat/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          clientMessageId,
          content,
          attachmentIds,
          replyToMessageId,
        }),
      },
    );
  }

  reactToMessage(
    accessToken: string,
    messageId: string,
    emoji: string,
  ): Promise<ServerMessage> {
    return request<ServerMessage>(
      `${this.apiBaseUrl}/api/v1/public/chat/messages/${messageId}/reactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ emoji }),
      },
    );
  }

  uploadAttachment(
    accessToken: string,
    file: File,
  ): Promise<MessageAttachment> {
    const body = new FormData();
    body.append('file', file);
    return request<MessageAttachment>(
      `${this.apiBaseUrl}/api/v1/public/chat/attachments`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body,
      },
    );
  }

  identify(
    accessToken: string,
    data: { name?: string; email?: string },
  ): Promise<IdentifyResult> {
    return request<IdentifyResult>(
      `${this.apiBaseUrl}/api/v1/public/chat/identify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(data),
      },
    );
  }

  updateContext(
    accessToken: string,
    payload: ContextPayload,
  ): Promise<{ updated: boolean }> {
    return request<{ updated: boolean }>(
      `${this.apiBaseUrl}/api/v1/public/chat/context`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      },
    );
  }

  markMessagesRead(accessToken: string): Promise<{ updated: boolean }> {
    return request<{ updated: boolean }>(
      `${this.apiBaseUrl}/api/v1/public/chat/messages/read`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
  }
}
