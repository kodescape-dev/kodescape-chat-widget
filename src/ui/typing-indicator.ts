import kiroFaceUrl from '../assets/kiro-face.webp';
import { createBrandMark, setBrandMarkImage } from './branding';

// The AI agent's entry in the typing list. It gets a "is typing" line instead of dots.
export const AI_TYPER_ID = 'ai-agent';

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

  const aiAvatar = document.createElement('span');
  aiAvatar.className = 'kw-typing-avatar kw-typing-avatar--ai';
  aiAvatar.hidden = true;
  const label = document.createElement('span');
  label.className = 'kw-typing-label';
  label.hidden = true;

  el.append(supportAvatar, aiAvatar, dots, label);

  return {
    el,
    setSupportAvatar(avatarUrl) {
      setBrandMarkImage(supportAvatar, avatarUrl);
    },
    setParticipants(participants) {
      const ai = participants.find(
        (participant) => participant.id === AI_TYPER_ID,
      );
      el.classList.toggle('kw-typing--ai', Boolean(ai));
      supportAvatar.hidden = Boolean(ai);
      dots.hidden = Boolean(ai);
      aiAvatar.hidden = !ai;
      label.hidden = !ai;
      if (ai) {
        label.textContent = `${ai.name} is typing…`;
        aiAvatar.style.backgroundImage = `url("${(ai.avatarUrl || kiroFaceUrl).replaceAll('"', '%22')}")`;
        aiAvatar.classList.toggle(
          'kw-typing-avatar--photo',
          Boolean(ai.avatarUrl),
        );
      }
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
