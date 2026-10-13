// Coordinates match the existing exported floor plan: Blender (x,y,z) -> glTF (x,z,-y).
export type DoorState={studio:boolean;conference:boolean}
export function walkable(x:number,z:number,doors:DoorState):boolean{
 const r=.22
 const studio=x>-4+r&&x<4-r&&z>-3.5+r&&z<3.5-r
 const lobby=x>-4+r&&x<4-r&&z>3.5+r&&z<11.5-r
 const conference=x>-10+r&&x<-4-r&&z>4+r&&z<11-r
 const studioThreshold=doors.studio&&Math.abs(x-2.25)<.42&&z>3.2&&z<3.8
 const conferenceThreshold=doors.conference&&x>-4.35&&x<-3.65&&z>4.84&&z<5.66
 return studio||lobby||conference||studioThreshold||conferenceThreshold
}

export type Blocker={minX:number;maxX:number;minZ:number;maxZ:number}
export const eyeHeight=1.7
export function canOccupy(x:number,z:number,doors:DoorState,blockers:readonly Blocker[]):boolean{
 if(!walkable(x,z,doors))return false
 const r=.22
 // Open leaves remain solid at the hinge side of each doorway.
 if(doors.studio&&Math.abs(x-1.625)<r+.065&&z>3.5-r&&z<4.75+r)return false
 if(doors.conference&&Math.abs(z-5.875)<r+.065&&x>-4-r&&x<-2.75+r)return false
 return !blockers.some(b=>x>b.minX-r&&x<b.maxX+r&&z>b.minZ-r&&z<b.maxZ+r)
}
export function moveWithCollisions(x:number,z:number,dx:number,dz:number,doors:DoorState,blockers:readonly Blocker[]):[number,number]{
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));const sx=dx/steps,sz=dz/steps
 for(let i=0;i<steps;i++){if(canOccupy(x+sx,z,doors,blockers))x+=sx;if(canOccupy(x,z+sz,doors,blockers))z+=sz}
 return [x,z]
}
