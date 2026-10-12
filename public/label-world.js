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
}
async function showWorkflow(id) {
  const scope=labelId;selectedRelease={id}
  const result=await api('/labels/'+encodeURIComponent(scope)+'/releases/'+encodeURIComponent(id)+'/workflow')
  if(scope!==labelId||selectedRelease?.id!==id)return
  selectedRelease={id,version:result.release.version}
  document.getElementById('lw-workflow-summary').textContent=`${result.release.title} · Rights: ${result.rights.status} · Delivery readiness: ${result.readiness.status}. External submission unavailable.`
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
