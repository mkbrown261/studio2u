// glTF's embedded textures use browser-created blob URLs. Only the scene app
// receives this policy; the original site's security headers remain unchanged.
export const sceneContentSecurityPolicy="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
export function isScenePage(path:string){return path==='/label-world'||path==='/label-world/money'||path==='/label-world/inbox'||/^\/label-world\/agents\/(researcher|reviewer|executive|builder|partner)$/.test(path)}
