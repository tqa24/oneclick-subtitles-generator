// Gated debug logging (enable in the browser console: localStorage.debug_logs = 'true')
export const DEBUG_LOGS = (typeof window !== 'undefined') && (localStorage.getItem('debug_logs') === 'true');
export const dbg = (...args) => { if (DEBUG_LOGS) console.log(...args); };
