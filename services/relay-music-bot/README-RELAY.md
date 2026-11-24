# 🎵 Relay Music Bot (Fluxer / Orvix Native)

Relay Music, Relay / Fluxer altyapısına özel olarak optimize edilmiş, LiveKit ve NodeLink ses motoru ile çalışan self-hosted müzik botudur.

---

## ⚡ Özellikler

- **Tam Entegre & Bağımsız:** Relay çekirdeğinden tamamen bağımsız bir mikroservis / Docker konteyner grubu olarak çalışır.
- **Otomatik Sunucu Katılımı:** Relay'de yeni açılan her sunucuya (guild) bot davet linki gerekmeden otomatik olarak üye eklenir!
- **Hacker Yeşil Teması ile Uyumlu:** Bot embed ve mesaj renkleri hacker/emerald temasına (`#00e676`) ayarlanmıştır.
- **Ses & Kalite:** LiveKit ve NodeLink tabanlı olup YouTube, Spotify, SoundCloud, Deezer vb. kaynaklardan yüksek kaliteli kesintisiz ses yayını sağlar.
- **Ön-tanımlı Prefix:** `!` (Örn: `!play`, `!skip`, `!stop`)

---

## 🚀 Başlatma Yöntemleri

### Yöntem 1: Docker ile Başlatma (Tavsiye Edilen)

Klasör içindeyken terminal veya komut satırından:

```bash
# Windows:
start-docker.bat

# Linux / WSL:
./start-docker.sh

# Veya doğrudan docker compose ile:
docker compose up -d --build
```

Durdurmak için:
```bash
docker compose down
```

### Yöntem 2: Standalone (Doğrudan Node.js ile)

Gereksinim: Node.js >= 22

```bash
npm install --legacy-peer-deps
node index.mjs
```

*(Not: Standalone çalıştığında MySQL ve NodeLink servislerinin erişilebilir olması gerekir. Docker Compose bu servisleri otomatik olarak ayağa kaldırır.)*

---

## 📋 Başlıca Komutlar

| Komut | Açıklama |
| :--- | :--- |
| `!play <şarkı / link>` | Şarkıyı arar veya verilen YouTube/Spotify/SoundCloud linkini çalar |
| `!pause` | Çalan şarkıyı duraklatır |
| `!resume` | Duraklatılan şarkıyı devam ettirir |
| `!skip` | Sıradaki şarkıya geçer |
| `!stop` | Oynatmayı durdurur ve ses kanalından ayrılır |
| `!queue` | Mevcut şarkı kuyruğunu gösterir |
| `!nowplaying` / `!np` | Şu an çalan şarkının bilgilerini gösterir |
| `!volume <0-100>` | Ses seviyesini ayarlar |
| `!loop` | Şarkı veya kuyruk tekrar modunu açar/kapatır |
| `!247` | Botun ses kanalında 7/24 kalmasını sağlar |

---

## ⚙️ Yapılandırma (`config.json`)

- **Bot Token:** `1569143898905772032.OoPXf8-Fmy3rVOjKA-hUh645g46g3NbgC7Rxx4RcLw0`
- **Instance URL:** `http://host.docker.internal:8088` (Docker içinden Relay API'sine erişim)
- **Prefix:** `!`
- **MySQL / Redis / NodeLink:** Docker Compose ağında (`relay-music-net`) otomatik bağlıdır.
