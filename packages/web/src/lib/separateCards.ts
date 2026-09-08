/** Repair intersecting card rectangles once, before painting a saved layout.
 * Non-overlapping cards keep their exact coordinates. This is placement, not
 * a continuously running force: settled cards cannot shake against pins.
 */
export function separateCards<T extends {id:string;x?:number;y?:number}>(nodes:T[], dimensions:(node:T)=>{width:number;height:number}, gap=24):Set<string> {
 const occupied:Array<{x:number;y:number;width:number;height:number}>=[];
 const moved=new Set<string>();
 // Stable ordering makes a repair identical across refreshes and API ordering.
 for(const node of [...nodes].sort((a,b)=>a.id.localeCompare(b.id))){
  const size=dimensions(node);const originalX=node.x??0,originalY=node.y??0;
  const free=(x:number,y:number)=>!occupied.some(other=>Math.abs(x-other.x)<(size.width+other.width)/2+gap&&Math.abs(y-other.y)<(size.height+other.height)/2+gap);
  let x=originalX,y=originalY;
  if(!free(x,y)){
   // A square spiral searches nearby space without moving already clear cards.
   const stepX=size.width+gap,stepY=size.height+gap;
   search:for(let ring=1;ring<=nodes.length;ring++){
    for(let dy=-ring;dy<=ring;dy++)for(let dx=-ring;dx<=ring;dx++){
     if(Math.abs(dx)!==ring&&Math.abs(dy)!==ring)continue;
     const candidateX=originalX+dx*stepX,candidateY=originalY+dy*stepY;
     if(free(candidateX,candidateY)){x=candidateX;y=candidateY;break search;}
    }
   }
   node.x=x;node.y=y;moved.add(node.id);
  }
  occupied.push({x,y,...size});
 }
 return moved;
}
