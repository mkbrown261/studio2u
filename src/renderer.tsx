import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children, title }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title ? `${title} · Studio2U` : 'Studio2U — We Bring The Studio To You'}</title>
        <meta
          name="description"
          content="Studio2U is mobile recording. Book a professional recording engineer to come record your session tonight — no studio required."
        />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎙️</text></svg>" />

        <script src="https://cdn.tailwindcss.com"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
            tailwind.config = {
              theme: {
                extend: {
                  colors: {
                    ink: '#12100E',
                    surface: '#1C1713',
                    surface2: '#241E18',
                    gold: {
                      DEFAULT: '#D9A448',
                      light: '#EBC780',
                      dark: '#B7833A'
                    },
                    wine: {
                      DEFAULT: '#6E2A3A',
                      light: '#8C3B4D',
                      dark: '#4E1D29'
                    },
                    cream: '#F3ECE0',
                    muted: '#A89A8C'
                  },
                  fontFamily: {
                    display: ['"Playfair Display"', 'serif'],
                    sans: ['"Inter"', 'sans-serif']
                  }
                }
              }
            }
          `
          }}
        ></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
        <link href="/static/styles.css" rel="stylesheet" />
      </head>
      <body class="bg-ink text-cream font-sans antialiased">
        <header id="site-header" class="fixed top-0 left-0 right-0 z-50 border-b border-gold/10 bg-ink/80 backdrop-blur-md">
          <nav class="max-w-6xl mx-auto flex items-center justify-between px-5 py-4">
            <a href="/" class="flex items-center gap-2 group">
              <span class="w-9 h-9 rounded-full bg-gradient-to-br from-gold to-wine flex items-center justify-center text-ink font-display font-bold text-sm">S2U</span>
              <span class="font-display text-lg tracking-wide">Studio<span class="text-gold">2</span>U</span>
            </a>
            <div class="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
              <a href="/#services" class="hover:text-gold transition">Services</a>
              <a href="/#pricing" class="hover:text-gold transition">Pricing</a>
              <a href="/#about" class="hover:text-gold transition">About</a>
              <a href="/#faq" class="hover:text-gold transition">FAQ</a>
              <a href="/status" class="hover:text-gold transition">My Bookings</a>
            </div>
            <a href="/book" class="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-ink font-semibold px-5 py-2.5 rounded-full text-sm transition shadow-lg shadow-gold/20">
              Book Now <i class="fa-solid fa-arrow-right text-xs"></i>
            </a>
          </nav>
        </header>

        <main class="pt-20">{children}</main>

        <footer class="border-t border-gold/10 bg-surface mt-24">
          <div class="max-w-6xl mx-auto px-5 py-12 grid grid-cols-1 md:grid-cols-4 gap-10">
            <div>
              <div class="flex items-center gap-2 mb-3">
                <span class="w-8 h-8 rounded-full bg-gradient-to-br from-gold to-wine flex items-center justify-center text-ink font-display font-bold text-xs">S2U</span>
                <span class="font-display text-base">Studio2U</span>
              </div>
              <p class="text-sm text-muted leading-relaxed">We bring the studio to you. Professional mobile recording, on your schedule.</p>
            </div>
            <div>
              <h4 class="font-semibold text-cream mb-3 text-sm uppercase tracking-wider">Explore</h4>
              <ul class="space-y-2 text-sm text-muted">
                <li><a href="/#services" class="hover:text-gold transition">Services</a></li>
                <li><a href="/#pricing" class="hover:text-gold transition">Pricing</a></li>
                <li><a href="/#about" class="hover:text-gold transition">About Mason</a></li>
                <li><a href="/#faq" class="hover:text-gold transition">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 class="font-semibold text-cream mb-3 text-sm uppercase tracking-wider">Book</h4>
              <ul class="space-y-2 text-sm text-muted">
                <li><a href="/book" class="hover:text-gold transition">New Session</a></li>
                <li><a href="/status" class="hover:text-gold transition">Check Booking Status</a></li>
              </ul>
            </div>
            <div id="contact">
              <h4 class="font-semibold text-cream mb-3 text-sm uppercase tracking-wider">Contact</h4>
              <ul class="space-y-2 text-sm text-muted">
                <li><i class="fa-solid fa-envelope mr-2 text-gold"></i>booking@studio2u.com</li>
                <li><i class="fa-brands fa-square-cash mr-2 text-gold"></i>$KEYZGMG</li>
                <li><i class="fa-solid fa-location-dot mr-2 text-gold"></i>Mobile — we come to you</li>
              </ul>
            </div>
          </div>
          <div class="border-t border-gold/10 py-5 text-center text-xs text-muted">
            © 2026 Studio2U. All rights reserved. We bring the studio to you.
          </div>
        </footer>
      </body>
    </html>
  )
})
