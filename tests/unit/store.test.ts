import { describe, it, expect, vi } from 'vitest';
import { ChatStore } from '../../src/core/store';
import type { ServerMessage } from '../../src/core/types';

function serverMessage(overrides: Partial<ServerMessage> = {}): ServerMessage {
  return {
    id: 'msg-1',
    clientMessageId: 'client-1',
    direction: 'inbound',
    senderType: 'visitor',
    senderName: null,
    content: 'hello',
    createdAt: new Date().toISOString(),
    status: 'sent',
    ...overrides,
  };
}

describe('ChatStore', () => {
  it('adds a pending message immediately with status "sending"', () => {
    const store = new ChatStore();
    store.addPending('client-1', 'hello');

    const [message] = store.getMessages();
    expect(message).toMatchObject({
      id: null,
      clientMessageId: 'client-1',
      status: 'sending',
      content: 'hello',
    });
  });

  it('reconciles a pending message to "sent" using the REST response, without duplicating it', () => {
    const store = new ChatStore();
    store.addPending('client-1', 'hello');
    store.confirmSent('client-1', serverMessage());

    expect(store.getMessages()).toHaveLength(1);
    expect(store.getMessages()[0]).toMatchObject({
      id: 'msg-1',
      status: 'sent',
    });
  });

  it('marks a pending message as failed and allows retrying it in place', () => {
    const store = new ChatStore();
    store.addPending('client-1', 'hello');
    store.markFailed('client-1');
    expect(store.getMessages()[0].status).toBe('failed');

    store.retry('client-1');
    expect(store.getMessages()[0].status).toBe('sending');
    expect(store.getMessages()).toHaveLength(1);
  });

  it('deduplicates history/backfill items already known by server id', () => {
    const store = new ChatStore();
    store.mergeServerMessages([serverMessage({ id: 'msg-1' })]);
    store.mergeServerMessages([
      serverMessage({ id: 'msg-1' }),
      serverMessage({ id: 'msg-2', clientMessageId: 'client-2' }),
    ]);

    expect(store.getMessages().map((m) => m.id)).toEqual(['msg-1', 'msg-2']);
  });

  it('reconciles an already-pending clientMessageId when it reappears in a history page instead of duplicating', () => {
    const store = new ChatStore();
    store.addPending('client-1', 'hello');
    store.mergeServerMessages([
      serverMessage({ id: 'msg-1', clientMessageId: 'client-1' }),
    ]);

    expect(store.getMessages()).toHaveLength(1);
    expect(store.getMessages()[0].status).toBe('sent');
  });

  it('accepts an admin reply delivered over the socket as a normal server message', () => {
    const store = new ChatStore();
    store.receiveRealtime(
      serverMessage({
        id: 'msg-9',
        clientMessageId: 'admin-1',
        direction: 'outbound',
        senderType: 'human',
        content: 'how can I help?',
      }),
    );

    expect(store.getMessages()).toEqual([
      expect.objectContaining({
        id: 'msg-9',
        direction: 'outbound',
        status: 'sent',
      }),
    ]);
  });

  it('notifies subscribers on every mutation and lets them unsubscribe', () => {
    const store = new ChatStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.addPending('client-1', 'hello');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.addPending('client-2', 'again');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('tracks connection status changes only when the value actually changes', () => {
    const store = new ChatStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setConnected(true);
    store.setConnected(true);
    store.setConnected(false);

    expect(store.isConnected()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('bumps a sent message to "delivered" via applyDelivered', () => {
    const store = new ChatStore();
    store.mergeServerMessages([serverMessage({ id: 'msg-1' })]);

    store.applyDelivered('msg-1');

    expect(store.getMessages()[0].status).toBe('delivered');
  });

  it('never downgrades a "read" message back to "delivered"', () => {
    const store = new ChatStore();
    store.mergeServerMessages([serverMessage({ id: 'msg-1' })]);

    store.applyRead(['msg-1']);
    expect(store.getMessages()[0].status).toBe('read');

    store.applyDelivered('msg-1');

    expect(store.getMessages()[0].status).toBe('read');
  });

  it('applyDelivered is a no-op for an unknown message id', () => {
    const store = new ChatStore();
    const listener = vi.fn();
    store.mergeServerMessages([serverMessage({ id: 'msg-1' })]);
    store.subscribe(listener);

    store.applyDelivered('does-not-exist');

    expect(store.getMessages()[0].status).toBe('sent');
    expect(listener).not.toHaveBeenCalled();
  });

  it('bumps a set of message ids to "read" via applyRead, leaving others untouched', () => {
    const store = new ChatStore();
    store.mergeServerMessages([
      serverMessage({ id: 'msg-1' }),
      serverMessage({ id: 'msg-2', clientMessageId: 'client-2' }),
    ]);

    store.applyRead(['msg-1']);

    const [first, second] = store.getMessages();
    expect(first.status).toBe('read');
    expect(second.status).toBe('sent');
  });

  it('applyRead does not notify subscribers when nothing changes', () => {
    const store = new ChatStore();
    store.mergeServerMessages([serverMessage({ id: 'msg-1', status: 'read' })]);
    const listener = vi.fn();
    store.subscribe(listener);

    store.applyRead(['msg-1']);

    expect(listener).not.toHaveBeenCalled();
  });
});
