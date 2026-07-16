export function BookPage() {
  return (
    <div class="max-w-2xl mx-auto px-5 py-16">
      <div class="text-center mb-10">
        <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">Book a Session</p>
        <h1 class="font-display text-3xl md:text-4xl font-bold">Let's get you booked</h1>
        <p class="text-muted mt-3">Fill this out and we'll send you deposit instructions right after.</p>
      </div>

      <div id="booking-app" class="bg-surface border border-gold/10 rounded-2xl p-6 md:p-8"></div>

      <script src="/static/book.js"></script>
    </div>
  )
}
