export function createPlatformClient(getUser) {
  return async function platform(action,data={}) {
    const user=getUser();const token=user?await user.getIdToken():null;
    const response=await fetch('/api/v1/platform',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,...(user?.sessionToken?{'X-Neon-Session':user.sessionToken}:{})},body:JSON.stringify({action,data}),credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    const result=await response.json();
    if(getUser()?.uid!==user?.uid)throw Object.assign(new Error('authentication_changed'),{code:'authentication_changed'});
    if(!response.ok){const error=new Error(result.error??'service_unavailable');error.code=result.error;throw error;}
    return result;
  };
}
