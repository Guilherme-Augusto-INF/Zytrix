import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import { resolveSafePreviewPath } from './staging-static-path.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
if(!process.env.ZYTRIX_STAGING_DATABASE_URL_FILE)throw Error('Private runtime connection file required');
process.env.ZYTRIX_STAGING_DATABASE_URL=(await readFile(process.env.ZYTRIX_STAGING_DATABASE_URL_FILE,'utf8')).trim();
process.env.ZYTRIX_POSTGRES_STAGING='true';
const handlers={'/api/v1/platform':(await import('../api/v1/platform.js')).default,'/api/v1/config':(await import('../api/v1/config.js')).default};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 try{
  if(handlers[pathname]){let size=0,body='';for await(const chunk of req){size+=chunk.length;if(size>16384){res.writeHead(413);res.end();return;}body+=chunk;}
   req.body=body;res.status=function(code){res.statusCode=code;return res;};res.json=function(value){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res;};await handlers[pathname](req,res);return;}
  // Decoding can introduce traversal even when URL.pathname looked safe.
  // Resolve and validate the *decoded* path against an explicit assets-only root.
  const file=resolveSafePreviewPath(root,pathname);
  if(!file||!mime[extname(file)]||!(await stat(file)).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',mime[extname(file)]);res.end(await readFile(file));
 }catch{res.writeHead(503);res.end('Temporarily unavailable');}
}).listen(5502,'127.0.0.1',()=>console.log('Staging validation: http://127.0.0.1:5502'));
