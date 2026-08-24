import { io, type Socket } from 'socket.io-client';
import type {
  MessageFailedEvent,
  MessageNewEvent,
  MessageReactionsEvent,
  MessageReadEvent,
  MessageSendAck,
  MessageStatusEvent,
  ServerMessage,
  TypingEvent,
} from './types';

const MESSAGE_SEND_TIMEOUT_MS = 10_000;

export interface ChatSocketHandlers {
  onMessageNew: (event: MessageNewEvent) => void;
  onMessageFailed: (event: MessageFailedEvent) => void;
  onConnectionChange: (connected: boolean) => void;
  onReconnectBackfillNeeded: () => void;
  onMessageStatus: (event: MessageStatusEvent) => void;
  onMessageRead: (event: MessageReadEvent) => void;
  onMessageReactions: (event: MessageReactionsEvent) => void;
  onTypingStart: (event: TypingEvent) => void;
  onTypingStop: (event: TypingEvent) => void;
}

export class ChatSocket {
  private socket: Socket | null = null;

  constructor(
    private readonly apiBaseUrl: string,
    private readonly getAccessToken: () => Promise<string>,
  ) {}

  async connect(handlers: ChatSocketHandlers): Promise<void> {
    const accessToken = await this.getAccessToken();
    const socket = io(`${this.apiBaseUrl}/chat`, {
      auth: { accessToken },
    });
    this.socket = socket;

    let hasConnectedBefore = false;
    socket.on('connect', () => {
      handlers.onConnectionChange(true);
      if (hasConnectedBefore) handlers.onReconnectBackfillNeeded();
      hasConnectedBefore = true;
    });
    socket.on('disconnect', () => handlers.onConnectionChange(false));
    socket.on('message:new', (event: MessageNewEvent) => {
      handlers.onMessageNew(event);
    });
    socket.on('message:failed', (event: MessageFailedEvent) => {
      handlers.onMessageFailed(event);
    });
    socket.on('message:status', (event: MessageStatusEvent) => {
      handlers.onMessageStatus(event);
    });
    socket.on('message:read', (event: MessageReadEvent) => {
      handlers.onMessageRead(event);
    });
    socket.on('message:reactions', (event: MessageReactionsEvent) => {
      handlers.onMessageReactions(event);
    });
    socket.on('typing:start', (event: TypingEvent) => {
      handlers.onTypingStart(event);
    });
    socket.on('typing:stop', (event: TypingEvent) => {
      handlers.onTypingStop(event);
    });

    socket.io.on('reconnect_attempt', () => {
      void this.getAccessToken().then((token) => {
        socket.auth = { accessToken: token };
      });
    });
  }

  emitTypingStart(conversationId?: string): void {
    this.socket?.emit('typing:start', { conversationId });
  }

  emitTypingStop(conversationId?: string): void {
    this.socket?.emit('typing:stop', { conversationId });
  }

  emitDraftUpdate(text: string): void {
    this.socket?.emit('visitor:draft:update', { text });
  }

  emitDraftClear(): void {
    this.socket?.emit('visitor:draft:clear');
  }

  sendMessage(
    clientMessageId: string,
    content: string,
    attachmentIds: string[] = [],
    replyToMessageId?: string,
  ): Promise<ServerMessage> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }
      const timeout = setTimeout(() => {
        reject(new Error('Message send timed out'));
      }, MESSAGE_SEND_TIMEOUT_MS);
      this.socket.emit(
        'message:send',
        { clientMessageId, content, attachmentIds, replyToMessageId },
        (ack: MessageSendAck) => {
          clearTimeout(timeout);
          if (ack.ok) resolve(ack.message);
          else reject(new Error(ack.message));
        },
      );
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
