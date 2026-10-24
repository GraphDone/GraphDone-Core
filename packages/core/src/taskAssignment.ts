/** Display assignment is task data, never an authorization grant. */
export function taskAssignee(metadata:unknown):{id:string;name:string;username:string;type:string}|null {
 try {const value=typeof metadata==='string'?JSON.parse(metadata):metadata;const a=(value as any)?.assignee;
  return a&&typeof a.id==='string'&&a.id.length<=128&&typeof a.name==='string'&&a.name.length<=200?{id:a.id,name:a.name,username:a.name,type:'USER'}:null;
 }catch{return null;}
}
