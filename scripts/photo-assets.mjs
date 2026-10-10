// Offline, hash-verified decoding of checked-in licensed photo bytes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export function decodePhoto(encoded,expected) {
 const text=encoded.replace(/\s/g,'');
 if (!text || text.length>2000000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw Error('Invalid photo encoding');
 const bytes=Buffer.from(text,'base64');
 if (bytes.toString('base64')!==text || bytes.length!==expected.size || createHash('sha256').update(bytes).digest('hex')!==expected.sha256) throw Error('Photo integrity failed');
 if(bytes.subarray(0,4).toString()!=='RIFF'||bytes.subarray(8,12).toString()!=='WEBP')throw Error('Photo must be WebP');
 return bytes;
}
export function preparePhotos(root='public') {
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'photos/encoded-assets.json'),'utf8'));
 for(const asset of manifest){
  if(!/^photos\/[a-z0-9-]+\/(hero|thumb|[0-9]{2})\.webp$/.test(asset.path))throw Error('Invalid photo path');
  const target=path.join(root,asset.path);
  fs.writeFileSync(target,decodePhoto(fs.readFileSync(target+'.base64','utf8'),asset));
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)preparePhotos();
