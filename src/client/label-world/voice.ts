// Voice for Label World employees, using only built-in browser speech APIs:
//   - Speech-to-text: Web Speech API (Chrome, Edge, Safari 14.1+). Audio is processed by
//     the browser vendor's speech service; nothing is sent to Studio2U except the final text.
//   - Text-to-speech: speechSynthesis with a distinct, stable voice per employee.
// No API keys or extra billing. Unsupported browsers simply hide the controls.
import type { AgentId } from './registry'

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number; start(): void; stop(): void; abort(): void; onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null }

export function speechInputSupported() {
  return typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
}
export function speechOutputSupported() { return typeof window !== 'undefined' && 'speechSynthesis' in window }

/** Start listening. Calls onText with interim + final transcript; resolves with final text. */
export function listen(onText: (text: string, final: boolean) => void): { stop: () => void; done: Promise<string> } {
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  const rec: Recognition = new Ctor()
  rec.lang = navigator.language || 'en-US'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1
  let finalText = ''
  const done = new Promise<string>((resolve, reject) => {
    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += t; else interim += t
      }
      onText((finalText + interim).trim(), false)
    }
    rec.onerror = (e: any) => reject(new Error(e.error === 'not-allowed' ? 'Microphone permission was denied. Allow mic access in your browser to talk to your team.' : e.error === 'no-speech' ? 'Didn\'t catch that. Tap the mic and try again.' : 'Voice input stopped: ' + e.error))
    rec.onend = () => { onText(finalText.trim(), true); resolve(finalText.trim()) }
  })
  rec.start()
  return { stop: () => rec.stop(), done }
}

// Distinct personalities: pitch/rate plus a preferred voice gender where available.
const persona: Record<AgentId, { pitch: number; rate: number; prefer: RegExp }> = {
  executive: { pitch: 0.85, rate: 0.98, prefer: /(daniel|alex|guy|david|male|aaron|arthur|google uk english male)/i },
  researcher: { pitch: 1.1, rate: 1.04, prefer: /(samantha|ava|allison|jenny|aria|female|google us english|karen|moira)/i },
  reviewer: { pitch: 1.0, rate: 1.0, prefer: /(tom|fred|ryan|male|google uk english male|oliver)/i },
  builder: { pitch: 0.95, rate: 1.08, prefer: /(nathan|evan|male|google us english|matthew)/i },
  partner: { pitch: 0.9, rate: 1.02, prefer: /(aaron|reed|male|google us english|matthew|guy)/i }
}
function pickVoice(agent: AgentId) {
  const voices = speechSynthesis.getVoices().filter(v => v.lang?.toLowerCase().startsWith((navigator.language || 'en').slice(0, 2).toLowerCase()))
  return voices.find(v => persona[agent].prefer.test(v.name)) || voices[0] || null
}
/** Speak text in the employee's voice. Long replies are trimmed to keep it conversational. */
export function speak(agent: AgentId, text: string) {
  if (!speechOutputSupported() || !text) return
  speechSynthesis.cancel()
  const clean = text.replace(/[*_#`>]/g, '').replace(/https?:\/\/\S+/g, 'the link').slice(0, 900)
  const u = new SpeechSynthesisUtterance(clean)
  const v = pickVoice(agent); if (v) u.voice = v
  u.pitch = persona[agent].pitch; u.rate = persona[agent].rate
  speechSynthesis.speak(u)
}
export function stopSpeaking() { if (speechOutputSupported()) speechSynthesis.cancel() }
