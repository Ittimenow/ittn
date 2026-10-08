/** Shared stage boundaries for the shell and the travelling sales pixels. */
export const FUNNEL_COLORS=['#83BFDF','#91C7A5','#E6AD79','#D98482'] as const;
export const FUNNEL_BOUNDS=[.36,0,-.35] as const;
export function funnelStage(y:number){return y>.36?0:y>0?1:y>-.35?2:3;}
export function funnelRadius(y:number){return y>-.35?.20+(Math.min(y,.71)+.35)*.59:.20;}
const hash=(n:number)=>{const x=Math.sin(n*127.1+41.7)*43758.5453;return x-Math.floor(x);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export function funnelColor(y:number):[number,number,number] {
  let color=FUNNEL_COLORS[funnelStage(y)];
  let rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255) as [number,number,number];
  // A short soft transition at each boundary, not a rainbow along the whole funnel.
  for(let j=0;j<3;j++)if(Math.abs(y-FUNNEL_BOUNDS[j])<.055){
    const t=Math.max(0,Math.min(1,(FUNNEL_BOUNDS[j]+.055-y)/.11));
    const ease=t*t*(3-2*t);
    rgb=[1,3,5].map(i=>mix(parseInt(FUNNEL_COLORS[j].slice(i,i+2),16)/255,parseInt(FUNNEL_COLORS[j+1].slice(i,i+2),16)/255,ease)) as [number,number,number];
  }
  return rgb;
}
export const FUNNEL_FLOW_CAPACITY=96;
export const FUNNEL_FRAGMENTS=6;
export const FUNNEL_BURST_DURATION=.72;
const POOL_CAPACITY=FUNNEL_FLOW_CAPACITY*(1+FUNNEL_FRAGMENTS);
export class FunnelMotion {
  readonly positions=new Float32Array(POOL_CAPACITY*3);
  readonly colors=new Float32Array(POOL_CAPACITY*3);
  readonly alphas=new Float32Array(POOL_CAPACITY);
  readonly sizes=new Float32Array(POOL_CAPACITY);
  private time=0;
  reset(){this.time=0;this.alphas.fill(0);}
  advance(dt:number,intensity:number,loss:number) {
    this.time+=Math.max(0,Math.min(dt,.075));
    this.alphas.fill(0);
    const count=Math.round(FUNNEL_FLOW_CAPACITY*intensity/100);
    for(let i=0;i<FUNNEL_FLOW_CAPACITY;i++) {
      if(i>=count){this.alphas[i]=0;continue;}
      const duration=5.5+hash(i+29)*2,clock=this.time+hash(i+101)*duration,cycle=Math.floor(clock/duration),t=(clock%duration)/duration;
      // Uniform descent keeps every stage readable; the radius smoothly narrows.
      const y=1.24-t*2.48;
      const angle=i*2.399963+Math.sin(t*3+i)*.20;
      const radial=(.22+hash(i+13)*.62)*Math.max(.055,funnelRadius(y)-.105);
      const x=Math.cos(angle)*radial,z=Math.sin(angle)*radial;
      const alpha=Math.min(1,t*15,(1-t)*12);
      const lost=hash(i*7+cycle*41+811)<loss/100;
      const lostY=.27-hash(i+cycle*11)*.48;
      if(lost&&y<lostY) {
        const lostT=(1.24-lostY)/2.48,age=(t-lostT)*duration;
        if(age<FUNNEL_BURST_DURATION) {
          const progress=age/FUNNEL_BURST_DURATION;
          // Freeze the rupture origin and stage color at the instant of loss.
          const originAngle=i*2.399963+Math.sin(lostT*3+i)*.20;
          const originRadius=(.22+hash(i+13)*.62)*Math.max(.055,funnelRadius(lostY)-.105);
          const originX=Math.cos(originAngle)*originRadius,originZ=Math.sin(originAngle)*originRadius;
          const color=funnelColor(lostY);
          for(let j=0;j<FUNNEL_FRAGMENTS;j++) {
            const index=FUNNEL_FLOW_CAPACITY+i*FUNNEL_FRAGMENTS+j;
            const angle=j*Math.PI*2/FUNNEL_FRAGMENTS+hash(i+cycle*7)*3;
            const spread=(.16+hash(i*13+j)*.16)*progress;
            this.positions.set([originX+Math.cos(angle)*spread,lostY+Math.sin(angle)*spread*.65,originZ+Math.sin(angle+1.1)*spread*.65],index*3);
            this.colors.set(color,index*3);
            this.alphas[index]=Math.pow(1-progress,1.6)*.8;
            this.sizes[index]=.62-.27*progress;
          }
        }
        continue;
      }
      this.positions.set([x,y,z],i*3);this.colors.set(funnelColor(y),i*3);
      this.alphas[i]=Math.max(0,alpha);this.sizes[i]=.85+hash(i+98)*.5;
    }
  }
}
