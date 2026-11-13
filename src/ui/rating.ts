const STAR_ICON =
  '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.6l2.3 4.7 5.2.8-3.8 3.7.9 5.2L10 14.5 5.4 17l.9-5.2L2.5 8.1l5.2-.8L10 2.6z" stroke-width="1.4" stroke-linejoin="round"/></svg>';
const CHECK_ICON =
  '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const RATING_LABELS = ['Very bad', 'Bad', 'Okay', 'Good', 'Great'];
const DEFAULT_HINT = 'Your feedback helps us improve.';

export interface RatingCardHandle {
  el: HTMLElement;
}

export function createRatingCard(options: {
  onSubmit: (rating: number, comment: string) => Promise<void>;
}): RatingCardHandle {
  const el = document.createElement('div');
  el.className = 'kw-rating';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', 'Rate this chat');

  const form = document.createElement('div');
  form.className = 'kw-rating-form';

  const title = document.createElement('strong');
  title.className = 'kw-rating-title';
  title.textContent = 'How was your chat?';

  const hint = document.createElement('p');
  hint.className = 'kw-rating-hint';
  hint.setAttribute('aria-live', 'polite');

  const stars = document.createElement('div');
  stars.className = 'kw-rating-stars';
  stars.setAttribute('role', 'radiogroup');
  stars.setAttribute('aria-label', 'Rating');

  const comment = document.createElement('textarea');
  comment.className = 'kw-rating-comment';
  comment.rows = 3;
  comment.maxLength = 1000;
  comment.placeholder = 'Anything you would like to add? (optional)';
  comment.setAttribute('aria-label', 'Comment');
  comment.hidden = true;

  const submit = document.createElement('button');
  submit.type = 'button';
  submit.className = 'kw-rating-submit';
  submit.textContent = 'Send feedback';
  submit.hidden = true;

  const status = document.createElement('p');
  status.className = 'kw-rating-status';
  status.setAttribute('role', 'status');
  status.hidden = true;

  const done = document.createElement('div');
  done.className = 'kw-rating-done';
  done.tabIndex = -1;
  done.hidden = true;
  const doneIcon = document.createElement('span');
  doneIcon.className = 'kw-rating-done-icon';
  doneIcon.innerHTML = CHECK_ICON;
  const doneTitle = document.createElement('strong');
  doneTitle.className = 'kw-rating-title';
  doneTitle.textContent = 'Thanks for your feedback';
  const doneText = document.createElement('p');
  doneText.className = 'kw-rating-hint';
  doneText.textContent = 'It helps us make our support better.';
  done.append(doneIcon, doneTitle, doneText);

  let rating = 0;
  let preview = 0;
  const buttons: HTMLButtonElement[] = [];
  const paint = () => {
    const shown = preview || rating;
    buttons.forEach((button, index) => {
      button.classList.toggle('kw-rating-star--on', index < shown);
      button.setAttribute('aria-checked', String(index + 1 === rating));
    });
    hint.textContent = shown ? RATING_LABELS[shown - 1] : DEFAULT_HINT;
  };
  for (let value = 1; value <= 5; value += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kw-rating-star';
    button.setAttribute('role', 'radio');
    button.setAttribute(
      'aria-label',
      `${value} of 5, ${RATING_LABELS[value - 1]}`,
    );
    button.innerHTML = STAR_ICON;
    button.addEventListener('mouseenter', () => {
      preview = value;
      paint();
    });
    button.addEventListener('click', () => {
      rating = value;
      preview = 0;
      paint();
      comment.hidden = false;
      submit.hidden = false;
    });
    buttons.push(button);
    stars.appendChild(button);
  }
  stars.addEventListener('mouseleave', () => {
    preview = 0;
    paint();
  });
  paint();

  submit.addEventListener('click', () => {
    if (!rating) return;
    submit.disabled = true;
    status.hidden = true;
    options
      .onSubmit(rating, comment.value.trim())
      .then(() => {
        form.hidden = true;
        done.hidden = false;
        done.focus({ preventScroll: true });
      })
      .catch(() => {
        submit.disabled = false;
        status.textContent = 'That did not send. Please try again.';
        status.hidden = false;
      });
  });

  form.append(title, hint, stars, comment, submit, status);
  el.append(form, done);
  return { el };
}
