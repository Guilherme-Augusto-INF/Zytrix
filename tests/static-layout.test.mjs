import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {renderStaticLayout} from '../scripts/static-layout.mjs';
import {categories} from '../assets/js/categories-data.js';

test('every shared shell has complete navigation and blocking footer CSS in its first HTML, without replacing page content',async()=>{
 for(const file of (await readdir(new URL('..',import.meta.url))).filter(name=>name.endsWith('.html'))){
  const source=await readFile(new URL('../'+file,import.meta.url),'utf8');
  if(!source.includes('data-header'))continue;
  const built=renderStaticLayout(source,file);
  assert.equal((built.match(/<header class="site-header"/g)||[]).length,1,file);
  assert.match(built,/<link rel="stylesheet"[^>]*footer\.css[^>]*>/,file);
  assert.match(built,/<footer class="site-footer site-footer-v2"/,file);
  assert.equal((built.match(/data-platform-nav="explore"/g)||[]).length,1,file);
  assert.equal((built.match(/data-platform-footer="clips"/g)||[]).length,1,file);
  if(!['categorias.html','ao-vivo.html'].includes(file))assert.equal(built.match(/<main\b[\s\S]*?<\/main>/)?.[0],source.match(/<main\b[\s\S]*?<\/main>/)?.[0],file);
  assert.equal(renderStaticLayout(built,file),built,'static rendering is idempotent: '+file);
 }
});
test('discovery controls are present before JS and use the complete category catalog',async()=>{
 const categoriesHtml=renderStaticLayout(await readFile(new URL('../categorias.html',import.meta.url),'utf8'),'categorias.html');
 const grid=categoriesHtml.slice(categoriesHtml.indexOf('id="categories-grid"'),categoriesHtml.indexOf('<section class="section"'));
 assert.equal((grid.match(/class="card category-card"/g)||[]).length,Object.keys(categories).length);
 for(const [name,subs]of Object.entries(categories)){assert.ok(grid.includes(encodeURIComponent(name)),name);assert.ok(grid.includes(subs.length+' subcategorias'));}
 const lives=renderStaticLayout(await readFile(new URL('../ao-vivo.html',import.meta.url),'utf8'),'ao-vivo.html');
 assert.equal((lives.match(/data-filter=/g)||[]).length,9);
 assert.match(lives,/data-filter="todos"/);
 assert.match(lives,/id="lives-grid"><div class="state">Carregando/);
});
