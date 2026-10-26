const root = document.getElementById('label-world')
const message = document.getElementById('lw-message')
const labels = document.getElementById('lw-labels')
const releases = document.getElementById('lw-releases')
let labelId = ''
let selectedRelease = null
let labelRole = 'viewer'
let editingRelease = null
const rightsCategories = ['master','beat','samples','cover_interpolation','collaborators','ai_sources']
function element(tag, text) { const el=document.createElement(tag); if(text) el.textContent=text; return el }
function selectOptions(name, values) { const select=element('select');select.name=name;for(const value of values){const option=element('option',value.replaceAll('_',' '));option.value=value;select.append(option)}return select }
async function api(path, body) {
  const response = await fetch('/api/label-world' + path, body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {})
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Request failed')
  return result
}
function report(error) { message.textContent = error.message }
async function loadReleases() {
  const scope=labelId
  selectedRelease=null
  document.getElementById('lw-rights-form').hidden=true
  document.getElementById('lw-workflow-summary').textContent='Select a release to review.'
  releases.replaceChildren()
  if (!labelId) return
  const result = await api('/labels/'+encodeURIComponent(scope)+'/releases')
  if(scope!==labelId)return
  for (const release of result.releases) {
    const item = document.createElement('li')
    item.textContent = `${release.title} — ${release.artist} · ${release.release_mode} · ${release.workflow_state} `
    const button=element('button','Review rights');button.addEventListener('click',()=>showWorkflow(release.id).catch(report));item.append(button)
    if(labelRole!=='viewer'){const edit=element('button','Revise intake');edit.addEventListener('click',()=>{
      editingRelease={id:release.id,version:release.version,label:labelId};const form=document.getElementById('lw-release-form')
      for(const [key,value] of Object.entries({artist:release.artist,title:release.title,releaseType:release.release_type,releaseMode:release.release_mode,targetDistributor:release.target_distributor}))form.elements.namedItem(key).value=value
      document.getElementById('lw-release-submit').textContent='Save new revision';document.getElementById('lw-cancel-edit').hidden=false;form.scrollIntoView({block:'center'})
    });item.append(edit)}
    releases.append(item)
  }
  if (!result.releases.length) releases.textContent = 'Create your first release draft below.'
  await loadRegistrations()
  loadQueue().catch(()=>{})
}
async function showWorkflow(id) {
  const scope=labelId;selectedRelease={id};loadSubmissions(id).catch(report)
  const result=await api('/labels/'+encodeURIComponent(scope)+'/releases/'+encodeURIComponent(id)+'/workflow')
  if(scope!==labelId||selectedRelease?.id!==id)return
  selectedRelease={id,version:result.release.version}
  document.getElementById('lw-workflow-summary').textContent=`${result.release.title} · Rights: ${result.rights.status} · Delivery readiness: ${result.readiness.status}. See Submissions below for your filled-in forms.`
  const fields=document.getElementById('lw-rights-fields');fields.replaceChildren()
  for(const category of rightsCategories){
    const row=element('div'),label=element('label',category.replaceAll('_',' ')+' ')
    const status=selectOptions(category,['UNKNOWN','CONFIRMED','NOT_APPLICABLE','DISPUTED','UNLICENSED'])
    if(category==='master')status.querySelector('option[value="NOT_APPLICABLE"]').remove()
    const note=element('input');note.name=category+'_note';note.placeholder='Basis, license reference, or missing information';note.maxLength=2000;note.required=true
    label.append(status);const noteLabel=element('label','Basis for '+category.replaceAll('_',' ')+' ');noteLabel.append(note);row.append(label,noteLabel);fields.append(row)
  }
  const form=document.getElementById('lw-rights-form');form.reset();form.hidden=labelRole!=='owner'||result.rightsReviewRecorded;form.querySelector('button').disabled=false
  if(result.rightsReviewRecorded)document.getElementById('lw-workflow-summary').textContent+=' Owner statement recorded. Use Revise intake to correct it through a new version.'
}
document.getElementById('lw-rights-form').addEventListener('submit',async event=>{
  event.preventDefault();const selected={...selectedRelease},scope=labelId,form=event.currentTarget,button=form.querySelector('button');button.disabled=true
  try{
    const data=new FormData(form);if(!data.get('attest'))throw new Error('Owner confirmation required')
    const assertions={};for(const category of rightsCategories)assertions[category]={status:data.get(category),source:data.get(category)==='UNKNOWN'?'UNKNOWN':'USER_CONFIRMED',note:data.get(category+'_note')}
    const result=await api('/labels/'+encodeURIComponent(scope)+'/releases/'+encodeURIComponent(selected.id)+'/rights',{version:selected.version,assertions})
    if(scope===labelId){message.textContent='Owner statement saved. Rights: '+result.rights.status;await showWorkflow(selected.id)}
  }catch(error){report(error)}finally{button.disabled=false}
})
async function loadRegistrations(){
  const scope=labelId;const list=document.getElementById('lw-registrations');list.replaceChildren();if(!scope)return
  const result=await api('/labels/'+encodeURIComponent(scope)+'/registrations');if(scope!==labelId)return
  for(const task of result.registrations){
    const li=element('li');li.append(element('p',`${task.title} · ${task.organization} · ${task.status} · applicability ${task.applicability}${task.reported_status?' · User reported '+task.reported_status+' (unverified)':''}${task.next_review_at?' · Review '+task.next_review_at:''}`))
    if(task.reason)li.append(element('p','Next action: '+task.reason))
    if(labelRole==='owner'){
      const details=element('details');details.append(element('summary','Update follow-up'));const form=element('form')
      const status=selectOptions('status',['PENDING','PREPARED','AWAITING_APPROVAL','AWAITING_VERIFICATION','BLOCKED','NOT_APPLICABLE']);status.value=task.status
      const applicability=selectOptions('applicability',['UNKNOWN','APPLICABLE','NOT_APPLICABLE']);applicability.value=task.applicability
      const reported=selectOptions('reportedStatus',['','SUBMITTED','CONFIRMED']);reported.value=task.reported_status||''
      const reason=element('input');reason.name='reason';reason.required=true;reason.maxLength=2000;reason.placeholder='Reason / next action';reason.value=task.reason||''
      const receipt=element('input');receipt.name='receiptUrl';receipt.type='url';receipt.placeholder='HTTPS receipt link (unverified)';receipt.value=task.receipt_url||''
      const review=element('input');review.name='nextReviewAt';review.type='date';review.value=task.next_review_at?.slice(0,10)||''
      for(const [title,control] of [['Status',status],['Applicability',applicability],['Reported filing status',reported],['Next action',reason],['Receipt',receipt],['Review date',review]]){const label=element('label',title+' ');label.append(control);form.append(label)}
      const button=element('button','Save follow-up');form.append(button)
      form.addEventListener('submit',async e=>{e.preventDefault();button.disabled=true;try{const data=Object.fromEntries(new FormData(form));data.revision=task.revision;data.reportedStatus=data.reportedStatus||null;await api('/labels/'+encodeURIComponent(scope)+'/registrations/'+encodeURIComponent(task.id),data);if(scope===labelId){message.textContent='Follow-up saved; official filing is not verified.';await loadRegistrations()}}catch(error){report(error)}finally{button.disabled=false}})
      details.append(form);li.append(details)
    }
    list.append(li)
  }
  if(!result.registrations.length)list.textContent='A separate follow-up queue is created with each release.'
}
async function loadLabels(preferred) {
  const result = await api('/labels')
  labels.replaceChildren()
  for (const label of result.labels) {
    const option = document.createElement('option')
    option.value = label.id; option.textContent = label.name; labels.append(option)
  }
  labelId = preferred || result.labels[0]?.id || ''
  labelRole=result.labels.find(l=>l.id===labelId)?.role||'viewer'
  labels.value = labelId
  document.getElementById('lw-release-submit').disabled = !labelId||labelRole==='viewer'
  await loadReleases()
  await loadProviderStatus()
}
function cancelEdit(){editingRelease=null;document.getElementById('lw-release-form').reset();document.getElementById('lw-release-submit').textContent='Create release';document.getElementById('lw-cancel-edit').hidden=true}
document.getElementById('lw-cancel-edit').addEventListener('click',cancelEdit)
labels.addEventListener('change',async()=>{cancelEdit();labelId=labels.value;try{const result=await api('/labels');labelRole=result.labels.find(l=>l.id===labelId)?.role||'viewer';document.getElementById('lw-release-submit').disabled=!labelId||labelRole==='viewer';await loadReleases()}catch(error){report(error)}})
for (const [formId, action] of [
  ['lw-label-form',async data=>{const label=await api('/labels',{name:data.get('name')});await loadLabels(label.id)}],
  ['lw-release-form',async data=>{const input={artist:data.get('artist'),title:data.get('title'),releaseType:data.get('releaseType'),releaseMode:data.get('releaseMode'),targetDistributor:data.get('targetDistributor')};if(editingRelease){if(editingRelease.label!==labelId)throw new Error('Workspace changed; start a new revision');await api('/labels/'+encodeURIComponent(labelId)+'/releases/'+encodeURIComponent(editingRelease.id)+'/intake',{...input,version:editingRelease.version})}else{await api('/labels/'+encodeURIComponent(labelId)+'/releases',input)}cancelEdit();await loadReleases()}]
]) {
  const form=document.getElementById(formId)
  form.addEventListener('submit',async event=>{
    event.preventDefault();message.textContent=''
    const button=form.querySelector('button');button.disabled=true
    try {await action(new FormData(form));form.reset();message.textContent='Saved.'} catch(error){report(error)} finally {button.disabled=false}
  })
}
loadLabels().catch(report)

const providerSelect=document.getElementById('lw-provider'),modelsSelect=document.getElementById('lw-models')
let providerEpoch=0
function providerDisplay(){
  providerEpoch++;modelsSelect.replaceChildren()
  document.getElementById('lw-qwen-config').hidden=providerSelect.value!=='qwen'
  document.getElementById('lw-qwen-model-label').hidden=providerSelect.value!=='qwen'
  document.getElementById('lw-refresh-models').disabled=providerSelect.value==='qwen'
  document.getElementById('lw-provider-connect').elements.apiKey.value=''
  document.getElementById('lw-reasoning-output').textContent=''
}
providerSelect.addEventListener('change',()=>{providerDisplay();loadProviderStatus().catch(report)})
async function loadProviderStatus(){
  const epoch=providerEpoch,result=await api('/providers');if(epoch!==providerEpoch)return
  const selected=result.providers.find(p=>p.id===providerSelect.value)
  document.getElementById('lw-provider-status').textContent=!result.storageConfigured?'Provider key storage needs server setup.':selected?.connection?'API key saved. Refresh models and send a test to verify access.':'No API key connected for this provider.'
  const form=document.getElementById('lw-provider-connect')
  if(selected?.connection){const config=JSON.parse(selected.connection.endpoint_config);form.elements.region.value=config.region||'us';form.elements.workspace.value=config.workspace||''}
  if(labelId){const scope=labelId,settings=await api('/labels/'+encodeURIComponent(scope)+'/reasoning/settings');if(scope!==labelId||epoch!==providerEpoch)return
    if(settings.preference)document.getElementById('lw-provider-status').textContent+=` Saved choice for this label: ${settings.preference.provider} / ${settings.preference.model}.`
  }
}
async function providerAction(form,action){
  const button=form.querySelector('button');button.disabled=true
  try{await action()}catch(error){report(error)}finally{button.disabled=false}
}
document.getElementById('lw-provider-connect').addEventListener('submit',event=>{
  event.preventDefault();const form=event.currentTarget,data=new FormData(form),provider=providerSelect.value
  // Clear the password field before the network call, including failure paths.
  form.elements.apiKey.value=''
  providerAction(form,async()=>{await api('/providers/'+provider+'/connect',{apiKey:data.get('apiKey'),config:{region:data.get('region'),workspace:data.get('workspace')}});modelsSelect.replaceChildren();await loadProviderStatus()})
})
document.getElementById('lw-provider-disconnect').addEventListener('click',async()=>{
  try{await api('/providers/'+providerSelect.value+'/disconnect',{});providerDisplay();await loadProviderStatus()}catch(error){report(error)}
})
document.getElementById('lw-refresh-models').addEventListener('click',async event=>{
  const button=event.currentTarget,epoch=providerEpoch,provider=providerSelect.value;button.disabled=true
  try{
    const result=await api('/providers/'+provider+'/models',{});if(epoch!==providerEpoch)return
    modelsSelect.replaceChildren();for(const model of result.models){const option=element('option',model.name+' · '+model.id);option.value=model.id;modelsSelect.append(option)}
    document.getElementById('lw-provider-status').textContent=result.models.length?'Current provider catalog loaded. Choose a model and save.':'No supported text models returned for this account.'
  }catch(error){report(error)}finally{button.disabled=providerSelect.value==='qwen'}
})
document.getElementById('lw-model-form').addEventListener('submit',event=>{
  event.preventDefault();const form=event.currentTarget,scope=labelId,provider=providerSelect.value,model=provider==='qwen'?form.elements.qwenModel.value.trim():modelsSelect.value
  providerAction(form,async()=>{if(!scope)throw new Error('Select a label first');await api('/labels/'+encodeURIComponent(scope)+'/reasoning/settings',{provider,model});await loadProviderStatus()})
})
document.getElementById('lw-reasoning-test').addEventListener('submit',event=>{
  event.preventDefault();const form=event.currentTarget,scope=labelId,epoch=providerEpoch,prompt=new FormData(form).get('prompt')
  providerAction(form,async()=>{if(!scope)throw new Error('Select a label first');const result=await api('/labels/'+encodeURIComponent(scope)+'/reasoning/test',{prompt});if(scope!==labelId||epoch!==providerEpoch)return;document.getElementById('lw-reasoning-output').textContent=`${result.provider} / ${result.model}\n\n${result.text}`;document.getElementById('lw-provider-status').textContent='Generation succeeded. Employee workflows remain in development.'})
})
labels.addEventListener('change',()=>{document.getElementById('lw-reasoning-output').textContent='';loadProviderStatus().catch(report)})
loadProviderStatus().catch(report)

// ---- Submissions (UnitedMasters / ASCAP / SoundExchange packets) ----
function fieldValue(v){if(v==null)return '';if(Array.isArray(v))return v.map(x=>typeof x==='object'?Object.entries(x).filter(([,y])=>y!=null).map(([k,y])=>k+': '+y).join(', '):x).join('\n');if(typeof v==='object')return JSON.stringify(v);return String(v)}
async function loadSubmissions(id){
  const scope=labelId,box=document.getElementById('lw-submissions');box.replaceChildren(element('p','Loading forms…'))
  const base='/labels/'+encodeURIComponent(scope)+'/releases/'+encodeURIComponent(id)+'/submissions'
  const list=await api(base);if(scope!==labelId||selectedRelease?.id!==id)return;box.replaceChildren()
  for(const sub of list.submissions){
    const packet=(await api(base+'/'+sub.target.toLowerCase())).packet
    const card=element('div');card.className='lw-packet'
    const h=element('h3',{UNITEDMASTERS:'UnitedMasters release',ASCAP:'ASCAP work registration',SOUNDEXCHANGE:'SoundExchange recording claim'}[sub.target]);const pill=element('span',sub.status.replaceAll('_',' '));pill.className='lw-pill '+sub.status;h.append(pill);card.append(h)
    card.append(element('p',packet.applicabilityReason))
    if(packet.missing.length)card.append(element('p',packet.missing.length+' detail(s) still needed. Your agent will ask, or answer below.'))
    for(const w of packet.warnings){const p=element('p','⚠ '+w);p.className='lw-miss';card.append(p)}
    const details=element('details');details.open=sub.status==='READY';details.append(element('summary','Show every field'))
    for(const sec of packet.sections){details.append(element('h4',sec.title));for(const f of sec.fields){const row=element('div');row.className='lw-field';row.append(element('strong',f.label));const val=element('span',f.status==='MISSING'?(f.question||'Missing'):f.status==='HUMAN_ONLY'?f.note:fieldValue(f.value)||'(optional, leave blank)');if(f.status==='MISSING')val.className='lw-miss';if(f.status==='HUMAN_ONLY')val.className='lw-human';row.append(val);if(f.status==='READY'){const b=element('button','Copy');b.type='button';b.addEventListener('click',async()=>{await navigator.clipboard.writeText(fieldValue(f.value));b.textContent='Copied';setTimeout(()=>b.textContent='Copy',1200)});row.append(b)}else row.append(element('span',''));details.append(row)}}
    card.append(details)
    const link=element('a','Open '+packet.officialUrl.replace('https://',''));link.href=packet.officialUrl;link.target='_blank';link.rel='noopener';card.append(link)
    if(['READY','NEEDS_CORRECTION','SUBMITTED_REPORTED'].includes(sub.status)&&labelRole!=='viewer'){
      const form=element('form');const ref=element('input');ref.name='confirmationRef';ref.placeholder='Confirmation # shown after you pressed Submit';ref.maxLength=200;const btn=element('button',sub.status==='SUBMITTED_REPORTED'?'Update confirmation':'I submitted it');form.append(ref,btn)
      form.addEventListener('submit',async e=>{e.preventDefault();btn.disabled=true;try{await api(base+'/report',{target:sub.target,outcome:'SUBMITTED',confirmationRef:ref.value||undefined,evidence:ref.value?undefined:'User confirmed submission on the dashboard'});message.textContent=sub.target+' recorded as submitted. Your label will check back until it is accepted.';await loadSubmissions(id)}catch(err){report(err)}finally{btn.disabled=false}})
      card.append(form)
    }
    if(sub.status==='VERIFIED')card.append(element('p','Verified: '+(packet.verifiedEvidence||'confirmed on provider site')))
    box.append(card)
  }
  if(!list.submissions.length)box.append(element('p','No provider forms apply yet.'))
}
// ---- Agent queue ----
async function loadQueue(){
  const scope=labelId,ul=document.getElementById('lw-queue');if(!ul)return;ul.replaceChildren();if(!scope)return
  const q=await api('/labels/'+encodeURIComponent(scope)+'/queue');if(scope!==labelId)return
  const st=document.getElementById('lw-engine-status');st.textContent=q.engine?'Engine last ran '+new Date(q.engine.lastRun).toLocaleString()+'. It checks every release every 5 minutes, even when your computer is off.':'Your engine will run within 5 minutes.'
  if(!q.open.length)ul.append(element('li','Nothing waiting. Your label is caught up.'))
  for(const t of q.open){const li=element('li',`${t.title} · ${t.status.replaceAll('_',' ').toLowerCase()}${t.capability==='SCREEN_CONTROL'?' · needs screen control (Claude/Codex on your computer)':''}${t.run_after&&new Date(t.run_after)>new Date()?' · next check '+new Date(t.run_after).toLocaleDateString():''}`);ul.append(li)}
}
document.getElementById('lw-run-engine')?.addEventListener('click',async e=>{const b=e.currentTarget;if(!labelId)return;b.disabled=true;try{const r=await api('/labels/'+encodeURIComponent(labelId)+'/engine/run',{});message.textContent='Checked '+r.summary.releases+' release(s); '+r.summary.queued+' new task(s) queued.';await loadQueue();if(selectedRelease)await loadSubmissions(selectedRelease.id)}catch(err){report(err)}finally{b.disabled=false}})
