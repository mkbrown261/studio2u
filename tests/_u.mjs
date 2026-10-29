import './label-world-api-fixture.mjs'
const u = await import('../src/label-world/autonomy/understand.ts')
const r = await u.understand('My song 22 was on Baddies, the episode where they went to Hawaii. I never got paid and nobody asked me. It was playing in the background at the party. I wrote it myself.', { titles: ['22', 'Crash and Burn'], me: { name: 'Mason Brown', pro: 'ASCAP' } })
console.log(JSON.stringify(r, null, 1)); console.log(u.sayUnderstood(r, { title: 'x', deadline: '2027-01-31', deadlineNote: null }))
