import type { EngineerProfile } from '../lib/db-engineers'

export function BookPage({ engineer }: { engineer: EngineerProfile }) {
  return (
    <div class="max-w-2xl mx-auto px-5 py-16">
      <a href={`/engineers/${engineer.id}`} class="text-sm text-muted hover:text-gold transition inline-block mb-6">
        <i class="fa-solid fa-arrow-left mr-1"></i> Back to {engineer.display_name}'s profile
      </a>
      <div class="text-center mb-10">
        <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">Book a Session</p>
        <h1 class="font-display text-3xl md:text-4xl font-bold">Book with {engineer.display_name}</h1>
        <p class="text-muted mt-3">
          ${engineer.hourly_rate}/hr
          {engineer.first_time_discount_amount != null && (
            <> · First session ${engineer.first_time_discount_amount} flat (up to {engineer.first_time_discount_hours} hrs)</>
          )}
        </p>
      </div>

      <div id="booking-app" class="bg-surface border border-gold/10 rounded-2xl p-6 md:p-8" data-engineer-id={engineer.id}></div>

      <script src="/static/book.js"></script>
    </div>
  )
}
