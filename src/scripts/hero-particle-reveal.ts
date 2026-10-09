import { BufferAttribute, BufferGeometry, DoubleSide, Group, LineSegments, Mesh, MeshStandardMaterial, Points, Raycaster, ShaderMaterial, Vector2, Vector3, Vector4 } from 'three';
import source from '../assets/hero/ampersand.json?raw';
import { revealGeometry } from './hero-reveal-geometry';

const mask=/* glsl */`
uniform vec4 uTrail[24];
uniform vec2 uResolution;
uniform float uTime;
float reveal(){
  vec2 p=(gl_FragCoord.xy/uResolution-.5)*2.7;
  p+=.025*vec2(sin(p.y*22.+uTime*.7)+sin(p.x*31.-p.y*9.),cos(p.x*19.-uTime*.6));
  float field=0.;
  for(int i=0;i<24;i++){
    vec2 d=p-uTrail[i].xy;
    field+=exp(-dot(d,d)/.058)*uTrail[i].z;
  }
  return smoothstep(.12,.85,field);
}
`;
const interiorVertex=/* glsl */`
varying float vDepth;
void main(){vec4 p=modelViewMatrix*vec4(position,1.);vDepth=position.z;gl_Position=projectionMatrix*p;gl_PointSize=3.2*4.6/max(.5,-p.z);}
`;

export class RevealObject {
  readonly group=new Group();
  private geometry=revealGeometry(source);
  private trail=Array.from({length:24},()=>new Vector4(20,20,0,0));
  private uniforms={uTrail:{value:this.trail},uResolution:{value:new Vector2(500,500)},uTime:{value:0}};
  private resources:(BufferGeometry|ShaderMaterial|MeshStandardMaterial)[]=[];
  private target=new Vector2();
  private cursor=new Vector2();
  private touching=false;
  private index=0;
  private time=0;
  private stamp=0;
  private lastInput=-10;
  private preview=0;
  constructor(){
    const shell=new MeshStandardMaterial({color:0xe8ecf0,roughness:.32,metalness:.12,transparent:true,depthWrite:false});
    shell.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,this.uniforms);
      shader.fragmentShader=mask+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`diffuseColor.a*=1.-reveal()*.985;\n#include <opaque_fragment>`);
    };
    const surface=new Mesh(this.geometry,shell);surface.renderOrder=3;this.group.add(surface);
    // A muted back wall gives the revealed channels depth without showing through holes.
    const innerMaterial=new ShaderMaterial({uniforms:this.uniforms,vertexShader:interiorVertex,fragmentShader:mask+`varying float vDepth; void main(){float a=reveal();if(a<.01)discard;gl_FragColor=vec4(.63,.76,.84,a*.8);}`,transparent:true,side:DoubleSide,depthWrite:false});
    const lining=new Mesh(this.geometry,innerMaterial);lining.scale.set(.995,.995,.96);lining.renderOrder=0;this.group.add(lining);
    // Sample the real volume, so circuitry stays inside the original ampersand contour.
    const testMaterial=new MeshStandardMaterial({side:DoubleSide});
    const volume=new Mesh(this.geometry,testMaterial);volume.updateMatrixWorld();
    const ray=new Raycaster(),positions:number[]=[],segments:number[]=[],nodes=new Map<string,Vector3>();
    const step=.085;
    for(let x=-11;x<=11;x++)for(let y=-11;y<=11;y++){
      ray.set(new Vector3(x*step,y*step,2),new Vector3(0,0,-1));
      const hits=ray.intersectObject(volume);
      if(hits.length<2)continue;
      const front=hits[0].point.z,back=hits[hits.length-1].point.z;
      for(let z=0;z<4;z++){
        const point=new Vector3(x*step,y*step,back+(front-back)*(.18+z*.21));
        nodes.set(`${x},${y},${z}`,point);positions.push(...point.toArray());
      }
    }
    for(const [key,p] of nodes){
      const [x,y,z]=key.split(',').map(Number);
      for(const [dx,dy,dz] of [[1,0,0],[0,1,0],[0,0,1]]){
        const next=nodes.get(`${x+dx},${y+dy},${z+dz}`);
        if(next&&Math.sin(x*47+y*13+z*31+dx*3)>.05)segments.push(...p.toArray(),...next.toArray());
      }
    }
    testMaterial.dispose();
    const lineGeometry=new BufferGeometry();lineGeometry.setAttribute('position',new BufferAttribute(new Float32Array(segments),3));
    const linesMaterial=new ShaderMaterial({uniforms:this.uniforms,vertexShader:interiorVertex,fragmentShader:mask+`varying float vDepth;void main(){float a=reveal();if(a<.01)discard;gl_FragColor=vec4(.23,.52,.74,a*(.48+vDepth*.8));}`,transparent:true,depthTest:false,depthWrite:false});
    const lines=new LineSegments(lineGeometry,linesMaterial);lines.renderOrder=1;this.group.add(lines);
    const nodeGeometry=new BufferGeometry();nodeGeometry.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));
    const nodeMaterial=new ShaderMaterial({uniforms:this.uniforms,vertexShader:interiorVertex,fragmentShader:mask+`varying float vDepth;void main(){float a=reveal();if(a<.01)discard;gl_FragColor=vec4(.34,.65,.91,a*.7);}`,transparent:true,depthTest:false,depthWrite:false});
    const dots=new Points(nodeGeometry,nodeMaterial);dots.renderOrder=2;this.group.add(dots);
    const signalGeometry=new BufferGeometry(),starts:number[]=[],ends:number[]=[],seeds:number[]=[];
    for(let i=0;i<segments.length;i+=18){starts.push(...segments.slice(i,i+3));ends.push(...segments.slice(i+3,i+6));seeds.push(i*.137);}
    signalGeometry.setAttribute('position',new BufferAttribute(new Float32Array(starts),3));signalGeometry.setAttribute('aEnd',new BufferAttribute(new Float32Array(ends),3));signalGeometry.setAttribute('aSeed',new BufferAttribute(new Float32Array(seeds),1));
    const signalMaterial=new ShaderMaterial({uniforms:this.uniforms,vertexShader:`uniform float uTime;attribute vec3 aEnd;attribute float aSeed;void main(){vec3 p=mix(position,aEnd,fract(uTime*.65+aSeed));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=4.;}`,fragmentShader:mask+`void main(){float a=reveal();if(a<.01)discard;gl_FragColor=vec4(.15,.43,.98,a);}`,transparent:true,depthTest:false,depthWrite:false});
    const signals=new Points(signalGeometry,signalMaterial);signals.renderOrder=2;this.group.add(signals);
    this.resources.push(this.geometry,shell,innerMaterial,lineGeometry,linesMaterial,nodeGeometry,nodeMaterial,signalGeometry,signalMaterial);
    this.group.rotation.set(.10,-.28,-.08);
  }
  resize(width:number,height:number){this.uniforms.uResolution.value.set(width,height);}
  pointer(x:number,y:number){this.lastInput=this.time;this.target.set(x,y);if(!this.touching){this.cursor.copy(this.target);this.trail[this.index].set(x,y,1.1,0);this.index=(this.index+1)%24;}this.touching=true;this.preview=0;}
  leave(){this.touching=false;}
  trigger(){this.preview=2.5;}
  reset(){this.trail.forEach(p=>p.z=0);this.touching=false;this.preview=0;}
  advance(dt:number){
    this.time+=dt;this.uniforms.uTime.value=this.time;
    this.trail.forEach(p=>p.z*=Math.exp(-dt*1.65));
    this.preview=Math.max(0,this.preview-dt);
    if(this.preview>0){this.target.set(Math.sin(this.time*1.5)*.65,Math.cos(this.time*1.1)*.55);this.cursor.lerp(this.target,1-Math.exp(-dt*8));}
    else this.cursor.lerp(this.target,1-Math.exp(-dt*14));
    this.stamp+=dt;
    if(((this.touching&&this.time-this.lastInput<.12)||this.preview>0)&&this.stamp>.04){this.stamp=0;this.trail[this.index].set(this.cursor.x,this.cursor.y,.7,0);this.index=(this.index+1)%24;}
    this.group.rotation.set(.10+Math.sin(this.time*.32)*.035,-.28+Math.sin(this.time*.24)*.12,-.08+Math.sin(this.time*.3)*.015);
    this.group.position.y=Math.sin(this.time*.5)*.018;
  }
  dispose(){this.resources.forEach(r=>r.dispose());}
}
