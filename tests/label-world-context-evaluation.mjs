import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {writeFileSync} from 'node:fs'
import {fixture} from './label-world-api-fixture.mjs'
const {loadContext}=await import('../src/label-world/context/loader.ts')
const {currentReview}=await import('../src/label-world/reviewer/current.ts')
const baselineSha='737e860e95e851a152ef5344d3d06e238a630678'
const baseline=execFileSync('git',['show',baselineSha+':src/label-world/workspace-services.ts'],{encoding:'utf8'})
const section=baseline.slice(baseline.indexOf('   const records='),baseline.indexOf('   const provider=providerId'))
const oldAssembly=new (Object.getPrototypeOf(async function(){}).constructor)('c','label','user','release','releaseId','agent','history','currentReview',section.replaceAll(':any','')+'\nreturn prompt.slice(0,24000)')
const f=fixture(),label='evaluation-label';f.sqlite.prepare("INSERT INTO lw_labels(id,name) VALUES (?,'Synthetic context evaluation')").run(label);f.sqlite.prepare("INSERT INTO lw_memberships VALUES (?,1,'owner')").run(label)
for(let i=0;i<12;i++)f.sqlite.prepare("INSERT INTO lw_research_records(id,label_id,kind,title,content,created_by) VALUES (?,?,'notes',?, ?,1)").run('evaluation-note-'+i,label,'Synthetic unrelated research '+i,'Recorded synthetic scene note. '.repeat(40))
const history=[{role:'user',content:'Explain the available evidence.'}],c={env:f.env}
const cases=[]
for(const employee of ['reviewer','researcher','executive','builder']){
 const times={baseline:[],routed:[]};let before,after
 for(let i=0;i<10;i++){
  let t=performance.now();before=await oldAssembly(c,label,1,null,null,employee,async()=>history,currentReview);times.baseline.push(performance.now()-t)
  t=performance.now();after=await loadContext(f.db,{userId:1,labelId:label,employeeId:employee,operation:'explain'},history);times.routed.push(performance.now()-t)
 }
 const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]
 cases.push({employee,baselineChars:before.length,routedChars:after.trace.chars,baselineApproxTokens:Math.ceil(before.length/4),routedApproxTokens:after.trace.approxTokens,baselineMedianAssemblyMs:median(times.baseline),routedMedianAssemblyMs:median(times.routed),baselineContainsUnrelatedResearch:employee!=='researcher'&&before.includes('Synthetic unrelated research'),routedContainsUnrelatedResearch:employee!=='researcher'&&after.prompt.includes('Synthetic unrelated research'),routedInstructionHashes:after.trace.sources.length,mandatoryPoliciesPresent:after.instructions.includes('server-enforced human authorization')})
 assert.ok(after.trace.chars<=24000);assert.ok(!after.instructions.includes('Synthetic unrelated research'));if(employee!=='researcher')assert.ok(!after.prompt.includes('Synthetic unrelated research'))
}
const result={baselineSha,dataset:'12 synthetic saved research notes, no releases; 4 employees; 10 local D1-interface fixture assemblies per employee',measurement:'Characters and ceil(chars/4) estimates, not provider tokenization. SQLite local assembly latency only; no LLM call.',cases,liveModelAccuracy:'NOT_TESTED',providerLatency:'NOT_TESTED',providerCost:'NOT_MEASURED; no paid calls',observedImprovements:['Deterministic employee/skill routing','Unrelated research excluded from other roles','Mandatory policies never silently truncated','Versioned instruction hashes and user-scoped metadata traces'],limitations:['Does not prove generated explanations are accurate','Small sparse requests can require more instruction tokens','Live comparison requires explicitly connected model','No complete autonomous skills or business execution added']}
writeFileSync('docs/evidence/context-comparison-local.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result,null,2));f.sqlite.close()
