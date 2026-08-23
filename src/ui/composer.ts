import type { MessageAttachment } from '../core/types';
import { createEmojiPicker } from './emoji-picker';

export interface ComposerSubmission {
  content: string;
  attachments: MessageAttachment[];
}

export interface ComposerHandle {
  el: HTMLFormElement;
  focus(): void;
  setDisabled(disabled: boolean): void;
  setPlaceholder(placeholder: string): void;
  destroy(): void;
}

type SelectedFile = {
  id: string;
  file: File;
  status: 'uploading' | 'ready' | 'failed';
  attachment?: MessageAttachment;
  previewUrl?: string;
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;
const SEND_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ATTACH_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21.4 11.6l-8.9 8.9a6 6 0 01-8.5-8.5l9.6-9.6a4 4 0 015.7 5.7l-9.7 9.6a2 2 0 01-2.8-2.8l8.9-8.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SMILE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 14.5a4.5 4.5 0 007 0M9 9.5h.01M15 9.5h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

export function createComposer(handlers: {
  onSend: (submission: ComposerSubmission) => void;
  onInput?: (value: string) => void;
  onUpload: (file: File) => Promise<MessageAttachment>;
}): ComposerHandle {
  const form = document.createElement('form');
  form.className = 'kw-composer';
  form.setAttribute('aria-label', 'Send a message');
  let files: SelectedFile[] = [];

  const selected = document.createElement('div');
  selected.className = 'kw-composer-files';
  selected.hidden = true;

  const row = document.createElement('div');
  row.className = 'kw-composer-row';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.hidden = true;
  fileInput.accept =
    'image/jpeg,image/png,image/webp,image/gif,application/pdf,.docx,.xlsx,.txt,.csv';

  const attachButton = iconButton('Attach image or file', ATTACH_ICON);
  attachButton.addEventListener('click', () => fileInput.click());

  const inputWrap = document.createElement('div');
  inputWrap.className = 'kw-composer-input-wrap';
  const textarea = document.createElement('textarea');
  textarea.className = 'kw-composer-input';
  textarea.rows = 1;
  textarea.placeholder = 'Write your message…';
  textarea.setAttribute('aria-label', 'Message');
  textarea.maxLength = 4000;
  inputWrap.appendChild(textarea);

  const emojiButton = iconButton('Insert emoji', SMILE_ICON);
  emojiButton.setAttribute('aria-expanded', 'false');
  const emojiPicker = createEmojiPicker((emoji) => {
    insertAtCursor(textarea, emoji);
    setPickerOpen(false);
    handlers.onInput?.(textarea.value);
  });
  const picker = emojiPicker.el;
  emojiButton.addEventListener('click', () =>
    setPickerOpen(!emojiPicker.isOpen()),
  );

  const sendButton = document.createElement('button');
  sendButton.type = 'submit';
  sendButton.className = 'kw-composer-send';
  sendButton.setAttribute('aria-label', 'Send message');
  sendButton.innerHTML = SEND_ICON;

  row.append(attachButton, emojiButton, inputWrap, sendButton);
  form.append(fileInput, selected, picker, row);

  function setPickerOpen(open: boolean): void {
    if (open) emojiPicker.open();
    else emojiPicker.close();
    emojiButton.setAttribute('aria-expanded', String(open));
  }

  function submit(): void {
    const content = textarea.value.trim();
    const attachments = files
      .filter(
        (item): item is SelectedFile & { attachment: MessageAttachment } =>
          item.status === 'ready' && Boolean(item.attachment),
      )
      .map((item) => item.attachment);
    if (
      (!content && attachments.length === 0) ||
      files.some((item) => item.status !== 'ready')
    )
      return;
    handlers.onSend({ content, attachments });
    textarea.value = '';
    for (const item of files)
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    files = [];
    renderFiles();
  }

  function addFiles(next: File[]): void {
    const available = MAX_FILES - files.length;
    for (const file of next.slice(0, available)) {
      if (file.size > MAX_FILE_BYTES) continue;
      const item: SelectedFile = {
        id: crypto.randomUUID(),
        file,
        status: 'uploading',
        previewUrl: file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : undefined,
      };
      files.push(item);
      renderFiles();
      void upload(item);
    }
  }

  async function upload(item: SelectedFile): Promise<void> {
    item.status = 'uploading';
    renderFiles();
    try {
      item.attachment = await handlers.onUpload(item.file);
      item.status = 'ready';
    } catch {
      item.status = 'failed';
    }
    renderFiles();
  }

  function renderFiles(): void {
    selected.textContent = '';
    selected.hidden = files.length === 0;
    for (const item of files) {
      const chip = document.createElement('div');
      chip.className = `kw-file-chip kw-file-chip--${item.status}`;
      if (item.previewUrl) {
        const image = document.createElement('img');
        image.src = item.previewUrl;
        image.alt = '';
        chip.appendChild(image);
      }
      const copy = document.createElement('span');
      copy.innerHTML = `<strong></strong><small></small>`;
      copy.querySelector('strong')!.textContent = item.file.name;
      copy.querySelector('small')!.textContent =
        item.status === 'uploading'
          ? 'Uploading…'
          : item.status === 'failed'
            ? 'Upload failed'
            : formatSize(item.file.size);
      chip.appendChild(copy);
      if (item.status === 'failed') {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Retry';
        retry.addEventListener('click', () => void upload(item));
        chip.appendChild(retry);
      }
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'kw-file-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${item.file.name}`);
      remove.addEventListener('click', () => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        files = files.filter((entry) => entry.id !== item.id);
        renderFiles();
      });
      chip.appendChild(remove);
      selected.appendChild(chip);
    }
    const blocked = files.some((item) => item.status !== 'ready');
    sendButton.disabled = blocked;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit();
  });
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      submit();
    }
  });
  textarea.addEventListener('input', () => handlers.onInput?.(textarea.value));
  textarea.addEventListener('blur', () => handlers.onInput?.(''));
  textarea.addEventListener('paste', (event) => {
    const images = Array.from(event.clipboardData?.files ?? []).filter((file) =>
      file.type.startsWith('image/'),
    );
    if (images.length) {
      event.preventDefault();
      addFiles(images);
    }
  });
  fileInput.addEventListener('change', () => {
    addFiles(Array.from(fileInput.files ?? []));
    fileInput.value = '';
  });
  form.addEventListener('dragover', (event) => event.preventDefault());
  form.addEventListener('drop', (event) => {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer?.files ?? []));
  });
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && emojiPicker.isOpen()) {
      event.stopPropagation();
      setPickerOpen(false);
      emojiButton.focus();
    }
  });
  const closePicker = (event: PointerEvent) => {
    if (!event.composedPath().includes(form)) setPickerOpen(false);
  };
  document.addEventListener('pointerdown', closePicker);

  return {
    el: form,
    focus: () => textarea.focus(),
    setDisabled(disabled) {
      textarea.disabled = disabled;
      sendButton.disabled = disabled;
      attachButton.disabled = disabled;
      emojiButton.disabled = disabled;
    },
    setPlaceholder(placeholder) {
      textarea.placeholder = placeholder || 'Write your message…';
    },
    destroy() {
      document.removeEventListener('pointerdown', closePicker);
      for (const item of files)
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    },
  };
}

function iconButton(label: string, icon: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'kw-composer-action';
  button.setAttribute('aria-label', label);
  button.innerHTML = icon;
  return button;
}

function insertAtCursor(textarea: HTMLTextAreaElement, text: string): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
  textarea.focus();
  textarea.setSelectionRange(start + text.length, start + text.length);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
