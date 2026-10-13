// Same ASCII contract and case-insensitive key as public.profiles.
export function normalizePublicUsername(value) {
 return typeof value==='string'&&/^[A-Za-z0-9_.-]{2,30}$/.test(value)?value.toLowerCase():'';
}
export function publicProfileUrl(username) {
 const key=normalizePublicUsername(username);return key?'/@'+encodeURIComponent(key):'';
}
export function profileRouteUsername(pathname) {
 if(typeof pathname!=='string'||!pathname.startsWith('/@'))return '';
 try{return normalizePublicUsername(decodeURIComponent(pathname.slice(2)));}catch{return '';}
}
