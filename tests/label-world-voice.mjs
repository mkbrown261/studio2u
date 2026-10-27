// Voice: feature-detected (hidden when unsupported), per-employee voices, transcript only.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const calls = []
globalThis.window = {}; Object.defineProperty(globalThis, 'navigator', { value: { language: 'en-US' }, configurable: true })
const v = await import('../src/client/label-world/voice.ts')
assert.equal(v.speechInputSupported(), false); assert.equal(v.speechOutputSupported(), false)
v.speak('executive', 'hello') // no-op without speechSynthesis
class Utt { constructor(t) { this.text = t } }
const voices = [{ name: 'Samantha', lang: 'en-US' }, { name: 'Daniel', lang: 'en-GB' }, { name: 'Google français', lang: 'fr-FR' }]
globalThis.SpeechSynthesisUtterance = Utt
globalThis.speechSynthesis = { getVoices: () => voices, cancel: () => calls.push('cancel'), speak: u => calls.push(u) }
window.speechSynthesis = speechSynthesis
v.speak('executive', '**Release** ready: https://example.com/x')
const u = calls.find(c => c.text); assert.equal(u.voice.name, 'Daniel'); assert.ok(u.pitch < 1); assert.ok(!u.text.includes('http') && !u.text.includes('*'))
calls.length = 0; v.speak('researcher', 'hi'); assert.equal(calls.find(c => c.text).voice.name, 'Samantha')
const ui = readFileSync('src/client/label-world/ui.tsx', 'utf8')
assert.ok(/canMic&&<button/.test(ui) && /canSpeak&&<label/.test(ui), 'controls render only when supported')
assert.ok(/requestSubmit/.test(ui), 'final transcript is sent through the normal message route')
console.log('PASS voice: feature detection, per-employee voice selection, markdown/link stripping before speech, controls hidden when unsupported, transcript sent via existing authenticated message route')
