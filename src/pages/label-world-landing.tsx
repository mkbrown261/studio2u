// Public marketing page for Label World (/label). Every claim here maps to a shipped
// feature; anything not shipped yet is visibly marked "Coming soon".
const features = [
  { icon: 'fa-crown', tag: 'Live', title: 'Run your own label', desc: 'Your own 3D record-label headquarters with AI employees. Create releases, track every song, and see what each one still needs, all in one place.' },
  { icon: 'fa-rocket', tag: 'Live', title: 'Release on UnitedMasters', desc: 'Your release form arrives already filled in: title, genre, explicit tags, songwriters, producers, artwork checks and release date. You review it and hit Submit.' },
  { icon: 'fa-sack-dollar', tag: 'Live', title: 'Get your ASCAP money', desc: 'Your songs get registered the way ASCAP wants: writers, IPI numbers and splits, converted to ASCAP\'s 50/50 writer/publisher shares automatically.' },
  { icon: 'fa-tower-broadcast', tag: 'Live', title: 'Collect SoundExchange royalties', desc: 'Digital radio pays too. We prep your SoundExchange recording claim (ISRC, ownership %, release and UPC) so that money doesn\'t sit unclaimed.' },
  { icon: 'fa-magnifying-glass-dollar', tag: 'Live', title: 'Royalty recovery follow-up', desc: 'PRO, MLC, SoundExchange and Copyright Office tasks never expire. Your label keeps chasing every one until it\'s confirmed, even with zero streams.' },
  { icon: 'fa-headphones', tag: 'Coming soon', title: 'Playlist pitching', desc: 'Pitch-ready one-sheets and playlist submissions handled by your label team. In the works.' }
]
const steps = [
  { n: '1', title: 'Drop your song', desc: 'Create a release, upload your master and artwork.' },
  { n: '2', title: 'Your label asks once', desc: 'Missing info gets collected one time, then reused forever: legal names, splits, IPI.' },
  { n: '3', title: 'Forms fill themselves', desc: 'UnitedMasters, ASCAP and SoundExchange packets are prepared field by field.' },
  { n: '4', title: 'You press Submit', desc: 'You log in and approve. Your label follows up until the money\'s confirmed.' }
]

export function LabelWorldLanding({ signedIn }: { signedIn: boolean }) {
  const enter = signedIn ? '/label-world' : '/label-world/login?returnTo=%2Flabel-world'
  return (
    <div class="lw-landing">
      <style>{`
        .lw-glow{background:radial-gradient(60% 60% at 70% 30%,rgba(62,216,204,.18),transparent 60%),radial-gradient(50% 50% at 20% 70%,rgba(232,191,107,.16),transparent 60%)}
        .lw-ring{background:linear-gradient(135deg,#e8bf6b,#3ED8CC 55%,#a46bff);padding:1px;border-radius:1.25rem}
        .lw-ring>div{border-radius:calc(1.25rem - 1px)}
        .lw-float{animation:lwfloat 6s ease-in-out infinite}@keyframes lwfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        .lw-shine{background:linear-gradient(90deg,#e8bf6b,#fff3cf,#3ED8CC,#e8bf6b);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:lwshine 8s linear infinite}@keyframes lwshine{to{background-position:300% 0}}
        @media (prefers-reduced-motion:reduce){.lw-float,.lw-shine{animation:none}}
      `}</style>

      {/* HERO */}
      <section class="relative overflow-hidden lw-glow">
        <div class="max-w-6xl mx-auto px-5 pt-16 pb-20 md:pt-24 md:pb-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p class="inline-flex items-center gap-2 text-teal-light text-xs font-semibold uppercase tracking-[0.2em] mb-6 border border-teal/40 rounded-full px-4 py-2 bg-teal/5">
              <i class="fa-solid fa-crown"></i> New · Studio2U Label World
            </p>
            <h1 class="font-display text-4xl sm:text-6xl font-bold leading-[1.05]">
              Your music. <span class="lw-shine">Your label.</span><br />Your money.
            </h1>
            <p class="mt-6 text-lg text-cream/80 max-w-xl leading-relaxed">
              Label World is the record label you run yourself. AI employees fill out the paperwork
              to release your songs, register them with ASCAP and SoundExchange, and chase every
              royalty you're owed. You stay in charge.
            </p>
            <div class="mt-9 flex flex-wrap gap-4">
              <a href={enter} class="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-ink font-bold px-8 py-4 rounded-full transition shadow-xl shadow-gold/30 text-base">
                <i class="fa-solid fa-door-open"></i> Enter Label World
              </a>
              <a href="/label-world" class="inline-flex items-center gap-2 border border-teal/50 hover:border-teal text-cream font-medium px-7 py-4 rounded-full transition text-base">
                <i class="fa-solid fa-vr-cardboard text-teal-light"></i> Take the free 3D tour
              </a>
            </div>
            {!signedIn && <p class="mt-4 text-sm text-muted">Free to start with your Studio2U account. <a href="/signup" class="text-gold hover:underline">Create one →</a></p>}
            <div class="mt-10 flex flex-wrap gap-6 text-sm text-cream/70">
              <span class="flex items-center gap-2"><i class="fa-solid fa-circle-check text-teal-light"></i> UnitedMasters</span>
              <span class="flex items-center gap-2"><i class="fa-solid fa-circle-check text-teal-light"></i> ASCAP</span>
              <span class="flex items-center gap-2"><i class="fa-solid fa-circle-check text-teal-light"></i> SoundExchange</span>
              <span class="flex items-center gap-2"><i class="fa-solid fa-circle-check text-teal-light"></i> Works with Claude &amp; Codex</span>
            </div>
          </div>
          <div class="relative lw-float">
            <div class="lw-ring shadow-2xl shadow-teal/10"><div class="overflow-hidden bg-ink">
              <img src="/static/label-world/hq-lobby.jpg" alt="Studio2U Label World 3D headquarters lobby" class="w-full block" loading="eager" />
            </div></div>
            <div class="absolute -bottom-6 -left-4 sm:-left-8 bg-surface/95 backdrop-blur border border-gold/30 rounded-2xl px-5 py-4 shadow-xl max-w-[260px]">
              <div class="text-xs text-muted uppercase tracking-wider mb-1">Your label team</div>
              <div class="flex items-center gap-3">
                <img src="/label-world/assets/carla-portrait.png" alt="Carla" class="w-10 h-10 rounded-full object-cover border border-gold/40" />
                <img src="/label-world/assets/eric-portrait.png" alt="Eric" class="w-10 h-10 rounded-full object-cover border border-gold/40 -ml-5" />
                <div class="text-sm font-semibold leading-tight">Carla &amp; Eric<br /><span class="text-xs font-normal text-muted">A&amp;R · Quality review</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section class="max-w-6xl mx-auto px-5 py-20">
        <div class="text-center max-w-2xl mx-auto mb-14">
          <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">What your label does</p>
          <h2 class="font-display text-3xl md:text-5xl font-bold">Stop leaving money on the table</h2>
          <p class="text-muted mt-4">Most independent artists never register their songs everywhere they get paid. Your label does it for you, one song at a time.</p>
        </div>
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(f => (
            <div class={`relative rounded-2xl p-7 border transition ${f.tag === 'Live' ? 'bg-gradient-to-br from-wine/20 to-surface border-gold/25 hover:border-gold/60' : 'bg-surface border-cream/10 opacity-80'}`}>
              <span class={`absolute top-5 right-5 text-[10px] font-bold uppercase tracking-wider rounded-full px-3 py-1 ${f.tag === 'Live' ? 'text-teal-light bg-teal/10' : 'text-muted bg-cream/5'}`}>{f.tag}</span>
              <div class="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center text-gold text-xl mb-5"><i class={`fa-solid ${f.icon}`}></i></div>
              <h3 class="font-display text-xl font-bold mb-2">{f.title}</h3>
              <p class="text-sm text-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section class="max-w-6xl mx-auto px-5 py-20">
        <div class="grid lg:grid-cols-2 gap-14 items-center">
          <div class="order-2 lg:order-1 grid grid-cols-5 gap-4">
            <div class="col-span-3 lw-ring"><div class="overflow-hidden bg-ink"><img src="/static/label-world/carla-studio.jpg" alt="Carla in the Label World recording studio" class="w-full h-full object-cover block" loading="lazy" /></div></div>
            <div class="col-span-2 lw-ring"><div class="overflow-hidden bg-ink h-full"><img src="/static/label-world/eric-studio.jpg" alt="Eric reviewing a release" class="w-full h-full object-cover block" loading="lazy" /></div></div>
          </div>
          <div class="order-1 lg:order-2">
            <p class="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">How it works</p>
            <h2 class="font-display text-3xl md:text-4xl font-bold mb-8">From finished song to getting paid</h2>
            <div class="space-y-5">
              {steps.map(s => (
                <div class="flex gap-4">
                  <div class="flex-none w-10 h-10 rounded-full bg-gold text-ink font-bold flex items-center justify-center">{s.n}</div>
                  <div><h3 class="font-semibold text-lg">{s.title}</h3><p class="text-sm text-muted">{s.desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AI AGENTS */}
      <section class="max-w-6xl mx-auto px-5 py-16">
        <div class="lw-ring"><div class="bg-surface px-8 py-12 md:px-14 grid md:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <p class="text-teal-light text-xs font-semibold uppercase tracking-[0.2em] mb-3"><i class="fa-solid fa-robot"></i> Bring your own AI</p>
            <h2 class="font-display text-2xl md:text-4xl font-bold mb-4">Your Claude or ChatGPT/Codex works for your label</h2>
            <p class="text-muted leading-relaxed max-w-2xl">Connect the AI you already pay for. It picks up your label's to-do list, asks you only what's missing, and fills in the forms on screen while you watch. Studio2U keeps the list moving around the clock, even when your computer is off.</p>
          </div>
          <a href={signedIn ? '/label-world/dashboard' : enter} class="inline-flex items-center justify-center gap-2 bg-teal hover:bg-teal-light text-ink font-bold px-7 py-4 rounded-full transition whitespace-nowrap">
            <i class="fa-solid fa-plug"></i> Connect my AI
          </a>
        </div></div>
      </section>

      {/* FAQ */}
      <section class="max-w-4xl mx-auto px-5 py-16">
        <h2 class="font-display text-3xl font-bold text-center mb-10">Straight answers</h2>
        <div class="space-y-3">
          {[
            { q: 'Do you submit things without me?', a: 'No. Your label prepares everything and fills in the forms, but you log in to UnitedMasters, ASCAP and SoundExchange yourself and press Submit. Your passwords are never shared with Studio2U or any AI.' },
            { q: 'Do I need to be signed with anyone?', a: 'No. Label World is built for independent artists and producers running their own label.' },
            { q: 'Does it guarantee royalties or playlist placement?', a: 'No one can honestly guarantee that. What we do is make sure your songs are registered correctly and nothing gets forgotten, which is where most independent artists lose money.' },
            { q: 'I\'m with BMI, not ASCAP. Does it still help?', a: 'Yes. Your label tracks your PRO follow-up for any society. Fully pre-filled forms are live for ASCAP today, with more societies coming.' },
            { q: 'What does it cost?', a: 'Getting started is free with your Studio2U account. To use your own AI, connect the Claude or ChatGPT plan you already have.' }
          ].map(item => (
            <details class="group bg-surface border border-gold/10 rounded-xl px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary class="flex items-center justify-between cursor-pointer font-medium text-cream">{item.q}<i class="fa-solid fa-chevron-down text-gold text-xs transition group-open:rotate-180"></i></summary>
              <p class="text-muted text-sm mt-3 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section class="max-w-6xl mx-auto px-5 pb-24">
        <div class="relative overflow-hidden rounded-3xl border border-gold/30">
          <img src="/static/label-world/hq-lobby.jpg" alt="" class="absolute inset-0 w-full h-full object-cover opacity-30" loading="lazy" />
          <div class="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-wine/40"></div>
          <div class="relative px-8 py-16 md:py-20 text-center">
            <h2 class="font-display text-3xl md:text-5xl font-bold mb-5">Your label is waiting.</h2>
            <p class="text-cream/75 max-w-xl mx-auto mb-8">Walk in, meet your team, and get your first release ready today.</p>
            <a href={enter} class="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-ink font-bold px-9 py-4 rounded-full transition shadow-xl shadow-gold/30 text-lg">
              <i class="fa-solid fa-door-open"></i> Enter Label World
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
