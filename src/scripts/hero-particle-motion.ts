import type { ParticleShape } from './hero-particle-shapes';
import type { ParticleSettings } from './hero-particle-settings';

const hash=(n:number)=>{const x=Math.sin(n*127.1+41.7)*43758.5453;return x-Math.floor(x);};
interface Pixel {
  x:number;y:number;z:number;vx:number;vy:number;vz:number;nx:number;ny:number;nz:number;size:number;alpha:number;tone:number;
  baseX:number;baseY:number;baseZ:number;targetX:number;targetY:number;targetZ:number;
  targetNX:number;targetNY:number;targetNZ:number;targetSize:number;targetTone:number;targetAlpha:number;
  phase:number;glow:number;material:number;restraint:number;
}
/** A coherent surface with independent, continuous three-dimensional drift. */
export class VolumeParticleMotion {
  readonly positions:Float32Array;
  readonly normals:Float32Array;
  readonly tones:Float32Array;
  readonly alphas:Float32Array;
  readonly sizes:Float32Array;
  readonly materials:Float32Array;
  readonly seeds:Float32Array;
  private pixels:Pixel[]=[];
  private settings:ParticleSettings;
  private speed:number;
  private time=0;
  private pointerPosition?:{x:number;y:number};
  private trail:{x:number;y:number;age:number}[]=[];
  private waves:number[]=[];
  constructor(capacity:number,settings:ParticleSettings) {
    this.settings=settings;this.speed=settings.speed;
    this.positions=new Float32Array(capacity*3);this.normals=new Float32Array(capacity*3);
    this.tones=new Float32Array(capacity);this.alphas=new Float32Array(capacity);this.sizes=new Float32Array(capacity);this.materials=new Float32Array(capacity);this.seeds=new Float32Array(capacity);
  }
  get count(){return this.pixels.length;}
  configure(settings:ParticleSettings){this.settings=settings;}
  pointer(x:number,y:number){
    const last=this.pointerPosition;
    if(!last||Math.hypot(x-last.x,y-last.y)>.025){this.trail.push({x,y,age:0});if(this.trail.length>18)this.trail.shift();}
    this.pointerPosition={x,y};
  }
  leave(){this.pointerPosition=undefined;}
  signal(){this.waves.push(0);if(this.waves.length>3)this.waves.shift();}
  setShape(shape:ParticleShape,instant=false,preserveNeighbors=false) {
    const hadPixels=this.pixels.length>0;
    if(preserveNeighbors&&this.pixels.length) {
      // Spatial buckets keep live size/density changes local without an O(n²) search.
      const buckets=new Map<string,Pixel[]>(),remaining=new Set(this.pixels),ordered:Pixel[]=[];
      const key=(x:number,y:number,z:number)=>`${Math.round(x/.13)}:${Math.round(y/.13)}:${Math.round(z/.13)}`;
      for(const p of this.pixels){const k=key(p.baseX,p.baseY,p.baseZ);const bucket=buckets.get(k)||[];bucket.push(p);buckets.set(k,bucket);}
      for(let i=0;i<shape.count;i++) {
        const nearby=buckets.get(key(shape.positions[i*3],shape.positions[i*3+1],shape.positions[i*3+2]));
        const p=nearby?.pop();if(p){ordered.push(p);remaining.delete(p);}else ordered.push(undefined as unknown as Pixel);
      }
      const unused=[...remaining];
      this.pixels=ordered.map(p=>p||unused.pop()!).concat(unused);
    }
    const length=Math.max(shape.count,this.pixels.length);
    for(let i=0;i<length;i++) {
      const active=i<shape.count,j=i*3,x=shape.positions[j],y=shape.positions[j+1],z=shape.positions[j+2];
      let p=this.pixels[i];
      if(!p){
        p={x,y,z,vx:0,vy:0,vz:0,nx:shape.normals[j],ny:shape.normals[j+1],nz:shape.normals[j+2],size:shape.sizes[i],alpha:hadPixels?0:1,tone:shape.tones[i],baseX:x,baseY:y,baseZ:z,targetX:x,targetY:y,targetZ:z,targetNX:0,targetNY:0,targetNZ:1,targetSize:1,targetTone:0,targetAlpha:1,phase:hash(i+31)*Math.PI*2,glow:0,material:0,restraint:1};
        this.pixels[i]=p;
      }
      p.material=active?shape.materials[i]:p.material;
      p.tone=active?shape.tones[i]:p.tone;
      p.restraint=shape.rigid?0:p.material===2?.12:p.material===1?.30:p.material===3?.10:.68;
      p.targetAlpha=active?1:0;p.targetX=active?x:p.baseX;p.targetY=active?y:p.baseY;p.targetZ=active?z:p.baseZ;
      p.targetNX=active?shape.normals[j]:p.nx;p.targetNY=active?shape.normals[j+1]:p.ny;p.targetNZ=active?shape.normals[j+2]:p.nz;
      p.targetTone=active?shape.tones[i]:p.tone;p.targetSize=active?shape.sizes[i]:p.size;
      if(instant){p.vx=p.vy=p.vz=0;p.x=p.baseX=p.targetX;p.y=p.baseY=p.targetY;p.z=p.baseZ=p.targetZ;p.nx=p.targetNX;p.ny=p.targetNY;p.nz=p.targetNZ;p.alpha=p.targetAlpha;p.tone=p.targetTone;p.size=p.targetSize;}
    }
    this.write();
  }
  private write() {
    for(let i=0;i<this.pixels.length;i++){
      const p=this.pixels[i],j=i*3;
      this.positions[j]=p.x;this.positions[j+1]=p.y;this.positions[j+2]=p.z;
      this.normals[j]=p.nx;this.normals[j+1]=p.ny;this.normals[j+2]=p.nz;
      this.tones[i]=p.glow;this.alphas[i]=p.alpha;this.sizes[i]=p.size;this.materials[i]=p.material;this.seeds[i]=p.tone;
    }
  }
  advance(dt:number) {
    if(this.settings.paused)return;
    dt=Math.min(Math.max(dt,0),.05);
    this.speed+=(this.settings.speed-this.speed)*(1-Math.exp(-dt*4));
    const step=dt*this.speed;this.time+=step;
    this.trail=this.trail.filter(p=>(p.age+=dt)<1.5);
    this.waves=this.waves.map(t=>t+step).filter(t=>t<2.1);
    const layout=1-Math.exp(-dt*3.4),decay=Math.exp(-dt*11),relax=1-Math.exp(-dt*4);
    const amplitude=this.settings.distance*2.7/500,chaos=this.settings.chaos/100,reaction=this.settings.reaction/100;
    for(let i=0;i<this.pixels.length;i++) {
      const p=this.pixels[i],phase=p.phase,t=this.time;
      p.baseX+=(p.targetX-p.baseX)*layout;p.baseY+=(p.targetY-p.baseY)*layout;p.baseZ+=(p.targetZ-p.baseZ)*layout;
      p.nx+=(p.targetNX-p.nx)*layout;p.ny+=(p.targetNY-p.ny)*layout;p.nz+=(p.targetNZ-p.nz)*layout;
      p.size+=(p.targetSize-p.size)*layout;p.alpha+=(p.targetAlpha-p.alpha)*layout;
      let influence=0,flowX=0,flowY=0;
      const touch=(x:number,y:number,strength:number)=>{
        const dx=p.baseX-x,dy=p.baseY-y,d2=dx*dx+dy*dy;
        const weight=Math.exp(-d2/.105)*strength;
        if(weight>influence){influence=weight;flowX=dx;flowY=dy;}
      };
      if(this.pointerPosition)touch(this.pointerPosition.x,this.pointerPosition.y,.7);
      for(const trail of this.trail)touch(trail.x,trail.y,Math.exp(-trail.age*2.4));
      influence*=reaction*p.restraint;
      let wave=0;
      const radius=Math.hypot(p.baseX,p.baseY,p.baseZ*.7);
      for(const age of this.waves){const d=(radius-age*.85)/.23;wave+=Math.exp(-d*d)*Math.exp(-age*.8);}
      const drift=amplitude*(.28+chaos*.72)*p.restraint;
      const dx=drift*(Math.sin(t*.93+phase)*.30+Math.sin(t*.57+p.baseY*4)*.70);
      const dy=drift*(Math.cos(t*.79+phase*1.7)*.30+Math.sin(t*.67+p.baseX*3)*.70);
      const dz=drift*(Math.sin(t*1.12+phase*.8)*.45+Math.cos(t*.61+p.baseY*3)*.75);
      // Most touch energy lifts the surface in depth; lateral travel stays short.
      const tx=p.baseX+dx+flowX*influence*.12+p.nx*wave*.075*p.restraint;
      const ty=p.baseY+dy+flowY*influence*.12+p.ny*wave*.075*p.restraint;
      const tz=p.baseZ+dz+influence*.20*(.65+.35*Math.sin(phase))+p.nz*wave*.16*p.restraint;
      // Analytic critically damped spring: continuous velocity even on a new wave.
      const ox=p.x-tx,oy=p.y-ty,oz=p.z-tz;
      const cx=p.vx+11*ox,cy=p.vy+11*oy,cz=p.vz+11*oz;
      p.x=tx+(ox+cx*dt)*decay;p.y=ty+(oy+cy*dt)*decay;p.z=tz+(oz+cz*dt)*decay;
      p.vx=(p.vx-11*cx*dt)*decay;p.vy=(p.vy-11*cy*dt)*decay;p.vz=(p.vz-11*cz*dt)*decay;
      p.glow+=(Math.min(1,influence+wave*.55)-p.glow)*relax;
    }
    this.write();
  }
}
