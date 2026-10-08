// Run: node --experimental-strip-types scripts/render-hero-particles.mjs
// Static frames are generated from the same authored pixel positions as WebGL.
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { serviceHeroScenes } from '../src/data/service-hero-scenes.ts';
import { createParticleShape, VIEW_SIZE, particleAppearance, projectParticleShape } from '../src/scripts/hero-particle-shapes.ts';
import { DEFAULT_PARTICLE_SETTINGS as defaults } from '../src/scripts/hero-particle-settings.ts';
export async function renderHeroParticlePosters(defaults, outputDir = new URL('../public/services/particles/', import.meta.url)) {
const dir = outputDir;
await mkdir(dir,{recursive:true});
for (const {id} of serviceHeroScenes) {
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
  console.log('Updated 8 particle posters.');
}
