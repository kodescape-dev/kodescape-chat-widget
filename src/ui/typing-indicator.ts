import { createBrandMark, setBrandMarkImage } from './branding';

export interface TypingIndicatorHandle {
  el: HTMLElement;
  setSupportAvatar(avatarUrl: string | null): void;
  setParticipants(
    participants: Array<{
      id: string;
      name: string;
      avatarUrl?: string | null;
    }>,
  ): void;
}

export function createTypingIndicator(): TypingIndicatorHandle {
  const el = document.createElement('div');
  el.className = 'kw-typing';
  el.hidden = true;
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('role', 'status');

  const supportAvatar = createBrandMark('kw-typing-avatar');

  const dots = document.createElement('span');
  dots.className = 'kw-typing-dots';
  for (let i = 0; i < 3; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'kw-typing-dot';
    dots.appendChild(dot);
  }

  el.append(supportAvatar, dots);

  return {
    el,
    setSupportAvatar(avatarUrl) {
      setBrandMarkImage(supportAvatar, avatarUrl);
    },
    setParticipants(participants) {
      el.hidden = participants.length === 0;
      el.setAttribute('aria-hidden', participants.length ? 'false' : 'true');
      el.setAttribute(
        'aria-label',
        participants.length
          ? `${participants.map((participant) => participant.name).join(', ')} typing`
          : '',
      );
      supportAvatar.title = participants.length
        ? `${participants.map((participant) => participant.name).join(', ')} typing`
        : '';
    },
  };
}
