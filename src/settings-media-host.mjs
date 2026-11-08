/** Own local media store, exposed through the public DSH webServer contract. */
import {mkdir,writeFile,readFile,stat,readdir,lstat} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {Readable} from 'node:stream'
import {skinMedia} from './settings-skin-assets.mjs'
const maxFile=100*1024*1024,maxTotal=2*1024*1024*1024,route='/dsh-web-gui/media'
const formats={mp4:'video/mp4',gif:'image/gif',webp:'image/webp'}
const mediaFile=/^[a-f\d]{64}\.(mp4|gif|webp)$/
function webpAnimation(bytes){
 if(bytes.length<30||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'||bytes.readUInt32LE(4)+8!==bytes.length)
  throw Error('文件内容与 WebP 格式不符')
 let offset=12,duration=0,frames=0,animationHeader=false,loopOffset
 while(offset+8<=bytes.length){
  const type=bytes.toString('ascii',offset,offset+4),length=bytes.readUInt32LE(offset+4),start=offset+8
  offset=start+length+(length%2)
  if(offset>bytes.length)throw Error('WebP 文件不完整')
  if(type==='VP8X'){
   if(length!==10||(bytes.readUIntLE(start+4,3)+1)*(bytes.readUIntLE(start+7,3)+1)>16000000)throw Error('WebP 尺寸过大或无效')
   animationHeader=!!(bytes[start]&2)
  }
  if(type==='ANMF'){
   if(length<=16)throw Error('WebP 动画帧不完整')
   duration+=Math.max(10,bytes.readUIntLE(start+12,3))
   frames++
  }
  if(type==='ANIM'&&length===6)loopOffset=start+4
 }
 if(offset!==bytes.length||!animationHeader||!loopOffset||!frames)throw Error('请选择有效的动态 WebP')
 if(duration>60000)throw Error('请选择 60 秒以内的动态 WebP')
 return {duration,loopOffset}
}
function gifAnimation(bytes){
 const fail=()=>{throw Error('请选择有效的动态 GIF')}
 if(bytes.length<14||!['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6)))fail()
 const tableSize=flags=>flags&128?3*(2**((flags&7)+1)):0
 const headerEnd=13+tableSize(bytes[10])
 let offset=headerEnd,frames=0,duration=0,delay=100,loopOffset
 const skipBlocks=()=>{
  while(offset<bytes.length){
   const length=bytes[offset++]
   if(!length)return
   offset+=length
  }
  fail()
 }
 while(offset<bytes.length){
  const type=bytes[offset++]
  if(type===0x3b)return {frames,duration,loopOffset,headerEnd}
  if(type===0x21){
   const label=bytes[offset++]
   if(label===0xf9&&bytes[offset]===4&&offset+5<bytes.length)
    delay=Math.max(20,bytes.readUInt16LE(offset+2)*10)
   if(label===0xff&&bytes[offset]===11&&offset+16<bytes.length&&
    ['NETSCAPE2.0','ANIMEXTS1.0'].includes(bytes.toString('ascii',offset+1,offset+12))&&bytes[offset+12]===3&&bytes[offset+13]===1)
    loopOffset=offset+14
   skipBlocks()
  }else if(type===0x2c&&offset+9<bytes.length){
   offset+=9+tableSize(bytes[offset+8])+1
   skipBlocks()
   frames++
   duration+=delay
   delay=100
  }else fail()
 }
 fail()
}
function idleBytes(bytes,extension){
 if(extension==='webp'){
  bytes.writeUInt16LE(0,webpAnimation(bytes).loopOffset)
  return bytes
 }
 const {loopOffset,headerEnd}=gifAnimation(bytes)
 if(loopOffset!==undefined){
  bytes.writeUInt16LE(0,loopOffset)
  return bytes
 }
 bytes.write('GIF89a',0,'ascii')
 const loop=Buffer.from('21ff0b4e45545343415045322e300301000000','hex')
 return Buffer.concat([bytes.subarray(0,headerEnd),loop,bytes.subarray(headerEnd)])
}
export function createMediaHandler(root,origin){
 let uploading=false
 const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))}
 const checkedRoot=async()=>{await mkdir(root,{recursive:true});if((await lstat(root)).isSymbolicLink())throw Error('素材目录不可使用链接')}
 return async(req,res)=>{
  const remote=req.socket?.remoteAddress,source=req.headers.origin
  if(remote&&!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)||source&&source!=='dsh-app://app'&&source!==origin||req.headers['sec-fetch-site']==='cross-site'){json(res,403,{error:'仅允许本机客户端访问素材'});return}
  try{
   const url=new URL(req.url,'http://localhost'),path=url.pathname
   if(req.method==='POST'&&path===route){
    if(uploading){json(res,409,{error:'另一个素材正在导入，请稍后重试'});return}
    const extension=Object.keys(formats).find(key=>formats[key]===req.headers['content-type']),limit=extension==='gif'?20*1024*1024:maxFile
    if(!extension||Number(req.headers['content-length'])>limit){json(res,400,{error:'请选择 100 MB 以内的 MP4 / WebP，或 20 MB 以内的 GIF'});return}
    uploading=true
    try{const chunks=[];let size=0;for await(const part of req){const bytes=Buffer.isBuffer(part)?part:Buffer.from(part);size+=bytes.length;if(size>limit)throw Error('素材文件超过大小限制');chunks.push(bytes)}const bytes=Buffer.concat(chunks,size)
     let durationMs=extension==='webp'?webpAnimation(bytes).duration:undefined
     if(extension==='mp4'&&(bytes.length<16||bytes.toString('ascii',4,8)!=='ftyp'))throw Error('文件内容与 MP4 格式不符')
     if(extension==='gif'&&(bytes.length<10||!['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6))||!bytes.readUInt16LE(6)||!bytes.readUInt16LE(8)||bytes.readUInt16LE(6)*bytes.readUInt16LE(8)>16000000))throw Error('文件内容与 GIF 格式不符或尺寸过大')
     if(extension==='gif'&&url.searchParams.has('pet-action')){
      const {frames,duration}=gifAnimation(bytes)
      if(frames<2)throw Error('请选择至少两帧的动态 GIF')
      if(duration>60000)throw Error('请选择 60 秒以内的动态 GIF')
      durationMs=duration
     }
     await checkedRoot();const id=createHash('sha256').update(bytes).digest('hex')+'.'+extension,file=join(root,id)
     const files=(await readdir(root)).filter(name=>mediaFile.test(name));let total=0;for(const name of files){const info=await lstat(join(root,name));if(!info.isFile())throw Error('素材目录含无效文件');total+=info.size}if(!files.includes(id)&&total+bytes.length>maxTotal)throw Error('本机素材已达到 2 GB，请先在素材目录整理文件')
     try{await writeFile(file,bytes,{flag:'wx'})}catch(error){if(error.code!=='EEXIST')throw error}
     json(res,200,{ok:true,url:route+'/'+id,bytes:bytes.length,durationMs})
    }finally{uploading=false}return
   }
   const id=path.slice(route.length+1)
   if(!['GET','HEAD'].includes(req.method)||!path.startsWith(route+'/')||!mediaFile.test(id)){json(res,404,{error:'素材不存在'});return}
   const file=join(root,id),info=await lstat(file);if(!info.isFile()||info.isSymbolicLink())throw Error('素材文件无效')
   const extension=id.split('.').at(-1)
   const idle=url.searchParams.has('pet-idle')&&extension!=='mp4'&&info.size<=maxFile
    ?idleBytes(await readFile(file),extension):null
   const size=idle?.length??info.size
   let start=0,end=size-1,status=200
   if(req.headers.range){const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!match||!match[1]&&!match[2]){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return}if(!match[1])start=Math.max(0,size-Number(match[2]));else{start=Number(match[1]);end=match[2]?Math.min(end,Number(match[2])):end}if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return}status=206}
   const headers={'Content-Type':formats[extension],'Accept-Ranges':'bytes','Content-Length':end-start+1,'Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff'};if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${size}`;res.writeHead(status,headers)
   if(req.method==='HEAD'){res.end();return}
   const {createReadStream}=await import('node:fs')
   const stream=idle?Readable.from((function*(){
    for(let cursor=start;cursor<=end;cursor+=65536)yield idle.subarray(cursor,Math.min(cursor+65536,end+1))
   })()):createReadStream(file,{start,end})
   stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res)
  }catch(error){if(!res.headersSent)json(res,error.code==='ENOENT'?404:400,{error:error.code==='ENOENT'?'素材不存在':error.message});else res.destroy()}
 }
}
export function applyMedia(ctx){
 const home=process.env.DSH_HOME;if(!home)return
 const handler=createMediaHandler(resolve(home,'DSHWebGui','ui','media'),ctx.webServer.getOrigin())
 ctx.effect(()=>ctx.webServer.register({kind:'prefix',path:route,handler}),'DSH Web GUI：本机媒体素材接口')
 ctx.effect(()=>ctx.webServer.register({kind:'prefix',path:'/dsh-web-gui/skins',handler:async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname,row=skinMedia.find(row=>row.src===path||row.preview===path);if(!row||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end();return}try{const file=join(import.meta.dirname,'assets/skins',path.split('/').at(-1)),bytes=await readFile(file);res.writeHead(200,{'Content-Type':path.endsWith('.png')?'image/png':path.endsWith('.webp')?'image/webp':'image/jpeg','Cache-Control':'private,max-age=86400','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes)}catch{res.writeHead(404);res.end()}}}),'DSH Web GUI：内置皮肤资源')
}
