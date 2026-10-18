import { api as demo } from './demo.js';
import { api as live } from './supabase.js';

export const isDemo = new URLSearchParams(location.search).has('demo');
export const api = isDemo ? demo : live;
export { DEMO_TAG_UID, DEMO_UNKNOWN_UID } from './demo.js';
