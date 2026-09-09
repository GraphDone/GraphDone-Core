import {useEffect,useState} from 'react';
export const COMPACT_WORKSPACE_QUERY='(max-width: 767px), (max-height: 500px) and (max-width: 1023px)';
export function useCompactWorkspace(){
 const [compact,setCompact]=useState(()=>matchMedia(COMPACT_WORKSPACE_QUERY).matches);
 useEffect(()=>{const media=matchMedia(COMPACT_WORKSPACE_QUERY),update=()=>setCompact(media.matches);media.addEventListener('change',update);update();return()=>media.removeEventListener('change',update);},[]);
 return compact;
}
