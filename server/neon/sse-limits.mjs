const connections=new Map();
// Per process. The DB pool and server duration independently bound work across requests.
export function acquireRealtime(subject,{now=Date.now(),maximum=32,perUser=3}={}) {
 for(const [key,value] of connections)if(value.expires<=now)connections.delete(key);
 if(connections.size>=maximum||[...connections.values()].filter(x=>x.subject===subject).length>=perUser)return null;
 const key=Symbol();connections.set(key,{subject,expires:now+30000});
 return ()=>connections.delete(key);
}
