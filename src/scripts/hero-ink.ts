/** Local deformation of the actual hand-drawn PNG; no replacement lettering. */
const vertex=`attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const fragment=`precision highp float;
uniform sampler2D uImage;uniform vec2 uSize;uniform vec4 uPulls[16];varying vec2 vUv;
vec4 ink(vec2 p){vec2 uv=vec2(p.x/uSize.x,1.-p.y/uSize.y);if(min(uv.x,uv.y)<0.||max(uv.x,uv.y)>1.)return vec4(0.);return texture2D(uImage,uv);}
void main(){
 vec2 p=vec2((vUv.x*1.6-.3)*uSize.x,((1.-vUv.y)*3.-1.)*uSize.y);
 vec2 offset=vec2(0.);
 float radius=uSize.y*.48;
 for(int i=0;i<16;i++){
   vec2 d=p-uPulls[i].xy;
   float influence=exp(-dot(d,d)/(radius*radius));
   offset+=uPulls[i].zw*influence;
 }
 float lengthOffset=length(offset);offset*=min(1.,uSize.y*.72/max(.001,lengthOffset));
 vec2 q=p-offset;
 vec4 color=ink(q);
 // Tiny directional relief follows the original alpha contour and its grain.
 float raised=clamp(lengthOffset/30.,0.,1.);
 float highlight=max(0.,color.a-ink(q-vec2(.7,.9)).a);
 color.rgb=mix(color.rgb,vec3(.28,.38,1.),highlight*.25*raised);
 float shadow=ink(q-vec2(1.4,2.5)*raised).a*.13*raised*(1.-color.a);
 gl_FragColor=vec4(color.rgb*color.a+vec3(.29,.32,.52)*shadow,color.a+shadow);
}`;
type Pull={x:number;y:number;dx:number;dy:number;vx:number;vy:number};
type Drop={x:number;y:number;homeX:number;homeY:number;vx:number;vy:number;age:number;life:number;size:number;square:boolean};
class InkWord extends HTMLElement {
  private abort?:AbortController;private observer?:IntersectionObserver;private resize?:ResizeObserver;
  private media=matchMedia('(prefers-reduced-motion: reduce)');
  private canvas!:HTMLCanvasElement;private dropsCanvas!:HTMLCanvasElement;private image!:HTMLImageElement;
  private gl?:WebGLRenderingContext;private program?:WebGLProgram;private buffer?:WebGLBuffer;private texture?:WebGLTexture;
  private alpha?:Uint8ClampedArray;private maskWidth=0;private maskHeight=0;
  private pulls:Pull[]=Array.from({length:16},()=>({x:-1000,y:-1000,dx:0,dy:0,vx:0,vy:0}));
  private uniforms=new Float32Array(64);private drops:Drop[]=[];private cursor?:{x:number;y:number;t:number};
  private width=1;private height=1;private visible=false;private frame=0;private last=0;private pullSlot=0;private demo=0;private phase=0;
  private locations?:{size:WebGLUniformLocation|null;pulls:WebGLUniformLocation|null};
  connectedCallback(){
    this.abort=new AbortController();const options={signal:this.abort.signal};
    this.canvas=this.querySelector('[data-ink-fluid]')!;this.dropsCanvas=this.querySelector('[data-ink-drops]')!;this.image=this.querySelector('img')!;
    this.observer=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting;if(this.visible){void this.prepare();this.wake();}else this.stop();});this.observer.observe(this);
    this.resize=new ResizeObserver(()=>this.measure());this.resize.observe(this);
    document.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||e.buttons)this.pointer(e.clientX,e.clientY);},options);
    this.addEventListener('pointerdown',e=>{this.pointer(e.clientX,e.clientY,true);},options);
    this.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.play();}},options);
    this.addEventListener('click',e=>{if(e.detail===0)this.play();},options);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();else this.wake();},options);
    this.media.addEventListener('change',()=>{if(this.media.matches){this.stop();delete this.dataset.ready;}else{void this.prepare();this.wake();}},options);
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.stop();delete this.dataset.ready;},options);
    this.canvas.addEventListener('webglcontextrestored',()=>{this.release();void this.prepare();},options);
  }
  private async prepare(){
    if(this.media.matches||!this.isConnected)return;
    if(this.gl){this.dataset.ready='';this.draw();return;}
    try{
      await this.image.decode();if(!this.isConnected||this.media.matches||this.gl)return;
      const gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,powerPreference:'low-power'});if(!gl)return;
      const compile=(type:number,code:string)=>{const shader=gl.createShader(type)!;gl.shaderSource(shader,code);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader)||'Ink shader failed');return shader;};
      this.gl=gl;const program=gl.createProgram()!;const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Ink shader link failed');this.program=program;gl.useProgram(program);
      this.buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
      this.texture=gl.createTexture()!;gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.image);
      this.locations={size:gl.getUniformLocation(program,'uSize'),pulls:gl.getUniformLocation(program,'uPulls[0]')};
      const mask=document.createElement('canvas');mask.width=this.maskWidth=this.image.naturalWidth;mask.height=this.maskHeight=this.image.naturalHeight;const ctx=mask.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(this.image,0,0);this.alpha=ctx.getImageData(0,0,mask.width,mask.height).data;
      this.measure();this.draw();this.dataset.ready='';
    }catch(error){console.warn('[hero-ink] Static lettering retained.',error);this.release();delete this.dataset.ready;}
  }
  private measure(){
    const box=this.getBoundingClientRect();if(!box.width)return;this.width=box.width;this.height=box.height;
    const dpr=Math.min(devicePixelRatio,2);for(const c of [this.canvas,this.dropsCanvas]){c.width=Math.round(this.width*1.6*dpr);c.height=Math.round(this.height*3*dpr);}this.gl?.viewport(0,0,this.canvas.width,this.canvas.height);this.draw();
  }
  private inkAt(x:number,y:number){const ix=Math.floor(x/this.width*this.maskWidth),iy=Math.floor(y/this.height*this.maskHeight);return ix>=0&&ix<this.maskWidth&&iy>=0&&iy<this.maskHeight&&(this.alpha?.[(iy*this.maskWidth+ix)*4+3]||0)>80;}
  private pointer(clientX:number,clientY:number,tap=false){
    if(this.media.matches||!this.visible||!this.gl)return;
    const b=this.getBoundingClientRect(),x=clientX-b.left,y=clientY-b.top,now=performance.now();
    if(x<-.2*this.width||x>1.2*this.width||y<-this.height*.8||y>this.height*1.8){this.cursor=undefined;return;}
    const old=this.cursor;this.cursor={x,y,t:now};
    if(!old&&!tap)return;
    const dx=tap?this.height*.15:x-old!.x,dy=tap?-this.height*.23:y-old!.y;
    if(!tap&&now-old!.t>150)return;
    this.disturb(x,y,dx,dy);this.wake();
  }
  private disturb(x:number,y:number,dx:number,dy:number){
    const speed=Math.min(40,Math.hypot(dx,dy));if(speed<.3)return;
    let contact:{x:number;y:number}|undefined;
    for(let n=0;n<12;n++){const a=n*2.399,r=n<1?0:Math.sqrt(n/12)*this.height*.32;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;if(this.inkAt(px,py)){contact={x:px,y:py};break;}}
    if(!contact)return;
    const pull=this.pulls[this.pullSlot];this.pullSlot=(this.pullSlot+1)%16;
    const force=Math.min(2.0,40/Math.max(1,speed));Object.assign(pull,{x:contact.x,y:contact.y,dx:dx*force,dy:dy*force,vx:dx*8,vy:dy*8});
    for(let j=0;j<Math.min(5,1+Math.floor(speed/6));j++){
      if(this.drops.length>=100)this.drops.shift();
      this.drops.push({x:contact.x,y:contact.y,homeX:contact.x,homeY:contact.y,vx:dx*8+(Math.random()-.5)*45,vy:dy*8+(Math.random()-.5)*45,age:0,life:.75+Math.random()*.55,size:1.5+Math.random()*2.4,square:Math.random()>.48});
    }
  }
  private play(){if(this.media.matches||!this.visible)return;this.demo=1.25;this.phase=0;this.wake();}
  private wake(){if(this.frame||!this.gl||this.gl.isContextLost()||!this.visible||document.hidden||this.media.matches)return;this.last=performance.now();this.frame=requestAnimationFrame(this.tick);}
  private tick=(now:number)=>{
    this.frame=0;const dt=Math.min(.032,(now-this.last)/1000);this.last=now;let energy=0;
    if(this.demo>0){this.demo-=dt;this.phase+=dt;const x=this.width*(.10+.8*this.phase/1.25),y=this.height*(.55+Math.sin(this.phase*7)*.16);this.disturb(x,y,this.width*.8/1.25*dt,Math.cos(this.phase*7)*this.height*1.12*dt);}
    for(const p of this.pulls){p.vx+=(-p.dx*75-p.vx*14)*dt;p.vy+=(-p.dy*75-p.vy*14)*dt;p.dx+=p.vx*dt;p.dy+=p.vy*dt;energy+=Math.abs(p.dx)+Math.abs(p.dy);}
    this.drops=this.drops.filter(d=>d.age<d.life);
    for(const d of this.drops){d.age+=dt;const spring=d.age>.16?36:0;d.vx+=((d.homeX-d.x)*spring-d.vx*4)*dt;d.vy+=((d.homeY-d.y)*spring-d.vy*4+10)*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;}
    this.draw();if(energy>.025||this.drops.length||this.demo>0)this.frame=requestAnimationFrame(this.tick);else{this.pulls.forEach(p=>{p.dx=p.dy=p.vx=p.vy=0;});this.draw();}
  };
  private draw(){
    const gl=this.gl;if(!gl||!this.locations)return;
    this.pulls.forEach((p,i)=>this.uniforms.set([p.x,p.y,p.dx,p.dy],i*4));gl.uniform2f(this.locations.size,this.width,this.height);gl.uniform4fv(this.locations.pulls,this.uniforms);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);
    const ctx=this.dropsCanvas.getContext('2d')!;ctx.clearRect(0,0,this.dropsCanvas.width,this.dropsCanvas.height);const scale=this.dropsCanvas.width/(this.width*1.6);ctx.save();ctx.scale(scale,scale);ctx.translate(this.width*.3,this.height);ctx.fillStyle='#323bff';
    for(const d of this.drops){ctx.globalAlpha=Math.pow(Math.max(0,1-d.age/d.life),.5);const size=d.size*(1-d.age/d.life*.55);if(d.square)ctx.fillRect(d.x-size/2,d.y-size/2,size,size);else{ctx.beginPath();ctx.ellipse(d.x,d.y,size*.65,size*.42,Math.atan2(d.vy,d.vx),0,Math.PI*2);ctx.fill();}}
    ctx.restore();
  }
  private stop(){cancelAnimationFrame(this.frame);this.frame=0;this.cursor=undefined;}
  private release(){if(this.gl){this.gl.deleteBuffer(this.buffer||null);this.gl.deleteTexture(this.texture||null);this.gl.deleteProgram(this.program||null);}this.gl=undefined;}
  disconnectedCallback(){this.stop();this.abort?.abort();this.observer?.disconnect();this.resize?.disconnect();this.release();}
}
if(!customElements.get('ink-word'))customElements.define('ink-word',InkWord);
