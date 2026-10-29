# Google Play yayın hazırlığı — Klasik Tavla

Bu belge, `release/play-readiness-security` dalındaki yayın öncesi kontrol listesidir. Ana dal doğrudan değiştirilmemiştir.

## Şu an doğrulanabilenler

- Android uygulama kimliği: `com.klasiktavla.app`
- Android hedef SDK: 36
- Uygulama Google AdMob test App ID ve test rewarded-ad unit ID kullanıyor.
- `src/services/admobService.ts` istemci tarafında `proof_...` biçiminde bir token oluşturuyor. Bu token Google tarafından imzalanmış bir reklam tamamlama kanıtı değildir.
- Sunucunun oda durumu, eşleştirme ve jeton/ödül verileri bellekte tutuluyor; sunucu yeniden başlatıldığında kaybolabilir. Bu, çevrim içi oyun ve ödül ekonomisi için kalıcı veri deposu ve sunucu tarafı yetkilendirme gereksinimini doğurur.
- `server.ts` içindeki `/api/match/deduct-fee`, `/api/match/award-prize` ve `/api/match/refund-fee` uçları şu anda çağıranın kimliğini doğrulamıyor. İstemci istediği `userId`, `roomId`, `entryFee` veya `prizeAmount` değerini gönderebilir; ödül uç noktası oda bulunamadığında da başarı döndürebilir ve oda varsa gerçek kazananı doğrulamıyor. `claim-daily` de kimliği doğrulanmış kullanıcıya/kalıcı hesaba bağlı değil ve sunucudaki bellek içi sayaç yalnızca geçici sınırlama sağlıyor. Bu uçlar gerçek jeton bakiyesini güvenli biçimde yönetmiyor; üretimde ödül ve maç ekonomisi için güvenli kabul edilmemelidir.
- `firestore.rules` içindeki mevcut kurallar, oturum açmış kullanıcının kendi `users/{uid}` belgesindeki `coins`, `wins`, `losses`, `trophies` gibi alanları şekil kontrolleri geçtikçe doğrudan değiştirmesine izin veriyor. Kullanıcı kendi `coinTransactions` alt koleksiyonuna da yeni kayıt ekleyebiliyor. Bu nedenle istemci tarafından gönderilen bakiyeler ve işlem kayıtları güvenilir muhasebe kanıtı değildir; üretim öncesi bakiye/ekonomi yazma yetkisi sunucuya taşınmalı ve Firestore kuralları buna göre daraltılmalıdır.
- Firebase web yapılandırma dosyası istemciye gömülüdür; Firebase web API anahtarı tek başına sunucu sırrı sayılmaz. Güvenlik, uygun Authentication ve Firestore Security Rules ile sağlanmalıdır. Özel servis hesap anahtarları veya diğer sunucu sırları repoya eklenmemelidir.
- Google ile giriş yapılandırması için Firebase Android uygulaması, imza sertifikası parmak izleri ve `google-services.json` kontrol edilmelidir. Gizli/hesaba özel dosyalar depoya eklenmemelidir.

## Güvenlik değişikliği

Üretim ortamında `POST /api/coins/claim-ad` artık güvenli AdMob SSV doğrulaması eklenene kadar ödül vermeyi reddeder (`503 ADMOB_SSV_NOT_CONFIGURED`). Bu, sahte istemci istekleriyle jeton verilmesini engelleyen geçici bir korumadır; **ödüllü reklamlar üretimde henüz tamamlanmış sayılmaz**. Test/geliştirme ortamındaki mevcut senaryolar korunmuştur.

## Yayın engelleri — tamamlanmadan üretime çıkmayın

- [ ] AdMob'da Android uygulaması ve ödüllü reklam birimi oluştur; gerçek kimlikleri yalnızca doğru üretim yapılandırmasına yerleştir.
- [ ] AdMob SSV callback endpoint'i ekle; Google imzasını, gerekli parametreleri ve tekrar oynatma/idempotency durumunu doğrula.
- [ ] Ödül kayıtlarını kalıcı bir veritabanında sakla; yalnızca istemciden gelen `userId`, `adProof`, jeton miktarı veya ödül sonucuna güvenme.
- [ ] Firestore kurallarını ve istemci yazma akışını yeniden tasarla: kullanıcı istemcisi kendi jeton bakiyesini, maç istatistiklerini veya ödül defterini doğrudan değiştirememeli; güvenilir yazmalar doğrulanmış sunucu tarafı işlemlerle yapılmalı.
- [ ] Oyun odası, jeton bakiyesi, giriş ücreti, ödül ve iade işlemlerini sunucuda doğrula. Önce kimlik doğrulama ve yetkilendirme ekle; ücretleri oda/tier ayarlarından sunucu hesaplasın; ödül yalnızca sunucunun doğruladığı maç kazananına, kalıcı ve idempotent bir işlemle verilsin. İstemciden gelen miktarları ve oda kimliğini yetki kanıtı kabul etme. Mevcut HTTP endpoint'lerinin yalnızca log yazıp başarı dönmesi gerçek bakiye yönetimi yerine geçmez.
- [ ] Üretim API ve WebSocket URL'lerini, HTTPS/WSS kullanımını, ortam değişkenlerini ve sunucunun kalıcı depolama/ölçekleme ayarlarını doğrula. Şu anki CI Android derlemesinde `VITE_WS_SERVER_URL` tanımlanmıyor; bu nedenle üretilen doğrulama APK'sında uzak çevrim içi sunucu adresi yoktur ve Android'de çevrim içi eşleşme çalışması beklenmemelidir. Gerçek HTTPS/WSS sunucu adresi belirlendikten sonra derleme ortamına eklenip yeniden derlenmelidir.
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
