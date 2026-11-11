export type Finding={check:string;status:'PASS'|'FAIL'|'WARNING'|'NEEDS_HUMAN_REVIEW'|'NOT_TESTED';detail:string;evidence?:Record<string,unknown>}
export async function checksum(bytes:Uint8Array){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')}
export function inspectAudio(bytes:Uint8Array):Finding{
 const fail=(detail:string):Finding=>({check:'audio.technical',status:'FAIL',detail})
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),text=(a:number,n:number)=>String.fromCharCode(...bytes.subarray(a,a+n))
 if(bytes.length<44||text(0,4)!=='RIFF'||text(8,4)!=='WAVE')return fail('Supported initial format is uncompressed PCM WAV; RIFF/WAVE header missing.')
 if(v.getUint32(4,true)+8!==bytes.length)return fail('RIFF size does not match stored bytes.')
 let format:any=null,data=0,dataSeen=false
 for(let p=12;p+8<=bytes.length;){const id=text(p,4),size=v.getUint32(p+4,true);if(p+8+size>bytes.length)return fail('Truncated WAV chunk.');if(id==='fmt '){if(size<16)return fail('Invalid format chunk.');format={encoding:v.getUint16(p+8,true),channels:v.getUint16(p+10,true),sampleRate:v.getUint32(p+12,true),byteRate:v.getUint32(p+16,true),blockAlign:v.getUint16(p+20,true),bits:v.getUint16(p+22,true)}}if(id==='data'){data+=size;dataSeen=true}p+=8+size+(size%2)}
 if(!format||!dataSeen||!data)return fail('Missing format or nonempty audio data.')
 const f=format
 if(f.encoding!==1||![1,2].includes(f.channels)||![44100,48000,88200,96000].includes(f.sampleRate)||![16,24].includes(f.bits))return fail('Initial support: PCM WAV, mono/stereo, 44.1/48/88.2/96 kHz, 16/24 bit.')
 if(f.blockAlign!==f.channels*f.bits/8||f.byteRate!==f.sampleRate*f.blockAlign||data%f.blockAlign)return fail('WAV sample alignment or byte rate is inconsistent.')
 return {check:'audio.technical',status:'PASS',detail:'Stored PCM WAV structure and supported properties verified; no loudness, clipping, or musical-quality analysis performed.',evidence:{...f,durationSeconds:data/f.byteRate,audioBytes:data}}
}
export function inspectArtwork(bytes:Uint8Array):Finding{
 const fail=(detail:string):Finding=>({check:'artwork.technical',status:'FAIL',detail})
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
 if(bytes.length<45||[137,80,78,71,13,10,26,10].some((b,i)=>bytes[i]!==b))return fail('Initial artwork support is PNG; signature missing.')
 let width=0,height=0,ended=false,data=false
 for(let p=8;p+12<=bytes.length;){const size=v.getUint32(p),end=p+12+size;if(end>bytes.length)return fail('Truncated PNG chunk.');const type=String.fromCharCode(...bytes.subarray(p+4,p+8));let crc=0xffffffff;for(let i=p+4;i<p+8+size;i++){crc^=bytes[i];for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}if(((crc^0xffffffff)>>>0)!==v.getUint32(p+8+size))return fail('PNG checksum failed.');if(p===8&&type!=='IHDR')return fail('PNG header must be first.');if(type==='IHDR'){if(size!==13)return fail('Invalid PNG header.');width=v.getUint32(p+8);height=v.getUint32(p+12);if(bytes[p+16]!==8||![2,6].includes(bytes[p+17])||bytes[p+18]||bytes[p+19]||bytes[p+20])return fail('Initial support: noninterlaced 8-bit RGB/RGBA PNG.')}if(type==='IDAT')data=true;if(type==='IEND'){ended=size===0&&end===bytes.length;break}p=end}
 if(!ended||!data||!width||!height)return fail('PNG image data or complete end chunk missing.')
 if(width!==height||width<3000||width>6000)return {check:'artwork.technical',status:'FAIL',detail:'Preparation profile requires square artwork from 3000 to 6000 pixels; distributor acceptance is not asserted.',evidence:{width,height,format:'PNG'}}
 return {check:'artwork.technical',status:'PASS',detail:'PNG signature, chunk checksums and supported dimensions verified; visual-content review remains human review.',evidence:{width,height,format:'PNG'}}
}
// Decode compressed scanlines as a bounded stream; a valid container alone is not a valid image.
export async function inspectStoredArtwork(bytes:Uint8Array):Promise<Finding>{
 const result=inspectArtwork(bytes);if(result.status!=='PASS')return result
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),chunks:Uint8Array[]=[];for(let p=8;p+12<=bytes.length;){const size=v.getUint32(p),type=String.fromCharCode(...bytes.subarray(p+4,p+8));if(type==='IDAT')chunks.push(bytes.slice(p+8,p+8+size));p+=size+12}
 const width=Number(result.evidence!.width),height=Number(result.evidence!.height),row=1+width*(bytes[25]===6?4:3),expected=row*height
 try{const input=new Blob(chunks).stream().pipeThrough(new DecompressionStream('deflate')).getReader();let count=0;while(true){const {done,value}=await input.read();if(done)break;if(count+value.length>expected){await input.cancel();throw new Error('Oversized decoded image')}for(let i=(row-count%row)%row;i<value.length;i+=row)if(value[i]>4)throw new Error('Invalid scanline filter');count+=value.length}if(count!==expected)throw new Error('Wrong decoded byte count');return {...result,detail:'PNG checksums, dimensions and decoded scanline structure verified; visual-content review remains human review.',evidence:{...result.evidence,decodedBytes:count}}}catch{return {check:'artwork.technical',status:'FAIL',detail:'Compressed PNG image data could not be validated.'}}
}
