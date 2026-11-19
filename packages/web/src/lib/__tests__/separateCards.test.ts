import {describe,it,expect} from 'vitest';
import {separateCards} from '../separateCards';
describe('saved card placement',()=>{
 const dims=()=>({width:170,height:110});
 it('keeps an already clear user arrangement unchanged',()=>{const nodes=[{id:'a',x:40,y:40},{id:'b',x:400,y:250}];const before=structuredClone(nodes);expect(separateCards(nodes,dims).size).toBe(0);expect(nodes).toEqual(before);});
 it('separates a stack and remains identical on subsequent loads',()=>{const nodes=Array.from({length:100},(_,i)=>({id:String(i),x:400,y:300}));expect(separateCards(nodes,dims).size).toBe(99);for(let i=0;i<nodes.length;i++)for(let j=0;j<i;j++)expect(Math.abs(nodes[i].x-nodes[j].x)>=194||Math.abs(nodes[i].y-nodes[j].y)>=134).toBe(true);const before=structuredClone(nodes);expect(separateCards(nodes.reverse(),dims).size).toBe(0);expect(nodes.reverse()).toEqual(before);});
});

it('preserves saved spiral placement across cell boundaries and different card dimensions', () => {
  const nodes = [
    { id: 'a', x: -300, y: -220, width: 310, height: 182 },
    { id: 'b', x: -40, y: -130, width: 230, height: 95 },
    { id: 'c', x: -300, y: -220, width: 170, height: 72 },
    { id: 'd', x: 300, y: 20, width: 320, height: 170 },
    { id: 'e', x: 195, y: 90, width: 125, height: 112 },
    { id: 'f', x: -650, y: -220, width: 200, height: 182 },
    { id: 'g', x: -200, y: -150, width: 315, height: 185 },
  ];
  const moved = separateCards(nodes, ({ width, height }) => ({ width, height }));
  expect([...moved]).toEqual(['b', 'c', 'e', 'g']);
  expect(nodes.map(({ x, y }) => [x, y])).toEqual([
    [-300, -220], [214, -249], [-688, -412], [300, 20],
    [46, -46], [-650, -220], [-539, 59],
  ]);
});
