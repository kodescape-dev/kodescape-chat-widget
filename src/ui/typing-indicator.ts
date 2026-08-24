export interface TypingIndicatorHandle {
  el: HTMLElement;
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

  const avatars = document.createElement('span');
  avatars.className = 'kw-typing-avatars';

  const dots = document.createElement('span');
  dots.className = 'kw-typing-dots';
  for (let i = 0; i < 3; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'kw-typing-dot';
    dots.appendChild(dot);
  }

  el.append(avatars, dots);

  return {
    el,
    setParticipants(participants) {
      el.hidden = participants.length === 0;
      el.setAttribute('aria-hidden', participants.length ? 'false' : 'true');
      el.setAttribute(
        'aria-label',
        participants.length
          ? `${participants.map((participant) => participant.name).join(', ')} typing`
          : '',
      );
      avatars.replaceChildren(
        ...participants.slice(0, 3).map((participant) => {
          const avatar = document.createElement('span');
          avatar.className = 'kw-typing-avatar';
          avatar.title = `${participant.name} is typing`;
          avatar.textContent =
            participant.name.trim().charAt(0).toUpperCase() || 'A';
          if (participant.avatarUrl) {
            avatar.style.backgroundImage = `url("${participant.avatarUrl.replaceAll('"', '%22')}")`;
            avatar.classList.add('kw-typing-avatar--image');
          }
          return avatar;
        }),
      );
    },
  };
}
