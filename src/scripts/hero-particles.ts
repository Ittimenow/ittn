import { isServiceHeroSceneId, serviceHeroScenes, type ServiceHeroSceneId } from '../data/service-hero-scenes';
import { DEFAULT_PARTICLE_SETTINGS, PARTICLE_SETTINGS_EVENT, readParticleSettings, sanitizeParticleSettings, type ParticleSettings } from './hero-particle-settings';
import { createParticleShape, particleAppearance, projectParticleShape, VIEW_SIZE } from './hero-particle-shapes';
import type { ParticleRenderer } from './hero-particle-renderer';
class HeroParticles extends HTMLElement {
  static observedAttributes=['scene'];
  private surface!:HTMLButtonElement;
  private canvas!:HTMLCanvasElement;
  private hint!:HTMLElement;
  private engine?:ParticleRenderer;
  private events?:AbortController;
  private intersection?:IntersectionObserver;
  private resizeObserver?:ResizeObserver;
  private motion=matchMedia('(prefers-reduced-motion: reduce)');
  private settings:ParticleSettings=readParticleSettings();
  private visible=false;
  private loading=false;
  private failed=false;
  private frame=0;
  private lastTime=0;
  private touchStart?:{x:number;y:number};
  private get sceneId():ServiceHeroSceneId {
    const id=this.getAttribute('scene');return isServiceHeroSceneId(id)?id:'sites';
  }
  connectedCallback() {
    this.surface=this.querySelector('[data-particle-surface]')!;
    this.canvas=this.querySelector('[data-particle-canvas]')!;
    this.hint=this.querySelector('[data-particle-hint]')!;
    this.events=new AbortController();const options={signal:this.events.signal};
    this.updateImage();this.applySettings(this.settings);
    this.intersection=new IntersectionObserver(([entry])=>{
      this.visible=entry.isIntersecting;
      if(this.visible){void this.initialize();this.wake();}else this.stop();
    },{threshold:.05});
    this.intersection.observe(this.surface);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.surface);
    this.surface.addEventListener('pointermove',event=>{
      if((event.pointerType!=='mouse'&&((this.sceneId!=='integrations'&&this.sceneId!=='home')||!this.touchStart))||this.motion.matches||this.settings.paused)return;
      const p=this.localPoint(event.clientX,event.clientY);this.engine?.pointer(p.x,p.y);
    },options);
    this.surface.addEventListener('pointerleave',()=>this.engine?.leave(),options);
    this.surface.addEventListener('pointerdown',event=>{this.touchStart={x:event.clientX,y:event.clientY};if((this.sceneId==='integrations'||this.sceneId==='ai'||this.sceneId==='home')&&!this.motion.matches&&!this.settings.paused){const p=this.localPoint(event.clientX,event.clientY);this.engine?.pointer(p.x,p.y);}},{...options,passive:true});
    this.surface.addEventListener('pointercancel',()=>{this.touchStart=undefined;this.engine?.leave();},options);
    this.surface.addEventListener('pointerup',event=>{
      if(this.sceneId!=='integrations'&&this.sceneId!=='ai'&&this.sceneId!=='home'&&this.touchStart&&Math.hypot(event.clientX-this.touchStart.x,event.clientY-this.touchStart.y)<12&&!this.motion.matches&&!this.settings.paused)this.engine?.pulse();
      this.touchStart=undefined;if(event.pointerType!=='mouse')this.engine?.leave();
    },{...options,passive:true});
    this.surface.addEventListener('click',event=>{if(event.detail===0&&!this.motion.matches&&!this.settings.paused)this.engine?.pulse();},options);
    this.querySelector('[data-particle-retry]')?.addEventListener('click',()=>{
      this.engine?.dispose();this.engine=undefined;this.failed=false;void this.initialize();
    },options);
    window.addEventListener(PARTICLE_SETTINGS_EVENT,event=>this.applySettings(sanitizeParticleSettings((event as CustomEvent).detail)),options);
    this.addEventListener('hero-particle-panel',event=>{
      this.toggleAttribute('data-settings-open',(event as CustomEvent).detail.open);
    },options);
    this.motion.addEventListener('change',()=>{
      if(this.motion.matches){this.stop();delete this.dataset.rendered;this.drawStatic();}
      else{void this.initialize();this.resize();this.wake();}
      this.updateState();
    },options);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();else this.wake();},options);
    this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.fail();},options);
    this.canvas.addEventListener('webglcontextrestored',()=>{this.failed=false;this.resize();this.wake();this.updateState();},options);
  }
  attributeChangedCallback() {
    if(!this.surface)return;
    this.updateImage();this.engine?.setShape(this.sceneId);this.drawStatic();this.updateState();
    if(this.engine&&!this.motion.matches&&!this.failed)this.draw();
  }
  private updateImage() {
    const scene=serviceHeroScenes.find(s=>s.id===this.sceneId)!;
    this.querySelector<HTMLImageElement>('img')!.src=`/services/particles/${scene.id}.webp`;
    this.surface.setAttribute('aria-label',`${scene.alt}. ${this.sceneId==='home'?'Проведите по знаку, чтобы увидеть внутренние связи. Нажмите Enter для демонстрации.':this.sceneId==='ai'?'Коснитесь кристалла, чтобы запустить преобразование потока.':this.sceneId==='integrations'?'Проведите по связи, чтобы разорвать её. Она восстановится.':'Нажмите, чтобы запустить волну.'}`);
  }
  private localPoint(x:number,y:number) {
    const rect=this.surface.getBoundingClientRect();return{x:((x-rect.left)/rect.width-.5)*VIEW_SIZE,y:(.5-(y-rect.top)/rect.height)*VIEW_SIZE};
  }
  private applySettings(settings:ParticleSettings) {
    this.settings=settings;this.surface.style.setProperty('--particle-background',settings.background);
    this.engine?.configure(settings);
    this.drawStatic();
    if(this.engine&&!this.motion.matches&&!this.failed)this.draw();
    if(settings.paused)this.stop();else this.wake();
    this.updateState();
  }
  private drawStatic() {
    const customized=(['pixelSize','density','primary','secondary','depth','accent','accentAmount','coreColor','shellOpacity','funnelOpacity'] as const).some(key=>this.settings[key]!==DEFAULT_PARTICLE_SETTINGS[key]);
    if(this.sceneId==='home'||!customized){delete this.dataset.staticCustom;return;}
    const canvas=this.querySelector<HTMLCanvasElement>('[data-particle-static]');
    if(!canvas)return;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const {width}=this.surface.getBoundingClientRect();if(!width)return;
    const ratio=Math.min(devicePixelRatio||1,1.75);canvas.width=canvas.height=Math.round(width*ratio);
    const shape=createParticleShape(this.sceneId,this.settings.pixelSize,this.settings.density),scale=canvas.width/VIEW_SIZE;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(const point of projectParticleShape(shape,this.settings.depth)) {
      const size=point.size*canvas.width/500;
      const {color,alpha}=particleAppearance(point,this.settings);ctx.globalAlpha=alpha;
      ctx.fillStyle=`rgb(${color.join(',')})`;
      ctx.fillRect(canvas.width/2+point.x*scale-size/2,canvas.height/2-point.y*scale-size/2,size,size);
    }
    ctx.globalAlpha=1;this.dataset.staticCustom='';
  }
  private async initialize() {
    if(this.engine||this.loading||this.failed||this.motion.matches||!this.visible)return;
    this.loading=true;const connection=this.events;
    try {
      const {ParticleRenderer}=await import('./hero-particle-renderer');
      if(!this.isConnected||connection?.signal.aborted||this.motion.matches)return;
      this.engine=new ParticleRenderer(this.canvas,this.sceneId,this.settings);this.resize();this.wake();this.updateState();
    }catch(error){console.warn('[hero-particles] Animation could not start.',error);this.fail();}
    finally{this.loading=false;}
  }
  private fail(){this.failed=true;this.stop();delete this.dataset.rendered;this.drawStatic();this.updateState();}
  private updateState() {
    this.hint.textContent=this.motion.matches?'Движение отключено в настройках устройства.':this.failed?'Не удалось включить анимацию.':this.settings.paused?(this.hasAttribute('data-settings-available')?'Движение на паузе. Продолжить можно в настройках.':'Движение на паузе.'):this.sceneId==='home'?'Проведите по знаку — загляните внутрь.':this.sceneId==='integrations'?'Проведите по связи — она рассыплется и восстановится.':this.sceneId==='ai'?'Коснитесь кристалла — голубой поток станет розовым.':this.sceneId==='sites'?'Двигайте мышью — курсор изменит направление полёта.':'Проведите по пикселям. Нажмите, чтобы запустить волну.';
    this.surface.disabled=this.failed||this.motion.matches||this.settings.paused||!this.engine;
    this.querySelector<HTMLButtonElement>('[data-particle-retry]')!.hidden=!this.failed;
  }
  private resize() {
    this.drawStatic();
    if(!this.engine||this.failed||this.motion.matches)return;
    const{width,height}=this.surface.getBoundingClientRect();if(width&&height){this.engine.resize(width,height);this.draw();}
  }
  private draw(){try{this.engine?.render();this.dataset.rendered='';}catch(error){console.warn('[hero-particles] Animation interrupted.',error);this.fail();}}
  private wake() {
    if(this.frame||!this.engine||!this.visible||this.motion.matches||this.settings.paused||document.hidden||this.failed)return;
    this.lastTime=performance.now();this.frame=requestAnimationFrame(this.tick);
  }
  private tick=(now:number)=>{
    this.frame=0;
    if(!this.visible||document.hidden||this.motion.matches||this.settings.paused||this.failed)return;
    const elapsed=now-this.lastTime;
    if(elapsed>=1000/60-1){this.engine?.advance(Math.min(elapsed/1000,.05));this.lastTime=now;this.draw();}
    if(!this.failed)this.frame=requestAnimationFrame(this.tick);
  };
  private stop(){cancelAnimationFrame(this.frame);this.frame=0;}
  disconnectedCallback(){this.stop();this.events?.abort();this.intersection?.disconnect();this.resizeObserver?.disconnect();this.engine?.dispose();this.engine=undefined;this.failed=false;delete this.dataset.rendered;}
}
if(!customElements.get('hero-particles'))customElements.define('hero-particles',HeroParticles);
