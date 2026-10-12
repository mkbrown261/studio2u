import { ProviderError } from './adapters'
const encoder=new TextEncoder()
async function master(secret?:string){
  try {
    if(!secret)throw new Error()
    const bytes=Uint8Array.from(atob(secret),c=>c.charCodeAt(0))
    if(bytes.length!==32)throw new Error()
    return await crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt'])
  }catch{throw new ProviderError('Provider key storage is not configured',503)}
}
export async function encryptKey(secret:string|undefined,key:string,context:string){
  const imported=await master(secret),iv=crypto.getRandomValues(new Uint8Array(12))
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(context)},imported,encoder.encode(key))
  return JSON.stringify({v:1,iv:btoa(String.fromCharCode(...iv)),data:btoa(String.fromCharCode(...new Uint8Array(ciphertext)))})
}
export async function decryptKey(secret:string|undefined,envelope:string,context:string){
  const imported=await master(secret)
  try{
    const value=JSON.parse(envelope);if(value.v!==1)throw new Error()
    const bytes=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0))
    return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(value.iv),additionalData:encoder.encode(context)},imported,bytes(value.data)))
  }catch{throw new ProviderError('Provider key could not be decrypted',503)}
}
export const keyContext=(user:number,provider:string,config:string)=>`studio2u:llm:v1:${user}:${provider}:${config}`
