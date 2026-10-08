import { BufferAttribute, BufferGeometry, Group, NoToneMapping, PerspectiveCamera, Points, Scene, ShaderMaterial, Vector3, Vector4, WebGLRenderer } from 'three';
import { BASE_ROTATION, CAMERA_DISTANCE, createParticleShape, volumeDistance, PARTICLE_COUNT, VIEW_SIZE } from './hero-particle-shapes';
import type { ServiceHeroSceneId } from '../data/service-hero-scenes';
import { CrystalMotion } from './hero-particle-crystal';
import { HingeMotion } from './hero-particle-hinges';
import { CloudMotion } from './hero-particle-cloud';
import { FlightMotion } from './hero-particle-flight';
import { NetworkMotion } from './hero-particle-network';
import { FunnelMotion } from './hero-particle-funnel';
import { ShieldMotion } from './hero-particle-shield';
import { VolumeParticleMotion } from './hero-particle-motion';
import { colorChannels, type ParticleSettings } from './hero-particle-settings';

// Surface normals, perspective size and depth testing make the particle objects solid.
const vertexShader=/* glsl */`
  attribute vec3 aNormal;
  attribute float aTone;
  attribute float aAlpha;
  attribute float aSize;
  attribute float aSeed;
  attribute float aMaterial;
  uniform float uSize;
  uniform vec4 uImpacts[8];
  uniform float uCloud;
  varying float vRipple;
  varying float vLight;
  varying float vAlpha;
  varying float vFacing;
  varying float vSeed;
  varying float vMaterial;
  varying float vHeight;
  void main() {
    vec3 displaced=position;
    vRipple=0.0;
    if(aMaterial>.5&&aMaterial<1.5) {
      vec3 direction=normalize(position);
      for(int i=0;i<8;i++) {
        float age=uImpacts[i].w;
        if(age>=0.0&&age<1.1) {
          float arc=acos(clamp(dot(direction,uImpacts[i].xyz),-1.0,1.0));
          float ring=(arc-age*.95)/.09;
          vRipple+=exp(-ring*ring)*exp(-age*3.0);
        }
      }
      displaced+=direction*min(vRipple,1.0)*.025;
    }
    if(uCloud>.5){
      for(int i=0;i<8;i++){
        float age=uImpacts[i].w;
        if(age>=0.0&&age<1.1){
          float radius=distance(position,uImpacts[i].xyz);
          float ring=(radius-age*.32)/.09;
          vRipple+=exp(-ring*ring)*exp(-age*3.0);
        }
      }
    }
    vec4 viewPosition=modelViewMatrix*vec4(displaced,1.0);
    vec3 normal=normalize(normalMatrix*aNormal);
    vFacing=dot(normal,normalize(-viewPosition.xyz));
    vLight=clamp(.22+.78*max(0.0,dot(normal,normalize(vec3(-.45,.65,.72))))+aTone*.15,0.0,1.0);
    vAlpha=aAlpha;vSeed=aSeed;vMaterial=aMaterial;vHeight=position.y;
    gl_Position=projectionMatrix*viewPosition;
    gl_PointSize=uSize*aSize*${CAMERA_DISTANCE.toFixed(1)}/max(.5,-viewPosition.z);
  }
`;
const fragmentShader=/* glsl */`
  precision highp float;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  uniform vec3 uCoreColor;
  uniform float uAccentAmount;
  uniform float uShellOpacity;
  uniform float uFunnelOpacity;
  uniform float uLayer;
  uniform float uCloud;
  varying float vLight;
  varying float vRipple;
  varying float vAlpha;
  varying float vFacing;
  varying float vSeed;
  varying float vMaterial;
  varying float vHeight;
  void main() {
    bool funnel=vMaterial>2.5&&vMaterial<3.5;
    if(vMaterial>4.5)discard;
    bool shell=(vMaterial>.5&&vMaterial<1.5)||funnel;
    bool core=vMaterial>1.5&&vMaterial<2.5;
    if(vAlpha<.02)discard;
    if(uLayer<.5) { if(shell||vFacing<0.0)discard; }
    else { if(!shell)discard; if(uLayer<1.5&&vFacing>=0.0)discard; if(uLayer>1.5&&vFacing<0.0)discard; }
    bool accent=!core&&!shell&&vSeed<uAccentAmount;
    vec3 shadow=core?uCoreColor:accent?uAccent:uPrimary;
    vec3 highlight=core?mix(uCoreColor,vec3(1.0),.65):accent?mix(uAccent,vec3(1.0),.65):uSecondary;
    vec3 color=mix(shadow,highlight,pow(vLight,1.3));
    if(uCloud>.5)color=mix(color,mix(uCoreColor,vec3(1.0),.60),min(vRipple*.8,.65));
    float alpha=vAlpha;
    if(shell){alpha*=min(.9,uShellOpacity*(.32+.68*pow(max(0.0,1.0-abs(vFacing)),1.4))+vRipple*.24);color=mix(color,uSecondary,min(vRipple*.6,.7));}
    if(funnel){
      vec3 stage=mix(vec3(.514,.749,.875),vec3(.569,.780,.647),1.0-smoothstep(.305,.415,vHeight));
      stage=mix(stage,vec3(.902,.678,.475),1.0-smoothstep(-.055,.055,vHeight));
      stage=mix(stage,vec3(.851,.518,.510),1.0-smoothstep(-.405,-.295,vHeight));
      color=mix(stage,vec3(1.0),vLight*.55);
      alpha=vAlpha*uFunnelOpacity*(.20+.65*pow(1.0-abs(vFacing),2.0));
    }
    gl_FragColor=vec4(color,alpha);
  }
`;
const shieldVertex=/* glsl */`
  attribute float aAlpha;
  attribute float aSize;
  uniform float uSize;
  varying float vAlpha;
  void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=uSize*aSize*4.6/max(.5,-p.z);vAlpha=aAlpha;}
`;
const shieldFragment=/* glsl */`
  varying float vAlpha;
  void main(){if(vAlpha<.015)discard;gl_FragColor=vec4(.79,.43,.42,vAlpha);}
`;
const flowVertex=shieldVertex.replace('varying float vAlpha;','varying float vAlpha; attribute vec3 aColor; varying vec3 vColor;').replace('vAlpha=aAlpha;','vAlpha=aAlpha;vColor=aColor;');
const flowFragment=/* glsl */`
  varying float vAlpha;
  varying vec3 vColor;
  void main(){if(vAlpha<.015)discard;gl_FragColor=vec4(vColor,vAlpha);}
`;
export class ParticleRenderer {
  private renderer:WebGLRenderer;
  private scene=new Scene();
  private camera=new PerspectiveCamera(2*Math.atan(VIEW_SIZE/2/CAMERA_DISTANCE)*180/Math.PI,1,.1,20);
  private geometry=new BufferGeometry();
  private material:ShaderMaterial;
  private motion:VolumeParticleMotion;
  private points=new Group();
  private shellLayers:Points[]=[];
  private materials:ShaderMaterial[]=[];
  private shield=new ShieldMotion();
  private shieldGeometry=new BufferGeometry();
  private shieldMaterial=new ShaderMaterial({vertexShader:shieldVertex,fragmentShader:shieldFragment,transparent:true,depthTest:true,depthWrite:false,uniforms:{uSize:{value:6}}});
  private shieldPoints=new Points(this.shieldGeometry,this.shieldMaterial);
  private impactUniforms=Array.from({length:8},()=>new Vector4(0,0,1,-1));
  private funnel=new FunnelMotion();
  private funnelGeometry=new BufferGeometry();
  private funnelMaterial=new ShaderMaterial({vertexShader:flowVertex,fragmentShader:flowFragment,transparent:true,depthTest:true,depthWrite:false,uniforms:{uSize:{value:6}}});
  private funnelPoints=new Points(this.funnelGeometry,this.funnelMaterial);
  private network=new NetworkMotion();
  private networkGeometry=new BufferGeometry();
  private networkMaterial=new ShaderMaterial({vertexShader:flowVertex,fragmentShader:flowFragment,transparent:true,depthTest:true,depthWrite:false,uniforms:{uSize:{value:6}}});
  private networkPoints=new Points(this.networkGeometry,this.networkMaterial);
  private flight=new FlightMotion();
  private flightGeometry=new BufferGeometry();
  private flightMaterial=new ShaderMaterial({vertexShader:flowVertex,fragmentShader:flowFragment,transparent:true,depthTest:true,depthWrite:false,uniforms:{uSize:{value:6}}});
  private flightPoints=new Points(this.flightGeometry,this.flightMaterial);
  private cloud=new CloudMotion((x,y,z)=>volumeDistance('web-services',x,y,z));
  private cloudGeometry=new BufferGeometry();
  private cloudMaterial=new ShaderMaterial({vertexShader:flowVertex,fragmentShader:flowFragment,transparent:true,depthTest:true,depthWrite:false,uniforms:{uSize:{value:6}}});
  private cloudPoints=new Points(this.cloudGeometry,this.cloudMaterial);
  private hinges=new HingeMotion();
  private hingePositions=new Float32Array(PARTICLE_COUNT*3);
  private hingeNormals=new Float32Array(PARTICLE_COUNT*3);
  private hingeGeometry=new BufferGeometry();
  private hingeMaterial=new ShaderMaterial({vertexShader:flowVertex,fragmentShader:flowFragment,transparent:true,depthTest:true,depthWrite:false,uniforms:{uSize:{value:6}}});
  private hingePoints=new Points(this.hingeGeometry,this.hingeMaterial);
  private crystal=new CrystalMotion();
  private crystalGeometry=new BufferGeometry();
  private crystalMaterial=new ShaderMaterial({vertexShader:flowVertex.replace('varying float vAlpha;','varying float vAlpha; attribute float aSoft; varying float vSoft;').replace('vAlpha=aAlpha;','vAlpha=aAlpha;vSoft=aSoft;'),fragmentShader:`varying float vAlpha; varying vec3 vColor; varying float vSoft; void main(){float a=vAlpha;if(vSoft>.5){float r=length(gl_PointCoord-.5)*2.0;a*=exp(-r*r*3.5)*(1.0-smoothstep(.65,1.0,r));}if(a<.008)discard;gl_FragColor=vec4(vColor,a);}`,transparent:true,depthTest:true,depthWrite:false,uniforms:{uSize:{value:6}}});
  private crystalPoints=new Points(this.crystalGeometry,this.crystalMaterial);
  private funnelOpacity:number;
  private width=500;
  private size:number;
  private depth:number;
  private rocking:number;
  private time=0;
  private pointerPosition={x:0,y:0};
  private tilt={x:0,y:0};
  private primary=new Vector3();
  private secondary=new Vector3();
  private accent=new Vector3();
  private coreColor=new Vector3();
  private shellOpacity:number;
  private accentAmount:number;
  constructor(canvas:HTMLCanvasElement,private id:ServiceHeroSceneId,private settings:ParticleSettings) {
    this.renderer=new WebGLRenderer({canvas,alpha:true,antialias:false,powerPreference:'low-power'});
    this.renderer.debug.onShaderError=()=>{throw new Error('Particle shader compilation failed');};
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
    this.renderer.setClearColor(0xffffff,0);this.renderer.toneMapping=NoToneMapping;
    this.camera.position.z=CAMERA_DISTANCE;
    this.motion=new VolumeParticleMotion(PARTICLE_COUNT,settings);
    this.motion.setShape(createParticleShape(id,settings.pixelSize,settings.density),true);
    this.geometry.setAttribute('position',new BufferAttribute(this.motion.positions,3));
    this.geometry.setAttribute('aNormal',new BufferAttribute(this.motion.normals,3));
    this.geometry.setAttribute('aTone',new BufferAttribute(this.motion.tones,1));
    this.geometry.setAttribute('aAlpha',new BufferAttribute(this.motion.alphas,1));
    this.geometry.setAttribute('aSize',new BufferAttribute(this.motion.sizes,1));
    this.geometry.setAttribute('aSeed',new BufferAttribute(this.motion.seeds,1));
    this.geometry.setAttribute('aMaterial',new BufferAttribute(this.motion.materials,1));
    this.size=settings.pixelSize;this.depth=settings.depth;this.rocking=settings.rocking;
    this.shellOpacity=settings.shellOpacity;this.accentAmount=settings.accentAmount;this.funnelOpacity=settings.funnelOpacity;
    this.setColors(true);
    const uniforms={uCloud:{value:id==='web-services'?1:0},uFunnelOpacity:{value:this.funnelOpacity/100},uImpacts:{value:this.impactUniforms},uSize:{value:this.size},uPrimary:{value:this.primary},uSecondary:{value:this.secondary},uAccent:{value:this.accent},uCoreColor:{value:this.coreColor},uAccentAmount:{value:this.accentAmount/100},uShellOpacity:{value:this.shellOpacity/100}};
    // Transparent shell is drawn behind and in front of the opaque core.
    // This preserves its interior without translucent pixels writing depth.
    for(const [layer,order] of [[1,0],[0,1],[2,2]]) {
      const material=new ShaderMaterial({vertexShader,fragmentShader,transparent:true,depthTest:true,depthWrite:layer===0,uniforms:{...uniforms,uLayer:{value:layer}}});
      const points=new Points(this.geometry,material);points.frustumCulled=false;points.renderOrder=order;
      this.materials.push(material);this.points.add(points);
      if(layer!==0){points.visible=id==='support'||id==='bitrix24'||id==='integrations'||id==='ai';this.shellLayers.push(points);}
    }
    this.shieldGeometry.setAttribute('position',new BufferAttribute(this.shield.positions,3));
    this.shieldGeometry.setAttribute('aAlpha',new BufferAttribute(this.shield.alphas,1));
    this.shieldGeometry.setAttribute('aSize',new BufferAttribute(this.shield.sizes,1));
    this.shieldPoints.frustumCulled=false;this.shieldPoints.renderOrder=1;this.shieldPoints.visible=id==='support';
    this.points.add(this.shieldPoints);this.shield.reset();
    this.funnelGeometry.setAttribute('position',new BufferAttribute(this.funnel.positions,3));
    this.funnelGeometry.setAttribute('aAlpha',new BufferAttribute(this.funnel.alphas,1));
    this.funnelGeometry.setAttribute('aSize',new BufferAttribute(this.funnel.sizes,1));
    this.funnelGeometry.setAttribute('aColor',new BufferAttribute(this.funnel.colors,3));
    this.funnelPoints.frustumCulled=false;this.funnelPoints.renderOrder=1;this.funnelPoints.visible=id==='bitrix24';
    this.funnel.advance(0,settings.funnelFlow,settings.funnelLoss);this.points.add(this.funnelPoints);
    for(const [key,array,itemSize] of [['position',this.network.positions,3],['aAlpha',this.network.alphas,1],['aSize',this.network.sizes,1],['aColor',this.network.colors,3]] as const)this.networkGeometry.setAttribute(key,new BufferAttribute(array,itemSize));
    this.networkPoints.frustumCulled=false;this.networkPoints.renderOrder=1;this.networkPoints.visible=id==='integrations';
    this.network.reset();this.points.add(this.networkPoints);
    for(const [key,array,itemSize] of [['position',this.flight.positions,3],['aAlpha',this.flight.alphas,1],['aSize',this.flight.sizes,1],['aColor',this.flight.colors,3]] as const)this.flightGeometry.setAttribute(key,new BufferAttribute(array,itemSize));
    this.flightPoints.frustumCulled=false;this.flightPoints.renderOrder=1;this.flightPoints.visible=id==='sites';
    this.flight.reset();this.scene.add(this.flightPoints);
    for(const [key,array,itemSize] of [['position',this.cloud.positions,3],['aAlpha',this.cloud.alphas,1],['aSize',this.cloud.sizes,1],['aColor',this.cloud.colors,3]] as const)this.cloudGeometry.setAttribute(key,new BufferAttribute(array,itemSize));
    this.cloudPoints.frustumCulled=false;this.cloudPoints.renderOrder=1;this.cloudPoints.visible=id==='web-services';
    this.points.add(this.cloudPoints);
    for(const [key,array,itemSize] of [['position',this.hinges.positions,3],['aAlpha',this.hinges.alphas,1],['aSize',this.hinges.sizes,1],['aColor',this.hinges.colors,3]] as const)this.hingeGeometry.setAttribute(key,new BufferAttribute(array,itemSize));
    this.hingePoints.frustumCulled=false;this.hingePoints.renderOrder=2;this.hingePoints.visible=id==='rbs';this.points.add(this.hingePoints);
    for(const [key,array,itemSize] of [['position',this.crystal.positions,3],['aAlpha',this.crystal.alphas,1],['aSize',this.crystal.sizes,1],['aColor',this.crystal.colors,3],['aSoft',this.crystal.soft,1]] as const)this.crystalGeometry.setAttribute(key,new BufferAttribute(array,itemSize));
    this.crystalPoints.frustumCulled=false;this.crystalPoints.renderOrder=1;this.crystalPoints.visible=id==='ai';this.crystal.reset();this.points.add(this.crystalPoints);
    this.material=this.materials[1];
    this.scene.add(this.points);this.pose();this.sync();
  }

  setShape(id:ServiceHeroSceneId) {
    this.crystal.reset();this.crystalPoints.visible=id==='ai';
    this.hinges.reset();this.hingePoints.visible=id==='rbs';
    this.cloud.reset();this.cloudPoints.visible=id==='web-services';
    this.flight.reset();this.flightPoints.visible=id==='sites';this.pointerPosition={x:0,y:0};this.motion.leave();this.network.reset();this.networkPoints.visible=id==='integrations';this.id=id;this.funnelPoints.visible=id==='bitrix24';this.funnel.reset();this.funnel.advance(0,this.settings.funnelFlow,this.settings.funnelLoss);this.shieldPoints.visible=id==='support';this.shield.reset();for(const layer of this.shellLayers)layer.visible=id==='support'||id==='bitrix24'||id==='integrations'||id==='ai';this.motion.setShape(createParticleShape(id,this.settings.pixelSize,this.settings.density),this.settings.paused);this.pose();this.sync();
  }
  configure(settings:ParticleSettings) {
    const resample=this.settings.pixelSize!==settings.pixelSize||this.settings.density!==settings.density;
    this.settings=settings;this.motion.configure(settings);
    if(resample)this.motion.setShape(createParticleShape(this.id,settings.pixelSize,settings.density),settings.paused,true);
    if(settings.paused){this.size=settings.pixelSize;this.depth=settings.depth;this.rocking=settings.rocking;this.shellOpacity=settings.shellOpacity;this.accentAmount=settings.accentAmount;this.funnelOpacity=settings.funnelOpacity;this.setColors(true);this.pose();}
    if(settings.paused)this.funnel.advance(0,settings.funnelFlow,settings.funnelLoss);
    this.sync();
  }
  private setColors(instant=false,dt=0) {
    const factor=instant?1:1-Math.exp(-dt*5);
    this.primary.lerp(new Vector3(...colorChannels(this.settings.primary)).divideScalar(255),factor);
    this.secondary.lerp(new Vector3(...colorChannels(this.settings.secondary)).divideScalar(255),factor);
    this.accent.lerp(new Vector3(...colorChannels(this.settings.accent)).divideScalar(255),factor);
    this.coreColor.lerp(new Vector3(...colorChannels(this.settings.coreColor)).divideScalar(255),factor);
  }
  pointer(x:number,y:number){
    this.pointerPosition={x,y};
    if(this.id==='sites'){this.flight.pointer(x/(VIEW_SIZE*.5)*this.settings.reaction/100,y/(VIEW_SIZE*.5)*this.settings.reaction/100);return;}
    if(this.id==='integrations'){
      this.points.updateMatrixWorld();
      this.network.pointer(x,y,p=>{
        const projected=this.points.localToWorld(new Vector3(...p)).project(this.camera);
        return {x:projected.x*VIEW_SIZE*.5*this.camera.aspect,y:projected.y*VIEW_SIZE*.5};
      });
      return;
    }
    if(this.id==='ai'){
      this.points.updateMatrixWorld();
      // Sample the view ray in model space: hit the actual rotated crystal,
      // not the surrounding square canvas or its hidden interior core.
      let inside=false;
      for(let z=-.7;z<=.7;z+=.025){const scale=(CAMERA_DISTANCE-z)/CAMERA_DISTANCE;const p=this.points.worldToLocal(new Vector3(x*scale,y*scale,z));if(volumeDistance('ai',p.x,p.y,p.z)>=-.015){inside=true;break;}}
      this.crystal.touch(inside);return;
    }
    // Intersect the pointer ray with the object's central plane, then enter model space.
    const point=new Vector3(x,y,0);this.points.updateMatrixWorld();this.points.worldToLocal(point);this.motion.pointer(point.x,point.y);
  }
  leave(){this.pointerPosition={x:0,y:0};this.motion.leave();this.network.leave();this.flight.leave();this.crystal.touch(false);}
  pulse(){if(this.id==='ai')this.crystal.trigger();else if(this.id==='integrations')this.network.pulse();else this.motion.signal();}
  resize(width:number,height:number){this.width=width;this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);this.sync();}
  advance(dt:number) {
    if(this.settings.paused)return;
    this.motion.advance(dt);this.time+=dt*this.settings.speed;
    if(this.id==='ai')this.crystal.advance(dt*this.settings.speed);
    if(this.id==='rbs')this.hinges.advance(dt*this.settings.speed);
    if(this.id==='web-services')this.cloud.advance(dt*this.settings.speed);
    if(this.id==='sites')this.flight.advance(dt*this.settings.speed);
    if(this.id==='integrations')this.network.advance(dt*this.settings.speed);
    if(this.id==='support')this.shield.advance(dt*this.settings.speed);
    if(this.id==='bitrix24')this.funnel.advance(dt*this.settings.speed,this.settings.funnelFlow,this.settings.funnelLoss);
    const ease=1-Math.exp(-dt*4);
    this.size+=(this.settings.pixelSize-this.size)*ease;this.depth+=(this.settings.depth-this.depth)*ease;this.rocking+=(this.settings.rocking-this.rocking)*ease;
    this.tilt.x+=(Math.max(-1,Math.min(1,this.pointerPosition.x/(VIEW_SIZE*.5)))*.65*this.settings.reaction/100-this.tilt.x)*ease;this.tilt.y+=(Math.max(-1,Math.min(1,this.pointerPosition.y/(VIEW_SIZE*.5)))*.48*this.settings.reaction/100-this.tilt.y)*ease;
    this.shellOpacity+=(this.settings.shellOpacity-this.shellOpacity)*ease;this.accentAmount+=(this.settings.accentAmount-this.accentAmount)*ease;
    this.funnelOpacity+=(this.settings.funnelOpacity-this.funnelOpacity)*ease;
    this.setColors(false,dt);this.pose();this.sync();
  }
  private pose() {
    const rock=this.rocking/100,t=this.time;
    this.points.rotation.set(BASE_ROTATION.x+Math.sin(t*.66)*.11*rock-this.tilt.y,BASE_ROTATION.y+Math.sin(t*.48)*.24*rock+this.tilt.x,BASE_ROTATION.z+Math.sin(t*.57)*.045*rock,'ZYX');
    if(this.id==='sites'){
      const steer=this.flight.steering;
      this.points.rotation.set(BASE_ROTATION.x+Math.sin(t*.66)*.035*rock-steer.y*.12,BASE_ROTATION.y+Math.sin(t*.48)*.05*rock-steer.x*.20,BASE_ROTATION.z-steer.x*.16,'ZYX');
    }
    if(this.id==='rbs')this.points.rotation.set(BASE_ROTATION.x-this.tilt.y,BASE_ROTATION.y+this.tilt.x,BASE_ROTATION.z,'ZYX');
    this.points.position.y=this.id==='rbs'?0:Math.sin(t*.83)*.045*rock;
    if(this.id==='ai'){
      this.points.rotation.set(.07+this.crystal.shake,.4+Math.sin(this.crystal.time*.23)*.8,this.crystal.shake*.65,'ZYX');
      this.points.position.y=0;
    }
    this.points.scale.z=Math.max(.15,this.depth/100);
  }
  private sync() {
    if(this.id==='ai')for(const key of ['position','aAlpha','aSize','aColor','aSoft'])this.crystalGeometry.getAttribute(key).needsUpdate=true;
    this.crystalMaterial.uniforms.uSize.value=this.size*this.width/500*this.renderer.getPixelRatio();
    if(this.id==='rbs'){
      const shape=createParticleShape('rbs',this.settings.pixelSize,this.settings.density);
      for(let i=0;i<this.motion.count;i++){
        const j=i*3,module=shape.positions[j+1]<0?(shape.positions[j]<0?0:1):(shape.positions[j]<0?3:2);
        this.hingePositions.set(this.hinges.transform(module,this.motion.positions[j],this.motion.positions[j+1],this.motion.positions[j+2]),j);
        this.hingeNormals.set(this.hinges.transform(module,this.motion.normals[j],this.motion.normals[j+1],this.motion.normals[j+2],true),j);
      }
      for(const key of ['position','aAlpha','aSize','aColor'])this.hingeGeometry.getAttribute(key).needsUpdate=true;
    }
    (this.geometry.getAttribute('position') as BufferAttribute).array=this.id==='rbs'?this.hingePositions:this.motion.positions;
    (this.geometry.getAttribute('aNormal') as BufferAttribute).array=this.id==='rbs'?this.hingeNormals:this.motion.normals;
    this.hingeMaterial.uniforms.uSize.value=this.size*this.width/500*this.renderer.getPixelRatio();
    this.material.uniforms.uCloud.value=this.id==='web-services'?1:0;
    if(this.id==='web-services')for(const key of ['position','aAlpha','aSize','aColor'])this.cloudGeometry.getAttribute(key).needsUpdate=true;
    this.cloudMaterial.uniforms.uSize.value=this.size*this.width/500*this.renderer.getPixelRatio();
    if(this.id==='sites')for(const key of ['position','aAlpha','aSize','aColor'])this.flightGeometry.getAttribute(key).needsUpdate=true;
    this.flightMaterial.uniforms.uSize.value=this.size*this.width/500*this.renderer.getPixelRatio();
    if(this.id==='integrations')for(const key of ['position','aAlpha','aSize','aColor'])this.networkGeometry.getAttribute(key).needsUpdate=true;
    this.networkMaterial.uniforms.uSize.value=this.size*this.width/500*this.renderer.getPixelRatio();
    this.geometry.setDrawRange(0,this.motion.count);
    for(let i=0;i<8;i++){const impact=this.id==='support'?this.shield.impacts[i]:this.id==='web-services'?this.cloud.arrivals[i]:undefined;this.impactUniforms[i].set(impact?.x||0,impact?.y||0,impact?.z||1,impact?.age??-1);}
    if(this.id==='support')for(const key of ['position','aAlpha','aSize'])this.shieldGeometry.getAttribute(key).needsUpdate=true;
    if(this.id==='bitrix24')for(const key of ['position','aAlpha','aSize','aColor'])this.funnelGeometry.getAttribute(key).needsUpdate=true;
    this.funnelMaterial.uniforms.uSize.value=this.size*this.width/500*this.renderer.getPixelRatio();
    this.material.uniforms.uFunnelOpacity.value=this.funnelOpacity/100;
    this.shieldMaterial.uniforms.uSize.value=this.size*this.width/500*this.renderer.getPixelRatio();
    for(const key of ['position','aNormal','aTone','aAlpha','aSize','aSeed','aMaterial'])this.geometry.getAttribute(key).needsUpdate=true;
    this.material.uniforms.uShellOpacity.value=this.shellOpacity/100;this.material.uniforms.uAccentAmount.value=this.accentAmount/100;
    this.material.uniforms.uSize.value=this.size*this.width/500*this.renderer.getPixelRatio();
  }
  render(){this.renderer.render(this.scene,this.camera);}
  dispose(){this.crystalGeometry.dispose();this.crystalMaterial.dispose();this.hingeGeometry.dispose();this.hingeMaterial.dispose();this.cloudGeometry.dispose();this.cloudMaterial.dispose();this.flightGeometry.dispose();this.flightMaterial.dispose();this.networkGeometry.dispose();this.networkMaterial.dispose();this.funnelGeometry.dispose();this.funnelMaterial.dispose();this.shieldGeometry.dispose();this.shieldMaterial.dispose();this.geometry.dispose();this.materials.forEach(material=>material.dispose());this.renderer.dispose();}
}
