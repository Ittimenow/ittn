import { ideaOwner, openIdeaStore } from './idea-store';
import { eraseAt, type IdeaPoint as Point, type IdeaStroke as Stroke } from './idea-erase';
const SIZE=8192, KEY='ittn-idea-board-v1';
class HeroPencil extends HTMLElement {
  openBoard(){return this.open();}
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
  private tool:'draw'|'pan'|'erase'='draw';
  private owner:string|null=null;
  private viewKey='';
  private eraseChanged=false;
  private overview?:HTMLCanvasElement;
  private overviewDirty=true;
  private bounds=new WeakMap<Stroke,{left:number;right:number;top:number;bottom:number}>();
  private writes=Promise.resolve();
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
    this.owner=ideaOwner();this.viewKey=KEY+'-view-'+this.owner;
    this.ready=this.restore();
    try{const v=JSON.parse(localStorage.getItem(this.viewKey)||'null');if(v&&[v.x,v.y,v.zoom].every(Number.isFinite)&&v.zoom>=.2&&v.zoom<=4)this.savedView=v;}catch{}
    this.querySelector('[data-open-board]')!.addEventListener('click',()=>this.open(),options);
    this.querySelector('[data-close]')!.addEventListener('click',()=>this.dialog.close(),options);
    this.dialog.addEventListener('close',()=>{this.finish();document.documentElement.style.overflow=this.oldOverflow;},options);
    this.querySelector('[data-draw]')!.addEventListener('click',()=>this.selectTool('draw'),options);
    this.querySelector('[data-pan]')!.addEventListener('click',()=>this.selectTool('pan'),options);
    this.querySelector('[data-erase]')!.addEventListener('click',()=>this.selectTool('erase'),options);
    this.querySelector('[data-clear]')!.addEventListener('click',()=>void this.clearAll(),options);
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
    this.selectTool('draw');
    this.note(this.storageFailed?'Хранилище браузера недоступно. Скачайте рисунок перед закрытием.':'Рисуйте мышью или пальцем. Ваша идея останется здесь.');
  }
  private selectTool(tool:'draw'|'pan'|'erase'){
    this.finish();this.tool=tool;this.dialog.dataset.tool=tool;
    for(const name of ['draw','pan','erase'])this.querySelector<HTMLButtonElement>(`button[data-${name}]`)!.setAttribute('aria-pressed',String(name===tool));
    this.note(tool==='pan'?'Перетащите салфетку, чтобы найти место для новой идеи.':tool==='erase'?'Проведите ластиком по части линии, которую хотите убрать.':'Рисуйте мышью или пальцем. Ваша идея останется здесь.');
  }
  private note(s:string){this.querySelector('.board-note')!.textContent=s;}
  private measure(){
    if(!this.dialog.open)return;
    const w=this.dialog.clientWidth,h=this.dialog.clientHeight;
    if(this.width){this.ox+=(w-this.width)/2;this.oy+=(h-this.height)/2;}
    else{this.zoom=this.savedView?.zoom||1;this.ox=w/2-(this.savedView?.x??SIZE/2)*this.zoom;this.oy=h/2-(this.savedView?.y??SIZE/2)*this.zoom;}
    this.width=w;this.height=h;
    this.dialog.style.setProperty('--board-toolbar-height',this.querySelector<HTMLElement>('.board-toolbar')!.offsetHeight+'px');
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
    this.last={x:e.clientX,y:e.clientY};
    if(this.tool==='draw'){
      this.strokes.push([this.point(e)]);this.dirtyStroke=true;this.changed();
    }else if(this.tool==='erase')this.erase(e);
    this.render();
  };
  private move=(e:PointerEvent)=>{
    if(e.pointerId!==this.active)return;
    if(e.pointerType==='mouse'&&(e.buttons&1)===0){this.finish();return;}
    if(this.tool==='pan'){this.ox+=e.clientX-this.last.x;this.oy+=e.clientY-this.last.y;this.last={x:e.clientX,y:e.clientY};this.clampView();this.fullPaint=true;}
    else if(this.tool==='erase'){
      const events=e.getCoalescedEvents?.()||[];
      for(const item of events.length?events:[e]){
        const dx=item.clientX-this.last.x,dy=item.clientY-this.last.y,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/8));
        for(let i=1;i<=steps;i++)this.eraseAtScreen(this.last.x+dx*i/steps,this.last.y+dy*i/steps);
        this.last={x:item.clientX,y:item.clientY};
      }
    }else{
      const stroke=this.strokes[this.strokes.length-1],events=e.getCoalescedEvents?.()||[];
      for(const item of events.length?events:[e]){const p=this.point(item),last=stroke[stroke.length-1];if(Math.hypot(p.x-last.x,p.y-last.y)>.65)stroke.push(p);}
      this.bounds.delete(stroke);
    }this.render();
  };
  private finish(){
    const id=this.active;this.active=null;
    if(id!==null){
      if(this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);
      if(this.tool==='draw')this.persist();
      if(this.tool==='erase'&&this.eraseChanged){this.eraseChanged=false;const snapshot=this.strokes.slice();this.enqueue(()=>this.store!.replace(snapshot));}
      this.persistView();
    }
  }
  private changed(){this.revision++;this.shareUrl='';this.querySelector<HTMLElement>('[data-share-result]')!.hidden=true;}
  private erase(e:PointerEvent){this.eraseAtScreen(e.clientX,e.clientY);}
  private eraseAtScreen(x:number,y:number){
    if(!this.strokes.length)return;
    const point={x:(x-this.ox)/this.zoom,y:(y-this.oy)/this.zoom,p:.6};
    const erased=eraseAt(this.strokes,point,12/this.zoom+4);
    if(erased.changed){this.strokes=erased.strokes;this.eraseChanged=true;this.overviewDirty=true;this.fullPaint=true;this.changed();}
  }
  private persistView(){if(!this.owner)return;try{localStorage.setItem(this.viewKey,JSON.stringify({x:(this.width/2-this.ox)/this.zoom,y:(this.height/2-this.oy)/this.zoom,zoom:this.zoom}));}catch{}}
  private async restore(){
    try{
      if(!this.owner)throw Error('Cookies disabled');
      this.store=await openIdeaStore(this.owner);
      let saved:Stroke[]=[];
      try{const legacy=JSON.parse(localStorage.getItem(KEY)||'null');if(Array.isArray(legacy)&&legacy.every(s=>Array.isArray(s)&&s.length&&s.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=SIZE&&p.y>=0&&p.y<=SIZE&&Number.isFinite(p.p))))saved=legacy;}catch{}
      const migrated=await this.store.migrateLegacy(saved);
      if(migrated){
        try{
          localStorage.removeItem(KEY);
          const old=localStorage.getItem(KEY+'-view');
          if(old&&!localStorage.getItem(this.viewKey)){localStorage.setItem(this.viewKey,old);const v=JSON.parse(old);if([v.x,v.y,v.zoom].every(Number.isFinite))this.savedView=v;}
          localStorage.removeItem(KEY+'-view');
        }catch{}
      }
      this.strokes=await this.store.load<Stroke>();
      this.overviewDirty=true;
      this.fullPaint=true;this.render();
    }catch{this.storageFailed=true;this.note('Хранилище браузера недоступно. Скачайте рисунок перед закрытием.');}
  }
  private persist(){
    if(!this.dirtyStroke)return;this.dirtyStroke=false;
    const i=this.strokes.length-1;
    if(!this.store){this.storageFailed=true;this.note('Хранилище браузера недоступно. Скачайте рисунок перед закрытием.');return;}
    const stroke=this.strokes[i];this.overviewDirty=true;
    this.enqueue(()=>this.store!.put(Date.now()+'-'+crypto.randomUUID(),stroke));
  }
  private enqueue(write:()=>Promise<void>){
    this.writes=this.writes.then(write).catch(()=>{this.storageFailed=true;this.note('Не удалось сохранить в браузере. Скачайте рисунок кнопкой «Сохранить».');});
  }
  private async clearAll(){
    this.finish();if(!this.strokes.length)return;
    if(!window.confirm('Очистить весь рисунок? Это действие нельзя отменить.'))return;
    this.strokes=[];this.bounds=new WeakMap();this.overviewDirty=true;this.fullPaint=true;this.changed();this.render();
    if(this.store)this.enqueue(()=>this.store!.replace([]));
    this.note('Рисунок очищен.');
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
  private strokeBounds(s:Stroke){
    let box=this.bounds.get(s);if(box)return box;
    box={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
    for(const p of s){box.left=Math.min(box.left,p.x);box.right=Math.max(box.right,p.x);box.top=Math.min(box.top,p.y);box.bottom=Math.max(box.bottom,p.y);}
    this.bounds.set(s,box);return box;
  }
  private paint(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number){
    this.background(c,x,y,w,h);
    for(const s of this.strokes){
      const box=this.strokeBounds(s);
      if(box.right<x-10||box.left>x+w+10||box.bottom<y-10||box.top>y+h+10)continue;
      for(let i=0;i<s.length;i++)this.segment(c,s,i,{x,y,w,h});
    }
  }
  private paintOverview(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number){
    if(!this.overview){this.overview=document.createElement('canvas');this.overview.width=this.overview.height=2048;this.overviewDirty=true;}
    if(this.overviewDirty){
      const ctx=this.overview.getContext('2d')!;ctx.setTransform(.25,0,0,.25,0,0);ctx.clearRect(0,0,SIZE,SIZE);
      ctx.strokeStyle='#323bff';ctx.fillStyle='#323bff';ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';
      for(const stroke of this.strokes){
        if(stroke.length===1){const p=stroke[0];ctx.beginPath();ctx.arc(p.x,p.y,2.5,0,Math.PI*2);ctx.fill();continue;}
        ctx.beginPath();ctx.moveTo(stroke[0].x,stroke[0].y);
        for(let i=1;i<stroke.length;i++)ctx.lineTo(stroke[i].x,stroke[i].y);
        ctx.stroke();
      }
      this.overviewDirty=false;
    }
    this.background(c,x,y,w,h);
    const sx=Math.max(0,Math.floor(x*.25)-1),sy=Math.max(0,Math.floor(y*.25)-1);
    const ex=Math.min(2048,Math.ceil((x+w)*.25)+1),ey=Math.min(2048,Math.ceil((y+h)*.25)+1);
    if(ex>sx&&ey>sy)c.drawImage(this.overview,sx,sy,ex-sx,ey-sy,sx*4,sy*4,(ex-sx)*4,(ey-sy)*4);
  }
  private render(){if(!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;this.paintFrame();});}
  private paintFrame(){
    if(!this.dialog?.open||!this.width)return;
    const d=this.canvas.width/this.width,c=this.ctx;c.setTransform(d*this.zoom,0,0,d*this.zoom,d*this.ox,d*this.oy);
    if(this.fullPaint){
      const x=-this.ox/this.zoom,y=-this.oy/this.zoom,w=this.width/this.zoom,h=this.height/this.zoom;
      if(this.zoom<=.6)this.paintOverview(c,x,y,w,h);else this.paint(c,x,y,w,h);
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
    this.querySelector<HTMLButtonElement>('[data-clear]')!.disabled=!this.strokes.length;
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
      this.note('Ссылка готова. Сохранённая версия рисунка доступна 90 дней.');
    }catch(e){this.note(e instanceof Error?e.message:'Не удалось создать ссылку. Попробуйте ещё раз.');}
    finally{this.sharing=false;btn.textContent='Поделиться';this.render();}
  }
  private async copyLink(){
    const input=this.querySelector<HTMLInputElement>('[data-share-link]')!;
    try{await navigator.clipboard.writeText(input.value);this.note('Ссылка скопирована.');}
    catch{input.focus();input.select();this.note('Скопируйте выделенную ссылку.');}
  }
  disconnectedCallback(){this.finish();if(this.dialog?.open){this.dialog.close();document.documentElement.style.overflow=this.oldOverflow;}cancelAnimationFrame(this.frame);this.abort?.abort();this.resize?.disconnect();void this.writes.then(()=>this.store?.close());}
}
if(!customElements.get('hero-pencil'))customElements.define('hero-pencil',HeroPencil);
