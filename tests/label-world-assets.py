import json,struct,pathlib,math
root=pathlib.Path('public/label-world/assets')
for name in ['studio','lobby','conference','carla','eric','executive']:
 data=(root/(name+'.glb')).read_bytes();magic,version,length=struct.unpack_from('<4sII',data)
 assert magic==b'glTF' and version==2 and length==len(data)
 assert len(data)<25*1024*1024
 size,kind=struct.unpack_from('<I4s',data,12);doc=json.loads(data[20:20+size]);binary_offset=20+size+8
 assert len(doc.get('meshes',[]))>0
 assert all(not im.get('uri') for im in doc.get('images',[])),'texture path not embedded'
 assert not any(n.get('name')=='Icosphere' for n in doc.get('nodes',[])),'bone display helper exported'
 for mesh in doc.get('meshes',[]):
  for prim in mesh['primitives']:assert 'POSITION' in prim['attributes'] and 'NORMAL' in prim['attributes']
 if name in ['carla','eric','executive']:
  assert len(doc.get('skins',[]))==1 and len(doc['skins'][0]['joints'])=={'executive':66}.get(name,89)
  assert len(doc.get('animations',[]))==1
  checked=0
  for ch in doc['animations'][0]['channels']:
   node=doc['nodes'][ch['target']['node']];n=node.get('name','').lower()
   if ch['target']['path']!='rotation' or not any(k in n for k in ['hand','wrist']):continue
   sampler=doc['animations'][0]['samplers'][ch['sampler']];acc=doc['accessors'][sampler['output']];view=doc['bufferViews'][acc['bufferView']]
   offset=binary_offset+view.get('byteOffset',0)+acc.get('byteOffset',0);stride=view.get('byteStride',16)
   qs=[struct.unpack_from('<ffff',data,offset+i*stride) for i in range(acc['count'])]
   for a,b in zip(qs,qs[1:]):
    dot=min(1,abs(sum(x*y for x,y in zip(a,b))));angle=2*math.acos(dot)
    assert angle<math.radians(45),'spinning hand or discontinuous wrist'
   checked+=1
  assert checked>0
  if name=='executive':
   anim=doc['animations'][0];assert anim['name']=='Animation';assert len(data)<6*1024*1024,'executive too heavy for web'
   faces=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'] if 'indices' in p);assert faces<40000,faces
  if name=='eric':assert any('tablet' in n.get('name','').lower() for n in doc['nodes'])
 print('PASS',name,'embedded GLB',len(data),'bytes',len(doc.get('meshes',[])),'mesh groups',len(doc.get('animations',[])),'clips')
print('PASS: exported rigs, embedded textures/normals, sampled wrist continuity and Pages asset limits. Visual animation quality remains a browser check.')
