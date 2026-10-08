import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import {serviceHeroScenes} from '../src/data/service-hero-scenes.ts';
import * as shapes from '../src/scripts/hero-particle-shapes.ts';
import * as settingsModule from '../src/scripts/hero-particle-settings.ts';
import {ShieldMotion,SHIELD_RADIUS} from '../src/scripts/hero-particle-shield.ts';
import {VolumeParticleMotion} from '../src/scripts/hero-particle-motion.ts';
const {createParticleShape,PARTICLE_COUNT,volumeDistance,projectParticleShape,particleAppearance}=shapes;
const {DEFAULT_PARTICLE_SETTINGS:defaults,PARTICLE_SETTINGS_EVENT,sanitizeParticleSettings}=settingsModule;

const controller=ts.transpileModule(readFileSync(new URL('../src/scripts/hero-particles.ts',import.meta.url),'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
}).outputText;
async function fixture({reduced=false,fail=false}={}) {
  const dom=new JSDOM('<hero-particles scene="sites"><button data-particle-surface><img/><canvas data-particle-canvas></canvas></button><p data-particle-hint></p><button data-particle-retry hidden></button></hero-particles>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test/hero-lab/'});
  const w=dom.window, element=w.document.querySelector('hero-particles'), surface=element.querySelector('[data-particle-surface]');
  surface.getBoundingClientRect=()=>({width:500,height:500,left:0,top:0});
  let observer,time=0,serial=0,imports=0,draws=0,disposals=0;
  const frames=new Map(),calls=[];
  w.performance.now=()=>time;
  w.requestAnimationFrame=cb=>{frames.set(++serial,cb);return serial;};
  w.cancelAnimationFrame=id=>frames.delete(id);
  const media=new w.EventTarget();media.matches=reduced;w.matchMedia=()=>media;
  w.IntersectionObserver=class {constructor(cb){observer=cb;}observe(){}disconnect(){}};
  w.ResizeObserver=class {observe(){}disconnect(){}};
  class Renderer {
    constructor(){if(fail)throw Error('WebGL unavailable');}
    resize(){} advance(dt){calls.push(['advance',dt]);} render(){draws++;}
    pointer(x,y){calls.push(['pointer',x,y]);} leave(){} pulse(x,y){calls.push(['pulse',x,y]);}
    configure(value){calls.push(['configure',value]);} setShape(id){calls.push(['shape',id]);} dispose(){disposals++;}
  }
  w.eval(`(function(exports,require){${controller}\n})`)({},id=>{
    if(id.includes('service-hero-scenes'))return {serviceHeroScenes,isServiceHeroSceneId:id=>serviceHeroScenes.some(s=>s.id===id)};
    if(id.includes('hero-particle-settings'))return settingsModule;
    if(id.includes('hero-particle-shapes'))return shapes;
    if(id.includes('hero-particle-renderer')){imports++;return {ParticleRenderer:Renderer};}
    throw Error(id);
  });
  observer([{isIntersecting:true}]);
  for(let i=0;i<12;i++)await Promise.resolve();
  return {w,element,surface,media,calls,frames,
    get imports(){return imports;},get draws(){return draws;},get disposals(){return disposals;},
    visible(value){observer([{isIntersecting:value}]);},
    step(n=1){for(let i=0;i<n;i++){time+=1000/60;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(cb=>cb(time));}},
    pointer(type,x,y,pointerType='mouse'){const event=new w.Event(type,{cancelable:true});Object.assign(event,{clientX:x,clientY:y,pointerType});surface.dispatchEvent(event);assert.equal(event.defaultPrevented,false);},
    close(){element.remove();dom.window.close();},
  };
}

test('eight distinct 3D surfaces fit the frame, have depth, normals and matching buffers',()=>{
  const fingerprints=new Set();
  for(const {id} of serviceHeroScenes){
    const shape=createParticleShape(id);
    assert.equal(shape.positions.length,PARTICLE_COUNT*3);
    assert.equal(shape.tones.length,PARTICLE_COUNT);
    assert.equal(shape.normals.length,PARTICLE_COUNT*3);
    const depths=Array.from({length:shape.count},(_,i)=>shape.positions[i*3+2]);
    assert.ok(Math.max(...depths)-Math.min(...depths)>.3,'real depth rather than a flat mask');
    for(let i=0;i<shape.count;i++)assert.ok(Math.abs(Math.hypot(...shape.normals.slice(i*3,i*3+3))-1)<.001);
    const projected=projectParticleShape(shape);
    assert.ok(projected.length>shape.count*.15);
    assert.ok(projected.every(p=>Math.abs(p.x)<1.3&&Math.abs(p.y)<1.3));
    assert.ok(shape.positions.every(Number.isFinite));
    assert.ok(shape.positions.every(v=>Math.abs(v)<1.2),'shape leaves room for cursor displacement');
    assert.ok(shape.count>200&&shape.count<PARTICLE_COUNT);
    assert.equal(shape.pixelSize,6);
    assert.ok(shape.tones.every(v=>v>=0&&v<=1));
    assert.equal(createParticleShape(id),shape,'reuse sampled masks when switching back');
    fingerprints.add(shape.positions.slice(0,30).join(','));
  }
  assert.equal(fingerprints.size,8);
  assert.ok(volumeDistance('support',0,0,0)>0,'sphere surrounds its core');
  assert.ok(volumeDistance('web-services',0,0,0)>0,'cloud has a solid rounded body');
  assert.ok(volumeDistance('bitrix24',0,.65,0)<0,'funnel is hollow');
  assert.ok(volumeDistance('ai',0,0,0)>0,'crystal has a solid centre');
  assert.ok(volumeDistance('ai',.55,.55,0)<0,'elongated crystal tapers toward its tips');
});

test('pointer movement reaches the engine in artwork coordinates and keyboard triggers a signal',async()=>{
  const app=await fixture();
  assert.equal(app.imports,1);assert.equal(app.surface.disabled,false);
  app.pointer('pointermove',375,125);
  assert.deepEqual(app.calls.at(-1),['pointer',.675,.675]);
  app.pointer('pointerdown',250,250);app.pointer('pointerup',250,250);
  assert.deepEqual(app.calls.at(-1),['pulse',undefined,undefined]);
  app.surface.click();assert.deepEqual(app.calls.at(-1),['pulse',undefined,undefined]);
  app.step(10);assert.ok(app.draws>1,'ambient motion actually draws new frames');
  app.element.setAttribute('scene','ai');assert.deepEqual(app.calls.at(-1),['shape','ai']);
  assert.match(app.element.querySelector('img').src,/particles\/ai.webp$/);
  app.close();assert.equal(app.disposals,1);assert.equal(app.frames.size,0);
});

test('touch scroll is preserved, while a tap starts a signal',async()=>{
  const app=await fixture();
  app.pointer('pointerdown',100,100,'touch');app.pointer('pointermove',100,180,'touch');app.pointer('pointerup',100,180,'touch');
  assert.equal(app.calls.filter(c=>c[0]==='pulse').length,0);
  app.pointer('pointerdown',100,100,'touch');app.pointer('pointerup',102,101,'touch');
  assert.equal(app.calls.filter(c=>c[0]==='pulse').length,1);
  app.close();
});

test('rendering pauses outside the viewport and resumes without elapsed-time jumps',async()=>{
  const app=await fixture();app.step(10);app.visible(false);
  const draws=app.draws;assert.equal(app.frames.size,0);app.step(300);assert.equal(app.draws,draws);
  app.visible(true);app.step(4);assert.ok(app.draws>draws);
  assert.ok(app.calls.filter(c=>c[0]==='advance').every(c=>c[1]<=.06));app.close();
});

test('reduced motion loads only the static pixels, and follows preference changes',async()=>{
  const app=await fixture({reduced:true});
  assert.equal(app.imports,0);assert.equal(app.frames.size,0);assert.equal(app.surface.disabled,true);
  app.element.setAttribute('scene','elma');assert.match(app.element.querySelector('img').src,/elma.webp$/);
  app.media.matches=false;app.media.dispatchEvent(new app.w.Event('change'));
  for(let i=0;i<12;i++)await Promise.resolve();
  assert.equal(app.imports,1);assert.ok(app.frames.size);
  app.media.matches=true;app.media.dispatchEvent(new app.w.Event('change'));
  assert.equal(app.frames.size,0);assert.equal(app.element.hasAttribute('data-rendered'),false);app.close();
});

test('a failed renderer is visible as a static fallback with a retry, including context loss',async()=>{
  const failed=await fixture({fail:true});
  assert.equal(failed.surface.disabled,true);assert.equal(failed.element.hasAttribute('data-rendered'),false);
  assert.equal(failed.element.querySelector('[data-particle-retry]').hidden,false);failed.close();
  const app=await fixture();app.element.querySelector('canvas').dispatchEvent(new app.w.Event('webglcontextlost',{cancelable:true}));
  assert.equal(app.frames.size,0);assert.equal(app.element.hasAttribute('data-rendered'),false);
  assert.equal(app.element.querySelector('[data-particle-retry]').hidden,false);app.close();
});


test('volume motion is continuous, active on all axes, bounded and lifts on hover without a radial hole',()=>{
  const shape=createParticleShape('sites');
  const motion=new VolumeParticleMotion(PARTICLE_COUNT,{...defaults,speed:1.5,distance:30,reaction:100});
  motion.setShape(shape,true);motion.pointer(0,0);motion.signal();
  let moves=0,depthMoves=0;
  for(let frame=0;frame<240;frame++){
    const before=motion.positions.slice();motion.advance(1/60);
    for(let i=0;i<shape.count;i++){
      const j=i*3,dx=Math.abs(motion.positions[j]-before[j]),dy=Math.abs(motion.positions[j+1]-before[j+1]),dz=Math.abs(motion.positions[j+2]-before[j+2]);
      assert.ok(Math.max(dx,dy,dz)<.04,'bounded speed even with maximum controls');
      assert.ok(Math.hypot(motion.positions[j]-shape.positions[j],motion.positions[j+1]-shape.positions[j+1])<.33,'no large radial clearing');
      assert.ok(Math.abs(motion.positions[j+2]-shape.positions[j+2])<.6);
      if(dx+dy>.0001)moves++;if(dz>.0001)depthMoves++;
    }
  }
  assert.ok(moves>shape.count*100);assert.ok(depthMoves>shape.count*100);
  motion.configure({...defaults,paused:true});const paused=motion.positions.slice();motion.advance(.05);assert.deepEqual(motion.positions,paused);
});

test('interrupted morphs preserve displayed positions and settle into a new 3D surface',()=>{
  const motion=new VolumeParticleMotion(PARTICLE_COUNT,{...defaults,distance:0,rocking:0});
  motion.setShape(createParticleShape('ai'),true);
  for(const id of ['integrations','sites','elma']){
    const before=motion.positions.slice();motion.setShape(createParticleShape(id));
    for(let i=0;i<300;i++)assert.equal(motion.positions[i],before[i]);
    for(let frame=0;frame<30;frame++){
      const previous=motion.positions.slice();motion.advance(1/60);
      for(let i=0;i<300;i++)assert.ok(Math.abs(motion.positions[i]-previous[i])<.12);
    }
  }
  for(let frame=0;frame<300;frame++)motion.advance(1/60);
  const shape=createParticleShape('elma');
  for(let i=0;i<shape.count*3;i++)assert.ok(Math.abs(motion.positions[i]-shape.positions[i])<.002);
  motion.setShape(createParticleShape('elma',12,35),false,true);
  for(let frame=0;frame<120;frame++)motion.advance(1/60);
  assert.ok(motion.positions.every(Number.isFinite),'density changes never introduce invalid particles');
});

test('live settings pause/resume, persist across scene switches and update the background',async()=>{
  const app=await fixture();
  const paused={...defaults,paused:true,background:'#111111'};
  app.w.dispatchEvent(new app.w.CustomEvent(PARTICLE_SETTINGS_EVENT,{detail:paused}));
  assert.equal(app.frames.size,0);assert.equal(app.surface.disabled,true);
  assert.equal(app.surface.style.getPropertyValue('--particle-background'),'#111111');
  app.element.setAttribute('scene','support');
  assert.equal(app.frames.size,0);assert.deepEqual(app.calls.at(-1),['shape','support']);
  app.w.dispatchEvent(new app.w.CustomEvent(PARTICLE_SETTINGS_EVENT,{detail:{...paused,paused:false}}));
  assert.equal(app.surface.disabled,false);assert.ok(app.frames.size);app.close();
});

test('settings reject invalid storage values and pixel size controls a bounded sampling budget',()=>{
  const result=sanitizeParticleSettings({pixelSize:100,density:-20,speed:NaN,distance:-1,depth:300,chaos:-1,rocking:Infinity,primary:'red',secondary:'#abcdef',paused:'true'});
  assert.equal(result.pixelSize,12);assert.equal(result.density,35);assert.equal(result.speed,defaults.speed);
  assert.equal(result.depth,160);assert.equal(result.chaos,0);assert.equal(result.rocking,defaults.rocking);
  assert.equal(result.distance,0);assert.equal(result.primary,defaults.primary);assert.equal(result.secondary,'#ABCDEF');assert.equal(result.paused,false);
  for(const {id} of serviceHeroScenes)for(const size of [3,6,12])for(const density of [35,100]){
    const shape=createParticleShape(id,size,density);
    assert.ok(shape.count>10&&shape.count<=PARTICLE_COUNT);
    assert.ok(shape.positions.every(Number.isFinite));
  }
  assert.ok(createParticleShape('ai',3).count>createParticleShape('ai',12).count);
});

test('settings popup previews without persisting until Save, validates HEX, resets and returns focus on Escape',async()=>{
  const dom=new JSDOM(`<hero-particle-settings><button data-settings-open hidden>Настройки</button><dialog><button data-settings-close>Закрыть</button><input data-setting name="pixelSize" type="range" min="3" max="12" step=".5" data-unit="px"><output data-output="pixelSize"></output><input data-setting name="primary" type="color"><input data-color-text name="primary"><button data-settings-pause></button><button data-settings-reset></button><button data-settings-save>Сохранить</button><p data-settings-status></p></dialog></hero-particle-settings>`,{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;w.matchMedia=()=>({matches:false});
  w.HTMLDialogElement.prototype.show=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const compile=path=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const settings={};w.eval(`(function(exports,require){${compile('../src/scripts/hero-particle-settings.ts')}\n})`)(settings,()=>({default:defaults}));
  w.eval(`(function(exports,require){${compile('../src/scripts/hero-particle-settings-panel.ts')}\n})`)({},()=>settings);
  const panel=w.document.querySelector('hero-particle-settings'),open=panel.querySelector('[data-settings-open]'),dialog=panel.querySelector('dialog');
  open.click();assert.equal(dialog.open,true);assert.equal(open.getAttribute('aria-expanded'),'true');
  let updated;w.addEventListener(PARTICLE_SETTINGS_EVENT,e=>updated=e.detail);
  const size=panel.querySelector('[name="pixelSize"]');size.value='9';size.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(updated.pixelSize,9);assert.equal(w.localStorage.getItem(settings.PARTICLE_SETTINGS_KEY),null);
  panel.querySelector('[data-settings-save]').click();await Promise.resolve();
  assert.equal(JSON.parse(w.localStorage.getItem(settings.PARTICLE_SETTINGS_KEY)).settings.pixelSize,9);
  const hex=panel.querySelector('[data-color-text]');hex.value='bad';hex.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(hex.getAttribute('aria-invalid'),'true');assert.equal(updated.primary,defaults.primary);
  hex.value='#ab3344';hex.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(updated.primary,'#AB3344');
  panel.querySelector('[data-settings-pause]').click();assert.equal(updated.paused,true);
  panel.querySelector('[data-settings-reset]').click();assert.deepEqual(JSON.parse(JSON.stringify(updated)),defaults);
  panel.setAttribute('data-project-save','');
  w.fetch=async()=>({ok:false});panel.querySelector('[data-settings-save]').click();
  for(let i=0;i<4;i++)await Promise.resolve();
  assert.match(panel.querySelector('[data-settings-status]').textContent,/Не удалось сохранить/);
  assert.equal(panel.querySelector('[data-settings-save]').disabled,false);
  let request;w.fetch=async(url,options)=>{request={url,options};return {ok:true};};
  panel.querySelector('[data-settings-save]').click();for(let i=0;i<4;i++)await Promise.resolve();
  assert.equal(request.url,'/__hero-particles/defaults');assert.equal(request.options.method,'POST');
  assert.deepEqual(JSON.parse(request.options.body),defaults);
  assert.match(panel.querySelector('[data-settings-status]').textContent,/Сохранено как настройки проекта/);
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(dialog.open,false);assert.equal(w.document.activeElement,open);
  panel.remove();dom.window.close();
});


test('the pearl palette stays light, blue accents stay sparse and the core is visible through both shell sides',()=>{
  const body=createParticleShape('sites');
  const accentCount=Array.from(body.tones.slice(0,body.count)).filter(seed=>seed<defaults.accentAmount/100).length;
  assert.ok(accentCount/body.count>.025&&accentCount/body.count<.075);
  for(const light of [0,.22,.5,1]) {
    const normal=particleAppearance({light,seed:.8,material:0,facing:1},defaults);
    assert.ok(normal.color.every(channel=>channel>=169),'neutral shadows never approach black');
    assert.ok(Math.max(...normal.color)-Math.min(...normal.color)<30);
    assert.equal(normal.alpha,1);
  }
  const sphere=createParticleShape('support'),projected=projectParticleShape(sphere);
  const shell=projected.filter(p=>p.material===1),core=projected.filter(p=>p.material===2);
  assert.ok(core.length>50&&shell.length>500);
  assert.ok(shell.some(p=>p.facing<0)&&shell.some(p=>p.facing>0),'both sides of a translucent shell are retained');
  assert.ok(shell.every(p=>particleAppearance(p,defaults).alpha<=.4));
  assert.ok(core.every(p=>particleAppearance(p,defaults).alpha===1));
  const blue=particleAppearance(core[0],defaults).color;
  assert.ok(blue[2]>blue[0]&&blue[1]>blue[0],'the protected core is light blue');
  const changed=particleAppearance(core[0],{...defaults,coreColor:'#79ABAA'}).color;
  assert.ok(changed[1]>changed[0],'custom core color controls the entire highlight palette');
});

test('saved browser preferences apply only to the matching project defaults',()=>{
  const dom=new JSDOM('',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window;
  w.localStorage.setItem('ittn.hero-particles.v4',JSON.stringify({...defaults,coreColor:'#D9877C'}));
  const source=ts.transpileModule(readFileSync(new URL('../src/scripts/hero-particle-settings.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const settings={};w.eval(`(function(exports,require){${source}\n})`)(settings,()=>({default:defaults}));
  assert.equal(settings.readParticleSettings().coreColor,defaults.coreColor,'legacy browser choices must not hide new project defaults');
  settings.saveParticleSettings({...defaults,coreColor:'#C78877',accentAmount:3,shellOpacity:55});
  const restored=settings.readParticleSettings();
  assert.equal(restored.coreColor,'#C78877');assert.equal(restored.accentAmount,3);assert.equal(restored.shellOpacity,55);
  const stored=JSON.parse(w.localStorage.getItem(settings.PARTICLE_SETTINGS_KEY));stored.version='outdated';
  w.localStorage.setItem(settings.PARTICLE_SETTINGS_KEY,JSON.stringify(stored));
  assert.equal(settings.readParticleSettings().coreColor,defaults.coreColor);
  dom.window.close();
});

test('shield streams hit the shell, fragment outward and stay within a bounded pool',()=>{
  const shield=new ShieldMotion();shield.reset();
  const quadrants=new Set();let impacts=0,fragments=0;
  for(let step=0;step<1800;step++) {
    shield.advance(1/60);
    assert.ok(shield.impacts.length<=8);
    for(const impact of shield.impacts){assert.ok(Math.abs(Math.hypot(impact.x,impact.y,impact.z)-1)<1e-6);if(impact.age<.02)impacts++;}
    for(let i=0;i<shield.alphas.length;i++)if(shield.alphas[i]>.01){
      const [x,y,z]=shield.positions.slice(i*3,i*3+3);
      assert.ok(Math.hypot(x,y,z)>=SHIELD_RADIUS-1e-6,'no red particle penetrates the shield');
      assert.ok(Math.hypot(x,y,z)<1.7,'the stream is bounded');
      quadrants.add(`${x>=0?1:-1},${y>=0?1:-1},${z>=0?1:-1}`);
      if(i%7)fragments++;
    }
  }
  assert.ok(impacts>20&&fragments>100);assert.equal(quadrants.size,8,'attacks arrive from every octant');
  shield.reset();assert.ok(shield.positions.every(Number.isFinite));
});

test('funnel has four translucent stages, visible interior surfaces and ordered color transitions',async()=>{
  const {funnelColor,FUNNEL_COLORS,funnelStage}=await import('../src/scripts/hero-particle-funnel.ts');
  const shape=createParticleShape('bitrix24'),points=projectParticleShape(shape);
  assert.ok(points.every(p=>p.material===3));
  assert.ok(points.some(p=>p.facing<0)&&points.some(p=>p.facing>0));
  for(const [stage,y] of [.6,.2,-.2,-.6].entries()){
    assert.equal(funnelStage(y),stage);
    assert.deepEqual(funnelColor(y),[1,3,5].map(i=>parseInt(FUNNEL_COLORS[stage].slice(i,i+2),16)/255));
    const sample=points.find(p=>Math.abs(p.height-y)<.03);
    assert.ok(sample);
    const appearance=particleAppearance(sample,{...defaults,funnelOpacity:35});
    assert.ok(appearance.alpha>0&&appearance.alpha<.4);
  }
  assert.deepEqual(funnelColor(-1.2),funnelColor(-.6),'every exiting pixel is red');
});

test('funnel flow stays inside its walls, all exits are red and losses reduce throughput',async()=>{
  const {FunnelMotion,funnelRadius,funnelColor}=await import('../src/scripts/hero-particle-funnel.ts');
  const complete=new FunnelMotion(),lossy=new FunnelMotion();let allExits=0,reducedExits=0,entries=0;
  for(let step=0;step<1200;step++){
    complete.advance(1/60,65,0);lossy.advance(1/60,65,50);
    for(let i=0;i<complete.alphas.length;i++)if(complete.alphas[i]>.02){
      const [x,y,z]=complete.positions.slice(i*3,i*3+3);
      if(y<.7&&y>-.78)assert.ok(Math.hypot(x,z)<funnelRadius(y)-.075);
      if(y>.8){entries++;assert.deepEqual(Array.from(complete.colors.slice(i*3,i*3+3)).map(v=>v.toFixed(5)),funnelColor(1).map(v=>v.toFixed(5)));}
      if(y<-.85){allExits++;assert.deepEqual(Array.from(complete.colors.slice(i*3,i*3+3)).map(v=>v.toFixed(5)),funnelColor(-1).map(v=>v.toFixed(5)));}
    }
    for(let i=0;i<lossy.alphas.length;i++)if(lossy.alphas[i]>.02&&lossy.positions[i*3+1]<-.85)reducedExits++;
  }
  assert.ok(entries>100&&allExits>100);assert.ok(reducedExits<allExits*.7&&reducedExits>allExits*.3);
  complete.advance(0,0,0);assert.ok(complete.alphas.every(a=>a===0),'zero intensity stops the stream');
});

test('lost funnel pixels rupture into six same-color fragments, then fully expire',async()=>{
  const {FunnelMotion,FUNNEL_FLOW_CAPACITY,FUNNEL_FRAGMENTS,FUNNEL_BURST_DURATION}=await import('../src/scripts/hero-particle-funnel.ts');
  const flow=new FunnelMotion();flow.advance(0,100,60);
  let observed=false;
  for(let frame=0;frame<600&&!observed;frame++){
    const before=flow.alphas.slice();flow.advance(1/120,100,60);
    for(let i=0;i<FUNNEL_FLOW_CAPACITY;i++){
      const first=FUNNEL_FLOW_CAPACITY+i*FUNNEL_FRAGMENTS;
      if(before[first]===0&&flow.alphas[first]>.75){
        observed=true;
        assert.equal(flow.alphas[i],0,'the original pixel disappears on rupture');
        const color=Array.from(flow.colors.slice(first*3,first*3+3));
        const positions=flow.positions.slice(first*3,(first+6)*3);
        const alpha=flow.alphas[first],size=flow.sizes[first];
        for(let j=0;j<6;j++){assert.ok(flow.alphas[first+j]>0);assert.deepEqual(Array.from(flow.colors.slice((first+j)*3,(first+j+1)*3)),color);}
        flow.advance(.05,100,60);
        assert.notDeepEqual(flow.positions.slice(first*3,(first+6)*3),positions);
        assert.ok(flow.alphas[first]<alpha&&flow.sizes[first]<size);
        assert.deepEqual(Array.from(flow.colors.slice(first*3,first*3+3)),color,'fragment color stays at the lost stage');
        for(let n=0;n<Math.ceil(FUNNEL_BURST_DURATION/.05);n++)flow.advance(.05,100,60);
        for(let j=0;j<6;j++)assert.equal(flow.alphas[first+j],0,'no fragments remain after the burst');
        break;
      }
    }
  }
  assert.ok(observed,'at least one new rupture occurred');
  flow.advance(0,0,60);assert.ok(flow.alphas.every(a=>a===0),'zero flow also clears fragments');
  flow.reset();assert.ok(flow.alphas.every(a=>a===0));
});

test('network swipe ruptures locally, waits for pointer departure and restores transfer',async()=>{
  const {NetworkMotion,NETWORK_STEPS}=await import('../src/scripts/hero-particle-network.ts');
  const network=new NetworkMotion();network.reset();
  const project=([x,y])=>({x,y}),p=network.point(2,.62),stride=NETWORK_STEPS+9,base=2*stride;
  network.pointer(p[0]-.15,p[1]-.15,project);
  network.pointer(p[0]+.15,p[1]+.15,project);
  assert.equal(network.links[2].broken,true,'swept hit catches crossed strand');
  network.advance(.1);
  assert.ok(network.alphas.slice(base+NETWORK_STEPS+3,base+stride).every(a=>a>0),'six visible shards');
  for(let i=base+NETWORK_STEPS+3;i<base+stride;i++){
    const [r,g,b]=network.colors.slice(i*3,i*3+3);
    assert.ok(r>g*1.5&&r>b*1.5,'rupture sparks use the red shield palette');
  }
  assert.ok(network.alphas.slice(base+NETWORK_STEPS,base+NETWORK_STEPS+3).every(a=>a===0),'transfer stops on cut strand');
  assert.ok(network.alphas.slice(base,base+NETWORK_STEPS).some(a=>a===0),'a real gap opens');
  network.pointer(p[0],p[1],project);
  for(let i=0;i<100;i++)network.advance(.05);
  assert.equal(network.links[2].broken,true,'held pointer prevents repair');
  assert.ok(network.alphas.slice(base+NETWORK_STEPS+3,base+stride).every(a=>a===0),'shards expire even while held');
  network.leave();
  for(let i=0;i<50;i++)network.advance(.05);
  assert.equal(network.links[2].broken,false);
  assert.ok(network.alphas.slice(base,base+NETWORK_STEPS).every(a=>a>.5),'whole strand is restored');
  let packets=false;for(let i=0;i<100;i++){network.advance(.05);packets ||= network.alphas.slice(base+NETWORK_STEPS,base+NETWORK_STEPS+3).some(a=>a>0);}
  assert.ok(packets,'transfer resumes');
  network.pointer(p[0],p[1],project);assert.equal(network.links[2].broken,true,'can break again');
  network.reset();assert.ok(network.links.every(link=>!link.broken));
  assert.ok(network.positions.every(Number.isFinite));
});

test('integration touch reaches network without cancelling page scroll and pauses safely',async()=>{
  const app=await fixture();app.element.setAttribute('scene','integrations');
  app.pointer('pointerdown',310,290,'touch');app.pointer('pointermove',330,310,'touch');app.pointer('pointerup',330,310,'touch');
  assert.equal(app.calls.filter(c=>c[0]==='pointer').length,2);
  assert.equal(app.calls.filter(c=>c[0]==='pulse').length,0,'touch does not also break an unrelated link');
  app.w.dispatchEvent(new app.w.CustomEvent(PARTICLE_SETTINGS_EVENT,{detail:{...defaults,paused:true}}));
  app.pointer('pointerdown',310,290,'touch');app.pointer('pointermove',330,310,'touch');
  assert.equal(app.calls.filter(c=>c[0]==='pointer').length,2);
  app.close();
});


test('all network strands remain visible through multiple former fade cycles',async()=>{
  const {NetworkMotion,NETWORK_EDGES,NETWORK_STEPS}=await import('../src/scripts/hero-particle-network.ts');
  const network=new NetworkMotion();network.reset();
  const stride=NETWORK_STEPS+9;
  for(let frame=0;frame<=360;frame++){
    for(let edge=0;edge<NETWORK_EDGES.length;edge++){
      assert.ok(network.alphas.slice(edge*stride,edge*stride+NETWORK_STEPS).every(a=>Math.abs(a-.58)<.00001),'idle links never fade or disappear');
      for(let i=edge*stride+NETWORK_STEPS;i<edge*stride+NETWORK_STEPS+3;i++){
        if(network.alphas[i]>0)assert.ok(network.colors[i*3+2]>network.colors[i*3],'data packets stay blue');
      }
    }
    network.advance(.1);
  }
});

test('flight has sparse forward-moving stars, invisible wraps and smooth shared steering',async()=>{
  const {FlightMotion,FLIGHT_STAR_COUNT,FLIGHT_CAMERA_DISTANCE}=await import('../src/scripts/hero-particle-flight.ts');
  const flight=new FlightMotion();flight.reset();
  assert.equal(FLIGHT_STAR_COUNT,28);
  const initial=flight.positions.slice();flight.advance(.05);
  for(let i=0;i<FLIGHT_STAR_COUNT;i++)assert.ok(Math.abs(flight.positions[i*3+2]-initial[i*3+2]-.132)<.00001,'stars approach at the increased flight speed');
  flight.pointer(1,-1);flight.advance(.05);
  assert.ok(flight.steering.x>0&&flight.steering.x<.2,'no sudden bank');
  assert.ok(flight.steering.y<0&&flight.steering.y>-.2);
  for(let frame=0;frame<900;frame++){
    const previous=flight.positions.slice(),alphas=flight.alphas.slice();flight.advance(.025);
    let visible=0;
    for(let i=0;i<FLIGHT_STAR_COUNT;i++){
      const z=flight.positions[i*3+2],p=FLIGHT_CAMERA_DISTANCE/(FLIGHT_CAMERA_DISTANCE-z);
      if(flight.alphas[i]>.02)visible++;
      if(z<previous[i*3+2])assert.ok(alphas[i]<.02&&flight.alphas[i]<.02,'wrap is hidden');
      if(Math.max(Math.abs(flight.positions[i*3]*p),Math.abs(flight.positions[i*3+1]*p))>1.34)assert.equal(flight.alphas[i],0);
    }
    assert.ok(visible<=28&&visible>=5,'sparse but continuously readable flight');
  }
  flight.leave();for(let i=0;i<100;i++)flight.advance(.05);
  assert.ok(Math.abs(flight.steering.x)+Math.abs(flight.steering.y)<.001,'returns to neutral');
  flight.reset();assert.deepEqual(flight.positions,initial);
  const still=flight.positions.slice();flight.advance(0);assert.deepEqual(flight.positions,still);
});

test('cloud exchanges single pixels and clusters through its surface in both directions',async()=>{
  const {CloudMotion,CLOUD_STREAMS,CLOUD_GROUP_SIZE}=await import('../src/scripts/hero-particle-cloud.ts');
  const cloud=new CloudMotion((x,y,z)=>volumeDistance('web-services',x,y,z));
  const initial=cloud.positions.slice();let singles=0,groups=0,inbound=0,outbound=0,arrivals=0;
  for(let frame=0;frame<900;frame++){
    const before=cloud.positions.slice(),alpha=cloud.alphas.slice();cloud.advance(.025);
    let active=0;
    for(let lane=0;lane<CLOUD_STREAMS;lane++){
      const base=lane*CLOUD_GROUP_SIZE,count=cloud.alphas.slice(base,base+CLOUD_GROUP_SIZE).filter(a=>a>.02).length;
      if(count){active++;if(count===1)singles++;else {groups++;assert.ok(count>=3&&count<=7);}}
      if(alpha[base]>.4&&cloud.alphas[base]>.4){
        const j=base*3,r=Math.hypot(cloud.positions[j],cloud.positions[j+1]-.12,cloud.positions[j+2]),previous=Math.hypot(before[j],before[j+1]-.12,before[j+2]);
        if(lane%2===0&&r<previous)inbound++;if(lane%2===1&&r>previous)outbound++;
      }
    }
    assert.ok(active<=8&&active>=4,'bounded, asynchronous traffic');
    for(const hit of cloud.arrivals){assert.ok(Math.abs(volumeDistance('web-services',hit.x,hit.y,hit.z))<.001,'arrival follows the actual cloud boundary');arrivals++;}
    assert.ok(cloud.arrivals.length<=8);
    assert.ok(cloud.positions.every(Number.isFinite));
  }
  assert.ok(singles>0&&groups>0&&inbound>0&&outbound>0&&arrivals>0);
  cloud.reset();assert.deepEqual(cloud.positions,initial);assert.equal(cloud.arrivals.length,0);
  const paused=cloud.positions.slice();cloud.advance(0);assert.deepEqual(cloud.positions,paused);
});

test('sketched 2×2×2 route keeps one moving cube, valid hinges and continuous repeated permutations',async()=>{
  const {HingeMotion,HINGE_CENTERS,HINGE_CELLS,HINGE_ROUTE,HINGE_CUBE_HALF:h}=await import('../src/scripts/hero-particle-hinges.ts');
  const motion=new HingeMotion(),dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const basis=[[1,0,0],[0,1,0],[0,0,1]],shape=createParticleShape('rbs'),faces=Array.from({length:4},()=>Array(6).fill(0));
  for(let i=0;i<shape.count;i++){
    const j=i*3,module=shape.positions[j+1]<0?(shape.positions[j]<0?0:1):(shape.positions[j]<0?3:2);
    for(let axis=0;axis<3;axis++)if(Math.abs(shape.normals[j+axis])>.95)faces[module][axis*2+(shape.normals[j+axis]>0?1:0)]++;
  }
  assert.ok(faces.flat().every(count=>count>20),'all six faces of every cube exist');
  // Drawn frames, in stable module order: named cubes 3, 4, 2, 1.
  const frames=[[3,4,2,1],[3,4,2,5],[3,8,2,5],[3,8,1,5],[4,8,1,5],[4,8,3,5],[4,8,3,7],[4,8,1,7],[4,6,1,7],[4,6,1,3],[8,6,1,3]];
  const initial=HINGE_CENTERS.map((p,i)=>motion.transform(i,...p));
  let previous=initial;const movedModules=new Set();
  for(let moveIndex=0;moveIndex<48;moveIndex++){
    if(moveIndex<frames.length)assert.deepEqual(motion.occupiedCells,frames[moveIndex],'matches hand-drawn frame');
    const move=motion.currentMove;
    assert.deepEqual([move.from,move.to],HINGE_ROUTE[moveIndex%12]);
    const localHinge=[move.module,move.support].map(module=>{
      const center=motion.transform(module,...HINGE_CENTERS[module]),delta=move.pivot.map((n,k)=>n-center[k]);
      return basis.map((axis,k)=>dot(delta,motion.transform(module,...axis,true))+HINGE_CENTERS[module][k]);
    });
    const samples=100,dt=move.duration/samples;
    for(let sample=0;sample<samples;sample++){
      motion.advance(dt);
      const centers=HINGE_CENTERS.map((p,i)=>motion.transform(i,...p));
      const axes=HINGE_CENTERS.map((_,i)=>basis.map(axis=>motion.transform(i,...axis,true)));
      let moving=0;
      for(let i=0;i<4;i++){
        const distance=Math.hypot(...centers[i].map((n,k)=>n-previous[i][k]));
        assert.ok(distance<.04,'no jump at moves or lap boundaries');
        if(distance>1e-9){moving++;movedModules.add(i);}
        for(const axis of axes[i])assert.ok(Math.abs(Math.hypot(...axis)-1)<1e-9);
        for(const x of [-h,h])for(const y of [-h,h])for(const z of [-h,h]){
          const p=motion.transform(i,HINGE_CENTERS[i][0]+x,HINGE_CENTERS[i][1]+y,z),q=shapes.rotateParticle(...p),scale=shapes.CAMERA_DISTANCE/(shapes.CAMERA_DISTANCE-q[2]);
          assert.ok(Math.max(Math.abs(q[0]*scale),Math.abs(q[1]*scale))<1.28,'fits artwork frame');
        }
        for(let j=i+1;j<4;j++){
          const delta=centers[j].map((n,k)=>n-centers[i][k]);
          const candidates=[...axes[i],...axes[j],...axes[i].flatMap(u=>axes[j].map(v=>cross(u,v)))];
          assert.ok(candidates.some(axis=>Math.hypot(...axis)>1e-8&&Math.abs(dot(delta,axis))>=h*(axes[i].reduce((sum,v)=>sum+Math.abs(dot(v,axis)),0)+axes[j].reduce((sum,v)=>sum+Math.abs(dot(v,axis)),0))-.000001),`intersection at move ${moveIndex}, sample ${sample}`);
        }
      }
      assert.ok(moving<=1,'exactly one cube at a time');
      for(const [index,module] of [move.module,move.support].entries()){
        const p=motion.transform(module,...localHinge[index]);
        assert.ok(Math.hypot(...p.map((n,k)=>n-move.pivot[k]))<1e-8,'same material edge stays attached to stationary support');
      }
      previous=centers;
    }
    // Clear sub-picosecond floating-point residue at a rest, without a pose reset.
    if(motion.currentMove.from===move.from&&motion.currentMove.to===move.to)motion.advance(1e-10);
    assert.equal(new Set(motion.occupiedCells).size,4);
    for(let i=0;i<4;i++)assert.ok(Math.hypot(...motion.transform(i,...HINGE_CENTERS[i]).map((n,k)=>n-HINGE_CELLS[motion.occupiedCells[i]-1][k]))<1e-8);
  }
  assert.equal(movedModules.size,4);
  assert.deepEqual(motion.occupiedCells,[3,4,2,1],'identities return after four laps, without resets');
  for(let i=0;i<4;i++)assert.ok(Math.hypot(...previous[i].map((n,k)=>n-initial[i][k]))<1e-8);
  const still=motion.positions.slice();motion.advance(0);assert.deepEqual(motion.positions,still);
  motion.reset();assert.deepEqual(motion.occupiedCells,[3,4,2,1]);
});


test('crystal shimmers at rest and processes one blue input into a later warm pink output',async()=>{
  const {CrystalMotion,CRYSTAL_CORE,CRYSTAL_DURATION}=await import('../src/scripts/hero-particle-crystal.ts');
  const crystal=new CrystalMotion();crystal.reset();
  const before=crystal.colors.slice();crystal.advance(.5);
  assert.notDeepEqual(crystal.colors.slice(0,CRYSTAL_CORE*3),before.slice(0,CRYSTAL_CORE*3));
  assert.ok(crystal.alphas.slice(CRYSTAL_CORE).every(a=>a===0),'idle has no streams');
  crystal.touch(false);assert.equal(crystal.active,false);
  crystal.touch(true);assert.equal(crystal.active,true);
  assert.equal(crystal.trigger(),false,'cannot restart an active process');
  let blue=0,pink=0,shake=0;
  for(let frame=0;frame<420;frame++){
    crystal.advance(.01);
    if(Math.abs(crystal.shake)>.001)shake++;
    for(let i=CRYSTAL_CORE;i<crystal.alphas.length;i++){
      if(crystal.alphas[i]<.02)continue;
      const [r,g,b]=crystal.colors.slice(i*3,i*3+3),y=crystal.positions[i*3+1];
      if(i<CRYSTAL_CORE+36){blue++;assert.ok(b>r&&y>0);}
      else {pink++;assert.ok(r>b&&r>g&&y<0);assert.ok(crystal.age>=1.95,'output follows input and processing');}
    }
    assert.ok(Math.abs(crystal.shake)<=.014);
    for(let i=0;i<CRYSTAL_CORE;i++)assert.ok(volumeDistance('ai',...crystal.positions.slice(i*3,i*3+3))>0,'glow stays inside crystal');
  }
  assert.ok(blue&&pink&&shake);assert.equal(crystal.active,false);
  crystal.touch(true);assert.equal(crystal.active,false,'holding hover does not repeat');
  crystal.touch(false);crystal.touch(true);assert.equal(crystal.active,true,'re-entry starts next process');
  crystal.advance(CRYSTAL_DURATION);assert.equal(crystal.active,false);
  const still=crystal.positions.slice();crystal.advance(0);assert.deepEqual(crystal.positions,still);
  crystal.reset();assert.equal(crystal.age,-1);assert.ok(crystal.alphas.slice(CRYSTAL_CORE).every(a=>a===0));
  const shape=createParticleShape('ai'),projected=projectParticleShape(shape);
  assert.ok(projected.some(p=>p.material===1&&p.facing<0));assert.ok(projected.some(p=>p.material===5));
});

test('crystal touch tests the contact position once, preserves scrolling and supports keyboard',async()=>{
  const app=await fixture();app.element.setAttribute('scene','ai');
  app.pointer('pointerdown',250,250,'touch');app.pointer('pointerup',250,250,'touch');
  assert.equal(app.calls.filter(c=>c[0]==='pointer').length,1);
  assert.equal(app.calls.filter(c=>c[0]==='pulse').length,0,'tap cannot bypass shape hit testing');
  const click=new app.w.MouseEvent('click',{detail:0});app.surface.dispatchEvent(click);
  assert.equal(app.calls.filter(c=>c[0]==='pulse').length,1,'keyboard can activate conversion');
  app.w.dispatchEvent(new app.w.CustomEvent(PARTICLE_SETTINGS_EVENT,{detail:{...defaults,paused:true}}));
  app.pointer('pointerdown',250,250,'touch');app.pointer('pointerup',250,250,'touch');
  assert.equal(app.calls.filter(c=>c[0]==='pointer').length,1,'pause prevents touch activation');
  app.close();
});
