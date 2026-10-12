/** A browser profile owns a board only while it retains its anonymous cookie. */
const COOKIE='ittn_idea_owner';
const COOKIE_AGE=400*24*60*60;
const DB='ittn-ideas';
const STORE='scoped-strokes';

export function ideaOwner():string|null {
  const existing=document.cookie.split('; ').find(part=>part.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  const owner=existing&&/^[a-f0-9]{32}$/.test(existing)?existing:Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
  document.cookie=`${COOKIE}=${owner}; Max-Age=${COOKIE_AGE}; Path=/; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
  return document.cookie.split('; ').includes(`${COOKIE}=${owner}`)?owner:null;
}

const finished=(tx:IDBTransaction)=>new Promise<void>((resolve,reject)=>{
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});
const result=<T>(request:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});

export async function openIdeaStore(owner:string) {
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(DB,2);
    request.onupgradeneeded=()=>{
      const database=request.result;
      if(!database.objectStoreNames.contains('strokes'))database.createObjectStore('strokes');
      if(!database.objectStoreNames.contains(STORE))database.createObjectStore(STORE);
      if(!database.objectStoreNames.contains('meta'))database.createObjectStore('meta');
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('Storage blocked'));
  });
  const range=()=>IDBKeyRange.bound(owner+'|',owner+'|\uffff');
  const previous=await result<string|undefined>(db.transaction('meta').objectStore('meta').get('current-owner'));
  if(previous!==owner){
    const tx=db.transaction([STORE,'meta'],'readwrite');
    tx.objectStore(STORE).clear();tx.objectStore('meta').put(owner,'current-owner');
    await finished(tx);
    if(previous)try{localStorage.removeItem('ittn-idea-board-v1-view-'+previous);}catch{}
  }
  return {
    async load<T>():Promise<T[]> {
      return result(db.transaction(STORE).objectStore(STORE).getAll(range())) as Promise<T[]>;
    },
    async put(id:string,stroke:unknown) {
      const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(stroke,owner+'|'+id);await finished(tx);
    },
    async replace(strokes:unknown[]) {
      const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
      store.openKeyCursor(range()).onsuccess=event=>{
        const cursor=(event.target as IDBRequest<IDBCursor|null>).result;
        if(cursor){store.delete(cursor.primaryKey);cursor.continue();}
        else strokes.forEach((stroke,i)=>store.put(stroke,owner+'|'+String(i).padStart(9,'0')));
      };
      await finished(tx);
    },
    async migrateLegacy(localStrokes:unknown[]) {
      if(await result(db.transaction('meta').objectStore('meta').get('legacy-migrated')))return false;
      const legacy=await result<unknown[]>(db.transaction('strokes').objectStore('strokes').getAll());
      const source=legacy.length?legacy:localStrokes;
      const tx=db.transaction(['strokes',STORE,'meta'],'readwrite');
      source.forEach((stroke,i)=>tx.objectStore(STORE).put(stroke,owner+'|'+String(i).padStart(9,'0')));
      tx.objectStore('strokes').clear();tx.objectStore('meta').put(true,'legacy-migrated');
      await finished(tx);
      return true;
    },
    close(){db.close();}
  };
}
