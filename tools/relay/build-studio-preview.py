# SPDX-License-Identifier: AGPL-3.0-or-later
"""Build a local review gallery from actual studio runtime assets."""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STUDIO = ROOT / "docs/cosmetics-studio"
manifest = json.loads((STUDIO / "manifests/collection-v2.json").read_text())
cards = []
sizes = []
for product in manifest["products"]:
    meta = json.loads((STUDIO / product["directory"] / "metadata.json").read_text())
    poster = "../" + product["directory"] + "/" + meta["poster"]
    motion = "../" + product["directory"] + "/" + meta["asset"]
    name = html.escape(meta["name"])
    if meta.get("quality_state") == "candidate":
        name += " · inceleme adayı"
    cards.append(f'<button class="product" data-id="{meta["id"]}" data-category="{meta["category"]}" data-poster="{poster}" data-motion="{motion}"><div class="art"><img loading="lazy" src="{poster}" alt=""/></div><small>{meta["rarity"]} · {"Premium" if meta["premium"] else "Origins"}</small><h3>{name}</h3><span>{meta["price_rp"]:,} RP</span></button>')
    if meta["category"] == "avatar_frame":
        tests = "".join(f'<div class="size"><div class="avatar" style="width:{size}px;height:{size}px"><img src="avatar-sample.png" alt="Avatar örneği"/><img class="frame" src="{poster}" alt="{name}"/></div><small>{size} px</small></div>' for size in meta["sizes"])
        sizes.append(f'<article><h3>{name}</h3><div class="size-row">{tests}</div></article>')

page = '''<!doctype html><html lang="tr"><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/>
<title>Relay Cosmetics Studio — V2 review</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#0d0d12;color:#f2f0f7}main{max-width:1240px;margin:auto;padding:40px 24px}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px}h1{font-size:32px;letter-spacing:-1px;margin:8px 0}p,small{color:#a5a2b3}h2{font-size:20px;margin-top:40px}nav{display:flex;gap:24px;padding:16px 0;border-bottom:1px solid #30303b}nav a{color:#a5a2b3;text-decoration:none}nav a:first-child{color:#b79aff}button{font:inherit;color:inherit;cursor:pointer}button:focus-visible,a:focus-visible{outline:2px solid #b79aff;outline-offset:4px}.pill{border:1px solid #30303b;border-radius:30px;padding:8px 14px;font-size:13px}.layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px}.hero{width:100%;border-radius:12px;aspect-ratio:3/1;object-fit:cover}.products{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.product{padding:0 0 18px;background:#1b1b25;border:1px solid #30303b;border-radius:10px;text-align:left;overflow:hidden}.product small,.product h3,.product>span{margin:12px 16px 0;display:block}.product h3{font-size:16px;font-weight:600;margin-top:6px}.product>span{font-size:13px}.art{height:160px;background:#111117;display:grid;place-items:center}.art img{width:100%;height:100%;object-fit:cover}.product[data-category=avatar_frame] .art img{width:130px;height:130px;object-fit:contain}.profile{position:sticky;top:24px;align-self:start;background:#16161e;border:1px solid #30303b;border-radius:12px;overflow:hidden}.banner{height:112px;width:100%;object-fit:cover}.identity{padding:0 20px 24px}.avatar{position:relative;display:grid;place-items:center;isolation:isolate}.avatar>img:first-child{width:78%;height:78%;border-radius:50%;object-fit:cover}.frame{position:absolute;width:100%;height:100%;inset:0;pointer-events:none}.profile .avatar{width:96px;height:96px;margin-top:-48px}.identity h3{font-size:20px;margin:12px 0 5px}.identity p{font-size:13px;line-height:1.6}.toggle{display:block;width:calc(100% - 40px);margin:0 20px 20px;background:#292332;border:1px solid #4a3e5d;border-radius:6px;padding:10px}.compare{display:grid;grid-template-columns:1fr 1fr;gap:16px}.compare img{width:100%;aspect-ratio:3/1;object-fit:cover;border-radius:8px}.size-row{display:flex;align-items:center;gap:24px;flex-wrap:wrap;padding:20px;background:#16161e;border-radius:8px}.size{display:grid;justify-items:center;gap:10px}.light .size-row{background:#f0eef4}.light h3{color:#f2f0f7}.note{border-top:1px solid #30303b;margin-top:32px;padding-top:20px;font-size:13px}.reference{display:grid;grid-template-columns:1fr;gap:20px}.reference img{max-width:100%}@media(max-width:740px){main{padding:24px 16px}.layout{grid-template-columns:1fr}.profile{position:static;grid-row:1}.products{grid-template-columns:repeat(2,minmax(0,1fr))}.compare{grid-template-columns:1fr}.art{height:130px}nav{gap:15px;flex-wrap:wrap}h1{font-size:26px}.size-row{gap:14px}}
</style><main><header><div><small>RELAY / COSMETICS STUDIO</small><h1>Kendine ait bir profil.</h1><p>Origins · İlk kalite koleksiyonu</p></div><span class="pill">RP</span></header>
<nav><a href="#collection">Keşfet</a><a href="#comparison">Quantum Horizon</a><a href="#sizes">Boyut testleri</a><a href="../references/index.html">Referans incelemesi</a></nav>
<h2 id="collection">Origins koleksiyonu</h2><div class="layout"><section><img class="hero" src="../assets/banners/quantum_horizon/quantum_horizon-v2-static.webp" alt="Quantum Horizon dağ manzarası"/><p>Obsidyen arazi, uzak ışık, sessiz atmosfer.</p><div class="products">CARDS</div></section>
<aside class="profile"><img id="profile-banner" class="banner" src="../assets/banners/quantum_horizon/quantum_horizon-v2-static.webp" alt="Banner önizleme"/><div class="identity"><div class="avatar"><img src="avatar-sample.png" alt="Relay varsayılan avatarı"/><img id="profile-frame" class="frame" src="../assets/avatar-frames/violet_halo/violet_halo-v2-static.svg" alt="Violet Halo"/></div><h3>Relay Explorer</h3><small>Profil önizlemesi</small><p id="selection">Violet Halo</p></div><button id="motion" class="toggle" aria-pressed="false">Animasyonu önizle</button></aside></div>
<h2 id="comparison">Quantum Horizon · önce / sonra</h2><div class="compare"><div><img src="quantum-horizon-before.png" alt="Eski SVG"/><p>Önce · düzenli yıldızlar ve tek siluet</p></div><div><img src="../assets/banners/quantum_horizon/quantum_horizon-v2-static.webp" alt="Yeni manzara"/><p>Sonra · doğal arazi ve bağımsız sis katmanı</p></div></div>
<h2 id="sizes">Çerçeve okunabilirliği</h2>SIZES<div class="light"><h2>Açık zemin</h2>SIZES</div><p class="note">Yerel sanat ve boyut incelemesi. Satın alma ve sahiplik Relay uygulamasındaki API ile doğrulanır. Önizleme avatarı projenin varsayılan avatar dosyasıdır.</p></main>
<script>
let selected=null,playing=false;const button=document.querySelector('#motion'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
function render(){if(!selected)return;const category=selected.dataset.category;const image=document.querySelector(category==='avatar_frame'?'#profile-frame':'#profile-banner');image.src=playing&&!reduced.matches?selected.dataset.motion:selected.dataset.poster;document.querySelector('#selection').textContent=selected.querySelector('h3').textContent;button.setAttribute('aria-pressed',String(playing));button.textContent=playing?'Animasyonu durdur':'Animasyonu önizle'}
document.querySelectorAll('.product').forEach(card=>card.addEventListener('click',()=>{if(selected){playing=false;render()}selected=card;playing=false;render()}));
button.addEventListener('click',()=>{if(!selected)selected=document.querySelector('.product');playing=!playing;render()});document.addEventListener('visibilitychange',()=>{if(document.hidden){playing=false;render()}});reduced.addEventListener('change',()=>{playing=false;render()});
</script></html>'''
(STUDIO / "previews/index.html").write_text(page.replace("CARDS","".join(cards)).replace("SIZES","".join(sizes)))
references = sorted((ROOT / "docs/references/spark").glob("*.png"))
(STUDIO / "references/index.html").write_text(
    '<!doctype html><html lang="tr"><meta charset="utf-8"/><title>Relay references</title><style>body{font:16px system-ui;background:#0d0d12;color:#f2f0f7;max-width:1200px;margin:auto;padding:24px}img{width:100%}figure{margin:32px 0}</style><h1>İncelenen referanslar</h1>'
    + "".join(f'<figure><figcaption>{html.escape(p.name)}</figcaption><img src="../../references/spark/{html.escape(p.name,quote=True)}" alt="{html.escape(p.stem,quote=True)}"/></figure>' for p in references)
)
print("Built gallery, comparison and five-reference index")
