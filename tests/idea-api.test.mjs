import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createIdeaApi,validPng} from '../scripts/idea-api.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvWQAAAAASUVORK5CYII=','base64');
async function setup(t,options={}){
 const directory=await mkdtemp(join(tmpdir(),'ittn-ideas-')),mail=[];
 const api=createIdeaApi({directory,sendMail:async data=>{mail.push(data);return {accepted:['pm@ittimenow.com']};},env:{SMTP_FROM:'ideas@example.com'},...options});
 const server=createServer((req,res)=>void api.handle(req,res).then(ok=>{if(!ok)res.writeHead(404).end();}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{api.close();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});});
 const post=(data=png,headers={})=>fetch(base+'/api/ideas',{method:'POST',headers:{origin:base,'content-type':'image/png',...headers},body:data});
 return {directory,api,mail,base,post};
}
test('publish PNG, immutable link, fixed mail recipient, deduplicate, restart storage',async t=>{
 const x=await setup(t);
 const r=await x.post();assert.equal(r.status,201);const {url}=await r.json(),id=new URL(url).searchParams.get('id');
 assert.match(id,/^[a-f0-9]{32}$/);assert.equal(url,x.base+'/idea/?id='+id);
 const loaded=await fetch(x.base+'/api/ideas/'+id+'.png');assert.equal(loaded.status,200);assert.deepEqual(Buffer.from(await loaded.arrayBuffer()),png);
 const second=await x.post();assert.equal((await second.json()).url,url);
 for(let i=0;i<50&&x.mail.length===0;i++)await new Promise(r=>setTimeout(r,10));
 assert.equal(x.mail.length,1);assert.equal(x.mail[0].to,'pm@ittimenow.com');assert.ok(x.mail[0].text.includes(url));
 for(let i=0;i<50;i++){const meta=JSON.parse(await readFile(join(x.directory,id,'meta.json')));if(meta.notified)break;await new Promise(r=>setTimeout(r,10));}
 const again=createIdeaApi({directory:x.directory,env:{},sendMail:async()=>assert.fail('duplicate mail')});t.after(()=>again.close());await again.notifications();
 assert.equal((await readdir(x.directory)).length,1);
});
test('reject malformed/oversized PNG, cross-origin and invalid identifiers',async t=>{
 const x=await setup(t);
 assert.equal((await x.post(png,{origin:'https://evil.example'})).status,403);
 assert.equal((await x.post(Buffer.from('<svg/>'))).status,400);
 assert.equal((await x.post(png,{'content-type':'text/plain'})).status,415);
 const huge=Buffer.from(png);huge.writeUInt32BE(9000,16);assert.equal(validPng(huge),false);
 assert.equal((await x.post(huge)).status,400);
 assert.equal((await x.post(Buffer.alloc(8*1024*1024+1))).status,413);
 assert.equal((await fetch(x.base+'/api/ideas/not-a-token.png')).status,404);
 assert.equal((await fetch(x.base+'/api/ideas/'+ 'a'.repeat(32)+'.png')).status,404);
 assert.equal(x.mail.length,0);
});
test('SMTP failure queues notification; absent SMTP leaves pending record',async t=>{
 const x=await setup(t,{sendMail:async()=>{throw Error('offline');}});
 const {url}=await (await x.post()).json(),id=new URL(url).searchParams.get('id');
 for(let i=0;i<50;i++){const meta=JSON.parse(await readFile(join(x.directory,id,'meta.json')));if(meta.retryAt){assert.equal(meta.notified,false);return;}await new Promise(r=>setTimeout(r,10));}
 assert.fail('retry was not persisted');
});
test('rate and disk limits preserve existing content',async t=>{
 const x=await setup(t,{rateLimit:1});assert.equal((await x.post()).status,201);assert.equal((await x.post()).status,429);
 const y=await setup(t,{maxBytes:1});assert.equal((await y.post()).status,507);
});
