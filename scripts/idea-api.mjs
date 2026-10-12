import { mkdir, readFile, writeFile, rename, readdir, stat, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import { isIP } from 'node:net';

const LIMIT=8*1024*1024, ID=/^[a-f0-9]{32}$/;
export const IDEA_LINK_TTL_MS=90*24*60*60*1000;
const recipient='pm@ittimenow.com';
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
const fail=(status,message)=>Object.assign(new Error(message),{status});
export function validPng(data) {
  if(data.length<45||!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return false;
  if(data.readUInt32BE(8)!==13||data.toString('ascii',12,16)!=='IHDR')return false;
  const width=data.readUInt32BE(16),height=data.readUInt32BE(20);
  if(!width||!height||width>4096||height>4096)return false;
  let at=8,sawData=false;
  while(at+12<=data.length){
    const len=data.readUInt32BE(at),type=data.toString('ascii',at+4,at+8);
    if(at+12+len>data.length)return false;
    if(type==='IDAT')sawData=true;
    if(type==='IEND')return len===0&&at+12===data.length&&sawData;
    at+=12+len;
  }
  return false;
}
/** Shared by the local Vite server and the production Node server. Never serves storage paths. */
export function createIdeaApi({directory=process.env.IDEA_STORAGE_DIR||resolve('.data/ideas'),origin=process.env.IDEA_PUBLIC_ORIGIN,env=process.env,sendMail,maxBytes=512*1024*1024,rateLimit=12,now=()=>Date.now()}={}){
  let queue=Promise.resolve(),notifying=false,closed=false;
  const rates=new Map();
  const smtp=env.SMTP_HOST&&env.SMTP_FROM?nodemailer.createTransport({
    host:env.SMTP_HOST,port:Number(env.SMTP_PORT||465),secure:String(env.SMTP_SECURE??'true')==='true',requireTLS:true,
    auth:env.SMTP_USER?{user:env.SMTP_USER,pass:env.SMTP_PASSWORD}:undefined,
    connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,
    disableFileAccess:true,disableUrlAccess:true,
  }):null;
  const deliver=sendMail||(smtp?(mail=>smtp.sendMail(mail)):null);
  const exclusive=work=>{const next=queue.then(work);queue=next.catch(()=>{});return next;};
  const atomic=async(path,value)=>{await writeFile(path+'.tmp',JSON.stringify(value),{mode:0o600});await rename(path+'.tmp',path);};
  const expired=meta=>!meta||!Number.isFinite(Date.parse(meta.createdAt))||Date.parse(meta.createdAt)+IDEA_LINK_TTL_MS<=now();
  async function cleanup(){
    await exclusive(async()=>{
      for(const id of (await readdir(directory).catch(()=>[])).filter(id=>ID.test(id))){
        const meta=await readFile(join(directory,id,'meta.json'),'utf8').then(JSON.parse).catch(()=>null);
        if(expired(meta))await rm(join(directory,id),{recursive:true,force:true});
      }
    });
  }
  async function notifications(){
    if(closed||notifying||!deliver)return;notifying=true;
    try{
      const ids=(await readdir(directory).catch(()=>[])).filter(id=>ID.test(id));
      for(const id of ids){
        if(closed)break;
        const path=join(directory,id,'meta.json');
        const meta=await readFile(path,'utf8').then(JSON.parse).catch(()=>null);
        if(expired(meta)||meta.notified||meta.retryAt>now())continue;
        try{
          const result=await deliver({from:env.SMTP_FROM,to:recipient,subject:'Новая идея на IT TIME NOW',text:'На сайте опубликован новый рисунок.\n\nПосмотреть: '+meta.url+'\n\nСоздан: '+meta.createdAt,messageId:'<idea-'+id+'@ittimenow.com>'});
          if(result?.rejected?.length)throw Error('Recipient rejected');
          meta.notified=true;delete meta.retryAt;
        }catch{meta.retryAt=now()+5*60*1000;}
        await atomic(path,meta);
      }
    }catch{console.error('Idea notification queue could not be processed.');}
    finally{notifying=false;}
  }
  const timer=setInterval(()=>void notifications(),60000);timer.unref();
  const cleanupTimer=setInterval(()=>void cleanup().catch(()=>console.error('Idea cleanup failed.')),60*60*1000);cleanupTimer.unref();
  void cleanup().then(()=>notifications()).catch(()=>console.error('Idea cleanup failed.'));
  function publicOrigin(req){
    if(origin){const u=new URL(origin);if(!['http:','https:'].includes(u.protocol))throw fail(503,'Публикация временно недоступна.');return u.origin;}
    const host=req.headers.host||'';
    if(!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host))throw fail(503,'Публикация ещё не настроена.');
    return 'http://'+host;
  }
  async function handle(req,res){
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(!pathname.startsWith('/api/ideas'))return false;
    try{
      if(['/api/ideas','/api/ideas/'].includes(pathname)&&req.method==='POST'){
        const base=publicOrigin(req);
        if(req.headers.origin!==base)throw fail(403,'Публикация разрешена только с сайта.');
        if(req.headers['content-type']!=='image/png')throw fail(415,'Ожидается PNG.');
        const forwarded=String(req.headers['x-forwarded-for']||'').split(',').at(-1).trim();
        const currentTime=now(),ip=env.IDEA_TRUST_PROXY==='true'&&isIP(forwarded)?forwarded:req.socket.remoteAddress||'unknown';
        for(const [key,value] of rates)if(value.until<currentTime)rates.delete(key);
        const rate=rates.get(ip)||{count:0,until:currentTime+3600000};
        if(rate.count>=rateLimit||rates.size>=10000)throw fail(429,'Слишком много публикаций. Попробуйте позже.');
        rate.count++;rates.set(ip,rate);
        if(Number(req.headers['content-length'])>LIMIT)throw fail(413,'Рисунок слишком большой.');
        const chunks=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>LIMIT)throw fail(413,'Рисунок слишком большой.');chunks.push(chunk);}
        const png=Buffer.concat(chunks);if(!validPng(png))throw fail(400,'Не удалось прочитать рисунок.');
        const hash=createHash('sha256').update(png).digest('hex');
        let id='',createdAt='';
        await exclusive(async()=>{
          await mkdir(directory,{recursive:true});
          let used=0,count=0;
          for(const item of await readdir(directory)){
            if(!ID.test(item))continue;count++;
            const folder=join(directory,item);
            const meta=await readFile(join(folder,'meta.json'),'utf8').then(JSON.parse).catch(()=>null);
            if(expired(meta)){await rm(folder,{recursive:true,force:true});count--;continue;}
            if(meta.contentHash===hash){id=item;createdAt=meta.createdAt;return;}
            used+=(await stat(join(directory,item,'drawing.png')).catch(()=>({size:0}))).size;
          }
          if(count>=1000||used+size>maxBytes)throw fail(507,'Хранилище заполнено. Скачайте рисунок на устройство.');
          id=randomBytes(16).toString('hex');createdAt=new Date(now()).toISOString();
          const url=base+'/idea/?id='+id,folder=join(directory,id),metaPath=join(folder,'meta.json');
          await mkdir(folder,{recursive:true});
          await writeFile(join(folder,'drawing.png.tmp'),png,{mode:0o600});
          await rename(join(folder,'drawing.png.tmp'),join(folder,'drawing.png'));
          await atomic(metaPath,{url,createdAt,contentHash:hash,notified:false});
        });
        json(res,201,{url:base+'/idea/?id='+id,expiresAt:new Date(Date.parse(createdAt)+IDEA_LINK_TTL_MS).toISOString()});void notifications();return true;
      }
      const match=pathname.match(/^\/api\/ideas\/([a-f0-9]{32})\.png$/);
      if(match&&['GET','HEAD'].includes(req.method)){
        // A committed metadata record is required; incomplete uploads remain invisible.
        const folder=join(directory,match[1]);
        const meta=await readFile(join(folder,'meta.json'),'utf8').then(JSON.parse);
        if(expired(meta)){void cleanup().catch(()=>{});throw fail(404,'Срок действия ссылки истёк.');}
        const data=await readFile(join(directory,match[1],'drawing.png'));
        res.writeHead(200,{'Content-Type':'image/png','Content-Length':data.length,'Cache-Control':'no-store','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff'});
        res.end(req.method==='HEAD'?undefined:data);return true;
      }
      throw fail(req.method==='GET'?404:405,'Рисунок не найден.');
    }catch(e){json(res,e.status||(e.code==='ENOENT'?404:503),e.status?{error:e.message}:{error:e.code==='ENOENT'?'Рисунок не найден.':'Не удалось сохранить рисунок. Попробуйте позже.'});return true;}
  }
  return {handle,notifications,cleanup,close(){closed=true;clearInterval(timer);clearInterval(cleanupTimer);smtp?.close();}};
}
export function ideaApiPlugin(){
  let api;
  return {name:'idea-api',apply:'serve',configureServer(server){
    api=createIdeaApi();server.middlewares.use((req,res,next)=>{void api.handle(req,res).then(handled=>{if(!handled)next();}).catch(next);});
    server.httpServer?.once('close',()=>api.close());
  }};
}
