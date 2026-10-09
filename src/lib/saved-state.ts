export const savedKey="israel-hikes-saved";
export function parseSaved(value:string|null):string[]{try{const v=JSON.parse(value||"[]");return Array.isArray(v)?[...new Set(v.filter((id):id is string=>typeof id==="string"&&id.length>0))]:[]}catch{return []}}
export function toggleSaved(saved:string[],id:string){return saved.includes(id)?saved.filter(x=>x!==id):[...saved,id]}
