import { openIdeaStore } from './idea-store';
type Point={x:number;y:number;p:number};
type Stroke=Point[];
const SIZE=8192, KEY='ittn-idea-board-v1';
class HeroPencil extends HTMLElement {
  private dialog!:HTMLDialogElement;
  private canvas!:HTMLCanvasElement;
  private ctx!:CanvasRenderingContext2D;
  private abort?:AbortController;
  private resize?:ResizeObserver;
  private brush=document.createElement('canvas');
  private paper=new Image();
  private strokes:Stroke[]=[];
  private zoom=1;
  private ox=0; private oy=0;
  private width=0; private height=0;
  private active:number|null=null;
  private last={x:0,y:0};
  private pan=false;
  private oldOverflow='';
  private storageFailed=false;
  private frame=0;
  private fullPaint=true;
  private paintedStroke=0;
  private paintedPoint=0;
  private dirtyStroke=false;
  private store?:Awaited<ReturnType<typeof openIdeaStore>>;
  private ready:Promise<void>=Promise.resolve();
  private sharing=false;
  private exporting=false;
  private shareUrl='';
  private revision=0;
  private savedView?:{x:number;y:number;zoom:number};
  connectedCallback(){
    this.abort=new AbortController();const options={signal:this.abort.signal};
    this.dialog=this.querySelector('dialog')!;this.canvas=this.querySelector('.idea-surface')!;
    const ctx=this.canvas.getContext('2d');if(!ctx)return;this.ctx=ctx;
    this.makeBrush();
    this.paper.onload=()=>{this.fullPaint=true;this.render();};this.paper.src='/images/idea-napkin-texture.webp';
    this.ready=this.restore();
    try{const v=JSON.parse(localStorage.getItem(KEY+'-view')||'null');if(v&&[v.x,v.y,v.zoom].every(Number.isFinite)&&v.zoom>=.2&&v.zoom<=4)this.savedView=v;}catch{}
    this.querySelector('[data-open-board]')!.addEventListener('click',()=>this.open(),options);
    this.querySelector('[data-close]')!.addEventListener('click',()=>this.dialog.close(),options);
    this.dialog.addEventListener('close',()=>{this.finish();document.documentElement.style.overflow=this.oldOverflow;},options);
    this.querySelector('[data-pan]')!.addEventListener('click',()=>{this.finish();this.pan=!this.pan;this.dialog.toggleAttribute('data-pan',this.pan);const btn=this.querySelector<HTMLButtonElement>('button[data-pan]')!;btn.setAttribute('aria-pressed',String(this.pan));btn.textContent=this.pan?'Рисовать':'Переместить';this.note(this.pan?'Перетащите салфетку, чтобы найти место для новой идеи.':'Рисуйте мышью или пальцем. Ваша идея останется здесь.');},options);
    this.querySelector('[data-zoom-in]')!.addEventListener('click',()=>this.setZoom(this.zoom*1.25),options);
    this.querySelector('[data-zoom-out]')!.addEventListener('click',()=>this.setZoom(this.zoom/1.25),options);
    this.querySelector('[data-share]')!.addEventListener('click',()=>void this.share(),options);
    this.querySelector('[data-copy-link]')!.addEventListener('click',()=>void this.copyLink(),options);
    this.querySelector('[data-save]')!.addEventListener('click',()=>void this.save(),options);
    this.canvas.addEventListener('pointerdown',this.down,options);
    this.canvas.addEventListener('pointermove',this.move,options);
    for(const name of ['pointerup','pointercancel','lostpointercapture'])this.canvas.addEventListener(name,e=>{if((e as PointerEvent).pointerId===this.active)this.finish();},options);
    this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.setZoom(this.zoom*Math.exp(-e.deltaY*.002),e.clientX,e.clientY);},{...options,passive:false});
    window.addEventListener('blur',()=>this.finish(),options);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.finish();},options);
    this.addEventListener('dragstart',e=>e.preventDefault(),options);
    this.addEventListener('selectstart',e=>{if(!(e.target instanceof HTMLInputElement))e.preventDefault();},options);
    this.resize=new ResizeObserver(()=>this.measure());this.resize.observe(this.dialog);
  }
  private async open(){
    await this.ready;
    this.oldOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';
    this.dialog.showModal();this.measure();
    // Reopening always starts with the pencil selected.
    this.pan=false;this.dialog.removeAttribute('data-pan');
    const btn=this.querySelector<HTMLButtonElement>('button[data-pan]')!;btn.setAttribute('aria-pressed','false');btn.textContent='Переместить';
    this.note(this.storageFailed?'Хранилище браузера недоступно. Скачайте рисунок перед закрытием.':'Рисуйте мышью или пальцем. Ваша идея останется здесь.');
  }
  private note(s:string){this.querySelector('.board-note')!.textContent=s;}
  private measure(){
    if(!this.dialog.open)return;
    const w=this.dialog.clientWidth,h=this.dialog.clientHeight;
    if(this.width){this.ox+=(w-this.width)/2;this.oy+=(h-this.height)/2;}
    else{this.zoom=this.savedView?.zoom||1;this.ox=w/2-(this.savedView?.x??SIZE/2)*this.zoom;this.oy=h/2-(this.savedView?.y??SIZE/2)*this.zoom;}
    this.width=w;this.height=h;
    const d=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(w*d);this.canvas.height=Math.round(h*d);
    this.clampView();this.fullPaint=true;this.render();
  }
  private clampView(){this.ox=Math.min(0,Math.max(this.width-SIZE*this.zoom,this.ox));this.oy=Math.min(0,Math.max(this.height-SIZE*this.zoom,this.oy));}
  private setZoom(z:number,x=this.width/2,y=this.height/2){
    this.finish();const min=Math.max(.2,this.width/SIZE,this.height/SIZE);
    z=Math.min(4,Math.max(min,z));const factor=z/this.zoom;
    this.ox=x-(x-this.ox)*factor;this.oy=y-(y-this.oy)*factor;this.zoom=z;this.clampView();this.persistView();this.fullPaint=true;this.render();
  }
  private point(e:PointerEvent):Point{return{x:Math.min(SIZE,Math.max(0,(e.clientX-this.ox)/this.zoom)),y:Math.min(SIZE,Math.max(0,(e.clientY-this.oy)/this.zoom)),p:e.pointerType==='pen'?Math.max(.2,e.pressure):.6};}
  private down=(e:PointerEvent)=>{
    if(!e.isPrimary||e.button!==0||this.active!==null)return;e.preventDefault();this.active=e.pointerId;this.canvas.setPointerCapture(e.pointerId);
    this.last={x:e.clientX,y:e.clientY};if(!this.pan){this.strokes.push([this.point(e)]);this.dirtyStroke=true;this.revision++;this.shareUrl='';this.querySelector<HTMLElement>('[data-share-result]')!.hidden=true;}this.render();
  };
  private move=(e:PointerEvent)=>{
    if(e.pointerId!==this.active)return;
    if(e.pointerType==='mouse'&&(e.buttons&1)===0){this.finish();return;}
    if(this.pan){this.ox+=e.clientX-this.last.x;this.oy+=e.clientY-this.last.y;this.last={x:e.clientX,y:e.clientY};this.clampView();this.fullPaint=true;}
    else{
      const stroke=this.strokes[this.strokes.length-1],events=e.getCoalescedEvents?.()||[];
      for(const item of events.length?events:[e]){const p=this.point(item),last=stroke[stroke.length-1];if(Math.hypot(p.x-last.x,p.y-last.y)>.65)stroke.push(p);}
    }this.render();
  };
  private finish(){
    const id=this.active;this.active=null;
    if(id!==null){if(this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);this.persist();this.persistView();}
  }
  private persistView(){try{localStorage.setItem(KEY+'-view',JSON.stringify({x:(this.width/2-this.ox)/this.zoom,y:(this.height/2-this.oy)/this.zoom,zoom:this.zoom}));}catch{}}
  private async restore(){
    try{
      this.store=await openIdeaStore();
      this.strokes=await this.store.load<Stroke>();
      if(!this.strokes.length){
        const saved=JSON.parse(localStorage.getItem(KEY)||'null');
        if(Array.isArray(saved)&&saved.every(s=>Array.isArray(s)&&s.length&&s.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=SIZE&&p.y>=0&&p.y<=SIZE&&Number.isFinite(p.p)))){
          this.strokes=saved;
          await Promise.all(saved.map((stroke,i)=>this.store!.put(i,stroke)));
          localStorage.removeItem(KEY);
        }
      }
      this.fullPaint=true;this.render();
    }catch{this.storageFailed=true;this.note('Хранилище браузера недоступно. Скачайте рисунок перед закрытием.');}
  }
  private persist(){
    if(!this.dirtyStroke)return;this.dirtyStroke=false;
    const i=this.strokes.length-1;
    if(!this.store){this.storageFailed=true;this.note('Хранилище браузера недоступно. Скачайте рисунок перед закрытием.');return;}
    void this.store.put(Date.now()+'-'+crypto.randomUUID(),this.strokes[i]).catch(()=>{this.storageFailed=true;this.note('Не удалось сохранить в браузере. Скачайте рисунок кнопкой «Сохранить».');});
  }
  private makeBrush(){
    this.brush.width=this.brush.height=48;const c=this.brush.getContext('2d')!;
    let seed=473;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<500;i++){const x=random()*48,y=random()*48,r=Math.hypot(x-24,y-24)/24;if(r>1)continue;c.fillStyle=`rgba(50,59,255,${(.12+random()*.55)*Math.pow(1-r,.5)})`;c.fillRect(x,y,.6+random()*1.8,.6+random()*1.8);}
  }
  private background(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number){
    c.fillStyle='#fff';c.fillRect(x,y,w,h);
    if(this.paper.complete&&this.paper.naturalWidth){
      const pattern=c.createPattern(this.paper,'repeat');
      if(pattern){pattern.setTransform(new DOMMatrix().scale(.5));c.save();c.globalAlpha=.24;c.fillStyle=pattern;c.fillRect(x,y,w,h);c.restore();}
    }
  }
  private segment(c:CanvasRenderingContext2D,s:Stroke,i:number,region?:{x:number;y:number;w:number;h:number}){
    const p=s[i],a=s[Math.max(0,i-1)],length=Math.hypot(p.x-a.x,p.y-a.y),n=Math.max(1,Math.ceil(length/1.2));
    for(let j=1;j<=n;j++){
      const t=j/n,px=a.x+(p.x-a.x)*t,py=a.y+(p.y-a.y)*t;
      if(region&&(px<region.x-10||px>region.x+region.w+10||py<region.y-10||py>region.y+region.h+10))continue;
      const size=5*(.6+p.p);c.drawImage(this.brush,px-size/2,py-size/2,size,size);
    }
  }
  private paint(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number){
    this.background(c,x,y,w,h);
    for(const s of this.strokes){
      if(s.every(p=>p.x<x-10)||s.every(p=>p.x>x+w+10)||s.every(p=>p.y<y-10)||s.every(p=>p.y>y+h+10))continue;
      for(let i=0;i<s.length;i++)this.segment(c,s,i,{x,y,w,h});
    }
  }
  private render(){if(!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;this.paintFrame();});}
  private paintFrame(){
    if(!this.dialog?.open||!this.width)return;
    const d=this.canvas.width/this.width,c=this.ctx;c.setTransform(d*this.zoom,0,0,d*this.zoom,d*this.ox,d*this.oy);
    if(this.fullPaint){
      this.paint(c,-this.ox/this.zoom,-this.oy/this.zoom,this.width/this.zoom,this.height/this.zoom);
      this.fullPaint=false;this.paintedStroke=Math.max(0,this.strokes.length-1);this.paintedPoint=this.strokes.at(-1)?.length||0;
    }else{
      // The canvas itself caches finished marks. Append only previously unpainted segments.
      for(let i=this.paintedStroke;i<this.strokes.length;i++){
        const stroke=this.strokes[i];
        for(let j=i===this.paintedStroke?this.paintedPoint:0;j<stroke.length;j++)this.segment(c,stroke,j);
      }
      this.paintedStroke=Math.max(0,this.strokes.length-1);this.paintedPoint=this.strokes.at(-1)?.length||0;
    }
    this.querySelector('[data-zoom]')!.textContent=Math.round(this.zoom*100)+'%';
    this.querySelector<HTMLButtonElement>('[data-zoom-in]')!.disabled=this.zoom>=4;
    this.querySelector<HTMLButtonElement>('[data-zoom-out]')!.disabled=this.zoom<=Math.max(.2,this.width/SIZE,this.height/SIZE)+.001;
    this.querySelector<HTMLButtonElement>('[data-save]')!.disabled=!this.strokes.length||this.exporting;
    this.querySelector<HTMLButtonElement>('[data-share]')!.disabled=!this.strokes.length||this.sharing;
  }
  private async exportPng(){
    this.finish();await this.paper.decode().catch(()=>{});
    let left=SIZE,top=SIZE,right=0,bottom=0;
    for(const s of this.strokes)for(const p of s){left=Math.min(left,p.x);top=Math.min(top,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
    left=Math.max(0,left-64);top=Math.max(0,top-64);right=Math.min(SIZE,right+64);bottom=Math.min(SIZE,bottom+64);
    const w=right-left,h=bottom-top,scale=Math.min(1,4096/Math.max(w,h)),out=document.createElement('canvas');
    out.width=Math.ceil(w*scale);out.height=Math.ceil(h*scale);const c=out.getContext('2d')!;c.scale(scale,scale);c.translate(-left,-top);this.paint(c,left,top,w,h);
    const blob=await new Promise<Blob|null>(resolve=>out.toBlob(resolve,'image/png'));if(!blob)throw Error('Не удалось подготовить рисунок.');
    return blob;
  }
  private async save(){
    if(this.exporting||!this.strokes.length)return;
    this.exporting=true;const btn=this.querySelector<HTMLButtonElement>('[data-save]')!;btn.disabled=true;btn.textContent='Сохраняем…';
    try{
      const blob=await this.exportPng(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Моя идея.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
      this.note(this.storageFailed?'PNG скачан. Копия в браузере недоступна.':'PNG сохранён. Рисунок также остаётся в этом браузере.');
    }catch{this.note('Не удалось скачать рисунок. Попробуйте ещё раз.');}
    finally{this.exporting=false;btn.textContent='Сохранить';this.render();}
  }
  private async share(){
    if(this.sharing||!this.strokes.length)return;
    this.sharing=true;const btn=this.querySelector<HTMLButtonElement>('[data-share]')!;btn.disabled=true;btn.textContent='Создаём ссылку…';
    const revision=this.revision;
    try{
      if(!this.shareUrl){
        const blob=await this.exportPng();
        const response=await fetch('/api/ideas/',{method:'POST',headers:{'Content-Type':'image/png'},body:blob,signal:AbortSignal.timeout(30000)});
        if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Публикация временно недоступна. Попробуйте позже.');
        const data=await response.json();if(!response.ok)throw Error(data.error||'Не удалось создать ссылку.');
        if(revision!==this.revision){this.note('Ссылка создана для предыдущей версии. Нажмите «Поделиться» для нового рисунка.');return;}
        this.shareUrl=new URL(data.url,location.origin).href;
      }
      const input=this.querySelector<HTMLInputElement>('[data-share-link]')!;input.value=this.shareUrl;
      this.querySelector<HTMLElement>('[data-share-result]')!.hidden=false;
      this.note('Ссылка готова. По ней можно посмотреть сохранённую версию рисунка.');
    }catch(e){this.note(e instanceof Error?e.message:'Не удалось создать ссылку. Попробуйте ещё раз.');}
    finally{this.sharing=false;btn.textContent='Поделиться';this.render();}
  }
  private async copyLink(){
    const input=this.querySelector<HTMLInputElement>('[data-share-link]')!;
    try{await navigator.clipboard.writeText(input.value);this.note('Ссылка скопирована.');}
    catch{input.focus();input.select();this.note('Скопируйте выделенную ссылку.');}
  }
  disconnectedCallback(){this.finish();if(this.dialog?.open){this.dialog.close();document.documentElement.style.overflow=this.oldOverflow;}cancelAnimationFrame(this.frame);this.abort?.abort();this.resize?.disconnect();}
}
if(!customElements.get('hero-pencil'))customElements.define('hero-pencil',HeroPencil);
