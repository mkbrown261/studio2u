import type { Booking } from '../types'

export function ReviewFormPage({ booking, error }: { booking: Booking; error?: string }) {
  return (
    <div class="max-w-lg mx-auto px-5 py-16">
      <div class="text-center mb-8">
        <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">Booking #{booking.id}</p>
        <h1 class="font-display text-3xl font-bold">Leave a Review</h1>
        <p class="text-muted mt-3">How was your session on {booking.session_date}?</p>
      </div>

      {error && <div class="bg-wine/20 border border-wine/40 text-wine-light text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

      <form
        method="POST"
        action={`/review/${booking.id}`}
        class="bg-surface border border-gold/10 rounded-2xl p-7 space-y-6"
      >
        <input type="hidden" name="email" value={booking.customer_email} />

        <div class="text-center">
          <label class="block text-sm font-medium text-muted mb-4">Your Rating</label>
          <div id="mic-rating-picker" class="flex items-center justify-center gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" data-value={n} class="mic-star w-10 h-10 transition transform hover:scale-110">
                <img src="/static/images/mic-rating-empty.png" class="w-full h-full" alt={`${n} mic`} />
              </button>
            ))}
          </div>
          <input type="hidden" name="mic_rating" id="mic-rating-value" value="0" required />
        </div>

        <div>
          <label class="block text-sm font-medium text-muted mb-2">Comment (optional)</label>
          <textarea
            name="comment"
            rows="4"
            placeholder="How was the session, the sound quality, the vibe?"
            class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold"
          ></textarea>
        </div>

        <button type="submit" class="w-full bg-gold hover:bg-gold-light text-ink font-semibold py-3.5 rounded-full transition">
          Submit Review
        </button>
      </form>

      <script
        dangerouslySetInnerHTML={{
          __html: `
          (function() {
            var buttons = document.querySelectorAll('.mic-star');
            var hiddenInput = document.getElementById('mic-rating-value');
            function paint(value) {
              buttons.forEach(function(btn) {
                var v = parseInt(btn.getAttribute('data-value'), 10);
                var img = btn.querySelector('img');
                img.src = v <= value ? '/static/images/mic-rating.png' : '/static/images/mic-rating-empty.png';
              });
            }
            buttons.forEach(function(btn) {
              btn.addEventListener('click', function() {
                var v = parseInt(btn.getAttribute('data-value'), 10);
                hiddenInput.value = v;
                paint(v);
              });
              btn.addEventListener('mouseenter', function() {
                paint(parseInt(btn.getAttribute('data-value'), 10));
              });
            });
            document.getElementById('mic-rating-picker').addEventListener('mouseleave', function() {
              paint(parseInt(hiddenInput.value, 10) || 0);
            });
          })();
        `
        }}
      ></script>
    </div>
  )
}
