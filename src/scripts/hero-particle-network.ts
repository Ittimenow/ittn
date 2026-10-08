/** Shared layout in model space: hub, cloud, database, window, sphere, module. */
export const NETWORK_NODES = [
  [0,0,0],[-.68,.61,.08],[.65,.60,-.16],[.77,-.20,.18],[-.02,-.80,.12],[-.78,-.29,-.15],
] as const;
export const NETWORK_EDGES = [[0,1],[0,2],[0,3],[0,4],[0,5],[1,2],[3,4],[4,5]] as const;
export const NETWORK_STEPS=32;
export const NETWORK_BURST_DURATION=.72;
const STRIDE=NETWORK_STEPS+3+6;
const smooth=(x:number)=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export type NetworkPoint=[number,number,number];
export type NetworkProject=(point:NetworkPoint)=>{x:number;y:number};
export interface NetworkLink { age:number; cut:number; held:boolean; broken:boolean; }
export class NetworkMotion {
  readonly positions=new Float32Array(NETWORK_EDGES.length*STRIDE*3);
  readonly colors=new Float32Array(NETWORK_EDGES.length*STRIDE*3);
  readonly alphas=new Float32Array(NETWORK_EDGES.length*STRIDE);
  readonly sizes=new Float32Array(NETWORK_EDGES.length*STRIDE);
  readonly links:NetworkLink[]=NETWORK_EDGES.map(()=>({age:0,cut:.5,held:false,broken:false}));
  private time=0;
  private last?:{x:number;y:number};
  reset(){this.time=0;this.last=undefined;for(const link of this.links)Object.assign(link,{age:0,cut:.5,held:false,broken:false});this.advance(0);}
  point(edge:number,t:number):NetworkPoint {
    const [a,b]=NETWORK_EDGES[edge],start=NETWORK_NODES[a],end=NETWORK_NODES[b];
    // Curved strands reveal depth while remaining anchored inside each solid.
    return [start[0]+(end[0]-start[0])*t,start[1]+(end[1]-start[1])*t,
      start[2]+(end[2]-start[2])*t+Math.sin(t*Math.PI)*(edge<5?.045:.13)];
  }
  /** Screen-space segment distance also catches a fast swipe between events. */
  pointer(x:number,y:number,project:NetworkProject) {
    const last=this.last||{x,y},dx=x-last.x,dy=y-last.y,length=dx*dx+dy*dy;
    for(let edge=0;edge<this.links.length;edge++) {
      const link=this.links[edge];link.held=false;
      let closest=Infinity,cut=.5,hover=false;
      for(let j=6;j<NETWORK_STEPS-5;j++) {
        const t=j/(NETWORK_STEPS-1),p=project(this.point(edge,t));
        const u=length?Math.max(0,Math.min(1,((p.x-last.x)*dx+(p.y-last.y)*dy)/length)):0;
        const distance=Math.hypot(p.x-last.x-u*dx,p.y-last.y-u*dy);
        if(distance<closest){closest=distance;cut=t;}
        if(Math.hypot(p.x-x,p.y-y)<.085)hover=true;
      }
      link.held=hover;
      if(closest<.06&&!link.broken){link.broken=true;link.age=0;link.cut=cut;}
    }
    this.last={x,y};
  }
  leave(){this.last=undefined;for(const link of this.links)link.held=false;}
  pulse(){const index=this.links.findIndex(link=>!link.broken);if(index>=0){Object.assign(this.links[index],{broken:true,age:0,cut:.55});}}
  advance(dt:number) {
    this.time+=Math.max(0,dt);this.alphas.fill(0);
    const write=(i:number,p:NetworkPoint,alpha:number,size:number,tone:'strand'|'packet'|'spark'='strand')=>{
      this.positions.set(p,i*3);this.alphas[i]=alpha;this.sizes[i]=size;
      this.colors.set(tone==='spark'?[.79,.43,.42]:tone==='packet'?[.51,.65,.84]:[.69,.74,.81],i*3);
    };
    for(let edge=0;edge<this.links.length;edge++) {
      const link=this.links[edge],base=edge*STRIDE;
      if(link.broken){link.age+=dt;if(link.held&&link.age>.85)link.age=.85;if(link.age>=2.15)link.broken=false;}
      const gap=link.broken?.30*smooth(link.age/.18)*(1-smooth((link.age-1.05)/1.1)):0;
      for(let j=0;j<NETWORK_STEPS;j++) {
        const t=j/(NETWORK_STEPS-1),p=this.point(edge,t),distance=Math.abs(t-link.cut);
        const alpha=link.broken?smooth((distance-gap)/.035):1;
        p[2]+=Math.sin(j*2.4+edge)*.006;
        write(base+j,p,alpha*.58,.44);
      }
      // Short, spaced packets; each strand has its own phase and direction.
      const phase=(this.time*.22+edge*.31)%1;
      for(let j=0;j<3;j++) {
        const t=phase-j*.035;
        if(t<.12||t>.90||link.broken)continue;
        write(base+NETWORK_STEPS+j,this.point(edge,edge%2?t:1-t),1-j*.18,.85-j*.10,'packet');
      }
      if(link.broken&&link.age<NETWORK_BURST_DURATION) {
        const progress=link.age/NETWORK_BURST_DURATION,origin=this.point(edge,link.cut);
        for(let j=0;j<6;j++) {
          const angle=j*Math.PI/3+edge,spread=(.19+(j%3)*.035)*progress;
          write(base+NETWORK_STEPS+3+j,[origin[0]+Math.cos(angle)*spread,origin[1]+Math.sin(angle)*spread,origin[2]+Math.sin(angle+1.1)*spread*.65],Math.pow(1-progress,1.6)*.8,.62-.27*progress,'spark');
        }
      }
    }
  }
}
