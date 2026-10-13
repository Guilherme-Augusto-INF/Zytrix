import {ApiError} from './platform.mjs';

// These match the existing HTTP budgets; enforce them before JSON.parse.
export const PLATFORM_BODY_BYTES=16384;
export const CHECKOUT_BODY_BYTES=4096;
export async function readBoundedBody(req,maxBytes){
 const declared=req.headers['content-length'];
 if(declared!==undefined){
  if(typeof declared!=='string'||!/^\d+$/.test(declared))throw new ApiError('invalid_input');
  if(Number(declared)>maxBytes)throw new ApiError('body_too_large',413);
 }
 const supplied=req.rawBody??req.body;
 if(supplied!==undefined){
  if(!Buffer.isBuffer(supplied)&&typeof supplied!=='string')throw new ApiError('invalid_input');
  if(Buffer.byteLength(supplied)>maxBytes)throw new ApiError('body_too_large',413);
  return Buffer.from(supplied);
 }
 let size=0;const chunks=[];
 for await(const chunk of req){
  const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
  size+=bytes.length;if(size>maxBytes)throw new ApiError('body_too_large',413);
  chunks.push(bytes);
 }
 return Buffer.concat(chunks,size);
}

// Iterative and fail-fast: never recurse or build one error per bad element.
// Current contracts: operations <=30, blockedWords <=40, document paths <=6.
export function assertJsonStructure(root,{maxArray=40,maxDepth=8,maxKeys=64,maxNodes=2048}={}){
 if(!root||typeof root!=='object'||Array.isArray(root))throw new ApiError('invalid_input');
 const pending=[[root,0]];let nodes=0;
 while(pending.length){
  const [value,depth]=pending.pop();
  if(++nodes>maxNodes||depth>maxDepth)throw new ApiError('invalid_input');
  if(value===null||typeof value!=='object')continue;
  if(Array.isArray(value)){
   if(value.length>maxArray)throw new ApiError('invalid_input');
   for(const item of value)pending.push([item,depth+1]);
  }else{
   const keys=Object.keys(value);
   if(keys.length>maxKeys)throw new ApiError('invalid_input');
   for(const key of keys){
    if(['__proto__','constructor','prototype'].includes(key))throw new ApiError('invalid_input');
    pending.push([value[key],depth+1]);
   }
  }
 }
 return root;
}

export async function readJsonBody(req,maxBytes,limits){
 const raw=await readBoundedBody(req,maxBytes);
 let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}
 catch{throw new ApiError('invalid_input');}
 return assertJsonStructure(value,limits);
}
