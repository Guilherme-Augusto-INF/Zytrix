import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,dirname,extname} from 'node:path';
// Resolve within the project through Node. Virtual sources avoid scanning parent
// directories, which may be inaccessible in a restricted Windows workspace.
const scopedSources={name:'project-sources',setup(builder){
 builder.onResolve({filter:/.*/},args=>({path:createRequire(args.importer||resolve('package.json')).resolve(args.path.startsWith('.')?resolve(args.resolveDir||process.cwd(),args.path):args.path),namespace:'project'}));
 builder.onLoad({filter:/.*/,namespace:'project'},async args=>({contents:await readFile(args.path,'utf8'),loader:extname(args.path)==='.json'?'json':'js',resolveDir:dirname(args.path)}));
}};
await build({absWorkingDir:process.cwd(),entryPoints:['./scripts/neon-managed-client.mjs'],outfile:'assets/js/neon-managed-client.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'external',plugins:[scopedSources]});
