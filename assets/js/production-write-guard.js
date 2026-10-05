export function guardProductionWrite(staging,operation){
 return async(...args)=>{if(await staging()){const error=new Error('legacy_write_disabled_in_staging');error.code='legacy_write_disabled_in_staging';throw error;}return operation(...args);};
}
