export function LoginPage({ error }: { error?: string }) {
  return (
    <div class="max-w-md mx-auto px-5 py-16">
      <div class="text-center mb-8">
        <div class="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center text-gold text-2xl mx-auto mb-4">
          <i class="fa-solid fa-right-to-bracket"></i>
        </div>
        <h1 class="font-display text-2xl font-bold">Log In</h1>
        <p class="text-muted text-sm mt-2">Welcome back to Studio2You.</p>
      </div>
      <form method="POST" action="/login" class="bg-surface border border-gold/10 rounded-2xl p-7 space-y-4">
        {error && <div class="bg-wine/20 border border-wine/40 text-wine-light text-sm rounded-lg px-4 py-3">{error}</div>}
        <div>
          <label class="block text-sm font-medium text-muted mb-2">Email</label>
          <input type="email" name="email" required autofocus class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
        </div>
        <div>
          <label class="block text-sm font-medium text-muted mb-2">Password</label>
          <input type="password" name="password" required class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
        </div>
        <button type="submit" class="w-full bg-gold hover:bg-gold-light text-ink font-semibold py-3 rounded-lg transition">
          Log In
        </button>
        <p class="text-center text-sm text-muted">
          Don't have an account? <a href="/signup" class="text-gold hover:underline">Sign up</a>
        </p>
      </form>
    </div>
  )
}
