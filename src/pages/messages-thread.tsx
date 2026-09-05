import type { Booking } from '../types'
import type { Message } from '../lib/db-messages'

// Shared thread UI for both sides of a booking's conversation. `backHref` and
// `postAction` differ between the engineer dashboard route and the customer /status
// route, everything else (bubble layout, empty state) is identical.
export function MessagesThreadPage({
  booking,
  messages,
  viewer,
  backHref,
  postAction
}: {
  booking: Booking
  messages: Message[]
  viewer: 'engineer' | 'customer'
  backHref: string
  postAction: string
}) {
  const otherPartyName = viewer === 'engineer' ? booking.customer_name : 'your engineer'

  return (
    <div class="max-w-2xl mx-auto px-5 py-12">
      <div class="mb-6">
        <a href={backHref} class="text-sm text-muted hover:text-gold transition">
          <i class="fa-solid fa-arrow-left mr-1"></i> Back
        </a>
        <h1 class="font-display text-2xl font-bold mt-4">Messages with {otherPartyName}</h1>
        <p class="text-muted text-sm mt-1">
          Booking #{booking.id} · {booking.session_date} @ {booking.session_time}
        </p>
      </div>

      <div class="bg-surface border border-gold/10 rounded-2xl p-5 mb-5 max-h-[60vh] overflow-y-auto flex flex-col gap-3">
        {messages.length === 0 ? (
          <div class="text-center text-muted text-sm py-10">
            <i class="fa-solid fa-message text-2xl mb-3 block"></i>
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_type === viewer
            return (
              <div class={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  class={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    mine ? 'bg-gold text-ink' : 'bg-ink/60 text-cream border border-gold/10'
                  }`}
                >
                  <div class="whitespace-pre-wrap break-words">{m.body}</div>
                  <div class={`text-[10px] mt-1 ${mine ? 'text-ink/60' : 'text-muted'}`}>
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <form method="POST" action={postAction} class="flex gap-2">
        <textarea
          name="body"
          required
          rows={2}
          placeholder="Type a message…"
          class="flex-1 bg-surface border border-gold/20 rounded-xl px-4 py-3 text-cream text-sm focus:outline-none focus:border-gold resize-none"
        ></textarea>
        <button
          type="submit"
          class="bg-gold hover:bg-gold-light text-ink font-semibold px-5 rounded-xl transition shrink-0"
        >
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </form>
    </div>
  )
}
