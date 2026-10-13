export function matchesSnapshot(findings:any[],reviewedVersion:number,releaseVersion:number,assets:any[]){return reviewedVersion===releaseVersion&&['master','artwork'].every(kind=>{const inspected=findings.find(f=>f.check===kind+'.integrity')||findings.find(f=>f.check===kind+'.existence');return Boolean(inspected)&&assets.find(a=>a.kind===kind)?.id===inspected.evidence?.assetId})}
export async function currentReview(db:any,label:string,release:any,user:number){
 const report=await db.prepare("SELECT id,release_version,findings_json,created_at FROM lw_reviews WHERE label_id=? AND release_id=? AND requested_by=? AND status='COMPLETED' ORDER BY created_at DESC,rowid DESC LIMIT 1").bind(label,release.id,user).first()
 if(!report)return {review:null,findings:[],current:false}
 const findings=JSON.parse(report.findings_json),assets=(await db.prepare("SELECT id,kind FROM lw_assets WHERE label_id=? AND release_id=? AND kind IN ('master','artwork') ORDER BY created_at DESC,rowid DESC").bind(label,release.id).all()).results
 const current=matchesSnapshot(findings,report.release_version,release.version,assets)
 return {review:{id:report.id,releaseVersion:report.release_version,createdAt:report.created_at},findings,current}
}
