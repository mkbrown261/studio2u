import type { Engineer, Service } from '../types'

export function HomePage({ engineer, services }: { engineer: Engineer | null; services: Service[] }) {
  return (
    <div>
      {/* HERO */}
      <section class="relative overflow-hidden">
        <div class="absolute inset-0">
          <img src="/static/images/hero.jpg" alt="Mobile recording session" class="w-full h-full object-cover" />
          <div class="absolute inset-0 bg-gradient-to-t from-ink via-ink/85 to-ink/40"></div>
          <div class="absolute inset-0 bg-gradient-to-r from-ink/60 via-transparent to-transparent"></div>
        </div>
        <div class="relative max-w-6xl mx-auto px-5 pt-20 pb-28 md:pt-32 md:pb-40">
          <p class="inline-flex items-center gap-2 text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-6 border border-gold/30 rounded-full px-4 py-2 bg-gold/5">
            <i class="fa-solid fa-bolt"></i> Book a recording engineer tonight
          </p>
          <h1 class="font-display text-4xl sm:text-6xl md:text-7xl font-bold leading-[1.05] max-w-3xl">
            We bring the <span class="text-gold">studio</span> to <span class="italic text-wine-light">you.</span>
          </h1>
          <p class="mt-6 text-lg md:text-xl text-cream/80 max-w-xl leading-relaxed">
            Skip the studio search. Book a professional mobile recording session, get a confirmed time, and we show up — set up, record, and break down, wherever you are.
          </p>
          <div class="mt-10 flex flex-wrap gap-4">
            <a href="/book" class="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-ink font-semibold px-7 py-4 rounded-full transition shadow-xl shadow-gold/20 text-base">
              Book Your Session <i class="fa-solid fa-arrow-right"></i>
            </a>
            <a href="#pricing" class="inline-flex items-center gap-2 border border-cream/20 hover:border-gold/50 text-cream font-medium px-7 py-4 rounded-full transition text-base">
              See Pricing
            </a>
          </div>
          <div class="mt-14 flex flex-wrap gap-8 text-sm text-cream/70">
            <div class="flex items-center gap-2"><i class="fa-solid fa-circle-check text-gold"></i> First session $100 / 3hrs</div>
            <div class="flex items-center gap-2"><i class="fa-solid fa-circle-check text-gold"></i> We travel to you</div>
            <div class="flex items-center gap-2"><i class="fa-solid fa-circle-check text-gold"></i> Pro gear, no studio needed</div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section class="max-w-6xl mx-auto px-5 py-20">
        <div class="text-center max-w-2xl mx-auto mb-14">
          <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">How it works</p>
          <h2 class="font-display text-3xl md:text-4xl font-bold">Booking is simpler than Googling studios</h2>
        </div>
        <div class="grid md:grid-cols-4 gap-6">
          {[
            { icon: 'fa-calendar-check', title: 'Book', desc: 'Pick your date, time, and location in under 2 minutes.' },
            { icon: 'fa-mobile-screen-button', title: 'Pay Deposit', desc: 'Send your Cash App deposit and upload your confirmation.' },
            { icon: 'fa-van-shuttle', title: 'We Show Up', desc: 'Mason arrives with professional gear, sets up at your location.' },
            { icon: 'fa-record-vinyl', title: 'Record', desc: 'Record your session, then we break down and leave. Simple.' }
          ].map((step, i) => (
            <div class="bg-surface border border-gold/10 rounded-2xl p-7 hover:border-gold/30 transition">
              <div class="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center text-gold text-xl mb-5">
                <i class={`fa-solid ${step.icon}`}></i>
              </div>
              <div class="text-xs text-muted font-semibold mb-1">STEP {i + 1}</div>
              <h3 class="font-display text-lg font-bold mb-2">{step.title}</h3>
              <p class="text-sm text-muted leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" class="max-w-6xl mx-auto px-5 py-20">
        <div class="text-center max-w-2xl mx-auto mb-14">
          <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">Services</p>
          <h2 class="font-display text-3xl md:text-4xl font-bold">More than just recording</h2>
          <p class="text-muted mt-4">Recording sessions can be booked instantly. Everything else — just reach out.</p>
        </div>
        <div class="grid md:grid-cols-3 gap-6">
          {services.map((s) => {
            const icons: Record<string, string> = {
              recording: 'fa-microphone-lines',
              mixing: 'fa-sliders',
              mastering: 'fa-compact-disc',
              songwriting: 'fa-feather-pointed',
              podcast: 'fa-podcast',
              voiceover: 'fa-waveform-lines'
            }
            return (
              <div class={`rounded-2xl p-7 border transition ${s.is_bookable ? 'bg-gradient-to-br from-wine/20 to-surface border-gold/40' : 'bg-surface border-gold/10 hover:border-gold/25'}`}>
                {s.is_bookable === 1 && (
                  <span class="inline-block text-[10px] font-bold uppercase tracking-wider text-gold bg-gold/10 rounded-full px-3 py-1 mb-4">
                    Book Instantly
                  </span>
                )}
                <div class="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center text-gold text-lg mb-4">
                  <i class={`fa-solid ${icons[s.slug] || 'fa-star'}`}></i>
                </div>
                <h3 class="font-display text-xl font-bold mb-2">{s.name}</h3>
                <p class="text-sm text-muted leading-relaxed mb-4">{s.description}</p>
                <div class="flex items-center justify-between">
                  <span class="text-gold font-semibold text-sm">{s.base_rate_note}</span>
                  {s.is_bookable === 1 ? (
                    <a href="/book" class="text-sm font-semibold text-cream hover:text-gold transition">Book →</a>
                  ) : (
                    <a href="/#contact" class="text-sm font-semibold text-cream hover:text-gold transition">Inquire →</a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" class="max-w-6xl mx-auto px-5 py-20">
        <div class="grid md:grid-cols-2 gap-14 items-center">
          <div>
            <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">About Studio2You</p>
            <h2 class="font-display text-3xl md:text-4xl font-bold mb-5">About Studio2You</h2>
            <p class="text-muted leading-relaxed mb-4">
              Studio2You was built to make professional recording more accessible by bringing the studio directly to you.
            </p>
            <p class="text-muted leading-relaxed mb-4">
              Backed by over 12 years of professional audio engineering experience, Studio2You was founded on the belief that artists shouldn't have to sacrifice quality for convenience. Whether you're recording in your home, apartment, hotel, rehearsal space, or another location, our mission is to deliver a professional recording experience wherever creativity happens.
            </p>
            <p class="text-muted leading-relaxed mb-4">
              Our founder brings over 12 years of professional audio engineering experience, including work with major-label and nationally recognized artists — spanning recording, mixing, vocal production, and artist development. That experience shapes every session and every engineer who becomes part of the Studio2You network.
            </p>
            <p class="text-muted leading-relaxed mb-6">
              Today, Studio2You is growing into a platform that connects artists with trusted mobile recording engineers, making it easier than ever to book high-quality recording sessions on your schedule, at your location.
            </p>
            <p class="font-display text-lg text-gold italic mb-6">Professional sound. Your space. Your schedule.</p>
            <div class="flex gap-8 text-sm">
              <div>
                <div class="text-2xl font-display font-bold text-gold">12+</div>
                <div class="text-muted text-xs uppercase tracking-wide mt-1">Years Experience</div>
              </div>
              <div>
                <div class="text-2xl font-display font-bold text-gold">{engineer?.travel_radius_miles ?? 30}mi</div>
                <div class="text-muted text-xs uppercase tracking-wide mt-1">Travel Radius</div>
              </div>
              <div>
                <div class="text-2xl font-display font-bold text-gold">M–F</div>
                <div class="text-muted text-xs uppercase tracking-wide mt-1">11am – 11pm</div>
              </div>
            </div>
          </div>
          <div class="relative">
            <img src="/static/images/mic-closeup.jpg" alt="Studio microphone" class="rounded-2xl border border-gold/20 shadow-2xl" />
            <div class="absolute -bottom-5 -left-5 bg-surface border border-gold/30 rounded-xl px-5 py-4 shadow-xl hidden sm:block">
              <div class="flex items-center gap-2 text-gold">
                <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
              </div>
              <div class="text-xs text-muted mt-1">Studio-quality, on your schedule</div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" class="max-w-6xl mx-auto px-5 py-20">
        <div class="text-center max-w-2xl mx-auto mb-14">
          <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">Pricing</p>
          <h2 class="font-display text-3xl md:text-4xl font-bold">Simple, honest pricing</h2>
          <p class="text-muted mt-4">You're not just paying for recording — you're paying for us to travel, set up, and break down at your location.</p>
        </div>
        <div class="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          <div class="relative bg-gradient-to-br from-wine/30 to-surface border-2 border-gold rounded-2xl p-8">
            <span class="absolute -top-3 left-8 bg-gold text-ink text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">Most Popular</span>
            <h3 class="font-display text-xl font-bold mb-1 mt-2">First Session</h3>
            <p class="text-muted text-sm mb-6">For new clients only</p>
            <div class="mb-6">
              <span class="text-5xl font-display font-bold text-gold">$100</span>
              <span class="text-muted"> / 3 hours</span>
            </div>
            <ul class="space-y-3 text-sm mb-8">
              <li class="flex items-center gap-2"><i class="fa-solid fa-check text-gold"></i> Full mobile setup at your location</li>
              <li class="flex items-center gap-2"><i class="fa-solid fa-check text-gold"></i> Up to 3 hours of recording</li>
              <li class="flex items-center gap-2"><i class="fa-solid fa-check text-gold"></i> Professional mic & interface</li>
              <li class="flex items-center gap-2"><i class="fa-solid fa-check text-gold"></i> Raw stems delivered same week</li>
            </ul>
            <a href="/book" class="block text-center bg-gold hover:bg-gold-light text-ink font-semibold py-3.5 rounded-full transition">Book First Session</a>
          </div>
          <div class="bg-surface border border-gold/15 rounded-2xl p-8">
            <h3 class="font-display text-xl font-bold mb-1 mt-2">Standard Rate</h3>
            <p class="text-muted text-sm mb-6">For returning clients</p>
            <div class="mb-6">
              <span class="text-5xl font-display font-bold text-cream">$40</span>
              <span class="text-muted"> / hour</span>
            </div>
            <ul class="space-y-3 text-sm mb-8">
              <li class="flex items-center gap-2"><i class="fa-solid fa-check text-gold"></i> Same mobile setup, no travel fee</li>
              <li class="flex items-center gap-2"><i class="fa-solid fa-check text-gold"></i> Book any session length</li>
              <li class="flex items-center gap-2"><i class="fa-solid fa-check text-gold"></i> Priority scheduling</li>
              <li class="flex items-center gap-2"><i class="fa-solid fa-check text-gold"></i> Raw stems delivered same week</li>
            </ul>
            <a href="/book" class="block text-center border border-gold/40 hover:bg-gold/10 text-cream font-semibold py-3.5 rounded-full transition">Book a Session</a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" class="max-w-4xl mx-auto px-5 py-20">
        <div class="text-center mb-12">
          <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">FAQ</p>
          <h2 class="font-display text-3xl md:text-4xl font-bold">Questions? Answered.</h2>
        </div>
        <div class="space-y-3">
          {[
            { q: 'How does payment work?', a: 'After you book, you\'ll get Cash App deposit instructions. Send your deposit, upload a screenshot or transaction ID, and your booking moves to pending approval. Once we confirm your payment, your session is locked in.' },
            { q: 'What if I need a time outside Monday–Friday, 11am–11pm?', a: 'You can still submit a booking request for those times — it\'ll be flagged as a special request and we\'ll reach out to confirm availability directly instead of auto-confirming.' },
            { q: 'What locations do you record at?', a: 'Apartments, houses, hotel rooms, rented studios — wherever you have a quiet-ish space. We travel up to 30 miles; further out, just ask.' },
            { q: 'Do I need my own equipment?', a: 'No. We bring professional mics, an audio interface, headphones, and everything needed for a clean vocal recording session.' },
            { q: 'What do I get after the session?', a: 'Raw recorded stems, delivered digitally within the week. Need mixing or mastering too? Just ask — those are add-on services.' }
          ].map((item) => (
            <details class="group bg-surface border border-gold/10 rounded-xl px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary class="flex items-center justify-between cursor-pointer font-medium text-cream">
                {item.q}
                <i class="fa-solid fa-chevron-down text-gold text-xs transition group-open:rotate-180"></i>
              </summary>
              <p class="text-muted text-sm mt-3 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section class="max-w-6xl mx-auto px-5 py-20">
        <div class="bg-gradient-to-br from-wine/40 via-surface to-surface border border-gold/20 rounded-3xl px-8 py-16 text-center relative overflow-hidden">
          <div class="relative">
            <h2 class="font-display text-3xl md:text-5xl font-bold mb-5">Ready to record tonight?</h2>
            <p class="text-cream/70 max-w-xl mx-auto mb-8">Stop searching for studios. Book your session now and we'll come to you.</p>
            <a href="/book" class="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-ink font-semibold px-8 py-4 rounded-full transition shadow-xl shadow-gold/30 text-base">
              Book Your Session <i class="fa-solid fa-arrow-right"></i>
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
