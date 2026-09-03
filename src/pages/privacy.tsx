import privacyMarkdown from '../../legal/privacy-policy.md?raw'
import { renderLegalMarkdown } from '../lib/markdown'

export function PrivacyPage() {
  const html = renderLegalMarkdown(privacyMarkdown)
  return (
    <div class="max-w-3xl mx-auto px-5 py-16">
      <a href="/signup" class="text-sm text-gold hover:underline">&larr; Back to Sign Up</a>
      <article id="legal-document" class="prose-legal bg-surface border border-gold/10 rounded-2xl p-7 md:p-10 mt-6" dangerouslySetInnerHTML={{ __html: html }}></article>
    </div>
  )
}
