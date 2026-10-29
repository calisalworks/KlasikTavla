# Google Play yayın hazırlığı — Klasik Tavla

Bu belge, `release/play-readiness-security` dalındaki yayın öncesi kontrol listesidir. Ana dal doğrudan değiştirilmemiştir.

## Şu an doğrulanabilenler

- Android uygulama kimliği: `com.klasiktavla.app`
- Android hedef SDK: 36
- Uygulama Google AdMob test App ID ve test rewarded-ad unit ID kullanıyor.
- `src/services/admobService.ts` istemci tarafında `proof_...` biçiminde bir token oluşturuyor. Bu token Google tarafından imzalanmış bir reklam tamamlama kanıtı değildir.
- Sunucunun oda durumu, eşleştirme ve jeton/ödül verileri bellekte tutuluyor; sunucu yeniden başlatıldığında kaybolabilir. Bu, çevrim içi oyun ve ödül ekonomisi için kalıcı veri deposu ve sunucu tarafı yetkilendirme gereksinimini doğurur.
- Google ile giriş yapılandırması için Firebase Android uygulaması, imza sertifikası parmak izleri ve `google-services.json` kontrol edilmelidir. Gizli/hesaba özel dosyalar depoya eklenmemelidir.

## Güvenlik değişikliği

Üretim ortamında `POST /api/coins/claim-ad` artık güvenli AdMob SSV doğrulaması eklenene kadar ödül vermeyi reddeder (`503 ADMOB_SSV_NOT_CONFIGURED`). Bu, sahte istemci istekleriyle jeton verilmesini engelleyen geçici bir korumadır; **ödüllü reklamlar üretimde henüz tamamlanmış sayılmaz**. Test/geliştirme ortamındaki mevcut senaryolar korunmuştur.

## Yayın engelleri — tamamlanmadan üretime çıkmayın

- [ ] AdMob'da Android uygulaması ve ödüllü reklam birimi oluştur; gerçek kimlikleri yalnızca doğru üretim yapılandırmasına yerleştir.
- [ ] AdMob SSV callback endpoint'i ekle; Google imzasını, gerekli parametreleri ve tekrar oynatma/idempotency durumunu doğrula.
- [ ] Ödül kayıtlarını kalıcı bir veritabanında sakla; yalnızca istemciden gelen `userId`, `adProof`, jeton miktarı veya ödül sonucuna güvenme.
- [ ] Oyun odası, jeton bakiyesi, giriş ücreti, ödül ve iade işlemlerini sunucuda doğrula. Mevcut HTTP endpoint'lerinin yalnızca log yazıp başarı dönmesi gerçek bakiye yönetimi yerine geçmez.
- [ ] Üretim API ve WebSocket URL'lerini, HTTPS/WSS kullanımını, ortam değişkenlerini ve sunucunun kalıcı depolama/ölçekleme ayarlarını doğrula.
- [ ] Firebase Android app kaydı, Google sağlayıcısı, SHA-1/SHA-256 imza parmak izleri ve Google ile giriş akışını test et.
- [ ] Release imzalı AAB üret; Android cihazda reklam, giriş, yatay ekran, çevrim içi eşleşme, bağlantı kopması/yeniden bağlanma ve uygulama yeniden başlatma testlerini yap.
- [ ] Play Console içerik derecelendirmesi, veri güvenliği formu, reklam beyanı, gizlilik politikası, uygulama erişimi ve mağaza kayıtlarını doldur.
- [ ] Kişisel geliştirici hesabı için Play Console'un gösterdiği kapalı test ve üretim erişimi koşullarını tamamla.

## Kontrol komutları

Depoda tanımlı mevcut komutlar:

- `npm run lint` — TypeScript kontrolü
- `npm run build` — web üretim derlemesi
- `npm test` — mevcut Bun tabanlı entegrasyon senaryoları; test sunucusunun `localhost:3000` adresinde ayrıca başlatılması gerekebilir.

Bu liste otomatik olarak yayın onayı vermez. CI sonucu, gerçek cihaz testi ve Play Console doğrulamaları ayrıca kontrol edilmelidir.
