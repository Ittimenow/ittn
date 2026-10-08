/** Sparse stars moving toward the camera make the cursor travel into the scene. */
export const FLIGHT_STAR_COUNT=28;
export const FLIGHT_CAMERA_DISTANCE=4.6;
const FAR=-5.5,NEAR=3.25,SPAN=NEAR-FAR;
const hash=(n:number)=>{const x=Math.sin(n*127.1+41.7)*43758.5453;return x-Math.floor(x);};
const smooth=(n:number)=>{n=Math.max(0,Math.min(1,n));return n*n*(3-2*n);};
export class FlightMotion {
  readonly positions=new Float32Array(FLIGHT_STAR_COUNT*3);
  readonly colors=new Float32Array(FLIGHT_STAR_COUNT*3);
  readonly sizes=new Float32Array(FLIGHT_STAR_COUNT);
  readonly alphas=new Float32Array(FLIGHT_STAR_COUNT);
  readonly steering={x:0,y:0};
  private target={x:0,y:0};
  private travel=0;
  reset(){this.travel=0;this.target={x:0,y:0};this.steering.x=this.steering.y=0;this.advance(0);}
  pointer(x:number,y:number){this.target={x:Math.max(-1,Math.min(1,x)),y:Math.max(-1,Math.min(1,y))};}
  leave(){this.target={x:0,y:0};}
  advance(dt:number){
    dt=Math.max(0,dt);this.travel+=dt*2.64;
    const ease=1-Math.exp(-dt*3.2);
    this.steering.x+=(this.target.x-this.steering.x)*ease;
    this.steering.y+=(this.target.y-this.steering.y)*ease;
    const focusX=-.10+this.steering.x*.36,focusY=.24+this.steering.y*.30;
    for(let i=0;i<FLIGHT_STAR_COUNT;i++){
      const z=FAR+((i/FLIGHT_STAR_COUNT*SPAN+this.travel)%SPAN);
      const angle=i*2.39996323,radius=.64+hash(i+5)*1.16;
      // Constant world-space lanes diverge under perspective. Steering moves
      // the vanishing point continuously, never rotates stars with the cursor.
      const perspective=FLIGHT_CAMERA_DISTANCE/(FLIGHT_CAMERA_DISTANCE-z);
      const x=Math.cos(angle)*radius+focusX/perspective,y=Math.sin(angle)*radius+focusY/perspective;
      this.positions.set([x,y,z],i*3);
      const edge=Math.max(Math.abs(x*perspective),Math.abs(y*perspective));
      this.alphas[i]=.68*smooth((z-FAR)/1.1)*smooth((NEAR-z)/.65)*smooth((1.34-edge)/.22);
      this.sizes[i]=.48+hash(i+71)*.28;
      this.colors.set(i===3?[.64,.73,.85]:[.72,.76,.82],i*3);
    }
  }
}
