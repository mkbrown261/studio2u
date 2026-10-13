export type AgentId='researcher'|'reviewer'|'executive'|'builder'
export const employees:Record<AgentId,{name:string;role:string;model:string|null;responsibilities:string[];runtime:string}>={
 researcher:{name:'Carla',role:'Researcher / A&R',model:'/label-world/assets/carla.glb',responsibilities:['Source music intelligence','Track artists and opportunities','Record evidence and uncertainty'],runtime:'Skills not yet executable'},
 reviewer:{name:'Eric',role:'Reviewer',model:'/label-world/assets/eric.glb',responsibilities:['Review audio, artwork and metadata','Check release rights evidence','Report blockers and packaging readiness'],runtime:'Skills not yet executable'},
 executive:{name:'Executive',role:'Label command center',model:null,responsibilities:['Set priorities','Delegate work','Review approvals and real outcomes'],runtime:'Skills not yet executable; physical model pending'},
 builder:{name:'Builder',role:'Producer / Builder',model:null,responsibilities:['Maintain briefs, lyrics and credits','Organize song assets','Prepare release packages'],runtime:'Skills not yet executable; physical model pending'}
}
export const rooms={
 lobby:{label:'Main lobby',url:'/label-world/assets/lobby.glb',camera:[2.8,1.7,10.3],target:[-1.9,1.6,6.8]},
 studio:{label:'Recording studio',url:'/label-world/assets/studio.glb',camera:[0,1.8,2.7],target:[0,1.3,-1.2]},
 conference:{label:'Conference room',url:'/label-world/assets/conference.glb',camera:[-4.6,1.7,5.25],target:[-7,1.7,7.7]}
} as const
