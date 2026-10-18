/** GLTFExporter encodes PNGs asynchronously, so their binary chunks can finish
 * in different orders. Preserve the asset but pack image views in declared
 * image order, giving identical source/specification builds identical bytes. */
export function canonicalizeGLB(input){
  const bytes=new Uint8Array(input),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2)throw new Error('Expected a GLB 2.0 file.');
  let json,bin;
  for(let offset=12;offset<bytes.length;){
    const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true),chunk=bytes.subarray(offset+8,offset+8+length);
    if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(chunk));
    else if(type===0x004e4942)bin=chunk;
    else throw new Error('Unexpected GLB chunk type.');
    offset+=8+length;
  }
  if(!json||!bin||json.buffers?.length!==1)throw new Error('Expected one embedded GLB buffer.');
  const imageViews=[...new Set((json.images??[]).map(image=>image.bufferView).filter(Number.isInteger))];
  const images=new Set(imageViews),views=json.bufferViews??[];
  const order=[...views.map((_,i)=>i).filter(i=>!images.has(i)),...imageViews];
  const remap=new Map(order.map((old,index)=>[old,index])),align=n=>Math.ceil(n/4)*4;
  let length=0;
  const chunks=order.map(index=>{
    const old=views[index];if((old.buffer??0)!==0)throw new Error('External buffers are not supported.');
    const data=bin.subarray(old.byteOffset??0,(old.byteOffset??0)+old.byteLength),offset=length;
    length+=align(data.byteLength);return {data,definition:{...old,byteOffset:offset}};
  });
  json.bufferViews=chunks.map(c=>c.definition);json.buffers[0].byteLength=length;
  const mapView=object=>{if(Number.isInteger(object?.bufferView))object.bufferView=remap.get(object.bufferView);};
  for(const accessor of json.accessors??[]){mapView(accessor);mapView(accessor.sparse?.indices);mapView(accessor.sparse?.values);}
  for(const image of json.images??[])mapView(image);
  const encoded=new TextEncoder().encode(JSON.stringify(json)),jsonLength=align(encoded.length);
  const output=new Uint8Array(12+8+jsonLength+8+length),header=new DataView(output.buffer);
  header.setUint32(0,0x46546c67,true);header.setUint32(4,2,true);header.setUint32(8,output.length,true);
  header.setUint32(12,jsonLength,true);header.setUint32(16,0x4e4f534a,true);output.fill(32,20,20+jsonLength);output.set(encoded,20);
  const binaryStart=20+jsonLength;header.setUint32(binaryStart,length,true);header.setUint32(binaryStart+4,0x004e4942,true);
  for(const c of chunks)output.set(c.data,binaryStart+8+c.definition.byteOffset);
  return output.buffer;
}
