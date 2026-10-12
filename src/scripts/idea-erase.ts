export type IdeaPoint={x:number;y:number;p:number};
export type IdeaStroke=IdeaPoint[];

const near=(a:IdeaPoint,b:IdeaPoint,r:number)=>Math.hypot(a.x-b.x,a.y-b.y)<=r;
const interpolate=(a:IdeaPoint,b:IdeaPoint,t:number):IdeaPoint=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,p:a.p+(b.p-a.p)*t});

/** Cut a round hole through ink paths, retaining both sides of a crossed line. */
export function eraseAt(strokes:IdeaStroke[],center:IdeaPoint,radius:number):{strokes:IdeaStroke[];changed:boolean} {
  const result:IdeaStroke[]=[];
  let changed=false;
  for(const stroke of strokes){
    let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
    for(const p of stroke){left=Math.min(left,p.x);right=Math.max(right,p.x);top=Math.min(top,p.y);bottom=Math.max(bottom,p.y);}
    if(center.x<left-radius||center.x>right+radius||center.y<top-radius||center.y>bottom+radius){result.push(stroke);continue;}
    const pieces:IdeaStroke[]=[];
    let strokeChanged=false;
    let current:IdeaStroke=[];
    const push=()=>{if(current.length)pieces.push(current);current=[];};
    for(let i=0;i<stroke.length;i++){
      const a=stroke[Math.max(0,i-1)],b=stroke[i];
      if(i>0&&(Math.min(a.x,b.x)>center.x+radius||Math.max(a.x,b.x)<center.x-radius||Math.min(a.y,b.y)>center.y+radius||Math.max(a.y,b.y)<center.y-radius)){
        if(!current.length)current.push(a);
        current.push(b);continue;
      }
      const length=Math.hypot(b.x-a.x,b.y-a.y);
      const steps=i===0?1:Math.max(1,Math.ceil(length/2));
      for(let j=i===0?0:1;j<=steps;j++){
        const p=i===0?b:interpolate(a,b,j/steps);
        if(near(p,center,radius)){changed=true;strokeChanged=true;push();}
        else if(!current.length||Math.hypot(p.x-current.at(-1)!.x,p.y-current.at(-1)!.y)>0.001)current.push(p);
      }
    }
    push();
    if(strokeChanged)result.push(...pieces);else result.push(stroke);
  }
  return {strokes:changed?result:strokes,changed};
}
