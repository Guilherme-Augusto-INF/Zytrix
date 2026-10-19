export function publicProfileUrl(uid) {
 return typeof uid==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)?'/usuario?uid='+encodeURIComponent(uid.toLowerCase()):'';
}
