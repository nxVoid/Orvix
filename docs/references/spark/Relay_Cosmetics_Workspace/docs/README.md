# Relay Cosmetics Workspace

Bu klasör 12 ayrı, özgün SVG kozmetik varlığı içerir: 5 avatar çerçevesi, 4 banner ve 3 isim zemini. SVG dosyalarındaki SMIL animasyonları destekleyen tarayıcılarda çalışır.

## Kullanım
- Avatar çerçevelerini kullanıcının avatar görselinin üstüne, şeffaf SVG katmanı olarak yerleştirin.
- Banner dosyaları 960×320, çerçeveler 256×256, isim zeminleri 640×120 viewBox ölçülerindedir.
- `catalog.json` örnek katalog metadata içerir; fiyatlar yalnızca taslaktır.
- SVG içeriklerini sunucu tarafında güvenilir statik asset olarak servis edin; kullanıcı yüklemeleri için SVG sanitizasyonu uygulayın.
- Hareket azaltma ayarı için istemci tarafında animasyonları durduran alternatif statik önizlemeler sağlayın.
- Bu çalışma tasarım varlıklarıdır; Relay API/veritabanına otomatik bağlanmaz.
