import { describe, expect, it, vi } from 'vitest';
import { createRatingCard } from '../../src/ui/rating';

function setup(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const { el } = createRatingCard({ onSubmit });
  document.body.appendChild(el);
  const stars = Array.from(
    el.querySelectorAll<HTMLButtonElement>('.kw-rating-star'),
  );
  return {
    el,
    stars,
    onSubmit,
    label: el.querySelector<HTMLElement>('.kw-rating-hint')!,
    comment: el.querySelector<HTMLTextAreaElement>('.kw-rating-comment')!,
    submit: el.querySelector<HTMLButtonElement>('.kw-rating-submit')!,
    form: el.querySelector<HTMLElement>('.kw-rating-form')!,
    done: el.querySelector<HTMLElement>('.kw-rating-done')!,
  };
}

describe('createRatingCard()', () => {
  it('names the star under the pointer and clears it on leave', () => {
    const { stars, label } = setup();

    stars[3].dispatchEvent(new MouseEvent('mouseenter'));

    expect(label.textContent).toBe('Good');
    expect(
      stars.filter((star) => star.classList.contains('kw-rating-star--on')),
    ).toHaveLength(4);

    stars[3].parentElement!.dispatchEvent(new MouseEvent('mouseleave'));

    expect(label.textContent).toBe('Your feedback helps us improve.');
  });

  it('keeps the chosen rating and reveals the comment box and send button', () => {
    const { stars, label, comment, submit } = setup();
    expect(comment.hidden).toBe(true);
    expect(submit.hidden).toBe(true);

    stars[4].click();

    expect(label.textContent).toBe('Great');
    expect(stars[4].getAttribute('aria-checked')).toBe('true');
    expect(comment.hidden).toBe(false);
    expect(submit.hidden).toBe(false);
  });

  it('sends the rating and comment, then shows the thank-you note', async () => {
    const { stars, comment, submit, form, done, onSubmit } = setup();
    stars[2].click();
    comment.value = '  Quick answer  ';

    submit.click();
    await vi.waitFor(() => expect(done.hidden).toBe(false));

    expect(onSubmit).toHaveBeenCalledWith(3, 'Quick answer');
    expect(form.hidden).toBe(true);
    expect(done.textContent).toContain('Thanks for your feedback');
  });

  it('lets the visitor try again when sending fails', async () => {
    const { stars, submit, el, form } = setup(
      vi.fn().mockRejectedValue(new Error('offline')),
    );
    stars[0].click();

    submit.click();
    const status = el.querySelector<HTMLElement>('.kw-rating-status')!;
    await vi.waitFor(() => expect(status.hidden).toBe(false));

    expect(status.textContent).toBe('That did not send. Please try again.');
    expect(submit.disabled).toBe(false);
    expect(form.hidden).toBe(false);
  });
});
