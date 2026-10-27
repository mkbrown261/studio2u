// Pre-flight release lint: catches the edits UnitedMasters' review team requests
// BEFORE the user submits, so releases aren't delayed. Pure function, no model, no
// network, which also makes it cheap to run (zero tokens beyond the result).
//
// Rules are from UnitedMasters' own support articles (checked 2026-10-27):
//  - "Why am I being asked to make edits for metadata for my release?"
//  - "WHY YOUR RELEASE MAY HAVE BEEN REJECTED" (cover art, metadata, samples)
//  - "How do I size my cover art correctly?" (3000x3000 min, 6000 max, JPG/PNG)
//  - "Why isn't my release on the correct artist profile" (link Spotify/Apple profiles)
//  - "Understanding Artist Roles" (non-performers, e.g. songwriters, are never Main/Featured)
import type { Intake } from './intake'

export type LintIssue = { severity: 'BLOCKER' | 'FIX' | 'TIP'; field: string; problem: string; fix: string; source: string }
const UM = 'UnitedMasters support: metadata edit requests'
const MAJORS = /\b(universal|sony|warner|atlantic|interscope|def jam|columbia|rca|capitol|republic|epic|island|motown|elektra|geffen|parlophone|unitedmasters|united masters)\b/i
const EXTRA_TITLE = /\b(single|official\s*(audio|video|music video)|clean|ep|lp|album|prod\.?\s*(by)?|produced by|feat\.?|ft\.?|featuring|out now|new)\b/i
const CENSORED = /[a-z]\*+[a-z]?|\*{2,}/i
const ROLE_WORDS = /\b(prod|producer|remix|remixer|songwriter|writer|pianist|engineer|mix|mixed|feat|ft)\b/i
const FANCY = /[\u{1D400}-\u{1D7FF}\u{1F100}-\u{1F1FF}\u{24B6}-\u{24E9}\u{FF01}-\u{FF5E}]/u
const COMPOUND = /\s(&|and|x|×|\/|,)\s|,/i

export function lintRelease(r: { title: string; artist: string; release_type: string }, i: Intake, assets: { artwork: boolean; artworkCheck?: string; master: boolean }, opts: { spotifyArtistId?: string | null; appleArtistId?: string | null; famousNames?: string[] } = {}): { ok: boolean; issues: LintIssue[] } {
  const issues: LintIssue[] = []
  const add = (severity: LintIssue['severity'], field: string, problem: string, fix: string, source = UM) => issues.push({ severity, field, problem, fix, source })
  const titleCheck = (field: string, t: string) => {
    if (!t) return
    if (r.artist && new RegExp(`\\b${r.artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t)) add('FIX', field, `"${t}" contains the artist name.`, 'Remove artist names from titles; artists go in their own fields.')
    for (const f of i.featuredArtists ?? []) if (f && t.toLowerCase().includes(f.toLowerCase())) add('FIX', field, `"${t}" contains featured artist "${f}".`, 'Put featured artists in the Featured Artist field, not the title.')
    const extra = t.replace(/\((remix|bonus|deluxe|live|acoustic|remastered|sped up|slowed|instrumental|radio edit|extended)[^)]*\)/ig, '').match(EXTRA_TITLE)
    if (extra) add('FIX', field, `"${t}" contains "${extra[0]}".`, 'Remove words like Single, Official Audio, Clean, EP, feat., prod. by. Version info like (Remix) or (Deluxe) goes in parentheses.')
    if (CENSORED.test(t)) add('FIX', field, `"${t}" is censored with asterisks.`, 'Spell the word out fully and mark the track Explicit instead.')
    if (FANCY.test(t)) add('FIX', field, `"${t}" uses decorative Unicode letters.`, 'Use standard fonts/characters only.')
    if (/[A-Z]{4,}/.test(t) && t === t.toUpperCase() && t.length > 6) add('TIP', field, `"${t}" is ALL CAPS.`, 'Stores may normalize casing; use Title Case unless all-caps is the real stylization.', 'Apple Music style guide (via UnitedMasters)')
  }
  titleCheck('Release title', r.title)
  if (r.release_type === 'single') add('TIP', 'Track title', 'Singles must use the same title for the track and the release.', 'Keep track title = release title.', 'UnitedMasters support')

  for (const [field, list] of [['Featured artists', i.featuredArtists ?? []], ['Producers', i.producers ?? []]] as const) for (const n of list) {
    if (ROLE_WORDS.test(n)) add('FIX', field, `"${n}" includes a role word.`, 'Only the person\'s name, e.g. "Mike Will" not "prod. by Mike Will".')
    if (COMPOUND.test(n)) add('FIX', field, `"${n}" looks like several names in one field.`, 'Enter one name per line.')
  }
  for (const w of i.writers ?? []) { if (COMPOUND.test(w.legalName)) add('FIX', 'Songwriters', `"${w.legalName}" looks like several names.`, 'One songwriter per line, legal names.') }
  const famous = (opts.famousNames ?? []).map(s => s.toLowerCase())
  for (const n of [...(i.featuredArtists ?? []), ...(i.writers ?? []).map(w => w.legalName)]) if (famous.includes(n.toLowerCase())) add('BLOCKER', 'Credits', `"${n}" is a well-known artist name.`, 'UnitedMasters requires authorization documentation for featured artists; upload it, or remove the name.')

  if (i.recordLabel && MAJORS.test(i.recordLabel)) add('BLOCKER', 'Label', `Label "${i.recordLabel}" is an existing/major label name (or UnitedMasters).`, 'Use a label name you own the rights to, or your artist name.')
  if (!i.recordLabel) add('TIP', 'Label', 'No label name set.', 'Leave blank to use the artist name, or enter a label name you own.')

  if (i.containsThirdPartyAudio && !i.thirdPartyAudioLicense) add('BLOCKER', 'Beat / samples', 'Uses a leased beat or samples without a license on file.', 'Attach the beat license / sample clearance. UnitedMasters rejects any sample without legal clearance.', 'UnitedMasters: why releases are rejected')
  for (const s of i.samples ?? []) if (!s.cleared) add('BLOCKER', 'Samples', `Sample "${s.description}" is not cleared.`, 'Clear it (written license) or remove it before submitting.', 'UnitedMasters: why releases are rejected')

  if (!assets.artwork) add('BLOCKER', 'Cover art', 'No cover art uploaded.', 'Upload square art, 3000×3000 px (up to 6000), JPG or PNG.', 'UnitedMasters: cover art sizing')
  else if (assets.artworkCheck === 'FAIL') add('BLOCKER', 'Cover art', 'Cover art failed the size/format check.', 'Re-export at exactly 3000×3000 px, RGB, JPG or PNG.', 'UnitedMasters: cover art sizing')
  else if (assets.artworkCheck !== 'PASS') add('TIP', 'Cover art', 'Cover art not checked yet.', 'Run the artwork check before submitting.')
  if (i.coverArtThirdParty && !i.coverArtLicense) add('BLOCKER', 'Cover art', 'Cover art uses photos/logos you don\'t own.', 'Cover art must be original; no brands, logos or others\' photos without a license.', 'UnitedMasters: why releases are rejected')
  if (!assets.master) add('BLOCKER', 'Audio', 'No master audio uploaded.', 'Upload the final WAV master.')

  if (i.releaseDate) {
    const days = Math.ceil((Date.parse(i.releaseDate + 'T00:00:00Z') - Date.now()) / 86400000)
    if (days < 21) add(days < 10 ? 'BLOCKER' : 'FIX', 'Release date', `Release date is ${Math.max(0, days)} days away.`, 'Submit at least 3 weeks ahead so edits don\'t delay the date and you keep the Spotify editorial pitch window.', 'UnitedMasters support')
  } else add('FIX', 'Release date', 'No release date set.', 'Pick a date at least 3 weeks out.')

  if (!opts.spotifyArtistId && !opts.appleArtistId) add('FIX', 'Artist profiles', 'Spotify/Apple artist profiles are not linked.', 'Paste your Spotify and Apple Music artist URLs in UnitedMasters (Settings > Linked Artist Profiles). It is the most reliable way to land on the right profile, which matters when another artist has a similar name.', 'UnitedMasters: correct artist profile')
  if (i.explicit === undefined) add('FIX', 'Explicit', 'Explicit flag not set.', 'Mark Explicit if any track has explicit lyrics.')
  return { ok: !issues.some(x => x.severity !== 'TIP'), issues }
}
