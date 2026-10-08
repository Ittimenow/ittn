import { writeFile, rename, rm } from 'node:fs/promises';

/** Local authoring only. No write endpoint is emitted in the static site. */
export function heroParticleDefaultsPlugin({
  target = new URL('../src/data/hero-particle-defaults.json', import.meta.url),
  renderPosters,
} = {}) {
  let saving=false;
  return {
    name:'hero-particle-defaults', apply:'serve',
    configureServer(server) {
      server.middlewares.use('/__hero-particles/defaults',async(req,res)=>{
        const reply=(status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value));};
        const host=req.headers.host||'',address=req.socket.remoteAddress;
        if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)||! /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)||req.headers.origin!==`http://${host}`){reply(403,{error:'Local same-origin requests only'});return;}
        if(req.method!=='POST'){reply(405,{error:'POST required'});return;}
        if(!req.headers['content-type']?.startsWith('application/json')){reply(415,{error:'JSON required'});return;}
        if(saving){reply(409,{error:'Save already in progress'});return;}
        let body='',locked=false;
        try {
          for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>8192){reply(413,{error:'Payload too large'});return;}}
          const {sanitizeParticleSettings,DEFAULT_PARTICLE_SETTINGS}=await server.ssrLoadModule('/src/scripts/hero-particle-settings.ts');
          const input=JSON.parse(body),settings=sanitizeParticleSettings(input);
          if(!input||Object.keys(input).length!==Object.keys(DEFAULT_PARTICLE_SETTINGS).length||Object.keys(settings).some(key=>input[key]!==settings[key])){reply(400,{error:'Invalid settings'});return;}
          if(saving){reply(409,{error:'Save already in progress'});return;}
          saving=true;locked=true;
          // Generate fallback assets before committing the new shared defaults.
          const render=renderPosters||(await server.ssrLoadModule('/scripts/render-hero-particles.mjs')).renderHeroParticlePosters;
          await render(settings);
          const temporary=new URL(`${target.href}.tmp`);
          try {await writeFile(temporary,JSON.stringify(settings,null,2)+'\n');await rename(temporary,target);}
          finally {await rm(temporary,{force:true});}
          reply(200,{saved:true,settings});
        } catch {reply(400,{error:'Could not save settings'});}
        finally {if(locked)saving=false;}
      });
    },
  };
}
