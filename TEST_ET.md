# Orvix test rehberi

## Windows uygulaması

`artifacts/Orvix-2026.1107.1-win-x64.zip` dosyasının tamamını çıkartın ve içindeki `Orvix/Orvix.exe` dosyasını çalıştırın. EXE tek başına taşınamaz; yanındaki dosyalar da gereklidir. Bu paket kurulum gerektirmeyen, imzasız bir yerel test derlemesidir.

Bu bilgisayardaki derleme çıktısı Windows üzerinde şu adrestedir:

```text
%LOCALAPPDATA%\RelayBuild\source\relay_desktop\dist-electron\win-unpacked\Orvix.exe
```

Uygulamadaki sunucu seçimine kendi Orvix sunucunuzun adresini girin. Yerel geliştirme sunucusu için adres `http://localhost:8088` olacaktır; farklı bir bilgisayardan bağlanmak için erişilebilir bir sunucu/tünel adresi gerekir.

## Doğrulananlar

- Windows x64 native modüllerinin derlemesi ve paket içeriği kontrolleri geçti.
- Windows masaüstü TypeScript kontrolü geçti.
- EXE ürün adı ve dosya açıklaması Orvix; sürümü 2026.1107.1.
- Geçici Windows profilinde uygulama başladı, pencere çizildi ve renderer 2026.1107.1 sürümünü raporladı.
- Native preflight sonucunda degraded listesi boş.
- Kaynak kopyasında 122 Rust CI testi ve 125 yapılandırma testi geçti; web, API ve masaüstü tip kontrolleri ile admin derleme kontrolü geçti.

## Yerel sunucunun son durumu

Kaynak geçişi ana proje dizinine uygulandı. PostgreSQL, bucket adları ve depolama verileri korundu; kayıtlı ürün adı Orvix yapıldı. Kaynak yedeği `.orvix-migration/legacy-source`, veritabanı yedeği `.orvix-migration/postgres-before-rebrand.dump` altındadır.

API başlatma testi mevcut Orvix Valkey konteynerine ağdan erişimde zaman aşımına takıldı. Valkey kendi içinde PONG yanıtladı; Docker üzerindeki yeniden başlatma/exec işlemleri de takıldı. Bu yüzden web sunucusunun hazır olduğu ve giriş/mesaj/ses işlevlerinin uçtan uca çalıştığı henüz doğrulanmadı. Nexora konteynerlerine işlem yapılmadı.

Valkey/Docker bağlantısı düzeltildikten sonra geliştirme ortamını şu komutla başlatabilirsiniz:

```sh
docker exec -it -w /workspaces/orvix relay-dev-workspace-1 pnpm dev
```

Web: `http://localhost:8088` — Admin: `http://localhost:8088/admin/`.

ZIP bütünlüğü için yanındaki `.zip.sha256` dosyasını kullanabilirsiniz. Otomatik güncelleme bu test derlemesinde kapalıdır; renderer paketin içindedir.

Docker hata ayıklamasında oluşturulan `relay-dev-cache-recovery` geçici konteyneri son kontrolde `Created` durumundaydı; port yayımlamıyor ve uygulama ayarları onu kullanmıyor. Docker işlemleri düzelince gerekirse `docker rm -f relay-dev-cache-recovery` ile temizlenebilir.
