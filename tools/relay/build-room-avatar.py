#!/usr/bin/env python3
"""Create an original low-poly, animated GLB. No downloaded geometry or textures."""
import json, struct, math
from pathlib import Path
root=Path(__file__).resolve().parents[2]
blob=bytearray(); views=[]; access=[]
def buffer(values,kind,component,minimum=None,maximum=None):
    while len(blob)%4: blob.append(0)
    start=len(blob);fmt='f' if component==5126 else 'H'
    blob.extend(struct.pack('<'+fmt*len(values),*values));views.append({'buffer':0,'byteOffset':start,'byteLength':len(blob)-start})
    d={'bufferView':len(views)-1,'componentType':component,'count':len(values)//{'SCALAR':1,'VEC3':3,'VEC4':4}[kind],'type':kind}
    if minimum is not None:d['min']=minimum;d['max']=maximum
    access.append(d);return len(access)-1
positions=[];normals=[];indices=[]
for normal,corners in [((0,0,1),[(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]),((0,0,-1),[(1,-1,-1),(-1,-1,-1),(-1,1,-1),(1,1,-1)]),((1,0,0),[(1,-1,1),(1,-1,-1),(1,1,-1),(1,1,1)]),((-1,0,0),[(-1,-1,-1),(-1,-1,1),(-1,1,1),(-1,1,-1)]),((0,1,0),[(-1,1,1),(1,1,1),(1,1,-1),(-1,1,-1)]),((0,-1,0),[(-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1)])]:
    start=len(positions)//3
    for point in corners:positions.extend(v/2 for v in point);normals.extend(normal)
    indices.extend(start+i for i in [0,1,2,0,2,3])
p=buffer(positions,'VEC3',5126,[-.5]*3,[.5]*3);n=buffer(normals,'VEC3',5126);ix=buffer(indices,'SCALAR',5123)
meshes=[{'primitives':[{'attributes':{'POSITION':p,'NORMAL':n},'indices':ix,'material':i}]} for i in range(3)]
nodes=[{'name':'OrvixGuide','children':[1,2,3,5,7,9]}, {'name':'Body','mesh':0,'translation':[0,1.15,0],'scale':[.62,.75,.34]}, {'name':'Head','mesh':1,'translation':[0,1.83,0],'scale':[.49,.48,.44]}, {'name':'LeftArmPivot','translation':[-.43,1.48,0],'children':[4]}, {'name':'LeftArm','mesh':0,'translation':[0,-.24,0],'scale':[.2,.63,.23]}, {'name':'RightArmPivot','translation':[.43,1.48,0],'children':[6]}, {'name':'RightArm','mesh':0,'translation':[0,-.24,0],'scale':[.2,.63,.23]}, {'name':'LeftLegPivot','translation':[-.19,.8,0],'children':[8]}, {'name':'LeftLeg','mesh':2,'translation':[0,-.34,0],'scale':[.23,.68,.26]}, {'name':'RightLegPivot','translation':[.19,.8,0],'children':[10]}, {'name':'RightLeg','mesh':2,'translation':[0,-.34,0],'scale':[.23,.68,.26]}]
animations=[]
for name,duration,amplitude in [('idle',3,.025),('walk',1,.55),('run',.65,.9)]:
    times=[duration*i/4 for i in range(5)];t=buffer(times,'SCALAR',5126,[0],[duration]);samplers=[];channels=[]
    for node,sign in [(3,1),(5,-1),(7,-1),(9,1)]:
        values=[]
        for i in range(5):
            angle=math.sin(i/4*math.tau)*amplitude*sign;values.extend([math.sin(angle/2),0,0,math.cos(angle/2)])
        out=buffer(values,'VEC4',5126);samplers.append({'input':t,'output':out,'interpolation':'LINEAR'});channels.append({'sampler':len(samplers)-1,'target':{'node':node,'path':'rotation'}})
    animations.append({'name':name,'samplers':samplers,'channels':channels})
doc={'asset':{'version':'2.0','generator':'Orvix original avatar builder; AGPL-3.0-or-later'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':nodes,'meshes':meshes,'materials':[{'name':'Suit','pbrMetallicRoughness':{'baseColorFactor':[.56,.38,.98,1],'metallicFactor':.15,'roughnessFactor':.7}}, {'name':'Helmet','pbrMetallicRoughness':{'baseColorFactor':[.77,.82,.88,1],'metallicFactor':.1,'roughnessFactor':.5}}, {'name':'Boots','pbrMetallicRoughness':{'baseColorFactor':[.16,.16,.22,1],'metallicFactor':0,'roughnessFactor':.9}}],'animations':animations,'buffers':[{'byteLength':len(blob)}],'bufferViews':views,'accessors':access}
data=json.dumps(doc,separators=(',',':')).encode()
while len(data)%4:data+=b' '
while len(blob)%4:blob.append(0)
glb=struct.pack('<III',0x46546c67,2,12+8+len(data)+8+len(blob))+struct.pack('<II',len(data),0x4e4f534a)+data+struct.pack('<II',len(blob),0x004e4942)+blob
path=root/'relay_app/src/features/rooms3d/assets/orvix-guide.glb';path.write_bytes(glb);print(f'{path.relative_to(root)}: {len(glb)} bytes, {len(positions)//3} shared vertices, 3 animation clips')
