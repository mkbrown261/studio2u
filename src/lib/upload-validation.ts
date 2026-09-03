// Validation for user-uploaded files going to R2 (engineer profile/equipment photos).
// Cloudflare Workers has no server-side image-decoding library available, so this is
// deliberately limited to what's cheap and reliable at the edge: MIME type allowlist
// (checked against the browser-reported Content-Type, which is the same signal
// R2.put's httpMetadata.contentType already trusted) and a hard byte-size cap to stop
// oversized uploads from burning R2 storage/egress or Worker CPU time on large
// arrayBuffer() reads.

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB

export interface ImageValidationResult {
  valid: boolean
  error?: string
  extension?: string
}

export function validateImageUpload(file: File): ImageValidationResult {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { valid: false, error: 'Please upload a PNG, JPG, or WEBP image.' }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { valid: false, error: 'Image must be smaller than 5MB.' }
  }
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  return { valid: true, extension }
}
