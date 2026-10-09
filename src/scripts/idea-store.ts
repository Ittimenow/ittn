/** Individual strokes are written asynchronously; drawing never serializes the whole sheet. */
export async function openIdeaStore() {
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('ittn-ideas',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('strokes');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('Storage blocked'));
  });
  return {
    async load<T>():Promise<T[]> {
      return new Promise((resolve,reject)=>{
        const request=db.transaction('strokes').objectStore('strokes').getAll();
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      });
    },
    async put(index:number|string,stroke:unknown) {
      return new Promise<void>((resolve,reject)=>{
        const tx=db.transaction('strokes','readwrite');tx.objectStore('strokes').put(stroke,index);
        tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
    },
    close(){db.close();}
  };
}
