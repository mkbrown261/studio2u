export function SignupPage({ error }: { error?: string }) {
  return (
    <div class="max-w-md mx-auto px-5 py-16">
      <div class="text-center mb-8">
        <div class="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center text-gold text-2xl mx-auto mb-4">
          <i class="fa-solid fa-user-plus"></i>
        </div>
        <h1 class="font-display text-2xl font-bold">Create Your Account</h1>
        <p class="text-muted text-sm mt-2">Sign up as an artist, an engineer, or both.</p>
      </div>
      <form method="POST" action="/signup" class="bg-surface border border-gold/10 rounded-2xl p-7 space-y-4">
        {error && <div class="bg-wine/20 border border-wine/40 text-wine-light text-sm rounded-lg px-4 py-3">{error}</div>}

        <div>
          <label class="block text-sm font-medium text-muted mb-2">Full Name</label>
          <input type="text" name="name" required class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
        </div>
        <div>
          <label class="block text-sm font-medium text-muted mb-2">Email</label>
          <input type="email" name="email" required class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
        </div>
        <div>
          <label class="block text-sm font-medium text-muted mb-2">Phone</label>
          <input type="tel" name="phone" required class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
        </div>
        <div>
          <label class="block text-sm font-medium text-muted mb-2">Password</label>
          <input type="password" name="password" required minlength="8" class="w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold" />
          <p class="text-xs text-muted mt-1.5">At least 8 characters.</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-muted mb-3">I want to sign up as:</label>
          <div class="grid grid-cols-2 gap-3">
            <label class="flex items-center gap-2 bg-ink border border-gold/20 rounded-lg px-4 py-3 cursor-pointer hover:border-gold/40 transition">
              <input type="checkbox" name="role_artist" value="1" checked class="accent-gold" />
              <span class="text-sm">Artist</span>
            </label>
            <label class="flex items-center gap-2 bg-ink border border-gold/20 rounded-lg px-4 py-3 cursor-pointer hover:border-gold/40 transition">
              <input type="checkbox" name="role_engineer" value="1" class="accent-gold" />
              <span class="text-sm">Engineer</span>
            </label>
          </div>
          <p class="text-xs text-muted mt-1.5">You can check both — you're not locked in.</p>
        </div>

        <button type="submit" class="w-full bg-gold hover:bg-gold-light text-ink font-semibold py-3 rounded-lg transition">
          Create Account
        </button>

        <p class="text-center text-sm text-muted">
          Already have an account? <a href="/login" class="text-gold hover:underline">Log in</a>
        </p>
      </form>
    </div>
  )
}
