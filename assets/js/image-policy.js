export const IMAGE_HOST = 'ycqrjqj1ewtpdcvb.public.blob.vercel-storage.com';
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const IMAGE_TYPES = Object.freeze({'image/jpeg':['jpg','jpeg'],'image/png':['png'],'image/webp':['webp']});
export function validImageFile(name,type,size) {
    return typeof name==='string' && name.length<=200 && IMAGE_TYPES[type]?.includes(name.split('.').pop().toLowerCase()) && size>0 && size<=MAX_IMAGE_BYTES;
}
export function managedImageUrl(value) {
    try {const u=new URL(value);return u.protocol==='https:'&&u.hostname===IMAGE_HOST&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^\/zytrix\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.webp$/.test(u.pathname);}catch{return false;}
}
