export function BecomeEngineerPage() {
  return (
    <div class="max-w-lg mx-auto px-5 py-16 text-center">
      <div class="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center text-gold text-2xl mx-auto mb-5">
        <i class="fa-solid fa-microphone-lines"></i>
      </div>
      <h1 class="font-display text-2xl font-bold mb-3">Become an Engineer</h1>
      <p class="text-muted mb-8">
        Join the Studio2You network. Set your own rate, build your portfolio, and start getting booked for mobile recording sessions.
      </p>
      <form method="POST" action="/dashboard/become-engineer">
        <button type="submit" class="bg-gold hover:bg-gold-light text-ink font-semibold px-7 py-3.5 rounded-full transition">
          Enable Engineer Account <i class="fa-solid fa-arrow-right ml-1"></i>
        </button>
      </form>
    </div>
  )
}
