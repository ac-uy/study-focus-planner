// Registry of click/change handlers referenced from the markup with data-act / data-change / data-enter.
export const ACTIONS = {};
export function register(prefix, obj) {
  Object.keys(obj).forEach((k) => { ACTIONS[prefix + '.' + k] = obj[k]; });
}
let refreshFn = () => {};
export function setRefresh(fn) { refreshFn = fn; }
export function refresh() { refreshFn(); }
export function go(hash) { location.hash = hash; }
