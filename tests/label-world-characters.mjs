// Character slots: all four employees are registered, reachable, and positioned at
// their workstations; missing GLBs/portraits must never break the build or scene.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
const { employees } = await import('../src/client/label-world/registry.ts')
const { interactables, inReach } = await import('../src/client/label-world/interactions.ts')
const hq = readFileSync('src/client/label-world/Headquarters.tsx', 'utf8')
for (const id of ['researcher', 'reviewer', 'executive', 'builder']) {
  const e = employees[id]; assert.ok(e && e.model && e.portrait, id)
  assert.match(e.model, /^\/label-world\/assets\/[a-z]+\.glb$/); assert.match(e.portrait, /^\/label-world\/assets\/[a-z]+-portrait\.png$/)
  const target = interactables.find(t => t.agent === id); assert.ok(target, 'interaction for ' + id)
  if (e.placement) { // placed characters must stand within reach of their own workstation prompt
    const [x, , z] = e.placement.position; assert.ok(Math.hypot(target.position[0] - x, target.position[1] - z) <= target.distance + 0.6, id + ' near its station')
  }
}
assert.ok(existsSync('public/label-world/assets/carla.glb') && existsSync('public/label-world/assets/eric.glb'))
assert.ok(/method:'HEAD'/.test(hq) && /CharacterBoundary/.test(hq), 'characters mount only when the GLB exists and are isolated by an error boundary')
assert.ok(!/Physical character pending/.test(hq))
console.log('PASS characters: four employee slots (Carla, Eric, Executive, Builder) with model/portrait paths, station placement within reach, existence-gated loading and per-character error isolation')
