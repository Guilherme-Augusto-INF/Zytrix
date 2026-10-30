import {mkdir,copyFile,cp,readdir,rm,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {renderStaticLayout} from './static-layout.mjs';
import {normalizeDocumentNavigation} from './clean-navigation.mjs';
const output=resolve('public');if(dirname(output)!==process.cwd())throw Error('invalid_build_output');await rm(output,{recursive:true,force:true});
await mkdir('public',{recursive:true});
await cp('assets','public/assets',{recursive:true});
const pageFiles=new Set((await readdir('.')).filter(file=>file.endsWith('.html')));
for(const item of await readdir('.',{withFileTypes:true}))if(item.isFile()&&(/\.(html|webmanifest|xml|ico|png|svg)$/.test(item.name)||['robots.txt','llms.txt'].includes(item.name))){
 if(item.name.endsWith('.html'))await writeFile('public/'+item.name,normalizeDocumentNavigation(renderStaticLayout(await readFile(item.name,'utf8'),item.name),pageFiles));
 else await copyFile(item.name,'public/'+item.name);
}
console.log('PASS: only browser assets copied to public deployment');
