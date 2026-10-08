export const CRYSTAL_DURATION=4.1;
export const CRYSTAL_CORE=48;
const FLOW=36,COUNT=CRYSTAL_CORE+FLOW*2;
const hash=(n:number)=>{const x=Math.sin(n*127.1+41.7)*43758.5453;return x-Math.floor(x);};
const smooth=(x:number)=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export class CrystalMotion {
  readonly positions=new Float32Array(COUNT*3);
  readonly colors=new Float32Array(COUNT*3);
  readonly alphas=new Float32Array(COUNT);
  readonly sizes=new Float32Array(COUNT);
  readonly soft=new Float32Array(COUNT);
  time=0;
  age=-1;
  private touching=false;
  get active(){return this.age>=0;}
  get energy(){return this.active?Math.sin(Math.min(1,Math.max(0,(this.age-.55)/2.3))*Math.PI):0;}
  get shake(){return this.active?Math.sin(this.age*61)*.014*Math.exp(-Math.pow((this.age-1.25)/.42,2)):0;}
  reset(){this.time=0;this.age=-1;this.touching=false;this.advance(0);}
  trigger(){if(this.active)return false;this.age=0;return true;}
  touch(inside:boolean){if(inside&&!this.touching)this.trigger();this.touching=inside;}
  advance(dt:number){
    dt=Math.max(0,dt);this.time+=dt;if(this.active){this.age+=dt;if(this.age>=CRYSTAL_DURATION)this.age=-1;}
    this.alphas.fill(0);
    for(let i=0;i<CRYSTAL_CORE;i++){
      const phase=i*2.399963+this.time*(.25+hash(i)*.20),y=Math.sin(phase*.7+i)*.31;
      const r=.13*(.35+hash(i+7)*.65)*(1-Math.abs(y));
      this.positions.set([Math.cos(phase)*r,y,Math.sin(phase)*r*.66],i*3);
      const shimmer=.5+.5*Math.sin(this.time*1.1+i*.63);
      this.colors.set([.91+shimmer*.07,.51+shimmer*.17,.67+shimmer*.10],i*3);
      this.soft[i]=i<10?1:0;
      this.sizes[i]=i<10?9+shimmer*4:.7+hash(i+31)*.5;
      this.alphas[i]=i<10?.09+this.energy*.08:.42+shimmer*.2+this.energy*.2;
    }
    if(!this.active)return;
    for(let direction=0;direction<2;direction++)for(let i=0;i<FLOW;i++){
      const start=direction===0?i*.022:1.95+i*.022;
      const t=(this.age-start)/(direction===0?1.05:1.20);
      if(t<0||t>1)continue;
      const index=CRYSTAL_CORE+direction*FLOW+i,phase=i*2.399963;
      const y=direction===0?1.45-t*1.36:-.15-t*1.30;
      // Both streams thread the pointed ends, widening only outside the shell.
      const radius=.012+Math.max(0,Math.abs(y)-.9)*.13;
      this.positions.set([Math.cos(phase)*radius,y,Math.sin(phase)*radius],index*3);
      this.colors.set(direction===0?[.48,.72,.90]:[.94,.57,.62],index*3);
      this.sizes[index]=.65+hash(i+direction*71)*.5;
      this.alphas[index]=.86*smooth(t/.13)*smooth((1-t)/.18);
    }
  }
}
