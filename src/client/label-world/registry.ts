export type AgentId='researcher'|'reviewer'|'executive'|'builder'|'partner'
// Character slots. Drop a GLB at `model` (and a PNG at `portrait`) and the character
// appears in the 3D headquarters automatically; a missing file never breaks the scene.
// `placement` positions characters whose GLB root has no world transform (Carla/Eric
// are already placed inside their exported files, so theirs are null).
export type Placement={position:[number,number,number];rotationY:number;scale?:number}
export const employees:Record<AgentId,{name:string;role:string;model:string|null;portrait:string;placement:Placement|null;responsibilities:string[];runtime:string}>={
 researcher:{name:'Carla',role:'Researcher / A&R',model:'/label-world/assets/carla.glb',portrait:'/label-world/assets/carla-portrait.png',placement:null,responsibilities:['Source music intelligence','Track artists and opportunities','Record evidence and uncertainty'],runtime:'Works your label queue'},
 reviewer:{name:'Eric',role:'Reviewer',model:'/label-world/assets/eric.glb',portrait:'/label-world/assets/eric-portrait.png',placement:null,responsibilities:['Review audio, artwork and metadata','Check release rights evidence','Report blockers and packaging readiness'],runtime:'Works your label queue'},
 executive:{name:'Executive',role:'Label command center',model:'/label-world/assets/executive.glb',portrait:'/label-world/assets/executive-portrait.png',placement:{position:[-7,0,10.55],rotationY:Math.PI,scale:1.28},responsibilities:['Set priorities','Delegate work','Review approvals and real outcomes'],runtime:'Works your label queue'},
 builder:{name:'Builder',role:'Producer / Builder',model:'/label-world/assets/builder.glb',portrait:'/label-world/assets/builder-portrait.png',placement:{position:[0,0,-.55],rotationY:0},responsibilities:['Maintain briefs, lyrics and credits','Organize song assets','Prepare release packages'],runtime:'Works your label queue'},
 partner:{name:'Ben',role:'Business Partner',model:null,portrait:'/label-world/assets/partner-portrait.png',placement:null,responsibilities:['Weekly post plan you approve once','Posts approved posts while autopilot is on','Merch drops, orders, Amazon Merch on Demand, shows and QR tickets','Daily money check-in'],runtime:'Approve once, then he runs it'}
}
export const rooms={
 lobby:{label:'Main lobby',url:'/label-world/assets/lobby.glb',camera:[2.8,1.7,10.3],target:[-1.9,1.6,6.8]},
 studio:{label:'Recording studio',url:'/label-world/assets/studio.glb',camera:[0,1.8,2.7],target:[0,1.3,-1.2]},
 conference:{label:'Conference room',url:'/label-world/assets/conference.glb',camera:[-4.6,1.7,5.25],target:[-7,1.7,7.7]}
} as const
