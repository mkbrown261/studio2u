// Tiny markdown → HTML converter for rendering the legal documents stored as
// plain-text constants in src/legal/*.ts. Cloudflare Workers has no filesystem
// access at runtime, so the canonical .md files in /legal (source of truth for
// humans/lawyers) are mirrored into TS string constants that get bundled at
// build time; this converts that same markdown text to HTML for the /terms and
// /consent pages instead of hand-maintaining a parallel JSX copy.
//
// Deliberately minimal — only supports the subset of markdown actually used in
// our legal docs: #/##/### headings, **bold**, "* " bullet lists, numbered
// "1. " lists, "---" horizontal rules, "☐ " checkbox-style lines, and plain
// paragraphs. Not a general-purpose markdown parser.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inline(s: string): string {
  let out = escapeHtml(s)
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  return out
}

export function renderLegalMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let listType: 'ul' | 'ol' | null = null

  const closeList = () => {
    if (listType) {
      html.push(listType === 'ul' ? '</ul>' : '</ol>')
      listType = null
    }
  }

  let paragraphBuffer: string[] = []
  const flushParagraph = () => {
    if (paragraphBuffer.length) {
      html.push(`<p>${inline(paragraphBuffer.join(' '))}</p>`)
      paragraphBuffer = []
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (line === '') {
      flushParagraph()
      continue
    }

    if (line === '---') {
      flushParagraph()
      closeList()
      html.push('<hr />')
      continue
    }

    const h3 = line.match(/^###\s+(.*)$/)
    const h2 = line.match(/^##\s+(.*)$/)
    const h1 = line.match(/^#\s+(.*)$/)
    if (h3 || h2 || h1) {
      flushParagraph()
      closeList()
      const [, text] = h3 || h2 || h1 as RegExpMatchArray
      const tag = h3 ? 'h3' : h2 ? 'h2' : 'h1'
      html.push(`<${tag}>${inline(text)}</${tag}>`)
      continue
    }

    const checkbox = line.match(/^☐\s+(.*)$/)
    if (checkbox) {
      flushParagraph()
      if (listType !== 'ul') { closeList(); html.push('<ul class="legal-checklist">'); listType = 'ul' }
      html.push(`<li><span class="legal-checkbox" aria-hidden="true">&#9744;</span> ${inline(checkbox[1])}</li>`)
      continue
    }

    const bullet = line.match(/^[*-]\s+(.*)$/)
    if (bullet) {
      flushParagraph()
      if (listType !== 'ul') { closeList(); html.push('<ul>'); listType = 'ul' }
      html.push(`<li>${inline(bullet[1])}</li>`)
      continue
    }

    const numbered = line.match(/^\d+\.\s+(.*)$/)
    if (numbered) {
      flushParagraph()
      if (listType !== 'ol') { closeList(); html.push('<ol>'); listType = 'ol' }
      html.push(`<li>${inline(numbered[1])}</li>`)
      continue
    }

    // Blank-field signature lines like "**Full Legal Name:** ____" render fine
    // via inline() as bold + underscores; treat as their own paragraph line.
    closeList()
    paragraphBuffer.push(line)
  }

  flushParagraph()
  closeList()

  return html.join('\n')
}
