# Güvenli jeton API'si — hedef sözleşme

Bu belge, mevcut Klasik Tavla akışını bir kerede kırmadan ekonomik işlemleri sunucuya taşıma hedefini tanımlar. **Bu sözleşme henüz uygulanmış değildir.** Şu anki HTTP uçları gerçek bir bakiye defteri değildir; geliştirme testleri bu uçların mevcut başarı yanıtlarını üretim güvenliği olarak yorumlamamalıdır.

## Güven sınırı

- Kimliği doğrulayan katman Firebase ID token'ını doğrular. Kullanıcı UID'si yalnızca doğrulanmış token'dan alınır; body içindeki userId yok sayılır veya reddedilir.
- İstemci hiçbir zaman güvenilir coins, entryFee, prizeAmount, refundAmount, maç sonucu veya reklam kanıtı kaynağı değildir.
- Her ekonomik işlem, kalıcı veritabanında bakiye değişimi ve tekil işlem defteri kaydını tek atomik işlemde yapar.
- Başarısız API yanıtı, zaman aşımı veya belirsiz ağ sonucu istemcide başarı/bakiye artışı üretmez. İstemci aynı idempotencyKey ile güvenle yeniden deneyebilir.
- Konuk profiller yerel/deneme deneyimi olarak kalabilir; kalıcı veya çevrim içi jeton ekonomisine geçiş için ayrı bir kimlik politikası gerekir.

## Önerilen endpoint sözleşmesi

### GET /api/coins/me

Kimlik: Authorization: Bearer <Firebase ID token>

Yanıt alanları: uid, coins, updatedAt, rewardStatus.freeRewardAvailableAt, rewardStatus.adsRemainingToday.

Bakiye ve ödül uygunluğu sunucunun kalıcı kayıtlarından okunur. İstemci profilindeki jeton sayısı yalnızca önbellek/gösterim verisidir.

### POST /api/coins/claim-free

İstemci gövdesi ekonomik tutar veya UID taşımaz. Sunucu ödül miktarını ve cooldown'ı yapılandırmadan alır; server time kullanır. Kalıcı UID + ödül türü + dönem için tekrar denemeler atomik/idempotent olmalıdır.

### POST /api/matches/:roomId/entry-fee

Gövde: { "idempotencyKey": "..." }

Sunucu token UID'sinin bu odada oyuncu olduğunu, oda/tier giriş ücretini ve bakiye yeterliliğini doğrular. İstemci ücret göndermez. Aynı oda/UID için tekrarlanan istek ikinci kez ücret kesmez.

### POST /api/matches/:roomId/prize

Gövde: { "idempotencyKey": "..." }

Sunucu odanın varlığını, maçın tamamlandığını ve kazanan UID'yi kendi maç durumundan doğrular. Ödül miktarı sunucunun oda/tier kuralından hesaplanır; kazanan dışındaki UID'ler reddedilir. Bir maç için yalnızca bir ödül kaydı oluşturulabilir.

### POST /api/matches/:roomId/refund

Gövde: { "idempotencyKey": "..." }

Sunucu maçın iade koşullarını (ör. maç başlamadan iptal) ve kullanıcının o oda için daha önce ücret ödediğini doğrular. Her oyuncu için tek iade yapılabilir. İstemci tutar belirleyemez.

### AdMob ödülü

POST /api/coins/claim-ad istemcinin oluşturduğu proof_... değerini reklam kanıtı olarak kabul etmemelidir. Ödül, yalnızca AdMob SSV callback imzası ve gerekli parametreler sunucuda doğrulandıktan sonra, doğrulanmış reklam işlem kimliği için bir kez yazılır. SSV tamamlanana kadar üretimde 503 ile kapalı kalması beklenen güvenli davranıştır.

## Kalıcı kayıt modeli

Veritabanı seçimi yapılırken aşağıdaki mantıksal kayıtlar desteklenmelidir:

- **UserWallet**: uid, balance, updatedAt; bakiye negatif olamaz.
- **CoinLedger**: benzersiz transactionId, uid, type, amount, balanceAfter, referenceId, createdAt. Kayıtlar sunucu tarafından yazılır ve değiştirilemez.
- **Idempotency**: benzersiz işlem anahtarı; aynı anahtarın tekrarı ilk sonucun aynısını döndürür, ikinci ekonomik etki yaratmaz.
- **RewardClaim**: uid, rewardType, periodKey, claimedAt; kullanıcı/dönem/ödül türü başına tekil kısıt.
- **MatchSettlement**: roomId, doğrulanmış winnerUid, durum, ücret/ödül/iadelerin işlem referansları. Maçın birden fazla kez sonuçlandırılması engellenir.

Bu kayıtlar tek bir işlem sınırı içinde güncellenemiyorsa kullanılan veritabanı ve işlem stratejisi açıkça tasarlanmalı; “önce bakiye, sonra ledger” gibi yarım kalabilecek iki ayrı yazma kullanılmamalıdır.

## HTTP hata sözleşmesi

- 401: token yok/geçersiz.
- 403: kimlik doğrulandı ama bu oda/işlem için yetkisi yok.
- 404: oda veya işlem referansı bulunamadı.
- 409: idempotency çakışması veya mevcut durum işlemle uyumsuz.
- 422: yetersiz bakiye ya da iş kuralı ihlali.
- 503: gerekli güvenilir servis (ör. AdMob SSV) henüz yapılandırılmamış.
- Her hata durumunda bakiye ve ledger değişmeden kalır.

## Otomatik kabul testleri

1. Token yok, bozuk token ve süresi geçmiş token: ekonomik endpoint'ler 401 döndürür; wallet/ledger değişmez.
2. Token UID'si A iken body UID'si B: işlem yalnızca A için yapılır veya body UID reddedilir; B değişmez.
3. Ücret/ödül miktarını değiştirme girişimi: istemci miktarı kullanılmaz; tutar sunucu kuralından çıkar.
4. Bilinmeyen oda, bitmemiş maç, kazanan olmayan kullanıcı ve tekrar sonuçlandırma: ödül verilmez.
5. Aynı ücret/ödül/iade isteği eşzamanlı ve ardışık tekrarlanır: yalnızca bir ledger kaydı ve tek bakiye etkisi olur.
6. Yetersiz bakiye ve negatif tutar: işlem reddedilir; bakiye negatif olmaz.
7. Veritabanı işlemi sırasında hata: bakiye ve ledger birlikte geri alınır.
8. Sunucu yeniden başlatılır: bakiye, ödül cooldown'ı ve idempotency geçmişi korunur.
9. HTTP 4xx/5xx, zaman aşımı veya bağlantı kopması: istemci başarı göstermeden önce sunucu sonucunu tekrar sorgulayabilir; yerel bakiye artırılmaz.
10. AdMob SSV: geçersiz imza, eksik parametre ve tekrar oynatılmış işlem reddedilir; geçerli callback yalnızca bir kez ödül verir.
11. Firestore Emulator Rules: istemci ekonomik alanları ve ledger belgelerini yazamaz; yalnızca sunucu güven sınırı bu alanları değiştirebilir.
12. Maç istatistikleri/kupalar: yalnızca sunucunun doğruladığı sonuçtan yazılır; istemci UID/trophy delta göndererek kendini yükseltemez.

## Geçiş sırası

1. Bu sözleşmeye göre API ve veritabanı seçimini/kurulumunu yap; sunucu ID token doğrulamasını ekle.
2. Yeni API için birim ve entegrasyon testlerini ekle; mevcut istemci akışlarını henüz kapatma.
3. İstemciyi yeni API'ye taşı ve sunucu yanıtındaki bakiyeyi kullan; ağ hatalarını yutup ekonomik işlemi devam ettiren fallback'leri kaldır.
4. Test ortamında mevcut hesap/konuk bakiyesi geçişini ve eski uygulama sürümü politikasını doğrula.
5. Firestore kurallarını daralt; Emulator testleri ve uygulama testleri geçmeden yayınlama.
6. AdMob SSV ve gerçek reklam kimlikleri, HTTPS/WSS adresleri ve imzalı AAB ayrı yayın kontrolleri olarak tamamlanmalı.

**Durum:** Tasarım ve kabul kriterleri belgelendi; endpoint'ler, kalıcı defter, Firebase Admin doğrulaması veya Firestore kuralları bu dosya ile değişmiş olmaz.
