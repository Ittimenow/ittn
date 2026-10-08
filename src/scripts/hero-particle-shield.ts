const hash=(n:number)=>{const x=Math.sin(n*127.1+41.7)*43758.5453;return x-Math.floor(x);};
export const SHIELD_RADIUS=.865;
export const SHIELD_STREAMS=18;
const FRAGMENTS=6;
export interface ShieldImpact {x:number;y:number;z:number;age:number;}
/** Bounded, deterministic attack streams. Every fragment travels outside the shell. */
export class ShieldMotion {
  readonly positions=new Float32Array(SHIELD_STREAMS*(FRAGMENTS+1)*3);
  readonly alphas=new Float32Array(SHIELD_STREAMS*(FRAGMENTS+1));
  readonly sizes=new Float32Array(SHIELD_STREAMS*(FRAGMENTS+1));
  readonly impacts:ShieldImpact[]=[];
  private time=0;
  private streams=Array.from({length:SHIELD_STREAMS},(_,i)=>{
    const z=hash(i+7)*1.8-.9,a=i*2.399963,r=Math.sqrt(1-z*z);
    return {x:r*Math.cos(a),y:r*Math.sin(a),z,offset:hash(i+88)*5,period:4.4+hash(i+39)*1.4,lastCycle:-1};
  });
  reset(){this.time=0;this.impacts.length=0;this.streams.forEach(s=>s.lastCycle=-1);this.advance(0);}
  advance(dt:number) {
    this.time+=Math.max(0,Math.min(dt,.075));
    for(const impact of this.impacts)impact.age+=dt;
    while(this.impacts.length&&this.impacts[0].age>1.1)this.impacts.shift();
    this.alphas.fill(0);
    for(let i=0;i<this.streams.length;i++) {
      const s=this.streams[i],clock=this.time+s.offset,cycle=Math.floor(clock/s.period),age=clock%s.period;
      const travel=2.05,burst=.72,base=i*(FRAGMENTS+1);
      if(age<travel) {
        const t=age/travel,radius=SHIELD_RADIUS+(1.65-SHIELD_RADIUS)*(1-t);
        this.put(base,s.x*radius,s.y*radius,s.z*radius,Math.min(1,t*5)*.85,1.15);
      } else if(age<travel+burst) {
        const t=(age-travel)/burst;
        if(s.lastCycle!==cycle){s.lastCycle=cycle;this.impacts.push({x:s.x,y:s.y,z:s.z,age:age-travel});if(this.impacts.length>8)this.impacts.shift();}
        // An orthonormal tangent frame plus outward velocity prevents penetration.
        const length=Math.hypot(s.x,s.y),ux=-s.y/length,uy=s.x/length;
        const vx=-s.z*uy,vy=s.z*ux,vz=length;
        for(let j=0;j<FRAGMENTS;j++) {
          const a=j*Math.PI*2/FRAGMENTS+hash(i+cycle*7)*3;
          const lateral=(.16+hash(i*13+j)*.16)*t;
          const outward=SHIELD_RADIUS+.025+.18*t;
          this.put(base+j+1,s.x*outward+(ux*Math.cos(a)+vx*Math.sin(a))*lateral,s.y*outward+(uy*Math.cos(a)+vy*Math.sin(a))*lateral,s.z*outward+vz*Math.sin(a)*lateral,Math.pow(1-t,1.6)*.8,.62-.27*t);
        }
      }
    }
  }
  private put(i:number,x:number,y:number,z:number,alpha:number,size:number){this.positions.set([x,y,z],i*3);this.alphas[i]=alpha;this.sizes[i]=size;}
}
