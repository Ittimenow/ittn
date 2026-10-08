/** A spatial route through a 2×2×2 board; each move belongs to one cube. */
export const HINGE_HALF=.29;
export const HINGE_CUBE_HALF=.276;
export type HingePoint=[number,number,number];
export type HingeMatrix=[HingePoint,HingePoint,HingePoint];
export const HINGE_CENTERS:readonly HingePoint[]=[[-HINGE_HALF,-HINGE_HALF,0],[HINGE_HALF,-HINGE_HALF,0],[HINGE_HALF,HINGE_HALF,0],[-HINGE_HALF,HINGE_HALF,0]];
export const HINGE_CELLS:readonly HingePoint[]=[
  [-HINGE_HALF,HINGE_HALF,0],[HINGE_HALF,HINGE_HALF,0],[-HINGE_HALF,-HINGE_HALF,0],[HINGE_HALF,-HINGE_HALF,0],
  [-HINGE_HALF,HINGE_HALF,-2*HINGE_HALF],[HINGE_HALF,HINGE_HALF,-2*HINGE_HALF],[-HINGE_HALF,-HINGE_HALF,-2*HINGE_HALF],[HINGE_HALF,-HINGE_HALF,-2*HINGE_HALF],
];
// Cell numbers, not cube identities: the next lap continues with its occupants.
export const HINGE_ROUTE:readonly (readonly [number,number])[]=[[1,5],[4,8],[2,1],[3,4],[1,3],[5,7],[3,1],[8,6],[7,3],[4,8],[6,2],[8,4]];
const ease=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
const dot=(a:HingePoint,b:HingePoint)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const subtract=(a:HingePoint,b:HingePoint):HingePoint=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a:HingePoint,b:HingePoint):HingePoint=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const identity=():HingeMatrix=>[[1,0,0],[0,1,0],[0,0,1]];
function rotate(p:HingePoint,axis:number,angle:number):HingePoint {
  const result=[...p] as HingePoint,a=(axis+1)%3,b=(axis+2)%3,c=Math.cos(angle),s=Math.sin(angle);
  result[a]=p[a]*c-p[b]*s;result[b]=p[a]*s+p[b]*c;return result;
}
function turn(p:HingePoint,pivot:HingePoint,axis:number,angle:number):HingePoint {
  const v=rotate(subtract(p,pivot),axis,angle);return [v[0]+pivot[0],v[1]+pivot[1],v[2]+pivot[2]];
}
export function hingeBoxesOverlap(a:HingePoint,axesA:HingeMatrix,b:HingePoint,axesB:HingeMatrix){
  const delta=subtract(b,a),axes=[...axesA,...axesB,...axesA.flatMap(u=>axesB.map(v=>cross(u,v)))];
  return !axes.some(axis=>Math.hypot(...axis)>1e-8&&Math.abs(dot(delta,axis))>=HINGE_CUBE_HALF*(axesA.reduce((s,v)=>s+Math.abs(dot(v,axis)),0)+axesB.reduce((s,v)=>s+Math.abs(dot(v,axis)),0))-1e-7);
}
interface HingeMove {module:number;support:number;axis:number;pivot:HingePoint;angle:number;duration:number;from:number;to:number;}
interface Pose {center:HingePoint;axes:HingeMatrix;}
function findMove(cells:number[],from:number,to:number):HingeMove {
  const module=cells.indexOf(from),source=HINGE_CELLS[from-1],target=HINGE_CELLS[to-1];
  if(module<0||cells.includes(to))throw new Error(`Invalid hinge route ${from} → ${to}`);
  for(const angle of [-Math.PI/2,Math.PI/2,-Math.PI,Math.PI])for(let axis=0;axis<3;axis++)for(const signA of [-1,1])for(const signB of [-1,1]){
    const pivot=[...source] as HingePoint;pivot[(axis+1)%3]+=signA*HINGE_HALF;pivot[(axis+2)%3]+=signB*HINGE_HALF;
    if(Math.hypot(...subtract(turn(source,pivot,axis,angle),target))>1e-7)continue;
    const support=cells.findIndex((cell,i)=>i!==module&&HINGE_CELLS[cell-1].every((n,k)=>Math.abs(Math.abs(n-pivot[k])-(k===axis?0:HINGE_HALF))<1e-7));
    if(support<0)continue;
    let clear=true;
    for(let sample=1;sample<=40&&clear;sample++){
      const a=angle*sample/40,center=turn(source,pivot,axis,a),axes=identity().map(v=>rotate(v,axis,a)) as HingeMatrix;
      for(let i=0;i<4;i++)if(i!==module&&hingeBoxesOverlap(center,axes,HINGE_CELLS[cells[i]-1],identity())){clear=false;break;}
    }
    if(clear)return {module,support,axis,pivot,angle,duration:Math.abs(angle)>2?2.25:1.65,from,to};
  }
  throw new Error(`No collision-free supported hinge ${from} → ${to}`);
}
export class HingeMotion {
  readonly positions=new Float32Array(12*3);
  readonly colors=new Float32Array(12*3);
  readonly alphas=new Float32Array(12);
  readonly sizes=new Float32Array(12).fill(.42);
  private cells=[3,4,2,1];
  private poses:Pose[]=HINGE_CENTERS.map(center=>({center:[...center],axes:identity()}));
  private displayed:Pose[]=this.poses;
  private routeIndex=0;
  private elapsed=0;
  private move!:HingeMove;
  private progress=0;
  constructor(){this.reset();}
  get currentMove(){return {...this.move,progress:this.progress};}
  get occupiedCells(){return [...this.cells];}
  reset(){
    this.cells=[3,4,2,1];this.poses=HINGE_CENTERS.map(center=>({center:[...center],axes:identity()}));
    this.routeIndex=0;this.elapsed=0;this.move=findMove(this.cells,...HINGE_ROUTE[0]);this.advance(0);
  }
  advance(dt:number){
    this.elapsed+=Math.max(0,dt);
    while(this.elapsed>=this.move.duration){
      this.elapsed-=this.move.duration;
      const {module,axis,angle,to}=this.move,pose=this.poses[module];
      this.poses[module]={center:[...HINGE_CELLS[to-1]],axes:pose.axes.map(v=>rotate(v,axis,angle).map(n=>Math.round(n)) as HingePoint) as HingeMatrix};
      this.cells[module]=to;this.routeIndex=(this.routeIndex+1)%HINGE_ROUTE.length;
      this.move=findMove(this.cells,...HINGE_ROUTE[this.routeIndex]);
    }
    this.progress=ease((this.elapsed-.16)/(this.move.duration-.32));
    const {module,pivot,axis,angle}=this.move,pose=this.poses[module];
    this.displayed=this.poses.map((p,i)=>i!==module?p:{center:turn(pose.center,pivot,axis,angle*this.progress),axes:pose.axes.map(v=>rotate(v,axis,angle*this.progress)) as HingeMatrix});
    for(let i=0;i<12;i++){
      const p=[...pivot] as HingePoint;p[axis]+=(i/11-.5)*HINGE_CUBE_HALF*1.8;
      this.positions.set(p,i*3);this.colors.set([.57,.68,.84],i*3);this.alphas[i]=.50*Math.sin(this.progress*Math.PI);
    }
  }
  transform(module:number,x:number,y:number,z:number,normal=false):HingePoint {
    const pose=this.displayed[module],origin=HINGE_CENTERS[module];
    const p=normal?[x,y,z]:[x-origin[0],y-origin[1],z-origin[2]];
    return [0,1,2].map(axis=>pose.axes.reduce((sum,v,i)=>sum+v[axis]*p[i],0)+(normal?0:pose.center[axis])) as HingePoint;
  }
}
