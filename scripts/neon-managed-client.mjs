// Browser entry: bundle only the official vanilla managed Auth client.
import {createAuthClient} from '@neondatabase/auth';
import {BetterAuthVanillaAdapter} from '@neondatabase/auth/vanilla';
export function createManagedClient(baseURL) {
 return createAuthClient(baseURL,{adapter:BetterAuthVanillaAdapter({fetchOptions:{credentials:'include'}})});
}
