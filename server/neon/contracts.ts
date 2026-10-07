export type NeonIdentity={subject:string;authProvider:'neon';emailVerified:boolean;email:string|null;sessionToken:string;sessionCreatedAt:number};
export type AuthConfig={postgresEnabled:true;authentication:'neon';neonAuthUrl:string};
export type AccountRegistration={username:string;acceptPolicies:true;termsVersion:string;privacyVersion:string;rulesVersion:string};
export function isUuid(value:unknown):value is string{return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);}
