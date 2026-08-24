import type {
  MessageAttachment,
  MessageReaction,
  MessageReply,
  ServerMessage,
} from './types';

export type LocalMessageStatus =
  'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface LocalMessage {
  id: string | null;
  clientMessageId: string;
  direction: 'inbound' | 'outbound';
  senderName: string | null;
  content: string;
  attachments?: MessageAttachment[];
  replyTo?: MessageReply | null;
  reactions?: MessageReaction[];
  createdAt: string;
  status: LocalMessageStatus;
}

export class ChatStore {
  private messages: LocalMessage[] = [];
  private readonly listeners = new Set<() => void>();
  private connected = false;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  getMessages(): readonly LocalMessage[] {
    return this.messages;
  }

  isConnected(): boolean {
    return this.connected;
  }

  setConnected(connected: boolean): void {
    if (this.connected === connected) return;
    this.connected = connected;
    this.emit();
  }

  addPending(
    clientMessageId: string,
    content: string,
    attachments: MessageAttachment[] = [],
    replyTo: MessageReply | null = null,
  ): void {
    this.messages.push({
      id: null,
      clientMessageId,
      direction: 'inbound',
      senderName: null,
      content,
      attachments,
      replyTo,
      reactions: [],
      createdAt: new Date().toISOString(),
      status: 'sending',
    });
    this.emit();
  }

  confirmSent(clientMessageId: string, server: ServerMessage): void {
    if (this.messages.some((m) => m.id === server.id)) {
      this.messages = this.messages.filter(
        (m) => m.clientMessageId !== clientMessageId || m.id === server.id,
      );
      this.emit();
      return;
    }
    const pending = this.messages.find(
      (m) => m.clientMessageId === clientMessageId,
    );
    if (pending) {
      pending.id = server.id;
      pending.createdAt = server.createdAt;
      pending.status = server.status;
      pending.senderName = server.senderName;
      pending.attachments = server.attachments ?? [];
      pending.replyTo = server.replyTo ?? null;
      pending.reactions = server.reactions ?? [];
    } else {
      this.messages.push({
        id: server.id,
        clientMessageId,
        direction: server.direction,
        senderName: server.senderName,
        content: server.content,
        attachments: server.attachments ?? [],
        replyTo: server.replyTo ?? null,
        reactions: server.reactions ?? [],
        createdAt: server.createdAt,
        status: server.status,
      });
    }
    this.emit();
  }

  markFailed(clientMessageId: string): void {
    const pending = this.messages.find(
      (m) => m.clientMessageId === clientMessageId,
    );
    if (!pending) return;
    pending.status = 'failed';
    this.emit();
  }

  retry(clientMessageId: string): void {
    const pending = this.messages.find(
      (m) => m.clientMessageId === clientMessageId,
    );
    if (!pending) return;
    pending.status = 'sending';
    this.emit();
  }

  mergeServerMessages(items: ServerMessage[]): void {
    let changed = false;
    for (const item of items) {
      const existingById = this.messages.find((m) => m.id === item.id);
      if (existingById) continue;
      const existingByClientId = this.messages.find(
        (m) => m.clientMessageId === item.clientMessageId && m.id === null,
      );
      if (existingByClientId) {
        existingByClientId.id = item.id;
        existingByClientId.createdAt = item.createdAt;
        existingByClientId.status = item.status;
        existingByClientId.senderName = item.senderName;
        existingByClientId.replyTo = item.replyTo ?? null;
        existingByClientId.reactions = item.reactions ?? [];
        changed = true;
        continue;
      }
      this.messages.push({
        id: item.id,
        clientMessageId: item.clientMessageId,
        direction: item.direction,
        senderName: item.senderName,
        content: item.content,
        attachments: item.attachments ?? [],
        replyTo: item.replyTo ?? null,
        reactions: item.reactions ?? [],
        createdAt: item.createdAt,
        status: item.status,
      });
      changed = true;
    }
    if (!changed) return;
    this.messages.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    this.emit();
  }

  applyDelivered(messageId: string): void {
    const message = this.messages.find((m) => m.id === messageId);
    if (!message) return;
    if (message.status === 'delivered' || message.status === 'read') return;
    message.status = 'delivered';
    this.emit();
  }

  applyRead(messageIds: readonly string[]): void {
    const idSet = new Set(messageIds);
    let changed = false;
    for (const message of this.messages) {
      if (!message.id || !idSet.has(message.id)) continue;
      if (message.status === 'read') continue;
      message.status = 'read';
      changed = true;
    }
    if (!changed) return;
    this.emit();
  }

  receiveRealtime(item: ServerMessage): void {
    this.mergeServerMessages([item]);
  }

  applyReactions(messageId: string, reactions: MessageReaction[]): void {
    const message = this.messages.find((item) => item.id === messageId);
    if (!message) return;
    message.reactions = reactions;
    this.emit();
  }

  togglePreviewReaction(messageId: string, emoji: string): void {
    const message = this.messages.find((item) => item.id === messageId);
    if (!message) return;
    const reactions = [...(message.reactions ?? [])];
    const index = reactions.findIndex(
      (reaction) =>
        reaction.emoji === emoji && reaction.actorType === 'visitor',
    );
    if (index >= 0) reactions.splice(index, 1);
    else
      reactions.push({
        emoji,
        actorType: 'visitor',
        actorName: null,
        createdAt: new Date().toISOString(),
      });
    message.reactions = reactions;
    this.emit();
  }
}
