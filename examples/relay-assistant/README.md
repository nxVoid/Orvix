# Relay Assistant

Mevcut Relay REST API ve Gateway ile çalışan Node.js/TypeScript örnek botu. Discord.js kullanmaz; API, Gateway ve veritabanı değişikliği gerektirmez.

**Komutlar normal kanal mesajlarıdır:** `/ping`, `/help`, `/avatar`, `/serverinfo`. Mesajı yazıp gönderin. Bu örnek yerel slash komut kaydı, autocomplete veya interaction callback kullanmaz. Önceki geliştirme aşamasındaki application-command taslaklarına bağımlı değildir.

## Mevcut özellikler

- Relay uygulama oluştururken bot hesabı ve token üretir. Sunucuda bot token sırrı hash olarak saklanır.
- Bot daveti mevcut OAuth2 `bot` scope'u ve izin seçicisiyle yapılır.
- Gateway bot oturumları, `MESSAGE_CREATE`, heartbeat ve resume destekler. Discord intent bitmask'i varsayılmaz; örnek Relay'in `ignored_events` alanını kullanır.
- Mevcut Kanal Ayarları → Webhooks ekranı oluşturma, ad/avatar, hedef kanal, URL kopyalama ve silmeyi sağlar. Bu çalışma alanında aynı ekrana eklenmiş test mesajı/önizleme de vardır; ikinci panel yoktur.
- Banner, webhook profil alanı değil, mesaj embed'inin `image` alanıdır. `thumbnail` küçük resimdir.

## 1. Botu oluştur ve token'ı al

1. Kendi Relay web uygulamana giriş yap. Kullanıcı Ayarları içindeki **Applications / Uygulamalar** bölümünü aç.
2. **Create application** ile `Relay Assistant` adlı uygulama oluştur.
3. Uygulama ayrıntılarında bot profilini kontrol et. **Secrets / Bot token** alanındaki token'ı al. Token artık gösterilmiyorsa **Regenerate** ile yenisini üret; doğrulama/parola istenirse tamamla. Yenileme eski token'ı geçersiz kılar.
4. **Client secret** yerine **Bot token** kullan. Token'ı yalnızca botun çalışacağı makinenin ortam değişkeninde veya `.env` dosyasında sakla. Token'ı sohbet mesajına, kaynak koda, ekran görüntüsüne veya frontend ayarına koyma.

Arayüz adları seçili dile göre değişebilir. Uygulamalar bölümü sunucu ayarlarında değil, kullanıcı ayarlarındadır.

## 2. Mevcut OAuth2 ile sunucuya davet et

1. Uygulama ayrıntılarındaki **OAuth2 URL builder** bölümünü aç.
2. Scope olarak yalnızca **bot** seç.
3. **View Channel**, **Send Messages**, **Embed Links** ve **Read Message History** izinlerini seç. Örnek yönetici, mesaj silme veya webhook yönetme izni istemez. Kanal bazındaki izinlerin de botun erişimine açık olması gerekir.
4. Bu basit davet için **Require OAuth2 Code Grant** kapalı olsun; yalnızca `bot` scope'unda redirect URI gerekmez.
5. **Copy authorization URL** bağlantısını aynı Relay sunucusunda tarayıcıda aç. Bot ekleme yetkin olan sunucuyu seçip yetkilendir.
6. Botun sunucu üye listesine eklendiğini kontrol et. Bağlı görünmesi için sonraki adımda bot sürecini başlatmalısın.

URL builder kendi Relay origin'ini, `client_id`, `scope=bot` ve izin bitlerini kullanır. Discord davet bağlantısı kullanma. Bot private ise sahibi olarak davet et; başkalarının davet etmesi gerekiyorsa mevcut Public Bot ayarını kullan.

## 3. Ayarları doldur ve başlat

Node.js **22.18+** gerekir. Harici npm bağımlılığı yoktur; TypeScript dosyaları Node'un yerleşik desteğiyle çalışır. Bot için `npm install` veya monorepo build gerekli değildir.

```bash
cd examples/relay-assistant
cp .env.example .env
chmod 600 .env
```

`.env` dosyasını düzenle:

```dotenv
RELAY_API_URL=https://relay.example/api/v1
RELAY_BOT_TOKEN=BURAYA_GERCEK_BOT_TOKENI
RELAY_MEDIA_URL=https://relay.example/media
RELAY_GUILD_IDS=SUNUCU_ID
```

Adresler örnektir. Kendi instance discovery yanıtındaki `endpoints.api` ve `endpoints.media` değerlerini aynen kullan; kurulumunun API prefix'ini tahmin etme. Gateway adresini bot `/gateway/bot` üzerinden alır. Sunucu ID'sini Relay'in mevcut ID kopyalama menüsünden al; gerekirse kullanıcı ayarlarından geliştirici modunu etkinleştir. Birden fazla sunucu ID'si virgülle ayrılabilir.

Uzak sunucularda HTTPS/WSS kullanılır. `localhost`, `127.0.0.1`, `::1` üzerinde HTTP/WS yerel geliştirme için kabul edilir. `.env` Git tarafından dışlanır.

```bash
npm start
```

`Relay Assistant connected.` çıktısından sonra botun erişebildiği normal bir metin kanalına sırayla gönder:

```text
/ping
/help
/avatar
/avatar @kullanıcı
/serverinfo
```

`/avatar 123456789` biçiminde kullanıcı ID'si de kullanılabilir. `/ping` REST yanıt süresini ölçer; Gateway gecikmesi olarak sunulmaz. Özel avatar yoksa bunu söyler. API üye sayısı döndürmüyorsa `/serverinfo` sayı uydurmaz. Bot DM'leri, diğer botları, webhook mesajlarını, yapılandırılmamış sunucuları ve yeniden oynatılan mesajları yok sayar. Yanıtlarda mention bildirimleri kapalıdır.

`Ctrl+C` ile durdur. İzleyici/watcher, Docker container veya servis kurulmaz.

## 4. Mevcut webhook panelini dene

Botu webhook yöneticisi yapmak gerekmez. Testleri webhook yönetme yetkisi olan kendi hesabınla, bir **test metin kanalında** yap:

1. **Kanal Ayarları → Webhooks** ekranını aç ve webhook oluştur.
2. Kaydı genişlet. Adını değiştir, avatar yükle ve mevcut kaydetme çubuğu görünüyorsa kaydet. Sayfayı yeniden açıp ad/avatarın korunduğunu doğrula. Yalnızca ad değişikliği avatarı silmemeli.
3. Hedef kanal seçimini değiştirirsen o kanal için de webhook yönetme iznin olmalı.
4. **Copy webhook URL** ile kopyala. URL token içerir ve parola gibi saklanmalıdır; loglara veya sohbet mesajlarına yapıştırma. Panoya kopyalamanın gerçek tarayıcıda çalışması ayrıca doğrulanmalıdır.
5. Aynı kayıttaki **Test message** alanına metin; embed başlığı, açıklaması ve renk gir. İstersen erişilebilir HTTPS adresleriyle **Banner image URL** ve **Thumbnail URL** doldur.
6. Önizlemeyi kontrol et, **Send test message** ile gönder ve hedef kanalda sonucu gör. Önizleme metin düzenini gösterir; sunucudaki markdown, medya işleme ve nihai görünüm farklı olabilir. Alanlar gönderilecek test mesajına aittir; kalıcı webhook şablonu değildir.
7. Tekrar ad/avatar değiştirip kaydet. Son olarak **Delete webhook** ile yalnızca oluşturduğun test webhook'unu sil. Eski URL'nin artık mesaj gönderemediğini doğrula.

Test gönderimi giriş yapılmış yönetim ucundan geçer; sunucu mevcut guild/kanal izinlerini kontrol eder. Token ile çalışan genel webhook execute uçlarının uygulama origin engeli korunur. Bu çalışma alanındaki test gönderimi dakikada 5 istekle sınırlıdır; hata alırsan kısa süre bekle. `Renew token` kullanırsan eski URL'yi kullanan servisleri güncellemen gerekir.

### Genel webhook API'siyle gönderim

Panelin dışında mevcut `POST /webhooks/{id}/{token}?wait=true` ucu aşağıdaki gövdeyi kabul eder. Gerçek URL'yi shell geçmişine veya loglara yazma; istek aracının gizli değişken alanında sakla. Webhook execute için bot token gerekmez.

```json
{
  "content": "Relay webhook testi",
  "allowed_mentions": {"parse": []},
  "embeds": [{
    "title": "Duyuru",
    "description": "Embed açıklaması",
    "color": 5793266,
    "image": {"url": "https://example.com/banner.png"},
    "thumbnail": {"url": "https://example.com/thumbnail.png"}
  }]
}
```

Görsel adreslerini gerçek erişilebilir dosyalarla değiştir. Yalnızca örnek URL kullanmak görselin yüklenmesini sağlamaz.

## Sorun giderme

| Belirti | Kontrol |
| --- | --- |
| Bot başlatılamıyor / 401 | Bot token'ı, doğru API adresi ve token yenilendiyse `.env` |
| Davet ekranında sunucu yok | Giriş yapılan hesap ve sunucuya bot ekleme yetkisi |
| Çevrimiçi ama yanıt yok | `RELAY_GUILD_IDS`, mesajı normal metin olarak gönderme, kanal View/Send izinleri |
| Embed veya avatar görünmüyor | Embed Links izni, `RELAY_MEDIA_URL`, görsel erişimi |
| Webhook ayarı/gönderimi reddediliyor | Guild ve kanal Manage Webhooks izinleri; hedef kanal izinleri |
| Rate limit | Bekle; tekrar tekrar tıklama. Örnek REST istemcisi 429 için sınırlı yeniden deneme yapar. |

Hata çıktıları token ve API hata gövdesini yazdırmaz. Sürekli bağlantı sorunu varsa `Ctrl+C` ile durdurup ayarları kontrol et.

## Hedefli doğrulama

Yalnızca bot testleri:

```bash
node --test --experimental-test-isolation=none --test-concurrency=1 test/Assistant.test.ts
```

Testler gerçek sunucuya bağlanmaz; dört komutun mevcut endpoint'leri kullanmasını, filtrelemeyi ve güvenli istek davranışını kontrol eder. Canlı bot daveti, Gateway bağlantısı, tarayıcı panosu ve görüntülerin son görünümü için yukarıdaki manuel adımları kendi sunucunda tamamla. Bot token'ı bu çalışma için sağlanmadığından canlı başarı iddia edilmez.


Bu çalışma alanında doğrulanan sonuçlar: 6 örnek bot testi, 4 webhook API testi ve 2 mevcut bot API testi geçti. API, uygulama ve örnek bot TypeScript kontrolleri hatasız tamamlandı. Testler sırayla çalıştırıldı; canlı sunucuya bağlanılmadı.
