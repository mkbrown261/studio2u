// Only expires newly collected public YouTube API reports. Artist releases,
// Reviewer reports, Blender assets, imported CSVs and users are never selected.
export async function expireYouTubeReports(env:any,now=new Date().toISOString()){
 let purged=0
 for(let batch=0;batch<10;batch++){
  const rows=(await env.DB.prepare("SELECT id,object_key FROM lw_research_reports WHERE source='youtube' AND expires_at<=? ORDER BY expires_at LIMIT 100").bind(now).all()).results
  if(!rows.length)break
  for(const row of rows){if(!row.object_key.startsWith('label-world/youtube/'))throw new Error('Unexpected research key');await env.R2.delete(row.object_key);await env.DB.prepare("DELETE FROM lw_research_reports WHERE id=? AND source='youtube' AND expires_at<=?").bind(row.id,now).run();purged++}
 }
 return {purged}
}
export default {async scheduled(_event:any,env:any){const result=await expireYouTubeReports(env);console.log(JSON.stringify({operation:'youtube-retention',...result}))}}
