const smooth=(n:number)=>{n=Math.max(0,Math.min(1,n));return n*n*(3-2*n);};
const hash=(n:number)=>{const v=Math.sin(n*127.1)*43758.5453;return v-Math.floor(v);};
export const PORTAL_COUNT=384;
export interface PortalBlock {x:number;y:number;z:number;size:number;angle:number;accent:boolean;}
/** Fixed portal mouth; repeating construction segments travel through its depth. */
export class SystemMotion {
  time=0;energy=0;age=-1;
  private travel=0;
  private target={x:0,y:0};
  private steer={x:0,y:0};
  reset(){this.time=0;this.energy=0;this.age=-1;this.travel=0;this.target={x:0,y:0};this.steer={x:0,y:0};}
  pointer(x:number,y:number){this.target={x:Math.max(-1,Math.min(1,x)),y:Math.max(-1,Math.min(1,y))};}
  leave(){this.target={x:0,y:0};}
  trigger(){if(this.age<0)this.age=0;}
  advance(dt:number){
    this.time+=dt;
    if(this.age>=0){this.age+=dt;if(this.age>2.4)this.age=-1;}
    this.energy=this.age<0?0:Math.sin(Math.PI*this.age/2.4);
    this.travel+=dt*(.27+this.energy*.62);
    const e=1-Math.exp(-dt*3);this.steer.x+=(this.target.x-this.steer.x)*e;this.steer.y+=(this.target.y-this.steer.y)*e;
  }
  block(i:number):PortalBlock{
    if(i<64){
      const side=Math.floor(i/16),j=i%16,t=(j/15-.5)*1.9,h=hash(i+12),outer=i%3===0;
      return {x:side<2?(side===0?-.95:.95):t,y:side>=2?(side===2?-.95:.95):t,z:.06+(h-.5)*.18,size:.105+h*.04+(outer?.03:0),angle:(h-.5)*.22,accent:false};
    }
    const n=i-64,segment=Math.floor(n/40),part=n%40;
    const phase=((segment*.9+this.travel)%7.2),z=.1-phase;
    const assembly=smooth((phase-.15)/.9)*(1-smooth((phase-5.0)/2.1));
    const route=Math.sin(phase*.55+this.time*.12)*.11+this.steer.x*.24*(phase/7.2);
    let x=0,y=0;
    if(part<12){x=((part%4)-1.5)*.22+route;y=-.67;}
    else if(part<32){const j=part-12,side=j<10?-1:1;x=side*(.77+(1-assembly)*.40);y=-.66+(j%10)*.145;}
    else {x=((part-32)-3.5)*.22;y=.78+(1-assembly)*.35;}
    const loose=1-assembly;
    x+=Math.sin(n*4.3+this.time*.3)*loose*.16;
    y+=Math.cos(n*2.7)*loose*.30;
    // Parallax is strongest in the deep layers; the mouth stays in the page plane.
    x+=this.steer.x*phase*.11;y+=this.steer.y*phase*.08;
    const near=smooth(phase/.32),far=1-smooth((phase-6.3)/.9);
    return {x,y,z:z-(part<12?(part%3)*.065:0),size:(part<12?.205:.14)*near*far,angle:loose*Math.sin(n)*.7,accent:part===6||part===25};
  }
  sample(i:number,_count:number):{position:number[];normal:number[]}{
    const block=this.block(Math.min(PORTAL_COUNT-1,Math.floor(i/24))),face=Math.floor(i%24/4),corner=i%4,axis=Math.floor(face/2),sign=face%2?1:-1;
    const p=[0,0,0],normal=[0,0,0];normal[axis]=sign;p[axis]=sign*block.size/2;
    p[(axis+1)%3]=(corner%2?1:-1)*block.size*.35;p[(axis+2)%3]=(corner<2?1:-1)*block.size*.35;
    return {position:[block.x+p[0],block.y+p[1],block.z+p[2]],normal};
  }
}
