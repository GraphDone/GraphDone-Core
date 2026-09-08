import {describe,it,expect} from 'vitest';
import {separateCards} from '../separateCards';
describe('saved card placement',()=>{
 const dims=()=>({width:170,height:110});
 it('keeps an already clear user arrangement unchanged',()=>{const nodes=[{id:'a',x:40,y:40},{id:'b',x:400,y:250}];const before=structuredClone(nodes);expect(separateCards(nodes,dims).size).toBe(0);expect(nodes).toEqual(before);});
 it('separates a stack and remains identical on subsequent loads',()=>{const nodes=Array.from({length:100},(_,i)=>({id:String(i),x:400,y:300}));expect(separateCards(nodes,dims).size).toBe(99);for(let i=0;i<nodes.length;i++)for(let j=0;j<i;j++)expect(Math.abs(nodes[i].x-nodes[j].x)>=194||Math.abs(nodes[i].y-nodes[j].y)>=134).toBe(true);const before=structuredClone(nodes);expect(separateCards(nodes.reverse(),dims).size).toBe(0);expect(nodes.reverse()).toEqual(before);});
});
