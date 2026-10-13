import type {AgentId} from './registry'
export type Interaction={id:string;kind:'door'|'agent'|'station';position:readonly[number,number];distance:number;room:'lobby'|'studio'|'conference'|null;agent?:AgentId;door?:'studio'|'conference';prompt:string;objects:string[]}
export const interactables:Interaction[]=[
 {id:'door.studio',kind:'door',position:[2.25,3.5],distance:1.9,room:null,door:'studio',prompt:'studio door',objects:['STUDIO door']},
 {id:'door.conference',kind:'door',position:[-4,5.25],distance:1.9,room:null,door:'conference',prompt:'conference door',objects:['CONFERENCE door']},
 {id:'agent.researcher.carla',kind:'agent',position:[-2.7,1.5],distance:2.1,room:'studio',agent:'researcher',prompt:'Talk to Carla · Researcher',objects:['carla']},
 {id:'agent.reviewer.eric',kind:'agent',position:[2.7,1.5],distance:2.1,room:'studio',agent:'reviewer',prompt:'Talk to Eric · Reviewer',objects:['eric']},
 {id:'station.builder',kind:'station',position:[0,.25],distance:2.1,room:'studio',agent:'builder',prompt:'Open Builder / Producer workspace',objects:['Production console']},
 {id:'station.executive',kind:'station',position:[-7,5.6],distance:2.1,room:'conference',agent:'executive',prompt:'Open Executive workspace',objects:['Conference • long walnut table']}
]
export function currentRoom(x:number,z:number){return x<-4?'conference':z>3.5?'lobby':'studio'}
export function inReach(target:Interaction,x:number,z:number){return (!target.room||currentRoom(x,z)===target.room)&&Math.hypot(target.position[0]-x,target.position[1]-z)<=target.distance}
export function focusedTarget(x:number,z:number,forwardX:number,forwardZ:number):Interaction|null{
 let best:Interaction|null=null,score=Infinity
 for(const t of interactables){if(!inReach(t,x,z))continue;const dx=t.position[0]-x,dz=t.position[1]-z,d=Math.hypot(dx,dz);const dot=d<.15?1:(dx*forwardX+dz*forwardZ)/d;if(dot<.45)continue;const candidate=d+(1-dot)*2;if(candidate<score){score=candidate;best=t}}
 return best
}
