import { io, type Socket } from 'socket.io-client';
import type {
  MessageNewEvent,
  MessageFailedEvent,
  MessageReadEvent,
  MessageReactionsEvent,
  MessageStatusEvent,
  TypingEvent,
} from './types';

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

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
