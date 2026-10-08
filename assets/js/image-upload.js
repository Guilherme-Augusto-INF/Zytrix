import {auth} from './client.js';
import {escapeAttr} from './ui.js';
import {safeImageUrl} from './security.js';
import {validImageFile,MAX_IMAGE_BYTES} from './image-policy.js';
const errors={authentication_required:'Sua sessão expirou. Entre novamente.',verified_email_required:'Verifique seu e-mail para enviar imagens.',forbidden:'Você só pode alterar imagens da sua própria conta ou live.',image_too_large:'A imagem deve ter no máximo 3 MB.',invalid_image:'Arquivo inválido. Use JPEG, PNG ou WebP estático, até 3 MB e 16 megapixels.',image_rate_limited:'Limite de 10 envios por hora atingido. Aguarde antes de tentar novamente.',image_storage_unavailable:'Não foi possível enviar a imagem. Sua imagem anterior foi preservada.',image_upload_expired:'O envio expirou. Selecione a imagem e tente novamente.'};
export function imageUploadMarkup({id,kind,url=''}) {
 const photo=kind==='profile',safe=safeImageUrl(url);
 return `<section id="${id}" class="image-upload ${photo?'image-upload-photo':'image-upload-thumb'}" aria-label="${photo?'Foto de perfil':'Thumbnail da live'}">
 <strong>${photo?'Foto de perfil':'Thumbnail da live'}</strong>
 <div class="image-upload-frame"><span class="image-empty" ${safe?'hidden':''}>${photo?'Sem foto':'Sem thumbnail'}</span><img ${safe?`src="${escapeAttr(safe)}"`:''} ${safe?'':'hidden'} width="${photo?512:1280}" height="${photo?512:720}" alt="${photo?'Foto atual':'Thumbnail atual'}"><canvas width="${photo?512:1280}" height="${photo?512:720}" hidden aria-label="Prévia da imagem selecionada"></canvas></div>
 <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" hidden>
 <div class="image-crop" hidden><label>Zoom <input data-crop="zoom" type="range" min="1" max="3" step="0.05" value="1"></label><label>Posição horizontal <input data-crop="x" type="range" min="0" max="100" value="50"></label><label>Posição vertical <input data-crop="y" type="range" min="0" max="100" value="50"></label></div>
 <p class="muted">Imagens públicas. JPEG, PNG ou WebP · até 3 MB. Confira a prévia antes de confirmar${photo?' e ajuste o recorte':''}.</p>
 <div class="image-actions"><button type="button" class="btn" data-choose>${safe?'Alterar foto':'Enviar foto'}</button><button type="button" class="btn btn-primary" data-upload hidden>Confirmar envio</button><button type="button" class="btn" data-cancel hidden>Cancelar</button><button type="button" class="btn btn-danger" data-remove ${safe?'':'hidden'}>Remover foto</button></div>
 <progress max="100" value="0" hidden aria-label="Progresso do envio"></progress><p class="image-status" role="status" aria-live="polite"></p></section>`;
}
export function mountImageUpload({id,kind,liveId=null,url='',onSaved=()=>{}}){
 const root=document.getElementById(id);if(!root)return ()=>{};
 const input=root.querySelector('input[type=file]'),canvas=root.querySelector('canvas'),img=root.querySelector('img'),empty=root.querySelector('.image-empty'),crop=root.querySelector('.image-crop'),status=root.querySelector('.image-status'),progress=root.querySelector('progress');
 const choose=root.querySelector('[data-choose]'),send=root.querySelector('[data-upload]'),cancel=root.querySelector('[data-cancel]'),remove=root.querySelector('[data-remove]');
 let bitmap=null,current=safeImageUrl(url),busy=false,version=0;
 function display(){img.hidden=!current;if(current)img.src=current;else img.removeAttribute('src');empty.hidden=!!current;canvas.hidden=true;crop.hidden=true;send.hidden=cancel.hidden=true;remove.hidden=!current;choose.textContent=current?'Alterar foto':'Enviar foto';}
 function reset(){version++;bitmap?.close();bitmap=null;input.value='';display();}
 function draw(){
  if(!bitmap)return;
  const aspect=canvas.width/canvas.height,zoom=Number(root.querySelector('[data-crop=zoom]').value);
  let w=bitmap.width,h=w/aspect;if(h>bitmap.height){h=bitmap.height;w=h*aspect;}w/=zoom;h/=zoom;
  const x=(bitmap.width-w)*Number(root.querySelector('[data-crop=x]').value)/100,y=(bitmap.height-h)*Number(root.querySelector('[data-crop=y]').value)/100;
  canvas.getContext('2d').drawImage(bitmap,x,y,w,h,0,0,canvas.width,canvas.height);
 }
 choose.onclick=()=>input.click();cancel.onclick=()=>{reset();status.textContent='Seleção cancelada.';};
 img.onerror=()=>{img.hidden=true;empty.hidden=false;};
 input.onchange=async()=>{
  const file=input.files[0];if(!file)return;reset();const ticket=version;
  if(!validImageFile(file.name,file.type,file.size)){status.textContent='Selecione JPEG, PNG ou WebP de até 3 MB.';input.value='';return;}
  try{
   const next=await createImageBitmap(file);if(ticket!==version){next.close();return;}
   if(next.width*next.height>16000000){next.close();throw Error('pixels');}
   bitmap?.close();bitmap=next;for(const range of crop.querySelectorAll('input'))range.value=range.dataset.crop==='zoom'?'1':'50';
   draw();img.hidden=empty.hidden=true;canvas.hidden=false;crop.hidden=kind!=='profile';send.hidden=cancel.hidden=false;remove.hidden=true;status.textContent='Prévia pronta. Confirme o envio para salvar.';
  }catch{status.textContent=errors.invalid_image;input.value='';}
 };
 crop.oninput=draw;
 async function request(method,file){
  const user=auth.currentUser;if(!user)throw Object.assign(Error(),{code:'authentication_required'});
  const token=await user.getIdToken();if(auth.currentUser?.uid!==user.uid)throw Object.assign(Error(),{code:'authentication_required'});
  const query=new URLSearchParams({kind,...(liveId?{liveId}:{})});
  return new Promise((resolve,reject)=>{
   const xhr=new XMLHttpRequest();xhr.open(method,'/api/v1/images?'+query);xhr.timeout=60000;
   xhr.setRequestHeader('Authorization','Bearer '+token);xhr.setRequestHeader('X-Neon-Session',user.sessionToken);
   if(file){xhr.setRequestHeader('Content-Type','image/webp');xhr.setRequestHeader('X-Image-Name','image.webp');}
   xhr.upload.onprogress=e=>{if(e.lengthComputable)progress.value=Math.min(95,Math.round(e.loaded/e.total*95));};
   xhr.onerror=xhr.ontimeout=()=>reject(Object.assign(Error(),{code:'image_storage_unavailable'}));
   xhr.onload=()=>{let result;try{result=JSON.parse(xhr.responseText);}catch{return reject(Object.assign(Error(),{code:'image_storage_unavailable'}));}
    if(auth.currentUser?.uid!==user.uid)return reject(Object.assign(Error(),{code:'authentication_required'}));
    if(xhr.status<200||xhr.status>=300)return reject(Object.assign(Error(),{code:result.error}));resolve(result);};xhr.send(file??null);
  });
 }
 async function submit(deleting){
  if(busy||(!deleting&&!bitmap))return;busy=true;for(const b of root.querySelectorAll('button,input'))b.disabled=true;
  progress.hidden=false;progress.value=0;status.textContent=deleting?'Removendo imagem...':'Otimizando e enviando imagem...';
  try{
   const file=deleting?null:await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.85));if(!deleting&&(!file||file.size>MAX_IMAGE_BYTES))throw Object.assign(Error(),{code:'invalid_image'});
   const result=await request(deleting?'DELETE':'POST',file);current=safeImageUrl(result.url);progress.value=100;reset();onSaved(current);
   status.textContent=deleting?'Imagem removida.':'Imagem salva com sucesso.';
  }catch(e){status.textContent=errors[e.code]??'Não foi possível salvar. Tente novamente.';}finally{busy=false;progress.hidden=true;for(const b of root.querySelectorAll('button,input'))b.disabled=false;}
 }
 send.onclick=()=>submit(false);remove.onclick=()=>submit(true);display();
 return ()=>{version++;bitmap?.close();};
}
