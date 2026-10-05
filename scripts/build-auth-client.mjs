import {build} from 'esbuild';
await build({entryPoints:['scripts/neon-managed-client.mjs'],outfile:'assets/js/neon-managed-client.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'external'});
