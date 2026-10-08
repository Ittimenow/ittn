export const CLOUD_STREAMS=8;
export const CLOUD_GROUP_SIZE=7;
const hash=(n:number)=>{const x=Math.sin(n*127.1+41.7)*43758.5453;return x-Math.floor(x);};
const smooth=(n:number)=>{n=Math.max(0,Math.min(1,n));return n*n*(3-2*n);};
export interface CloudArrival {x:number;y:number;z:number;age:number;}
/** Eight independent lanes share a bounded pixel pool and the cloud's surface. */
export class CloudMotion {
  readonly positions=new Float32Array(CLOUD_STREAMS*CLOUD_GROUP_SIZE*3);
  readonly colors=new Float32Array(CLOUD_STREAMS*CLOUD_GROUP_SIZE*3);
  readonly sizes=new Float32Array(CLOUD_STREAMS*CLOUD_GROUP_SIZE);
  readonly alphas=new Float32Array(CLOUD_STREAMS*CLOUD_GROUP_SIZE);
  readonly arrivals:CloudArrival[]=[];
  private time=0;
  private lanes;
  constructor(distance:(x:number,y:number,z:number)=>number){
    this.lanes=Array.from({length:CLOUD_STREAMS},(_,i)=>{
      const z=-.70+hash(i+17)*1.4,angle=i*2.39996323,r=Math.sqrt(1-z*z),x=Math.cos(angle)*r,y=Math.sin(angle)*r;
      let low=0,high=1.2;
      for(let step=0;step<18;step++){const mid=(low+high)/2;if(distance(x*mid,.12+y*mid,z*mid)>0)low=mid;else high=mid;}
      return {x,y,z,surface:(low+high)/2,period:5.6+hash(i+31)*1.0,lastCycle:-1};
    });
    this.reset();
  }
  reset(){this.positions.fill(0);this.colors.fill(0);this.sizes.fill(0);this.time=0;this.arrivals.length=0;this.lanes.forEach(s=>s.lastCycle=-1);this.advance(0);}
  advance(dt:number){
    this.time+=Math.max(0,dt);this.alphas.fill(0);
    for(const a of this.arrivals)a.age+=dt;
    while(this.arrivals.length&&this.arrivals[0].age>1.1)this.arrivals.shift();
    for(let i=0;i<CLOUD_STREAMS;i++){
      const lane=this.lanes[i],clock=this.time+i*.73,cycle=Math.floor(clock/lane.period),age=clock%lane.period,travel=4.6;
      if(age>=travel)continue;
      const t=age/travel,incoming=i%2===0,progress=incoming?1-Math.pow(1-t,1.25):Math.pow(t,1.6);
      const inner=lane.surface-.085,outer=1.55;
      const radius=incoming?outer+(inner-outer)*progress:inner+(outer-inner)*progress;
      const curve=Math.sin(t*Math.PI)*.14;
      const x=lane.x*radius-lane.y*curve,y=.12+lane.y*radius+lane.x*curve,z=lane.z*radius+Math.sin(t*Math.PI)*.08;
      const count=(i+cycle)%3===0?1:3+Math.floor(hash(i+cycle*19)*5);
      for(let j=0;j<count;j++){
        const index=i*CLOUD_GROUP_SIZE+j,spread=j===0?0:.027+hash(j+i*11)*.025,angle=j*2.399963+i;
        this.positions.set([x+Math.cos(angle)*spread,y+Math.sin(angle)*spread,z+(hash(j+61)-.5)*spread],index*3);
        this.alphas[index]=.82*smooth(t/.12)*smooth((1-t)/.10);
        this.sizes[index]=.72+hash(i*13+j)*.30;
        this.colors.set(i%3===0?[.59,.72,.86]:[.69,.75,.82],index*3);
      }
      if(incoming&&t>=.9&&lane.lastCycle!==cycle){
        lane.lastCycle=cycle;
        if(dt>0){this.arrivals.push({x:lane.x*lane.surface,y:.12+lane.y*lane.surface,z:lane.z*lane.surface,age:0});if(this.arrivals.length>8)this.arrivals.shift();}
      }
    }
  }
}
