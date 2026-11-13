const STAR_ICON =
  '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.6l2.3 4.7 5.2.8-3.8 3.7.9 5.2L10 14.5 5.4 17l.9-5.2L2.5 8.1l5.2-.8L10 2.6z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';
const RATING_LABELS = ['Very bad', 'Bad', 'Okay', 'Good', 'Great'];

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

  const title = document.createElement('strong');
  title.className = 'kw-rating-title';
  title.textContent = 'How was your chat?';

  const stars = document.createElement('div');
  stars.className = 'kw-rating-stars';
  stars.setAttribute('role', 'radiogroup');
  stars.setAttribute('aria-label', 'Rating');

  const comment = document.createElement('textarea');
  comment.className = 'kw-rating-comment';
  comment.rows = 2;
  comment.maxLength = 1000;
  comment.placeholder = 'Anything you would like to add? (optional)';
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

  let rating = 0;
  const buttons: HTMLButtonElement[] = [];
  const paint = () => {
    buttons.forEach((button, index) => {
      const selected = index < rating;
      button.classList.toggle('kw-rating-star--on', selected);
      button.setAttribute('aria-checked', String(index + 1 === rating));
    });
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
    button.addEventListener('click', () => {
      rating = value;
      paint();
      comment.hidden = false;
      submit.hidden = false;
    });
    buttons.push(button);
    stars.appendChild(button);
  }
  paint();

  submit.addEventListener('click', () => {
    if (!rating) return;
    submit.disabled = true;
    status.hidden = true;
    options
      .onSubmit(rating, comment.value.trim())
      .then(() => {
        title.textContent = 'Thanks for your feedback';
        stars.hidden = true;
        comment.hidden = true;
        submit.hidden = true;
      })
      .catch(() => {
        submit.disabled = false;
        status.textContent = 'That did not send. Please try again.';
        status.hidden = false;
      });
  });

  el.append(title, stars, comment, submit, status);
  return { el };
}
