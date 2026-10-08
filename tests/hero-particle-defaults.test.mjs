import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {heroParticleDefaultsPlugin} from '../scripts/hero-particle-defaults-plugin.mjs';
import {sanitizeParticleSettings,DEFAULT_PARTICLE_SETTINGS as defaults} from '../src/scripts/hero-particle-settings.ts';

test('local Save validates origin and settings, commits defaults and regenerates matching posters',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'hero-defaults-')),target=pathToFileURL(join(dir,'defaults.json'));
  let handler,rendered;
  const plugin=heroParticleDefaultsPlugin({target,renderPosters:async settings=>{rendered=settings;}});
  plugin.configureServer({ssrLoadModule:async()=>({sanitizeParticleSettings,DEFAULT_PARTICLE_SETTINGS:defaults}),middlewares:{use(_path,middleware){handler=middleware;}}});
  const server=createServer((req,res)=>handler(req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const post=(data,requestOrigin=origin)=>fetch(origin,{method:'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json'},body:JSON.stringify(data)});
  try {
    assert.equal((await post(defaults,'https://foreign.example')).status,403);
    assert.equal((await post({...defaults,pixelSize:999})).status,400);
    assert.equal((await post({...defaults,path:'/some/file'})).status,400);
    const chosen={...defaults,pixelSize:8,coreColor:'#B2DDF0'};
    assert.equal((await post(chosen)).status,200);
    assert.deepEqual(JSON.parse(await readFile(target,'utf8')),chosen);
    assert.deepEqual(rendered,chosen);
  } finally {await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
