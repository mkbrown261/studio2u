import assert from 'node:assert/strict'
import {deflateSync} from 'node:zlib'
import {inspectAudio,inspectArtwork,checksum} from '../src/label-world/reviewer/inspect.ts'
const wav=Buffer.alloc(44+48000*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(48000,24);wav.writeUInt32LE(96000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40)
assert.equal(inspectAudio(wav).status,'PASS');assert.equal(inspectAudio(wav).evidence.durationSeconds,1);assert.equal(inspectAudio(wav.subarray(0,50)).status,'FAIL');assert.equal(inspectAudio(Buffer.from('fake.wav')).status,'FAIL')
function chunk(type,data){const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);let crc=0xffffffff;for(const x of b.subarray(4,-4)){crc^=x;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}b.writeUInt32BE((crc^0xffffffff)>>>0,b.length-4);return b}
function png(size){const h=Buffer.alloc(13);h.writeUInt32BE(size);h.writeUInt32BE(size,4);h[8]=8;h[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(Buffer.alloc((size*3+1)*size))),chunk('IEND',Buffer.alloc(0))])}
assert.equal(inspectArtwork(png(3000)).status,'PASS');assert.equal(inspectArtwork(png(64)).status,'FAIL');const broken=png(3000);broken[40]^=1;assert.equal(inspectArtwork(broken).status,'FAIL');assert.equal((await checksum(wav)).length,64)
console.log('PASS: actual generated PCM WAV and PNG bytes; truncated WAV, undersized artwork and corrupted PNG rejected; checksums generated. No storage/task integration claimed.')
export {wav,png}
