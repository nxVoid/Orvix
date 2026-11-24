"""Read-only audit of first-party workspace package and source module paths."""
import json,pathlib,re,sys
root=pathlib.Path(__file__).resolve().parents[2]
errors=[];count=0
skip={'.orvix-migration','.fluxer','artifacts','node_modules','target','dist','_build','.git','.orvix','.cache','coverage'}
import os
for base,ds,fs in os.walk(root):
 ds[:]=[d for d in ds if d not in skip and not pathlib.Path(base,d).is_symlink()]
 for name in fs:
  p=pathlib.Path(base,name)
  if p.suffix not in {'.ts','.tsx','.mjs','.cjs','.json','.toml','.erl','.hrl'}:continue
  if p.is_symlink():continue
  if p.suffix=='.json':
   if name=='package.json':
    obj=json.loads(p.read_text())
    for section in ['dependencies','devDependencies','optionalDependencies']:
     for key,value in obj.get(section,{}).items():
      if key.startswith('@relay/') and value=='workspace:*' and not (root/'packages'/key.split('/')[1]/'package.json').exists():errors.append(f'{p.relative_to(root)}: missing {key}')
   continue
  try:s=p.read_text()
  except UnicodeError:continue
  for module in re.findall(r'''(?:from\s*|import\s*|require\(\s*)['"]([^'"\n]+)['"]''',s):
   target=None
   if module.startswith('@relay/'):
    part=module.split('/'); target=root/'packages'/part[1]
    manifest=target/'package.json'
    exported=json.loads(manifest.read_text()).get('exports',{}).get('./'+'/'.join(part[2:])) if manifest.exists() else None
    if isinstance(exported,str):target=target/exported;part=part[:2]
    if len(part)>2:target=target.joinpath(*part[2:])
    else:continue
   elif module.startswith(('./','../')):target=p.parent/module
   elif module.startswith('@app/') and 'relay_app' in p.parts:target=root/'relay_app/src'/module[5:]
   elif module.startswith('@electron/') and 'relay_desktop' in p.parts:target=root/'relay_desktop/src'/module[10:]
   if target is None:continue
   target=pathlib.Path(str(target).split('?')[0]);count+=1
   if any(x in target.parts for x in ['dist','.orvix-migration','.fluxer','artifacts','node_modules','target']):continue
   if not any(q.exists() for q in [target,*[pathlib.Path(str(target)+ext) for ext in ['.ts','.tsx','.js','.mjs','.cjs','.json','.d.ts']],target/'index.ts',target/'index.tsx']):
    # Bundlers resolve .js module specifiers to TypeScript sources.
    if target.suffix in {'.js','.jsx'} and any(target.with_suffix(ext).exists() for ext in ['.ts','.tsx']):continue
    errors.append(f'{p.relative_to(root)}: {module}')
import tomllib
manifest_count=0
for base,ds,fs in os.walk(root):
 ds[:]=[d for d in ds if d not in skip and not pathlib.Path(base,d).is_symlink()]
 if 'Cargo.toml' in fs:
  p=pathlib.Path(base,'Cargo.toml');obj=tomllib.loads(p.read_text());manifest_count+=1
  for member in obj.get('workspace',{}).get('members',[]):
   if not (p.parent/member/'Cargo.toml').exists():errors.append(f'{p.relative_to(root)}: missing member {member}')
  for section in ['dependencies','dev-dependencies','build-dependencies']:
   for name,spec in obj.get(section,{}).items():
    if isinstance(spec,dict) and 'path' in spec:
     dep=p.parent/spec['path']/'Cargo.toml'
     if not dep.exists():errors.append(f'{p.relative_to(root)}: missing dependency {name}')
     elif tomllib.loads(dep.read_text()).get('package',{}).get('name') != spec.get('package',name):errors.append(f'{p.relative_to(root)}: dependency name mismatch {name}')
 for name in fs:
  p=pathlib.Path(base,name)
  if p.suffix!='.css' or p.is_symlink():continue
  for url in re.findall(r"url\(['\"]?([^)'\"]+)",p.read_text()):
   if url.startswith(('data:','http:','https:','/','#','%23')):continue
   target=p.parent/url.split('?')[0].split('#')[0]
   if not target.exists():errors.append(f'{p.relative_to(root)}: missing CSS asset {url}')
print(f'Checked {count} local imports and {manifest_count} Cargo manifests; {len(errors)} unresolved references')
for error in errors[:100]:print(error)
sys.exit(bool(errors))
