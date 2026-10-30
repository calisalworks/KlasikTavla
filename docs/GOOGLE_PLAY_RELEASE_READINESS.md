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


## Jeton ekonomisi — istemci yazma noktaları ve güvenli geçiş sırası

İstemci tarafındaki akış incelemesinde aşağıdaki yazma noktaları tespit edildi:

- `src/firebase/coinService.ts`: ücretsiz ödül, reklam ödülü, maç giriş ücreti, maç ödülü ve iade işlemlerinde hem HTTP endpoint'lerine istek atıyor hem de oturum açılmış kullanıcılar için `users/{uid}` ve `coinTransactions` belgelerini doğrudan güncelliyor. Bazı ağ/HTTP hataları yutulduktan sonra yerel profil bakiyesi yine değiştirilebiliyor. İstemci saatine ve istemcinin verdiği tutarlara güvenilemez.
- `src/firebase/userService.ts`: kullanıcı oluşturma/senkronizasyonu yanında maç galibiyet/mağlubiyet/terk istatistiklerini ve kupa değişimini doğrudan Firestore'a yazıyor. Yeni kullanıcı oluşturulurken başlangıç bonusu işlem belgesi de istemciden yazılıyor.
- `src/utils/profileStorage.ts`: jeton ve istatistikler yerel depoda tutuluyor; bu değerler çevrim dışı/konuk deneyimi için gösterim amaçlı olabilir, fakat sunucu açısından güvenilir bakiye veya maç sonucu sayılmamalı.
- `firestore.rules`: kullanıcı kendi profilindeki ekonomik/statistik alanlarını değiştirebiliyor ve kendi işlem defterine kayıt ekleyebiliyor. Yalnızca istemciyi değiştirmek yeterli olmaz; kurallar da güvenli geçişin parçasıdır.

### Mevcut uygulamayı kırmadan önerilen sıra

1. **Önce test ve sözleşme:** jeton akışları için mevcut davranışı kapsayan testler ekle; başarısız HTTP yanıtı, yinelenen istek, aynı maç için ikinci ödül, yetersiz bakiye ve bağlantı kesilmesi senaryolarını tanımla.
2. **Kimlik doğrulama:** sunucu, Firebase ID token'ını doğrulayıp UID'yi token'dan çıkarsın. İstemcinin gövdesindeki `userId` kimlik kanıtı sayılmasın. Konuk kullanıcılar için ayrı, açıkça sınırlanmış bir politika belirlenmeden kalıcı ekonomi açılmasın.
3. **Sunucu tarafı bakiye defteri:** ücret/ödül/iade miktarları istemciden alınmak yerine sunucu yapılandırmasından ve doğrulanmış maç durumundan hesaplansın. Kalıcı depoda idempotency anahtarıyla bakiye ve işlem kaydı tek atomik işlemde yazılsın.
4. **İstemciyi taşı:** `coinService.ts` ekonomik yazmaları Firestore'dan kaldırıp sunucu API yanıtındaki doğrulanmış bakiyeyi kullansın. İstatistikler/kupalar için de sunucu tarafından doğrulanan maç sonucu API'si oluşturulsun. Yerel profil yalnızca önbellek olarak güncellensin; API başarısızsa ödül/bakiye artışı yapılmasın.
5. **Kuralları sıkılaştır:** sunucu tarafı akış ve gerekli testler hazırlandıktan sonra kullanıcı istemcisi için `coins`, ödül sayaçları, maç istatistikleri ve `coinTransactions` yazmaları kapatılsın. Profildeki güvenli alanlar (ör. görünen ad/avatar) ayrı izinlerle korunmalı. Kuralları bundan önce daraltmak mevcut uygulamanın giriş ve jeton akışını bozabilir.
6. **Geçiş ve doğrulama:** eski istemci sürümleri ve mevcut bakiyeler için geçiş politikası belirle; emülatör/entegrasyon testleri, Android cihaz testleri ve kurallar testleri tamamlanmadan üretime taşıma yapma.

**Durum:** Bu adımda yalnızca yazma noktaları ve sıralı geçiş planı belgelendi; uygulama davranışı ve Firestore kuralları değiştirilmedi. Güvenli sunucu kimlik doğrulaması, kalıcı veritabanı ve maç sonucu doğrulaması olmadan jeton ekonomisi üretime hazır değildir.


## Güvenlik test matrisi — uygulanmadan önce beklenen davranış

Bu testler henüz otomatik test olarak uygulanmış veya geçilmiş değildir. Bunlar güvenli ekonomi API'si ve kalıcı işlem defteri eklendiğinde kabul kriteri olarak kullanılmalıdır.

| Senaryo | Beklenen güvenli davranış | Mevcut durum |
| --- | --- | --- |
| Kimlik token'ı olmadan ücret/ödül/iade isteği | 401/403; hiçbir bakiye veya işlem kaydı değişmemeli | Engelleyici: mevcut uçlar kimliği doğrulamıyor |
| İstek gövdesinde başka bir kullanıcının userId değeri | Kimlik token'ındaki UID esas alınmalı; başka UID'ye işlem yapılmamalı | Engelleyici: UID gövdeden kabul ediliyor |
| İstemcinin değiştirdiği entryFee / prizeAmount | Tutar reddedilmeli veya sunucu oda seviyesi/maç sonucundan hesaplamalı | Engelleyici: tutarlar istemciden kabul ediliyor |
| Oda bulunmuyor veya maç bitmemiş | Ödül/iade reddedilmeli; bakiye değişmemeli | Engelleyici: ödül uç noktası oda yokken başarı döndürebiliyor |
| İstek kazanan olmayan oyuncudan geliyor | Ödül reddedilmeli | Engelleyici: kazanan doğrulaması yok |
| Aynı maç ödülü eşzamanlı iki kez isteniyor | Tek atomik işlem; yalnızca bir bakiye artışı ve bir ledger kaydı | Engelleyici: yalnızca bellek içi oda bayrağı var |
| Bakiye giriş ücretinden az | Sunucu işlemi reddetmeli; negatif bakiye oluşmamalı | Engelleyici: sunucu kalıcı bakiyeyi kontrol etmiyor |
| İstemci HTTP isteği başarısız oluyor | UI başarı göstermemeli; yerel/Firestore bakiyesi artırılmamalı | Engelleyici: bazı istemci akışları ağ hatasını yutup devam ediyor |
| Sunucu yeniden başlıyor | Bakiye, cooldown ve idempotency geçmişi kalıcı kalmalı | Engelleyici: ilgili kayıtlar bellek içi |
| Aynı ücretsiz ödül isteği tekrar gönderiliyor | Sunucu saati ve kalıcı UID bazlı cooldown ile ikinci ödül reddedilmeli | Engelleyici: kimlik doğrulama yok ve cooldown bellek içi |

### Güvenli uygulama için teknik ön koşullar

- Firebase Admin SDK veya eşdeğer güvenilir sunucu doğrulaması ile Firebase ID token doğrulanmalı; uid yalnızca doğrulanmış token'dan alınmalı.
- Kalıcı veritabanında atomik bakiye güncellemesi ve idempotency anahtarı birlikte uygulanmalı. Sunucu belleğindeki Map üretim muhasebesi olarak kullanılmamalı.
- Oyun sonucunu sunucudaki oda/tahta durumundan doğrulayan tek bir sonuç akışı olmalı. İstemcinin “kazandım” bildirimi tek başına ödül tetiklememeli.
- Firestore Admin/server yazmaları için gerekli kimlik bilgileri gizli ortam değişkenlerinde tutulmalı; servis hesabı anahtarı repoya commit edilmemeli.
- Yeni davranışlar önce test ortamında ve Firestore emulator kurallarıyla doğrulanmalı. Testler geçmeden ekonomik yazma kuralları daraltılmamalı; aksi hâlde eski istemci akışları kırılabilir.

Bu matristeki mevcut durum notları kod incelemesine dayanır; gerçek saldırı testi veya üretim doğrulaması yapıldığı anlamına gelmez.

## Otomatik reklam güvenlik kontrolü

- `tests/productionAdRewardFailClosed.test.ts`, ayrı bir test sunucusunu `NODE_ENV=production` ile başlatır ve SSV yapılandırılmamışken reklam ödülü isteğinin `503 ADMOB_SSV_NOT_CONFIGURED` döndürdüğünü doğrular. Ayrıca `x-test-suite: true` başlığının üretim korumasını aşamadığını kontrol eder.
- Bu kontrol, AdMob SSV entegrasyonunun tamamlandığını göstermez; yalnızca yapılandırma yokken ödül verilmemesini doğrular.
- Mevcut `friendRoomAndCoins.test.ts` senaryosunda `NODE_ENV=test` altında kullanılan `proof_...` reklam token'ları test simülasyonudur; Google tarafından imzalanmış reklam kanıtı veya gerçek jeton muhasebesi değildir.
- Bu yeni test, `bun run test` komutuna eklendi. CI sonucu gelmeden yeni testin geçtiği varsayılmamalıdır.

### Client-side fail-closed behavior

The client coin service now propagates non-2xx responses and network failures for daily rewards, match entry-fee deductions, prize awards, and refunds instead of continuing to update local profile balances or Firestore after a rejected server request. This is required because a server-side 503 guard is ineffective if the client ignores it and proceeds with its own balance mutation. This change does not make client-written Firestore balances authoritative; Firestore rules and the final server ledger still require a coordinated migration.

## Production match-settlement guard

The production server now returns HTTP 503 with `COIN_STATUS_NOT_CONFIGURED` for `/api/coins/status`, `COIN_REWARD_NOT_CONFIGURED` for `/api/coins/claim-daily`, and `MATCH_SETTLEMENT_NOT_CONFIGURED` for `/api/match/deduct-fee`, `/api/match/award-prize`, and `/api/match/refund-fee` until an authenticated, persistent, server-authoritative coin ledger is implemented. These routes previously could return success-shaped responses without actually changing a trusted balance; the prize route could also return success for a nonexistent room. The production guard runs before request validation or room-state mutation.

The production fail-closed integration test covers the coin-status and daily-reward routes plus all three match-settlement routes. It verifies that they return 503, identify the missing trusted infrastructure, and do not report a balance, reward, deduction, prize, or refund as completed. This intentionally disables these economy actions in production for now; it does not implement the final wallet/ledger system. Test-mode legacy route behavior remains a mock and must not be interpreted as a real coin transaction.

### Misafir hesabı bakiyesi aktarımı — ledger türü uyumu

`syncUserWithFirestore()` ilk kez oturum açan kullanıcı için `guest_migration` türünde bir `coinTransactions` kaydı oluşturabiliyordu; Firestore kuralındaki izin verilen türler listesinde bu değer yoktu ve kayıt reddediliyordu. Kural listesine `guest_migration` eklendi; bu yalnızca mevcut istemci akışının ledger kaydını yazabilmesini sağlar. **Bu değişiklik bakiyeyi güvenilir hâle getirmez:** istemci hâlâ kendi başlangıç bakiyesini ve ledger kaydını belirleyebiliyor. Güvenli üretim ekonomisi için yukarıdaki sunucu tarafı kimlik doğrulama, kalıcı ledger ve koordineli kural geçişi hâlâ zorunludur.

### Ek fail-closed koruması: test dışı ortamlar

Jeton durumu, ücretsiz ödül, reklam ödülü ve maç ücret/ödül/iade uçlarındaki geçici ekonomi davranışları artık yalnızca `NODE_ENV=test` iken etkinleşir. `NODE_ENV=production` yanında `development`, değişkenin hiç tanımlanmaması veya beklenmeyen başka bir değer de bu uçlarda 503 ile kapalı kalır. Bu, üretim ortam değişkeninin yanlışlıkla eksik/yanlış ayarlanmasının test amaçlı sahte ekonomi uçlarını açmasını önler. Bu uçların test dışındaki ortamlarda çalışması artık beklenmemelidir; gerçek ekonomi için doğrulanmış kimlik ve kalıcı sunucu ledger'ı hâlâ gereklidir.
