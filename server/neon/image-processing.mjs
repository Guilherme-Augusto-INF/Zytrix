import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {ApiError} from './platform.mjs';
import {validImageFile,MAX_IMAGE_BYTES} from '../../assets/js/image-policy.js';
const signature=b=>b.length>=12&&(b[0]===255&&b[1]===216&&b[2]===255?'jpeg':b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'?'webp':null);
export async function optimizeImage(buffer,{name,type,kind}) {
 if(buffer.length>MAX_IMAGE_BYTES)throw new ApiError('image_too_large',413);
 if(!validImageFile(name,type,buffer.length)||!['profile','thumbnail'].includes(kind))throw new ApiError('invalid_image',415);
 const expected=type==='image/jpeg'?'jpeg':type.split('/')[1];
 if(signature(buffer)!==expected)throw new ApiError('invalid_image',415);
 try{
  const options={limitInputPixels:16000000,failOn:'error'};
  const meta=await sharp(buffer,options).metadata();
  if(meta.format!==expected||(meta.pages??1)>1||!meta.width||!meta.height)throw Error('unsupported');
  const width=kind==='profile'?512:1280,height=kind==='profile'?512:720;
  // Decode and re-encode every upload: strip EXIF/GPS, scripts, trailing payloads and original metadata.
  let bytes=await sharp(buffer,options).rotate().resize(width,height,{fit:'cover',position:'centre'}).webp({quality:80,effort:4}).toBuffer();
  if(bytes.length>614400)bytes=await sharp(buffer,options).rotate().resize(width,height,{fit:'cover'}).webp({quality:60,effort:4}).toBuffer();
  if(bytes.length>614400)throw Error('output_limit');
  return {buffer:bytes,width,height,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 }catch{throw new ApiError('invalid_image',415);}
}
