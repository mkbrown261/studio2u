// Future personalization/achievement contracts. No persistence or awards executor enabled.
export type LabelRoomAppearance={labelId:string;revision:number;paletteVersion:string;cabinet_color:string|null;trim_finish:string|null;wall_material:string|null}
export const appearanceRegions={cabinet_front:['Lobby • reception stone front','Lobby • reception return'],cabinet_trim:['Lobby • shelf brass upright'],walls:['Lobby • east wall','Lobby • studio partition left']} as const
export type AchievementDefinition={id:string;metric:'verified_plays';threshold:number;platform:string;interval:string;labelOwnedReleaseRequired:true;officialCertification:false}
export type VerifiedMilestone={id:string;labelId:string;releaseId:string;definitionId:string;source:string;observedAt:string;verifiedAt:string;verifiedBy:string;evidenceAssetId:string;metricValue:number;revision:number;status:'VERIFIED'|'REVOKED'}
export const achievementRuntime='DESIGNED_ONLY' as const
