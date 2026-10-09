// Run: node --experimental-strip-types scripts/render-hero-particles.mjs
// Static frames are generated from the same authored pixel positions as WebGL.
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { Euler, Vector3 } from 'three';
import { revealGeometry } from '../src/scripts/hero-reveal-geometry.ts';
import { serviceHeroScenes } from '../src/data/service-hero-scenes.ts';
import { createParticleShape, VIEW_SIZE, particleAppearance, projectParticleShape } from '../src/scripts/hero-particle-shapes.ts';
import { DEFAULT_PARTICLE_SETTINGS as defaults } from '../src/scripts/hero-particle-settings.ts';
export async function renderHeroParticlePosters(defaults, outputDir = new URL('../public/services/particles/', import.meta.url)) {
const dir = outputDir;
await mkdir(dir,{recursive:true});
for (const {id} of serviceHeroScenes) {
  if(id==='home'){
    const geometry=revealGeometry(await readFile(new URL('../src/assets/hero/ampersand.json',import.meta.url),'utf8'));
    const positions=geometry.getAttribute('position'),rotation=new Euler(.10,-.28,-.08),faces=[];
    const light=new Vector3(-.4,.7,1).normalize();
    for(let i=0;i<positions.count;i+=3){
      const points=[0,1,2].map(j=>new Vector3().fromBufferAttribute(positions,i+j).applyEuler(rotation));
      const normal=new Vector3().subVectors(points[1],points[0]).cross(new Vector3().subVectors(points[2],points[0])).normalize();
      if(normal.z<=0)continue;
      const shade=Math.round(192+Math.max(0,normal.dot(light))*52);
      const projected=points.map(p=>[500+p.x*4.6/(4.6-p.z)*1000/VIEW_SIZE,500-p.y*4.6/(4.6-p.z)*1000/VIEW_SIZE]);
      faces.push({z:points.reduce((n,p)=>n+p.z,0)/3,html:`<polygon points="${projected.map(p=>p.join(',')).join(' ')}" fill="rgb(${shade},${Math.min(255,shade+3)},${Math.min(255,shade+7)})" stroke="rgb(${shade},${Math.min(255,shade+3)},${Math.min(255,shade+7)})" stroke-width=".5"/>`});
    }
    faces.sort((a,b)=>a.z-b.z);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000">${faces.map(f=>f.html).join('')}</svg>`;
    await writeFile(new URL('home.webp',dir),await sharp(Buffer.from(svg)).webp({quality:92,alphaQuality:100}).toBuffer());geometry.dispose();continue;
  }
  const shape=createParticleShape(id,defaults.pixelSize,defaults.density), scale=1000/VIEW_SIZE;
  const rects=[];
  for (const point of projectParticleShape(shape,defaults.depth)) {
    const {color,alpha}=particleAppearance(point,defaults);
    const size=point.size*2;
    const x=500+point.x*scale-size/2,y=500-point.y*scale-size/2;
    rects.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" fill="rgb(${color.join(',')})" opacity="${alpha.toFixed(3)}"/>`);
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">${rects.join('')}</svg>`;
  await writeFile(new URL(`${id}.webp`,dir),await sharp(Buffer.from(svg)).webp({quality:92,alphaQuality:100}).toBuffer());

}

}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await renderHeroParticlePosters(defaults);
  console.log(`Updated ${serviceHeroScenes.length} particle posters.`);
}
