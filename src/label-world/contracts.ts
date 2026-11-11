// Preserve earlier aliases while adding the canonical v2 logical specialists.
export const roles = ['executive', 'researcher', 'builder', 'reviewer', 'catalog_manager', 'release_manager', 'publishing_administrator', 'rights_administrator', 'marketing_manager', 'content_producer', 'social_media_manager', 'ar_researcher', 'producer_builder', 'publishing_admin', 'rights_admin', 'videographer', 'shortform_editor', 'royalty_admin'] as const
export const statuses = ['QUEUED', 'RUNNING', 'WAITING_FOR_INPUT', 'WAITING_FOR_APPROVAL', 'BLOCKED', 'FAILED', 'COMPLETED', 'CANCELLED'] as const
export type TaskStatus = typeof statuses[number]
const transitions: Record<TaskStatus, readonly TaskStatus[]> = {
  QUEUED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['WAITING_FOR_INPUT', 'WAITING_FOR_APPROVAL', 'BLOCKED', 'FAILED', 'COMPLETED', 'CANCELLED'],
  WAITING_FOR_INPUT: ['QUEUED', 'CANCELLED'], WAITING_FOR_APPROVAL: ['QUEUED', 'CANCELLED'],
  BLOCKED: ['QUEUED', 'CANCELLED'], FAILED: ['QUEUED', 'CANCELLED'], COMPLETED: [], CANCELLED: []
}
export function canTransition(from: TaskStatus, to: TaskStatus): boolean { return transitions[from]?.includes(to) ?? false }
export function releaseInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected release object')
  const v = value as Record<string, unknown>
  const field = (name: string) => {
    if (typeof v[name] !== 'string' || !(v[name] as string).trim() || (v[name] as string).length > 200) throw new Error(`Invalid ${name}`)
    return (v[name] as string).trim()
  }
  const artist = field('artist'), title = field('title')
  const releaseType = v.releaseType ?? 'single'
  if (!['single', 'ep', 'album'].includes(releaseType as string)) throw new Error('Invalid release type')
  return { artist, title, releaseType }
}
