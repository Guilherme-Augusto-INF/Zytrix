export function createPlatformClient(getUser) {
  return async function platform(action,data={}) {
    const user=getUser();const token=user?await user.getIdToken():null;
    const response=await fetch('/api/v1/platform',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action,data}),credentials:'same-origin'});
    const result=await response.json();
    if(!response.ok){const error=new Error(result.error??'service_unavailable');error.code=result.error;throw error;}
    return result;
  };
}
