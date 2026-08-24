import { ChatApi } from './core/api';
import { SessionManager } from './core/session';
import { ChatSocket } from './core/socket';
import { ChatStore } from './core/store';
import type { LocalMessage } from './core/store';
import type {
  DeviceDisplaySettings,
  MessageAttachment,
  TypingEvent,
  WidgetDeviceSettings,
  WidgetSettings,
} from './core/types';
import type { ComposerSubmission } from './ui/composer';
import { buildContextPayload, contextDedupeKey } from './core/context';
import { findWidgetScript } from './script-element';
import { createLauncher } from './ui/launcher';
import { createChatWindow } from './ui/window';
import { renderMessages } from './ui/message-list';
import type { LeadCaptureConfig, LeadCaptureData } from './ui/lead-capture';
import type {
  ContactPromptConfig,
  ContactPromptData,
} from './ui/contact-prompt';
import styles from './ui/styles.css?inline';

export interface MountOptions {
  siteId: string;
  apiBaseUrl?: string;
  target?: HTMLElement;
  preview?: boolean;
}

export interface MountedWidget {
  destroy(): void;
}

export type PreviewState = 'home' | 'chat' | 'pre-chat' | 'minimized';
export type PreviewDevice = 'desktop' | 'mobile';

export type PreviewConfigMessage = {
  type: 'kodescape-widget-preview:configure';
  settings: WidgetSettings;
  state: PreviewState;
  device: PreviewDevice;
};

const DEFAULT_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'https://api.kodescape.com';
const HISTORY_PAGE_LIMIT = 20;
const HISTORY_TOP_THRESHOLD_PX = 80;
const HISTORY_PRELOAD_DELAY_MS = 1000;
const DRAFT_UPDATE_DELAY_MS = 250;
const REMOTE_TYPING_TIMEOUT_MS = 6000;
const CONTEXT_POLL_INTERVAL_MS = 2000;
const DEFAULT_LEAD_SETTINGS: Pick<
  WidgetSettings,
  | 'askName'
  | 'requireName'
  | 'askEmail'
  | 'requireEmail'
  | 'formHeading'
  | 'formDescription'
  | 'contactCollectionMode'
> = {
  askName: true,
  requireName: true,
  askEmail: true,
  requireEmail: true,
  formHeading: '',
  formDescription: '',
  contactCollectionMode: 'after_first_message',
};

const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  name: 'Chat with us',
  supportDisplayName: 'Kodescape Support',
  supportSubtitle: 'We are here to help',
  supportAvatarUrl: null,
  incomingMessageSound: true,
  primaryColor: '#173bd3',
  backgroundColor: '#ffffff',
  textColor: '#0b1437',
  launcherPosition: 'right',
  welcomeMessage: 'How can we help you today?',
  welcomeHeading: 'Hi there 👋',
  conversationStarters: [
    'I have a question about my account',
    'Billing and subscription help',
    'Report an issue or bug',
  ],
  composerPlaceholder: 'Enter your message...',
  launcherStyle: 'label_icon',
  launcherLabel: 'Chat with us',
  launcherIcon: 'chat',
  askName: true,
  requireName: true,
  askEmail: true,
  requireEmail: true,
  formHeading: "Let's get you connected",
  formDescription: 'Please share a few details so we can help you.',
  contactCollectionMode: 'before_chat',
  showOnDesktop: true,
  showOnMobile: true,
  deviceSettings: {
    desktop: {
      display: true,
      position: 'right',
      launcherStyle: 'label_icon',
      bottomOffset: 20,
      sideOffset: 20,
      launcherSize: 'medium',
    },
    mobile: {
      display: true,
      position: 'right',
      launcherStyle: 'label_icon',
      bottomOffset: 20,
      sideOffset: 20,
      launcherSize: 'medium',
    },
  },
  visibilityRules: [],
};

const PREVIEW_MESSAGES = [
  {
    id: 'preview-1',
    clientMessageId: 'preview-client-1',
    direction: 'inbound' as const,
    senderType: 'visitor' as const,
    senderName: null,
    content: 'Hi! I have a question about my account.',
    attachments: [],
    reactions: [
      {
        emoji: '👍',
        actorType: 'human' as const,
        actorName: 'Kodescape Support',
        createdAt: new Date(Date.now() - 3.5 * 60_000).toISOString(),
      },
    ],
    status: 'read' as const,
    createdAt: new Date(Date.now() - 4 * 60_000).toISOString(),
  },
  {
    id: 'preview-2',
    clientMessageId: 'preview-client-2',
    direction: 'outbound' as const,
    senderType: 'human' as const,
    senderName: 'Kodescape Support',
    content: 'Of course — what can we help you with?',
    attachments: [],
    reactions: [],
    status: 'delivered' as const,
    createdAt: new Date(Date.now() - 3 * 60_000).toISOString(),
  },
  {
    id: 'preview-3',
    clientMessageId: 'preview-client-3',
    direction: 'inbound' as const,
    senderType: 'visitor' as const,
    senderName: null,
    content: "I'm having trouble updating my payment method.",
    attachments: [],
    status: 'read' as const,
    createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  },
  {
    id: 'preview-4',
    clientMessageId: 'preview-client-4',
    direction: 'outbound' as const,
    senderType: 'human' as const,
    senderName: 'Kodescape Support',
    content: 'Thanks for letting us know. I can help you with that!',
    attachments: [],
    replyTo: {
      messageId: 'preview-3',
      senderType: 'visitor' as const,
      senderName: null,
      content: "I'm having trouble updating my payment method.",
    },
    reactions: [],
    status: 'delivered' as const,
    createdAt: new Date(Date.now() - 60_000).toISOString(),
  },
];

export function mount(options: MountOptions): MountedWidget {
  const apiBaseUrl = (options.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(
    /\/$/,
    '',
  );
  const api = new ChatApi(apiBaseUrl);
  const session = new SessionManager(api, options.siteId);
  const store = new ChatStore();
  const socket = new ChatSocket(apiBaseUrl, () => session.ensureAccessToken());

  const host = document.createElement('div');
  host.style.all = 'initial';
  const shadow = host.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  shadow.appendChild(styleEl);

  const root = document.createElement('div');
  root.className = 'kw-root kw-root--right';
  shadow.appendChild(root);

  let isOpen = false;
  let hasEnteredChat = false;
  let currentSettings: WidgetSettings | null = null;
  let soundNotificationsEnabled = DEFAULT_WIDGET_SETTINGS.incomingMessageSound;
  let previewDevice: PreviewDevice = 'desktop';
  let resumeContactStatus:
    'unknown' | 'no-resume' | 'no-contact' | 'has-contact' =
    session.hasResumedSession() ? 'unknown' : 'no-resume';
  let resumeStatusPromise: Promise<void> | null = null;

  let currentConversationId: string | null = null;
  let hasSentFirstMessage = false;
  let contactPromptHandled = false;
  let socketStarted = false;
  let unreadMessageCount = 0;
  let draftUpdateTimer: ReturnType<typeof setTimeout> | null = null;
  let draftActive = false;
  let lastDraftUpdateAt = 0;
  const remoteTypers = new Map<
    string,
    { id: string; name: string; avatarUrl?: string | null }
  >();
  const remoteTypingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let readMarkInFlight = false;
  let historyLoaded = false;
  let historyNextCursor: string | null = null;
  let historyLoadPromise: Promise<void> | null = null;
  let olderHistoryLoading = false;
  let historyPreloadTimer: ReturnType<typeof setTimeout> | null = null;
  let hasPositionedInitialHistory = false;

  const initialUrl = location.href;
  const referrer = document.referrer;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let lastPostedContextKey: string | null = null;
  let contextPollTimer: ReturnType<typeof setInterval> | null = null;

  const launcher = createLauncher(() => void setOpen(!isOpen));
  const chatWindow = createChatWindow({
    onClose: () => void setOpen(false),
    onSend: handleSend,
    onUpload: handleUpload,
    onStarter: handleStarter,
    onContinue: () => void enterChat(),
    onStart: handleStart,
    onLeadSubmit: handleLeadSubmit,
    onComposerInput: handleComposerInput,
    onContactPromptSubmit: handleContactPromptSubmit,
    onContactPromptDismiss: handleContactPromptDismiss,
    onNotificationsChange: (enabled) => {
      soundNotificationsEnabled = enabled;
    },
  });
  chatWindow.setResumeAvailable(canAutoResume());
  root.append(chatWindow.el, launcher.el);
  chatWindow.listEl.addEventListener('scroll', handleMessageListScroll);

  (options.target ?? document.body).appendChild(host);

  const unsubscribe = store.subscribe(() => {
    renderMessages(
      chatWindow.listEl,
      store.getMessages(),
      handleRetry,
      handleReaction,
      handleReply,
      {
        name:
          currentSettings?.supportDisplayName ??
          DEFAULT_WIDGET_SETTINGS.supportDisplayName,
        avatarUrl: currentSettings?.supportAvatarUrl ?? null,
      },
    );
    chatWindow.setConnectionStatus(store.isConnected());
    launcher.setUnread(isOpen ? 0 : unreadMessageCount);
    maybeMarkMessagesRead(unreadMessageCount > 0);
  });

  function hasUnseenAdminMessage(): boolean {
    const messages = store.getMessages();
    const last = messages[messages.length - 1];
    return last?.direction === 'outbound';
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('resize', handleViewportChange);

  const handlePreviewMessage = (event: MessageEvent<unknown>) => {
    if (event.source !== window.parent) return;
    const data = event.data as Partial<PreviewConfigMessage> | null;
    if (data?.type !== 'kodescape-widget-preview:configure') return;
    if (!data.settings || !data.state || !data.device) return;
    applyPreview(data as PreviewConfigMessage);
  };

  if (options.preview) {
    window.addEventListener('message', handlePreviewMessage);
    applyPreview({
      type: 'kodescape-widget-preview:configure',
      settings: DEFAULT_WIDGET_SETTINGS,
      state: 'home',
      device: 'desktop',
    });
    window.parent.postMessage({ type: 'kodescape-widget-preview:ready' }, '*');
  } else {
    void api
      .getWidgetSettings(options.siteId)
      .then(applyBranding)
      .catch(() => {});
    connectVisitorSocket();
  }

  async function setOpen(next: boolean): Promise<void> {
    isOpen = next;
    chatWindow.setVisible(isOpen);
    launcher.setOpen(isOpen);
    if (!isOpen) {
      launcher.focus();
      return;
    }
    if (options.preview) {
      if (!hasEnteredChat) chatWindow.showHome();
      return;
    }
    const hadUnreadMessages = unreadMessageCount > 0;
    unreadMessageCount = 0;
    launcher.setUnread(0);
    if (!hasEnteredChat) {
      await ensureResumeContactStatusResolved();
      if (canAutoResume()) {
        await enterChat();
      }
    }
    if (hasEnteredChat) {
      await loadInitialHistory();
      positionInitialHistoryAtBottom();
      chatWindow.focusComposer();
    } else {
      chatWindow.showHome();
    }
    maybeMarkMessagesRead(hadUnreadMessages || hasUnseenAdminMessage());
  }

  function handleVisibilityChange(): void {
    if (options.preview) return;
    if (document.visibilityState === 'visible' && isOpen) {
      const hadUnreadMessages = unreadMessageCount > 0;
      unreadMessageCount = 0;
      launcher.setUnread(0);
      maybeMarkMessagesRead(hadUnreadMessages || hasUnseenAdminMessage());
      return;
    }
    maybeMarkMessagesRead(hasUnseenAdminMessage());
  }

  function handleViewportChange(): void {
    if (currentSettings && !options.preview) applyDeviceLayout(currentSettings);
  }

  function maybeMarkMessagesRead(hasUnseen: boolean): void {
    if (options.preview) return;
    if (!hasUnseen) {
      readMarkInFlight = false;
      return;
    }
    if (!isOpen) return;
    if (document.visibilityState !== 'visible') return;
    if (readMarkInFlight) return;
    readMarkInFlight = true;
    void (async () => {
      try {
        const accessToken = await session.ensureAccessToken();
        await api.markMessagesRead(accessToken);
      } catch {
        readMarkInFlight = false;
      }
    })();
  }

  async function enterChat(): Promise<void> {
    if (hasEnteredChat) return;
    hasEnteredChat = true;
    chatWindow.showChat();
    if (options.preview) {
      store.mergeServerMessages(PREVIEW_MESSAGES);
      chatWindow.setConnectionStatus(true);
      return;
    }
    await loadInitialHistory();
    positionInitialHistoryAtBottom();
  }

  function contactCollectionMode(): WidgetSettings['contactCollectionMode'] {
    return (currentSettings ?? DEFAULT_LEAD_SETTINGS).contactCollectionMode;
  }

  function identityCaptureEnabled(): boolean {
    const settings = currentSettings ?? DEFAULT_LEAD_SETTINGS;
    if (settings.contactCollectionMode === 'disabled') return false;
    return settings.askName || settings.askEmail;
  }

  function leadCaptureConfig(): LeadCaptureConfig {
    const settings = currentSettings ?? DEFAULT_LEAD_SETTINGS;
    return {
      askName: settings.askName,
      requireName: settings.requireName,
      askEmail: settings.askEmail,
      requireEmail: settings.requireEmail,
      heading: settings.formHeading,
      description: settings.formDescription,
    };
  }

  function contactPromptConfig(): ContactPromptConfig {
    const settings = currentSettings ?? DEFAULT_LEAD_SETTINGS;
    return {
      askName: settings.askName,
      requireName: settings.requireName,
      askEmail: settings.askEmail,
      requireEmail: settings.requireEmail,
    };
  }

  function canAutoResume(): boolean {
    if (resumeContactStatus === 'no-resume') return false;
    if (contactCollectionMode() !== 'before_chat') return true;
    if (!identityCaptureEnabled()) return true;
    return resumeContactStatus === 'has-contact';
  }

  function shouldSkipLeadCapture(): boolean {
    if (!identityCaptureEnabled()) return true;
    return resumeContactStatus === 'has-contact';
  }

  function ensureResumeContactStatusResolved(): Promise<void> {
    if (resumeContactStatus !== 'unknown') return Promise.resolve();
    if (!resumeStatusPromise)
      resumeStatusPromise = resolveResumeContactStatus();
    return resumeStatusPromise;
  }

  async function resolveResumeContactStatus(): Promise<void> {
    try {
      await session.ensureAccessToken();
      resumeContactStatus = session.getContactId()
        ? 'has-contact'
        : 'no-contact';
    } catch {
      resumeContactStatus = 'no-contact';
    }
    chatWindow.setResumeAvailable(canAutoResume());
  }

  function handleStart(): void {
    if (options.preview) {
      if (
        contactCollectionMode() === 'before_chat' &&
        identityCaptureEnabled()
      ) {
        chatWindow.configureLeadCapture(leadCaptureConfig());
        chatWindow.showLeadCapture();
      } else {
        void enterChat();
      }
      return;
    }
    if (contactCollectionMode() !== 'before_chat') {
      void enterChat();
      return;
    }
    void (async () => {
      await ensureResumeContactStatusResolved();
      if (shouldSkipLeadCapture()) {
        await enterChat();
        return;
      }
      chatWindow.configureLeadCapture(leadCaptureConfig());
      chatWindow.showLeadCapture();
    })();
  }

  function handleLeadSubmit(data: LeadCaptureData): void {
    if (options.preview) {
      void enterChat();
      if (data.message) handleSend({ content: data.message, attachments: [] });
      return;
    }
    void (async () => {
      await enterChat();
      if (data.message) {
        const clientMessageId = crypto.randomUUID();
        store.addPending(clientMessageId, data.message);
        await sendPending(clientMessageId, data.message);
      }
      if (data.name || data.email) {
        try {
          const accessToken = await session.ensureAccessToken();
          const result = await api.identify(accessToken, {
            name: data.name || undefined,
            email: data.email || undefined,
          });
          session.applyIdentifySession(result);
          resumeContactStatus = 'has-contact';
          chatWindow.setResumeAvailable(canAutoResume());
        } catch {}
      }
    })();
  }

  function maybeShowContactPrompt(): void {
    if (contactPromptHandled) return;
    if (contactCollectionMode() !== 'after_first_message') return;
    if (session.getContactId()) return;
    const settings = currentSettings ?? DEFAULT_LEAD_SETTINGS;
    if (!settings.askName && !settings.askEmail) return;
    contactPromptHandled = true;
    chatWindow.configureContactPrompt(contactPromptConfig());
    chatWindow.showContactPrompt();
  }

  function handleContactPromptDismiss(): void {
    chatWindow.hideContactPrompt();
  }

  function handleContactPromptSubmit(data: ContactPromptData): void {
    chatWindow.hideContactPrompt();
    if (!data.name && !data.email) return;
    void (async () => {
      try {
        const accessToken = await session.ensureAccessToken();
        const result = await api.identify(accessToken, {
          name: data.name || undefined,
          email: data.email || undefined,
        });
        session.applyIdentifySession(result);
        resumeContactStatus = 'has-contact';
        chatWindow.setResumeAvailable(canAutoResume());
      } catch {}
    })();
  }

  function currentContextPayload() {
    return buildContextPayload({
      currentUrl: location.href,
      currentPageTitle: document.title,
      initialUrl,
      referrer,
      userAgent: navigator.userAgent,
      timezone,
    });
  }

  async function postContextIfChanged(): Promise<void> {
    if (!currentConversationId) return;
    const payload = currentContextPayload();
    const key = contextDedupeKey(payload);
    if (key === lastPostedContextKey) return;
    lastPostedContextKey = key;
    try {
      const accessToken = await session.ensureAccessToken();
      await api.updateContext(accessToken, payload);
    } catch {}
  }

  function startContextWatch(): void {
    if (contextPollTimer) return;
    contextPollTimer = setInterval(() => {
      void postContextIfChanged();
    }, CONTEXT_POLL_INTERVAL_MS);
  }

  function clearVisitorDraft(): void {
    if (draftUpdateTimer) {
      clearTimeout(draftUpdateTimer);
      draftUpdateTimer = null;
    }
    if (!draftActive) return;
    draftActive = false;
    lastDraftUpdateAt = 0;
    socket.emitDraftClear();
  }

  function renderRemoteTypers(): void {
    chatWindow.setTypingParticipants([...remoteTypers.values()]);
  }

  function removeRemoteTyper(id: string): void {
    remoteTypers.delete(id);
    const timer = remoteTypingTimers.get(id);
    if (timer) clearTimeout(timer);
    remoteTypingTimers.delete(id);
    renderRemoteTypers();
  }

  function handleRemoteTypingStart(event: TypingEvent): void {
    if (currentConversationId && event.conversationId !== currentConversationId)
      return;
    const id = event.actorId ?? event.name ?? 'support';
    remoteTypers.set(id, {
      id,
      name: event.name ?? 'Kodescape Support',
      avatarUrl: event.avatarUrl,
    });
    const previousTimer = remoteTypingTimers.get(id);
    if (previousTimer) clearTimeout(previousTimer);
    remoteTypingTimers.set(
      id,
      setTimeout(() => removeRemoteTyper(id), REMOTE_TYPING_TIMEOUT_MS),
    );
    renderRemoteTypers();
  }

  function handleRemoteTypingStop(event: TypingEvent): void {
    if (event.actorId) removeRemoteTyper(event.actorId);
    else {
      remoteTypers.clear();
      remoteTypingTimers.forEach(clearTimeout);
      remoteTypingTimers.clear();
      renderRemoteTypers();
    }
  }

  function handleComposerInput(value: string): void {
    if (draftUpdateTimer) clearTimeout(draftUpdateTimer);
    if (!value) {
      clearVisitorDraft();
      return;
    }

    const emitDraft = () => {
      draftUpdateTimer = null;
      draftActive = true;
      lastDraftUpdateAt = Date.now();
      socket.emitDraftUpdate(value);
    };
    const remainingDelay =
      DRAFT_UPDATE_DELAY_MS - (Date.now() - lastDraftUpdateAt);
    if (!draftActive || remainingDelay <= 0) {
      emitDraft();
      return;
    }
    draftUpdateTimer = setTimeout(emitDraft, remainingDelay);
  }

  function loadInitialHistory(): Promise<void> {
    if (historyLoaded) return Promise.resolve();
    if (historyLoadPromise) return historyLoadPromise;

    historyLoadPromise = (async () => {
      chatWindow.setLoading(store.getMessages().length === 0);
      try {
        const accessToken = await session.ensureAccessToken();
        const page = await api.getMessages(accessToken, {
          limit: HISTORY_PAGE_LIMIT,
        });
        currentConversationId =
          page.items.find((message) => message.conversationId)
            ?.conversationId ?? currentConversationId;
        historyNextCursor = page.nextCursor;
        store.mergeServerMessages(page.items);
        historyLoaded = true;
      } catch {}
      chatWindow.setLoading(false);

      void postContextIfChanged();
      startContextWatch();
    })().finally(() => {
      historyLoadPromise = null;
    });

    return historyLoadPromise;
  }

  function scheduleHistoryPreload(): void {
    if (historyLoaded || historyLoadPromise || historyPreloadTimer) return;
    historyPreloadTimer = setTimeout(() => {
      historyPreloadTimer = null;
      void loadInitialHistory();
    }, HISTORY_PRELOAD_DELAY_MS);
  }

  function positionInitialHistoryAtBottom(): void {
    if (hasPositionedInitialHistory) return;
    hasPositionedInitialHistory = true;
    const scrollToBottom = () => {
      chatWindow.listEl.scrollTop = chatWindow.listEl.scrollHeight;
    };

    scrollToBottom();
    queueMicrotask(scrollToBottom);
    chatWindow.listEl.querySelectorAll('img').forEach((image) => {
      if (image.complete) return;
      image.addEventListener('load', scrollToBottom, { once: true });
      image.addEventListener('error', scrollToBottom, { once: true });
    });
  }

  function handleMessageListScroll(): void {
    if (chatWindow.listEl.scrollTop > HISTORY_TOP_THRESHOLD_PX) return;
    if (!historyLoaded || !historyNextCursor || olderHistoryLoading) return;
    void loadOlderHistory();
  }

  async function loadOlderHistory(): Promise<void> {
    if (!historyNextCursor || olderHistoryLoading) return;
    olderHistoryLoading = true;
    const cursor = historyNextCursor;
    const previousHeight = chatWindow.listEl.scrollHeight;
    const previousTop = chatWindow.listEl.scrollTop;
    try {
      const accessToken = await session.ensureAccessToken();
      const page = await api.getMessages(accessToken, {
        cursor,
        limit: HISTORY_PAGE_LIMIT,
      });
      historyNextCursor = page.nextCursor;
      store.mergeServerMessages(page.items);
      chatWindow.listEl.scrollTop =
        previousTop + (chatWindow.listEl.scrollHeight - previousHeight);
    } catch {}
    olderHistoryLoading = false;
  }

  function connectVisitorSocket(): void {
    if (socketStarted) return;
    socketStarted = true;
    socket
      .connect({
        onMessageNew: (event) => {
          currentConversationId = event.conversationId;
          if (
            event.message.direction === 'outbound' &&
            (!isOpen || document.visibilityState !== 'visible')
          ) {
            unreadMessageCount += 1;
          }
          store.receiveRealtime(event.message);
          if (
            event.message.direction === 'outbound' &&
            soundNotificationsEnabled
          ) {
            playIncomingSound();
          }
        },
        onMessageFailed: (event) => {
          store.markFailed(event.clientMessageId);
        },
        onConnectionChange: (connected) => {
          store.setConnected(connected);
          if (!connected) handleRemoteTypingStop({ conversationId: '' });
        },
        onReconnectBackfillNeeded: () => void backfillAfterReconnect(),
        onMessageStatus: (event) => store.applyDelivered(event.messageId),
        onMessageRead: (event) => store.applyRead(event.messageIds),
        onMessageReactions: (event) =>
          store.applyReactions(event.messageId, event.reactions),
        onTypingStart: handleRemoteTypingStart,
        onTypingStop: handleRemoteTypingStop,
      })
      .then(scheduleHistoryPreload)
      .catch(() => {
        socketStarted = false;
        store.setConnected(false);
      });
  }

  async function backfillAfterReconnect(): Promise<void> {
    const messages = store.getMessages();
    const lastConfirmed = [...messages].reverse().find((m) => m.id);
    if (!lastConfirmed?.id) return;
    try {
      const accessToken = await session.ensureAccessToken();
      const page = await api.getMessages(accessToken, {
        after: lastConfirmed.id,
      });
      store.mergeServerMessages(page.items);
    } catch {}
  }

  function handleStarter(text: string): void {
    void (async () => {
      await enterChat();
      handleSend({ content: text, attachments: [] });
    })();
  }

  async function handleUpload(file: File): Promise<MessageAttachment> {
    if (options.preview) {
      return {
        id: `preview-attachment-${crypto.randomUUID()}`,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        kind: file.type.startsWith('image/') ? 'image' : 'file',
        url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '#',
      };
    }
    const accessToken = await session.ensureAccessToken();
    return api.uploadAttachment(accessToken, file);
  }

  function handleSend(submission: ComposerSubmission): void {
    clearVisitorDraft();
    const clientMessageId = crypto.randomUUID();
    const replyTarget = submission.replyToMessageId
      ? store
          .getMessages()
          .find((message) => message.id === submission.replyToMessageId)
      : undefined;
    const replyTo = replyTarget?.id
      ? {
          messageId: replyTarget.id,
          senderType:
            replyTarget.direction === 'inbound'
              ? ('visitor' as const)
              : ('human' as const),
          senderName:
            replyTarget.direction === 'inbound'
              ? null
              : (currentSettings?.supportDisplayName ?? 'Support'),
          content: replyTarget.content.slice(0, 280),
        }
      : null;
    store.addPending(
      clientMessageId,
      submission.content,
      submission.attachments,
      replyTo,
    );
    if (options.preview) {
      store.confirmSent(clientMessageId, {
        id: `preview-message-${clientMessageId}`,
        clientMessageId,
        direction: 'inbound',
        senderType: 'visitor',
        senderName: null,
        content: submission.content,
        attachments: submission.attachments,
        status: 'sent',
        replyTo,
        reactions: [],
        createdAt: new Date().toISOString(),
      });
      return;
    }
    void sendPending(
      clientMessageId,
      submission.content,
      submission.attachments,
      submission.replyToMessageId,
    );
  }

  function handleRetry(clientMessageId: string): void {
    const message = store
      .getMessages()
      .find((m) => m.clientMessageId === clientMessageId);
    if (!message) return;
    store.retry(clientMessageId);
    void sendPending(
      clientMessageId,
      message.content,
      message.attachments ?? [],
      message.replyTo?.messageId,
    );
  }

  function handleReply(message: LocalMessage): void {
    if (!message.id) return;
    chatWindow.setReply({
      messageId: message.id,
      senderType: message.direction === 'inbound' ? 'visitor' : 'human',
      senderName:
        message.direction === 'outbound'
          ? (currentSettings?.supportDisplayName ?? 'Support')
          : null,
      content: message.content.slice(0, 280),
    });
  }

  function handleReaction(messageId: string, emoji: string): void {
    if (options.preview) {
      store.togglePreviewReaction(messageId, emoji);
      return;
    }
    void (async () => {
      try {
        const accessToken = await session.ensureAccessToken();
        const message = await api.reactToMessage(accessToken, messageId, emoji);
        store.applyReactions(messageId, message.reactions ?? []);
      } catch {}
    })();
  }

  async function sendPending(
    clientMessageId: string,
    content: string,
    attachments: MessageAttachment[] = [],
    replyToMessageId?: string,
  ): Promise<void> {
    try {
      const serverMessage = await socket.sendMessage(
        clientMessageId,
        content,
        attachments.map((attachment) => attachment.id),
        replyToMessageId,
      );
      currentConversationId =
        serverMessage.conversationId ?? currentConversationId;
      store.confirmSent(clientMessageId, serverMessage);
      if (!hasSentFirstMessage) {
        hasSentFirstMessage = true;
        void postContextIfChanged();
        maybeShowContactPrompt();
      }
    } catch {
      store.markFailed(clientMessageId);
    }
  }

  function applyBranding(settings: WidgetSettings): void {
    const normalized = {
      ...DEFAULT_WIDGET_SETTINGS,
      ...settings,
      backgroundColor: settings.backgroundColor ?? '#ffffff',
      textColor: settings.textColor ?? '#101828',
      deviceSettings: resolveDeviceSettings(settings),
    };
    currentSettings = normalized;
    soundNotificationsEnabled = normalized.incomingMessageSound;
    chatWindow.setNotificationsEnabled(soundNotificationsEnabled);
    chatWindow.configureLeadCapture(leadCaptureConfig());
    chatWindow.setResumeAvailable(canAutoResume());
    host.style.setProperty('--kw-primary-color', normalized.primaryColor);
    host.style.setProperty('--kw-background-color', normalized.backgroundColor);
    host.style.setProperty('--kw-text-color', normalized.textColor);
    host.style.setProperty(
      '--kw-primary-foreground',
      readableForeground(normalized.primaryColor),
    );
    chatWindow.setName(normalized.name);
    chatWindow.setSupportIdentity(
      normalized.supportDisplayName,
      normalized.supportSubtitle,
      normalized.supportAvatarUrl,
    );
    chatWindow.setHomeHeading(normalized.welcomeHeading);
    chatWindow.setWelcomeMessage(normalized.welcomeMessage);
    chatWindow.setStarters(normalized.conversationStarters);
    chatWindow.setComposerPlaceholder(normalized.composerPlaceholder);
    applyDeviceLayout(normalized);
  }

  function applyPreview(message: PreviewConfigMessage): void {
    previewDevice = message.device;
    root.classList.toggle('kw-preview--mobile', message.device === 'mobile');
    applyBranding(message.settings);
    chatWindow.setConnectionStatus(true);
    if (message.state === 'minimized') {
      isOpen = false;
      chatWindow.setVisible(false);
      launcher.setOpen(false);
      return;
    }
    isOpen = true;
    chatWindow.setVisible(true);
    launcher.setOpen(true);
    if (message.state === 'home') {
      chatWindow.showHome();
    } else if (message.state === 'pre-chat') {
      chatWindow.configureLeadCapture(leadCaptureConfig());
      chatWindow.showLeadCapture({ focus: false });
    } else {
      hasEnteredChat = true;
      chatWindow.showChat();
      store.mergeServerMessages(PREVIEW_MESSAGES);
      chatWindow.setSupportIdentity(
        message.settings.supportDisplayName,
        message.settings.supportSubtitle,
        message.settings.supportAvatarUrl,
      );
      chatWindow.setConnectionStatus(true);
    }
  }

  function applyDeviceLayout(settings: WidgetSettings): void {
    const device = options.preview
      ? previewDevice
      : window.matchMedia('(max-width: 480px)').matches
        ? 'mobile'
        : 'desktop';
    const profile = resolveDeviceSettings(settings)[device];
    root.classList.toggle('kw-root--left', profile.position === 'left');
    root.classList.toggle('kw-root--right', profile.position !== 'left');
    host.style.setProperty('--kw-bottom-offset', `${profile.bottomOffset}px`);
    host.style.setProperty('--kw-side-offset', `${profile.sideOffset}px`);
    host.style.setProperty(
      '--kw-launcher-size',
      `${launcherSizePixels(profile.launcherSize)}px`,
    );
    launcher.configure({
      style: profile.launcherStyle,
      label: settings.launcherLabel,
      icon: settings.launcherIcon,
    });
    host.style.display =
      options.preview || (profile.display && shouldShowOnCurrentPage(settings))
        ? ''
        : 'none';
  }

  function shouldShowOnCurrentPage(settings: WidgetSettings): boolean {
    const path = location.pathname;
    const includes = settings.visibilityRules.filter(
      (rule) => rule.action === 'include' && rule.value.trim(),
    );
    const excludes = settings.visibilityRules.filter(
      (rule) => rule.action === 'exclude' && rule.value.trim(),
    );
    if (excludes.some((rule) => pathMatches(path, rule))) return false;
    return (
      includes.length === 0 || includes.some((rule) => pathMatches(path, rule))
    );
  }

  return {
    destroy() {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('message', handlePreviewMessage);
      chatWindow.listEl.removeEventListener('scroll', handleMessageListScroll);
      if (historyPreloadTimer) clearTimeout(historyPreloadTimer);
      if (contextPollTimer) clearInterval(contextPollTimer);
      clearVisitorDraft();
      remoteTypingTimers.forEach(clearTimeout);
      remoteTypingTimers.clear();
      socket.disconnect();
      chatWindow.destroy();
      host.remove();
    },
  };
}

function playIncomingSound(): void {
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(660, context.currentTime);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.13);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.14);
  oscillator.addEventListener('ended', () => void context.close());
}

function resolveDeviceSettings(settings: WidgetSettings): WidgetDeviceSettings {
  if (settings.deviceSettings) return settings.deviceSettings;
  const shared: Omit<DeviceDisplaySettings, 'display'> = {
    position: settings.launcherPosition,
    launcherStyle: settings.launcherStyle,
    bottomOffset: 20,
    sideOffset: 20,
    launcherSize: 'medium',
  };
  return {
    desktop: { ...shared, display: settings.showOnDesktop },
    mobile: { ...shared, display: settings.showOnMobile },
  };
}

function launcherSizePixels(
  size: DeviceDisplaySettings['launcherSize'],
): number {
  if (size === 'small') return 46;
  if (size === 'large') return 62;
  return 54;
}

function readableForeground(hex: string): '#ffffff' | '#101828' {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return '#ffffff';
  const [red, green, blue] = [0, 2, 4].map((index) =>
    Number.parseInt(normalized.slice(index, index + 2), 16),
  );
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.56 ? '#101828' : '#ffffff';
}

function pathMatches(
  path: string,
  rule: WidgetSettings['visibilityRules'][number],
): boolean {
  const value = rule.value.trim();
  if (rule.match === 'exact') return path === value;
  if (rule.match === 'prefix') return path.startsWith(value);
  return path.includes(value);
}

export type { LocalMessage };

declare global {
  interface Window {
    KodescapeChatWidget?: { mount: typeof mount; bootstrap: typeof bootstrap };
  }
}

export function bootstrap(
  script: HTMLScriptElement | null = findWidgetScript(),
): MountedWidget | null {
  const siteId = script?.dataset.siteId?.trim();
  if (!script || !siteId || script.dataset.kodescapeMounted === 'true') {
    return null;
  }

  script.dataset.kodescapeMounted = 'true';
  try {
    return mount({ siteId });
  } catch (error) {
    delete script.dataset.kodescapeMounted;
    throw error;
  }
}

if (typeof document !== 'undefined') {
  window.KodescapeChatWidget = { mount, bootstrap };
  bootstrap();
}
