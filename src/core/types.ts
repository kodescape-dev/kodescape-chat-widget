export interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
}

export interface ChatSession {
  resumeToken: string;
  accessToken: string;
  visitorId: string;
  expiresAt: string;
  contactId: string | null;
}

export type ContactCollectionMode =
  'before_chat' | 'after_first_message' | 'disabled';

export type LauncherSize = 'small' | 'medium' | 'large';

export interface DeviceDisplaySettings {
  display: boolean;
  position: 'left' | 'right';
  launcherStyle: 'icon' | 'label_icon';
  bottomOffset: number;
  sideOffset: number;
  launcherSize: LauncherSize;
}

export interface WidgetDeviceSettings {
  desktop: DeviceDisplaySettings;
  mobile: DeviceDisplaySettings;
}

export interface WidgetSettings {
  availability?: {
    scheduleEnabled: boolean;
    isOpen: boolean;
    serverTime?: string;
    refreshAfterMs?: number;
  };
  name: string;
  supportDisplayName: string;
  supportSubtitle: string;
  onlineStatus?: string;
  offlineStatus?: string;
  supportAvatarUrl: string | null;
  incomingMessageSound: boolean;
  homeBackgroundEnabled?: boolean;
  homeBackgroundPreset?:
    'waves' | 'mountains' | 'dunes' | 'forest' | 'aurora' | 'sunset';
  homeBackgroundUrl?: string | null;
  primaryColor: string;
  backgroundColor?: string;
  textColor?: string;
  launcherPosition: 'left' | 'right';
  welcomeMessage: string;
  welcomeHeading: string;
  conversationStarters: string[];
  composerPlaceholder: string;
  launcherStyle: 'icon' | 'label_icon';
  launcherLabel: string;
  launcherIcon: 'chat' | 'message';
  askName: boolean;
  requireName: boolean;
  askEmail: boolean;
  requireEmail: boolean;
  formHeading: string;
  formDescription: string;
  contactCollectionMode: ContactCollectionMode;
  showOnDesktop: boolean;
  showOnMobile: boolean;
  deviceSettings?: WidgetDeviceSettings;
  channels?: WidgetChannels | null;
  visibilityRules: Array<{
    action: 'include' | 'exclude';
    match: 'exact' | 'contains' | 'prefix';
    value: string;
  }>;
}

export interface MessageAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'file';
  url: string;
}

export interface IdentifyResult {
  name: string | null;
  email: string | null;
  contactId: string;
  resumeToken: string;
  accessToken: string;
  expiresAt: string;
}

export type MessageDirection = 'inbound' | 'outbound';
export type MessageSenderType = 'visitor' | 'human';

export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface ServerMessage {
  id: string;
  conversationId?: string;
  clientMessageId: string;
  direction: MessageDirection;
  senderType: MessageSenderType;
  senderName: string | null;
  content: string;
  attachments?: MessageAttachment[];
  replyTo?: MessageReply | null;
  reactions?: MessageReaction[];
  createdAt: string;
  status: MessageStatus;
}

export type MessageSendAck =
  | { ok: true; message: ServerMessage }
  | { ok: false; code: string; message: string };

export interface MessageReply {
  messageId: string;
  senderType: MessageSenderType;
  senderName: string | null;
  content: string;
}

export interface MessageReaction {
  emoji: string;
  actorType: MessageSenderType;
  actorName: string | null;
  createdAt: string;
}

export interface ConversationSummary {
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
  status: 'open' | 'closed';
}

export interface MessageNewEvent {
  conversationId: string;
  message: ServerMessage;
  conversationSummary: ConversationSummary;
}

export interface MessagesPage {
  items: ServerMessage[];
  nextCursor: string | null;
}

export interface MessageStatusEvent {
  conversationId: string;
  messageId: string;
  status: 'delivered';
}

export interface MessageFailedEvent {
  conversationId: string;
  messageId: string;
  clientMessageId: string;
  reason?: string;
}

export interface MessageReadEvent {
  conversationId: string;
  messageIds: string[];
  readAt: string;
}

export interface MessageReactionsEvent {
  conversationId: string;
  messageId: string;
  reactions: MessageReaction[];
}

export interface TypingEvent {
  conversationId: string;
  actorType?: 'visitor' | 'human';
  actorId?: string;
  name?: string;
  avatarUrl?: string | null;
}

export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export interface ContextPayload {
  currentUrl?: string;
  currentPageTitle?: string;
  initialUrl?: string;
  referrer?: string;
  browser?: string;
  os?: string;
  deviceType?: DeviceType;
  timezone?: string;
}

export interface BookingServiceOption {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
}

export interface EmbeddedBookingChannel {
  mode: 'embedded';
  label: string;
  heading: string;
  description: string;
  confirmationText: string;
  timeZone: string;
  services: BookingServiceOption[];
  requireAddress: boolean;
  requireEmail: boolean;
  requirePhone: boolean;
}

export interface WidgetChannels {
  booking:
    | { mode: 'external'; label: string; url: string }
    | EmbeddedBookingChannel
    | null;
  text: { label: string; phone: string; message: string } | null;
  call: { label: string; phone: string } | null;
  email: { label: string; address: string; subject: string } | null;
}

export interface BookingAvailability {
  timeZone: string;
  durationMinutes: number;
  lastDate: string;
  days: Array<{
    date: string;
    slots: Array<{ startAt: string; available: boolean }>;
  }>;
}

export interface BookingAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  notes?: string;
}

export interface AppointmentRequest {
  clientRequestId: string;
  serviceId: string;
  startAt: string;
  customer: {
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    smsConsent: boolean;
  };
  address?: BookingAddress;
}

export interface AppointmentResult {
  reference: string;
  serviceName: string;
  durationMinutes: number;
  startAt: string;
  timeZone: string;
  address: BookingAddress | null;
  confirmationText: string;
}

export interface BookingProvider {
  getAvailability(
    serviceId: string,
    from?: string,
  ): Promise<BookingAvailability>;
  createAppointment(request: AppointmentRequest): Promise<AppointmentResult>;
}
