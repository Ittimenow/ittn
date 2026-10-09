import { SystemMotion, PORTAL_COUNT } from './hero-particle-system.ts';
import { HINGE_CENTERS, HINGE_CUBE_HALF } from './hero-particle-hinges.ts';
import { CloudMotion } from './hero-particle-cloud.ts';
import { FlightMotion, FLIGHT_CAMERA_DISTANCE } from './hero-particle-flight.ts';
import { NETWORK_NODES, NetworkMotion } from './hero-particle-network.ts';
import { funnelColor } from './hero-particle-funnel.ts';
import type { ParticleSettings } from './hero-particle-settings';
import type { ServiceHeroSceneId } from '../data/service-hero-scenes';

// Authored implicit solids, sampled once into jittered surface particles.
// Positive distances are inside; surface normals provide real directional light.
export const PARTICLE_COUNT = 8192;
export const VIEW_SIZE = 2.7;
type Point = readonly [number, number];
export interface ParticleShape { positions: Float32Array; normals: Float32Array; tones: Float32Array; sizes: Float32Array; materials: Float32Array; count: number; pixelSize: number; network?:boolean; flight?:boolean; cloud?:boolean; system?:boolean; rigid?:boolean; }
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
function capsule(x: number, y: number, ax: number, ay: number, bx: number, by: number, radius: number) {
  const vx = bx - ax, vy = by - ay;
  const t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy));
  return radius - Math.hypot(x - ax - t * vx, y - ay - t * vy);
}
function polygon(x: number, y: number, points: readonly Point[]) {
  let inside = false, distance = Infinity;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[i], [bx, by] = points[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
    distance = Math.min(distance, -capsule(x, y, ax, ay, bx, by, 0));
  }
  return inside ? distance : -distance;
}
const cursor: Point[] = [[-.63,.96],[-.61,-.48],[-.23,-.17],[.10,-.84],[.41,-.68],[.08,-.02],[.58,.01]];
const arrowHead: Point[] = [[.87,.57],[.86,-.10],[.20,.20]];

function profileDistance(id:'sites'|'elma',x:number,y:number):number {
  if(id==='sites') {
    const angle=-.12,c=Math.cos(angle),s=Math.sin(angle);
    return polygon(x*c-y*s,x*s+y*c,cursor);
  }
  const r=Math.hypot(x,y),angle=Math.atan2(y,x);
  const arc=Math.abs(angle)>.28&&Math.abs(angle)<Math.PI-.28?.145-Math.abs(r-.60):-1;
  return Math.max(arc,polygon(x,y,arrowHead),polygon(-x,-y,arrowHead));
}
export function particleHash(n: number) { const value = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return value - Math.floor(value); }
function solidBox(x:number,y:number,z:number,hx:number,hy:number,hz:number,r=.055) {
  const a=Math.abs(x)-hx+r,b=Math.abs(y)-hy+r,c=Math.abs(z)-hz+r;
  return r-Math.hypot(Math.max(a,0),Math.max(b,0),Math.max(c,0))-Math.min(Math.max(a,b,c),0);
}
function extrude(distance:number,z:number,thickness:number,bevel=.055) {
  const a=-distance+bevel,b=Math.abs(z)-thickness+bevel;
  return bevel-Math.hypot(Math.max(a,0),Math.max(b,0))-Math.min(Math.max(a,b),0);
}
/** Positive-inside distance fields: closed surfaces, except the open funnel. */
export function volumeDistance(id:ServiceHeroSceneId,x:number,y:number,z:number):number {
  switch(id) {
    case 'home': return .18-Math.hypot(Math.hypot(x,y)-.64,z);
    case 'sites': {
      // Nose recedes from the viewer; the tail remains close and readable.
      const scale=.88,px=x/scale,py=(y*Math.cos(1.48)-z*Math.sin(1.48))/scale,pz=(y*Math.sin(1.48)+z*Math.cos(1.48))/scale;
      return extrude(profileDistance(id,px*Math.cos(.35)-py*Math.sin(.35),px*Math.sin(.35)+py*Math.cos(.35)),pz,.18,.055)*scale;
    }
    case 'web-services': {
      // A cloud reads through its three upper lobes and a calm, level base.
      const outline=Math.max(
        .32-Math.hypot(x+.51,y+.02),
        .47-Math.hypot(x+.08,y-.25),
        .35-Math.hypot(x-.47,y-.01),
        capsule(x,y,-.50,-.15,.48,-.15,.19),
      );
      return extrude(outline,z,.30,.13);
    }
    case 'integrations': {
      return Math.max(...NETWORK_NODES.map(([cx,cy,cz],index)=>{
        const px=x-cx,py=y-cy,pz=z-cz;
        if(index===0)return solidBox(px,py,pz,.265,.265,.265,.065);
        if(index===1)return Math.max(.16-Math.hypot(px+.12,py,pz),.20-Math.hypot(px,py-.065,pz),.14-Math.hypot(px-.14,py,pz));
        if(index===2)return Math.min(.19-Math.hypot(px,pz),.22-Math.abs(py));
        if(index===3)return Math.min(solidBox(px,py,pz,.23,.19,.085,.035),-solidBox(px,py,pz,.16,.115,.2,.02));
        if(index===4)return .21-Math.hypot(px,py,pz);
        return solidBox(px,py,pz,.19,.19,.18,.045);
      }));
    }
    case 'bitrix24': {
      const radius=y>-.35?.20+(y+.35)*.59:.20;
      return Math.min(.075-Math.abs(Math.hypot(x,z)-radius),.71-y,y+.78);
    }
    case 'rbs': return Math.max(...HINGE_CENTERS.map(([cx,cy,cz])=>solidBox(x-cx,y-cy,z-cz,HINGE_CUBE_HALF,HINGE_CUBE_HALF,HINGE_CUBE_HALF,.035)));
    case 'elma': return extrude(profileDistance(id,x,y),z,.17,.055);
    case 'ai': return (1-Math.abs(x)/.46-Math.abs(y)/.94-Math.abs(z)/.36)/Math.hypot(1/.46,1/.94,1/.36);
    case 'support': return .83-Math.hypot(x,y,z);
  }
}
const cache = new Map<string, ParticleShape>();
export function createParticleShape(id:ServiceHeroSceneId,pixelSize=6,density=80):ParticleShape {
  const key=`${id}:${pixelSize}:${density}`;
  const cached=cache.get(key);if(cached)return cached;
  if(id==='home'){
    const count=Math.min(PARTICLE_COUNT-1,PORTAL_COUNT*20);
    const positions=new Float32Array(PARTICLE_COUNT*3),normals=new Float32Array(PARTICLE_COUNT*3),tones=new Float32Array(PARTICLE_COUNT),sizes=new Float32Array(PARTICLE_COUNT),materials=new Float32Array(PARTICLE_COUNT),ribbon=new SystemMotion();
    for(let i=0;i<count;i++){const p=ribbon.sample(Math.floor(i*PORTAL_COUNT*24/count),count);positions.set(p.position,i*3);normals.set(p.normal,i*3);tones[i]=.99;sizes[i]=(.8+particleHash(i+32)*.35)*ribbon.block(Math.floor(Math.floor(i*PORTAL_COUNT*24/count)/24)).size/.15;}
    const shape={positions,normals,tones,sizes,materials,count,pixelSize,system:true};
    if(cache.size>=16)cache.delete(cache.keys().next().value!);cache.set(key,shape);return shape;
  }
  const step=Math.max(.027,pixelSize*VIEW_SIZE/500*1.34),span=Math.ceil((id==='rbs'?.32:1.08)/step);
  const samples:{x:number;y:number;z:number;nx:number;ny:number;nz:number;seed:number;order:number;material:number}[]=[];
  const occupied=new Set<string>();
  const origins=id==='rbs'?HINGE_CENTERS:[[0,0,0]];
  for(const [module,[cx,cy,cz]] of origins.entries()){
  const field=(x:number,y:number,z:number)=>id==='rbs'?solidBox(x-cx,y-cy,z-cz,HINGE_CUBE_HALF,HINGE_CUBE_HALF,HINGE_CUBE_HALF,.035):volumeDistance(id,x,y,z);
  for(let iz=-span;iz<=span;iz++)for(let iy=-span;iy<=span;iy++)for(let ix=-span;ix<=span;ix++) {
    const x=ix*step+cx,y=iy*step+cy,z=iz*step+cz,d=field(x,y,z);
    if(Math.abs(d)>step*.58)continue;
    const seed=(ix+60)*73856093^(iy+60)*19349663^(iz+60)*83492791^module*12289;
    if(particleHash(seed+3)>density/100)continue;
    const e=.002;
    // Outward normal is the negative gradient of a positive-inside field.
    let nx=field(x-e,y,z)-field(x+e,y,z);
    let ny=field(x,y-e,z)-field(x,y+e,z);
    let nz=field(x,y,z-e)-field(x,y,z+e);
    const length=Math.hypot(nx,ny,nz);if(length<.000001)continue;nx/=length;ny/=length;nz/=length;
    const px=x+nx*d,py=y+ny*d,pz=z+nz*d;
    const cell=step*.78,voxel=`${module}:${Math.round(px/cell)}:${Math.round(py/cell)}:${Math.round(pz/cell)}`;
    if(occupied.has(voxel))continue;occupied.add(voxel);
    // Jitter breaks the lattice while keeping each particle near its surface.
    const jitter=step*(id==='rbs'?.16:id==='web-services'||id==='integrations'||id==='ai'?.32:.48);
    let order=0;
    for(let bit=0;bit<7;bit++)order|=(((ix+span)>>bit)&1)<<(bit*3)|(((iy+span)>>bit)&1)<<(bit*3+1)|(((iz+span)>>bit)&1)<<(bit*3+2);
    samples.push({x:px+(particleHash(seed+5)-.5)*jitter,y:py+(particleHash(seed+8)-.5)*jitter,z:pz+(particleHash(seed+13)-.5)*jitter,nx,ny,nz,seed,order,material:id==='support'||id==='ai'||(id==='integrations'&&Math.hypot(px,py,pz)<.49)?1:id==='bitrix24'?3:0});
  }
  }
  if(id==='ai'){
    for(let i=0;i<160;i++){const y=(particleHash(i+510)-.5)*.62,angle=i*2.399963,r=.13*(1-Math.abs(y));const nx=Math.cos(angle),nz=Math.sin(angle);samples.push({x:nx*r,y,z:nz*r*.66,nx,ny:0,nz,seed:i+550000,order:Math.floor(particleHash(i)*0x1fffff),material:5});}
  }
  if(id==='support') {
    const coreCount=Math.max(48,Math.round(4*Math.PI*.235**2/(step*step)*density/100));
    for(let i=0;i<coreCount;i++) {
      const ny=1-2*(i+.5)/coreCount,r=Math.sqrt(1-ny*ny),angle=i*2.399963229728653;
      const nx=r*Math.cos(angle),nz=r*Math.sin(angle),seed=900000+i;
      samples.push({x:nx*.235,y:ny*.235,z:nz*.235,nx,ny,nz,seed,order:Math.floor(particleHash(seed)*0x1fffff),material:2});
    }
  }
  samples.sort((a,b)=>a.order-b.order);
  const count=Math.min(samples.length,PARTICLE_COUNT),positions=new Float32Array(PARTICLE_COUNT*3),normals=new Float32Array(PARTICLE_COUNT*3),tones=new Float32Array(PARTICLE_COUNT),sizes=new Float32Array(PARTICLE_COUNT),materials=new Float32Array(PARTICLE_COUNT);
  for(let i=0;i<count;i++) {
    const p=samples[Math.floor(i*samples.length/count)];
    positions.set([p.x,p.y,p.z],i*3);normals.set([p.nx,p.ny,p.nz],i*3);
    materials[i]=p.material;tones[i]=particleHash(p.seed+17);sizes[i]=.78+particleHash(p.seed+19)*.42;
  }
  const result={positions,normals,tones,sizes,materials,count,pixelSize,network:id==='integrations',flight:id==='sites',cloud:id==='web-services',rigid:id==='rbs'};
  if(cache.size>=16)cache.delete(cache.keys().next().value!);
  cache.set(key,result);return result;
}
// Shared by the WebGL camera and the CPU poster / reduced-motion projection.
export const CAMERA_DISTANCE=4.6;
export const BASE_ROTATION={x:.30,y:-.40,z:-.07};
export function rotateParticle(x:number,y:number,z:number,rx=BASE_ROTATION.x,ry=BASE_ROTATION.y,rz=BASE_ROTATION.z):[number,number,number] {
  const a=y*Math.cos(rx)-z*Math.sin(rx),b=y*Math.sin(rx)+z*Math.cos(rx);
  const c=x*Math.cos(ry)+b*Math.sin(ry),d=-x*Math.sin(ry)+b*Math.cos(ry);
  return [c*Math.cos(rz)-a*Math.sin(rz),c*Math.sin(rz)+a*Math.cos(rz),d];
}
/** Interpolate between gray shadow and pearl highlight, never shade toward black. */
export function particleColor(light:number,primary='#A9B1BD',secondary='#F2F4F7'):[number,number,number] {
  const t=Math.pow(clamp(light),1.3);
  return [1,3,5].map(i=>Math.round(parseInt(primary.slice(i,i+2),16)*(1-t)+parseInt(secondary.slice(i,i+2),16)*t)) as [number,number,number];
}
export function particleAppearance(point:{light:number;seed:number;material:number;facing:number;height?:number},settings:ParticleSettings) {
  if(point.material===5)return {color:[238,153,188],alpha:.68};
  if(point.material===4)return {color:[184,194,209],alpha:point.facing};
  if(point.material===3){
    const base=funnelColor(point.height??0);
    return {color:base.map(c=>Math.round((c+(1-c)*point.light*.55)*255)),alpha:settings.funnelOpacity/100*(.20+.65*Math.pow(1-Math.abs(point.facing),2))};
  }
  const core=point.material===2,shell=point.material===1;
  const accented=!core&&!shell&&point.seed<settings.accentAmount/100;
  const pale=(color:string)=>'#'+[1,3,5].map(i=>Math.round(parseInt(color.slice(i,i+2),16)*.35+255*.65).toString(16).padStart(2,'0')).join('');
  const color=particleColor(point.light,core?settings.coreColor:accented?settings.accent:settings.primary,core?pale(settings.coreColor):accented?pale(settings.accent):settings.secondary);
  const alpha=shell?settings.shellOpacity/100*(.32+.68*Math.pow(Math.max(0,1-Math.abs(point.facing)),1.4)):1;
  return {color,alpha};
}
export function projectParticleShape(shape:ParticleShape,depth=100) {
  const points:{x:number;y:number;z:number;size:number;light:number;seed:number;material:number;facing:number;height:number}[]=[];
  for(let i=0;i<shape.count;i++) {
    if(shape.sizes[i]<.001)continue;
    const rotate=shape.system?((x:number,y:number,z:number):[number,number,number]=>[x,y,z]):rotateParticle;
    const n=rotate(shape.normals[i*3],shape.normals[i*3+1],shape.normals[i*3+2]/Math.max(.15,depth/100));
    const nl=Math.hypot(...n)||1;
    const p=rotate(shape.positions[i*3],shape.positions[i*3+1],shape.positions[i*3+2]*depth/100);
    const facing=(n[0]*-p[0]+n[1]*-p[1]+n[2]*(CAMERA_DISTANCE-p[2]))/nl;
    if(shape.system&&p[2]<-.08&&Math.max(Math.abs(p[0]),Math.abs(p[1]))*CAMERA_DISTANCE/(CAMERA_DISTANCE-p[2])>.88)continue;
    const material=shape.materials[i];
    if(facing<0&&material!==1&&material!==3&&material!==5)continue;
    const perspective=CAMERA_DISTANCE/(CAMERA_DISTANCE-p[2]);
    const light=.22+.78*Math.max(0,(-n[0]*.45+n[1]*.65+n[2]*.72)/nl/1.069);
    points.push({x:p[0]*perspective,y:p[1]*perspective,z:p[2],size:shape.pixelSize*shape.sizes[i]*perspective,light,seed:shape.tones[i],material,height:shape.positions[i*3+1],facing:facing/Math.hypot(p[0],p[1],CAMERA_DISTANCE-p[2])});
  }
  if(shape.network){
    const network=new NetworkMotion();network.reset();
    for(let i=0;i<network.alphas.length;i++){
      if(network.alphas[i]<.05)continue;
      const p=rotateParticle(network.positions[i*3],network.positions[i*3+1],network.positions[i*3+2]*depth/100),perspective=CAMERA_DISTANCE/(CAMERA_DISTANCE-p[2]);
      points.push({x:p[0]*perspective,y:p[1]*perspective,z:p[2],size:shape.pixelSize*network.sizes[i]*perspective,light:.35,seed:1,material:0,height:0,facing:1});
    }
  }
  if(shape.cloud){
    const cloud=new CloudMotion((x,y,z)=>volumeDistance('web-services',x,y,z));
    for(let i=0;i<cloud.alphas.length;i++){
      if(cloud.alphas[i]<.025)continue;
      const p=rotateParticle(cloud.positions[i*3],cloud.positions[i*3+1],cloud.positions[i*3+2]*depth/100),perspective=CAMERA_DISTANCE/(CAMERA_DISTANCE-p[2]);
      const x=p[0]*perspective,y=p[1]*perspective;
      if(Math.max(Math.abs(x),Math.abs(y))>=1.28)continue;
      points.push({x,y,z:p[2],size:shape.pixelSize*cloud.sizes[i]*perspective,light:.5,seed:1,material:4,height:0,facing:cloud.alphas[i]});
    }
  }
  if(shape.flight){
    const flight=new FlightMotion();flight.reset();
    for(let i=0;i<flight.alphas.length;i++){
      if(flight.alphas[i]<.025)continue;
      const z=flight.positions[i*3+2],perspective=FLIGHT_CAMERA_DISTANCE/(FLIGHT_CAMERA_DISTANCE-z);
      const x=flight.positions[i*3]*perspective,y=flight.positions[i*3+1]*perspective;
      if(Math.max(Math.abs(x),Math.abs(y))>=1.28)continue;
      points.push({x,y,z,size:shape.pixelSize*flight.sizes[i]*perspective,light:.5,seed:1,material:4,height:0,facing:flight.alphas[i]});
    }
  }
  return points.sort((a,b)=>a.z-b.z);
}
