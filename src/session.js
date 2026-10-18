import { V } from './store.js';

/** Wessen Daten gerade angezeigt werden: die eigenen, oder (Chefin "als Mitarbeiterin") die der gewählten Person. */
export function viewer() {
  const s = V.session;
  if (!s) return null;
  if (s.role === 'chef' && s.actingAs) return { role: 'ma', uid: s.actingAs, acting: true };
  return { role: s.role, uid: s.uid, acting: false };
}
export const isChef = () => !!(V.session && V.session.role === 'chef');
export const sourceName = () => (V.device === 'tablet' ? 'Tablet' : 'Handy');
