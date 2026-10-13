import type {AgentId} from './registry'
export type AnimationState='IDLE'|'GREETING'|'INTERACTING'|'WORKING'|'WALKING'|'CELEBRATING'
// Names come from independently reloaded GLBs, not assumed future capabilities.
export const animationCapabilities={
 researcher:{sourceAction:'Carla_Relaxed_Idle_v3.002',clips:{IDLE:'Animation'},staticFallback:false},
 reviewer:{sourceAction:'Eric_Stable_Scroll_Final.001',clips:{WORKING:'Animation'},staticFallback:true}
} as const
export function availableAnimation(agent:AgentId,state:AnimationState,available:readonly string[]){
 const entry=animationCapabilities[agent as keyof typeof animationCapabilities];if(!entry)return {clip:null,paused:true,missing:true}
 const exact=(entry.clips as Partial<Record<AnimationState,string>>)[state];const fallback=(entry.clips as Partial<Record<AnimationState,string>>).IDLE||'Animation';const clip=available.includes(exact||fallback)?exact||fallback:null
 return {clip,paused:entry.staticFallback&&!exact,missing:!exact||!clip}
}
