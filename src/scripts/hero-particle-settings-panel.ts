import { DEFAULT_PARTICLE_SETTINGS, PARTICLE_SETTINGS_EVENT, PARTICLE_SETTINGS_KEY, readParticleSettings, sanitizeParticleSettings, saveParticleSettings, type ParticleSettings } from './hero-particle-settings';
class HeroParticleSettingsPanel extends HTMLElement {
  private settings=readParticleSettings();
  private events?:AbortController;
  private saving=false;
  private dialog!:HTMLDialogElement;
  private trigger!:HTMLButtonElement;
  connectedCallback() {
    this.events=new AbortController();const options={signal:this.events.signal};
    this.dialog=this.querySelector('dialog')!;this.trigger=this.querySelector('[data-settings-open]')!;
    this.trigger.hidden=false;this.sync();
    try {
      if(sessionStorage.getItem('hero-particle-project-save')===JSON.stringify(DEFAULT_PARTICLE_SETTINGS)) {
        this.status('Сохранено как настройки проекта по умолчанию.');
        sessionStorage.removeItem('hero-particle-project-save');
      }
    } catch { /* Saving does not depend on browser storage. */ }
    this.trigger.addEventListener('click',()=>this.dialog.open?this.close():this.open(),options);
    this.querySelector('[data-settings-close]')!.addEventListener('click',()=>this.close(),options);
    this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();},options);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&this.dialog.open){event.preventDefault();this.close();}},options);
    this.addEventListener('input',event=>{
      const field=event.target as HTMLInputElement;
      if(field.matches('[data-setting]')) {
        this.update({[field.name]:field.type==='range'?field.valueAsNumber:field.value});
      } else if(field.matches('[data-color-text]')) {
        const valid=/^#[\da-f]{6}$/i.test(field.value);field.setAttribute('aria-invalid',String(!valid));
        if(valid)this.update({[field.name]:field.value});
      }
    },options);
    this.querySelector('[data-settings-save]')!.addEventListener('click',()=>void this.save(),options);
    this.querySelector('[data-settings-pause]')!.addEventListener('click',()=>this.update({paused:!this.settings.paused}),options);
    this.querySelector('[data-settings-reset]')!.addEventListener('click',()=>this.update({...DEFAULT_PARTICLE_SETTINGS}),options);
    window.addEventListener('storage',event=>{
      if(event.key===PARTICLE_SETTINGS_KEY){this.settings=readParticleSettings();this.sync();this.broadcast();}
    },options);
  }
  private open() {
    this.dialog.show();this.trigger.setAttribute('aria-expanded','true');
    this.dispatchEvent(new CustomEvent('hero-particle-panel',{bubbles:true,detail:{open:true}}));
    this.querySelector<HTMLButtonElement>('[data-settings-close]')!.focus({preventScroll:true});
    if(matchMedia('(max-width:767px)').matches) requestAnimationFrame(()=>{
      this.closest('hero-particles')?.querySelector('[data-particle-surface]')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    });
  }
  private close() {
    this.dialog.close();this.trigger.setAttribute('aria-expanded','false');
    this.dispatchEvent(new CustomEvent('hero-particle-panel',{bubbles:true,detail:{open:false}}));
    this.trigger.focus({preventScroll:true});
  }
  private update(patch:Partial<ParticleSettings>) {
    this.settings=sanitizeParticleSettings({...this.settings,...patch});this.sync();this.broadcast();this.status('Есть несохранённые изменения.');
  }
  private status(message:string){this.querySelector('[data-settings-status]')!.textContent=message;}
  private async save() {
    if(this.saving)return;
    if(this.querySelector('[aria-invalid="true"]')){this.status('Проверьте цвет: нужен формат #RRGGBB.');return;}
    const button=this.querySelector<HTMLButtonElement>('[data-settings-save]')!;
    const snapshot={...this.settings};this.saving=true;button.disabled=true;button.textContent='Сохраняю…';
    try {
      if(this.hasAttribute('data-project-save')) {
        try {sessionStorage.setItem('hero-particle-project-save',JSON.stringify(snapshot));}catch {}
        const response=await fetch('/__hero-particles/defaults',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot),signal:this.events?.signal});
        if(!response.ok)throw new Error('save failed');
        this.status(JSON.stringify(snapshot)===JSON.stringify(this.settings)?'Сохранено как настройки проекта по умолчанию.':'Настройки сохранены. Есть новые несохранённые изменения.');
      } else {
        if(!saveParticleSettings(snapshot))throw new Error('storage unavailable');
        this.status('Сохранено в этом браузере.');
      }
    } catch {
      if(!this.events?.signal.aborted){
        try{sessionStorage.removeItem('hero-particle-project-save');}catch {}
        this.status('Не удалось сохранить. Изменения видны в предпросмотре — попробуйте ещё раз.');
      }
    } finally {this.saving=false;button.disabled=false;button.textContent='Сохранить';}
  }
  private broadcast(){window.dispatchEvent(new CustomEvent(PARTICLE_SETTINGS_EVENT,{detail:this.settings}));}
  private sync() {
    for(const field of this.querySelectorAll<HTMLInputElement>('[data-setting], [data-color-text]')) {
      const value=this.settings[field.name as keyof ParticleSettings];
      field.value=String(value);field.removeAttribute('aria-invalid');
      if(field.type==='range')this.querySelector(`[data-output="${field.name}"]`)!.textContent=`${Number(value).toLocaleString('ru-RU',{maximumFractionDigits:2})} ${field.dataset.unit}`;
    }
    const pause=this.querySelector<HTMLButtonElement>('[data-settings-pause]')!;
    pause.textContent=this.settings.paused?'Продолжить':'Пауза';pause.setAttribute('aria-pressed',String(this.settings.paused));
  }
  disconnectedCallback(){this.events?.abort();this.dialog?.close();}
}
if(!customElements.get('hero-particle-settings'))customElements.define('hero-particle-settings',HeroParticleSettingsPanel);
