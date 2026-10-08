import projectDefaults from '../data/hero-particle-defaults.json' with { type: 'json' };
export interface ParticleSettings {
  pixelSize: number;
  density: number;
  speed: number;
  distance: number;
  reaction: number;
  depth: number;
  chaos: number;
  rocking: number;
  accentAmount: number;
  shellOpacity: number;
  funnelOpacity: number;
  funnelFlow: number;
  funnelLoss: number;
  accent: string;
  coreColor: string;
  primary: string;
  secondary: string;
  background: string;
  paused: boolean;
}
export const DEFAULT_PARTICLE_SETTINGS: Readonly<ParticleSettings> = Object.freeze({...projectDefaults});
export const PARTICLE_SETTINGS_KEY = 'ittn.hero-particles.v5';
export const PARTICLE_SETTINGS_EVENT = 'hero-particle-settings';
export const particleRanges = {
  pixelSize: [3,12], density: [35,100], speed: [.25,1.5], distance: [0,30], reaction: [0,100], depth: [15,160], chaos: [0,100], rocking: [0,100], accentAmount: [0,15], shellOpacity: [5,80], funnelOpacity: [5,80], funnelFlow: [0,100], funnelLoss: [0,60],
} as const;
export function sanitizeParticleSettings(value: unknown): ParticleSettings {
  const input = value && typeof value === 'object' ? value as Record<string,unknown> : {};
  const result = {...DEFAULT_PARTICLE_SETTINGS};
  for (const key of Object.keys(particleRanges) as (keyof typeof particleRanges)[]) {
    const n = input[key];
    if (typeof n === 'number' && Number.isFinite(n)) result[key] = Math.min(particleRanges[key][1],Math.max(particleRanges[key][0],n));
  }
  for (const key of ['primary','secondary','background','accent','coreColor'] as const) {
    const color=input[key];
    if (typeof color==='string' && /^#[\da-f]{6}$/i.test(color)) result[key]=color.toUpperCase();
  }
  if (typeof input.paused==='boolean') result.paused=input.paused;
  return result;
}
export function readParticleSettings(): ParticleSettings {
  try {
    const saved=JSON.parse(localStorage.getItem(PARTICLE_SETTINGS_KEY)||'null');
    if(saved?.version===JSON.stringify(DEFAULT_PARTICLE_SETTINGS))return sanitizeParticleSettings(saved.settings);
  } catch { /* Project defaults remain available when browser storage is unavailable. */ }
  return {...DEFAULT_PARTICLE_SETTINGS};
}
export function saveParticleSettings(value: ParticleSettings) {
  try {
    localStorage.setItem(PARTICLE_SETTINGS_KEY,JSON.stringify({version:JSON.stringify(DEFAULT_PARTICLE_SETTINGS),settings:sanitizeParticleSettings(value)}));
    return true;
  } catch { return false; }
}
export function colorChannels(hex: string): [number,number,number] {
  return [1,3,5].map(start=>parseInt(hex.slice(start,start+2),16)) as [number,number,number];
}
