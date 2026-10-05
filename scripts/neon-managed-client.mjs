// Browser entry: bundle only the official vanilla managed Auth client.
import {createAuthClient} from '@neondatabase/auth';
import {BetterAuthVanillaAdapter} from '@neondatabase/auth/vanilla';
export function createManagedClient(baseURL) {
 const sessionTokens=new WeakMap();
 return createAuthClient(baseURL,{adapter:BetterAuthVanillaAdapter({fetchOptions:{credentials:'include',
  async onResponse(ctx){
   if(new URL(ctx.request.url).pathname.endsWith('/get-session')&&ctx.response.ok){
    const value=await ctx.response.clone().json().catch(()=>null);
    if(typeof value?.session?.token==='string')sessionTokens.set(ctx.response,value.session.token);
   }
  },
  onSuccess(ctx){
   // Neon SDK replaces session.token with a JWT for Data API consumers. Our
   // API separately validates that JWT and the original revocable session.
   const token=sessionTokens.get(ctx.response);sessionTokens.delete(ctx.response);
   if(token&&ctx.data?.session)ctx.data.session.token=token;
  }
 }})});
}
