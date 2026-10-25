# Klasik Tavla — Yayın Öncesi Teknik Kontrol

Bu kontrol listesi 25 Ekim 2026 tarihinde güncellendi. Render staging servisi yayınlandı; önceki GitHub Actions web CI çalışması başarılıydı. Android smoke workflow'u debug APK derlemesini doğrulamak ve başarılıysa 7 gün süreyle test artefaktı sunmak üzere eklendi; en son çalışmasının sonucu ayrıca kontrol edilmelidir. Android release AAB henüz üretilip gerçek cihazda test edilmedi.

## Kritik: yayın öncesinde tamamlanmalı

- [x] Render üzerinde staging WebSocket sunucusu yayımlandı: `https://klasik-tavla-staging.onrender.com` (`/ws` WebSocket yolu). Bu yalnızca test içindir; yayın AAB'sinde üretim sunucusu kullanılmalı.
- [ ] Üretim WebSocket sunucusunu seç, dağıt ve Android'den `/api/health` ile `/ws` uç noktalarını gerçek cihazda uçtan uca doğrula.
- [x] Güvenli olmayan jeton kesme, ödül/iade ve reklam ödülü mutasyon uç noktaları geçici olarak 503 döndürecek şekilde kapatıldı.
- [ ] Maç giriş ücreti, ödül ve iade işlemlerini istemcinin gönderdiği `userId`, `entryFee` veya `prizeAmount` değerlerine güvenmeden sunucu tarafında doğrula. Kimlik doğrulama ve kalıcı, atomik bakiye kaydı olmadan jeton ekonomisi güvenli değildir.
- [ ] Gerçek AdMob App ID ve Rewarded Ad Unit ID değerlerini ayarla. Uygulama test kimliklerini varsayılan kullanır; release ön kontrolü test kimliklerini reddeder.
- [ ] AdMob ödülünü sunucu tarafı doğrulama (SSV) ile doğrula; istemcinin ürettiği `proof_...` değerini güvenilir kanıt kabul etme.
- [ ] Firebase Console'da doğru Android uygulamasını kaydet, SHA parmak izlerini ekle ve gerçek `android/app/google-services.json` dosyasını indir. Kurulum adımları `docs/ANDROID_FIREBASE_SETUP.md` içinde; `.example` dosyası yer tutucudur.
- [ ] Güvenli upload keystore ve parolalarını ortam değişkenleriyle sağla; anahtarları Git'e ekleme.
- [ ] `docs/ANDROID_RELEASE.md` içindeki ön kontrolü çalıştır. Betik test AdMob kimliklerini, test modunu ve staging sunucusunu yayın derlemesi için reddeder.
- [ ] İmzalı Android App Bundle (AAB) üret ve gerçek cihazda giriş, tekli oyun, çevrim içi eşleşme, arkadaş odası, arka plana alma/yeniden bağlanma ve reklam akışlarını test et.
- [ ] Play Console mağaza kaydı, gizlilik politikası, veri güvenliği formu, içerik derecelendirmesi ve gerekli politika beyanlarını tamamla.

## Doğrulanmış kaynak kodu gözlemleri

- `package.json`: Vite derleme, TypeScript kontrolü ve iki Bun tabanlı test betiği mevcut.
- `server.ts`: Express + WebSocket sunucusu; oda/eşleşme ve ödül durumlarının bir bölümü bellekte tutuluyor. Süreç yeniden başlarsa bu bellek verileri kaybolur.
- `src/utils/wsConfig.ts`: Android için `VITE_WS_SERVER_URL` gereklidir; tarayıcıda mevcut host kullanılır.
- `src/services/admobService.ts`: AdMob kimlikleri ortam değişkenlerinden okunabilir; test modu açıkça kapatılmadıkça test modunda kalır. İstemci reklam olayı tek başına jeton ödülünü yetkilendirmez.
- `android/app/src/main/AndroidManifest.xml`: AdMob App ID Gradle manifest placeholder üzerinden ayarlanır.
- `firestore.rules`: Kullanıcı belgeleri için sahiplik kontrolleri var; ancak bu kurallar kendi başına Express sunucusundaki REST uç noktalarını korumaz.

## Sıradaki uygulama adımları

1. Firebase Console'dan gerçek Android `google-services.json` dosyasını indir; örnek şablonu kullanma.
2. Üretim backend adresini, gerçek AdMob kimliklerini ve güvenli upload keystore'u yapılandır.
3. Kimlik doğrulama + kalıcı bakiye altyapısını ve AdMob SSV doğrulamasını tamamla; bundan önce jeton ekonomisini açma.
4. Android ön kontrolünü, imzalı AAB üretimini ve gerçek cihaz testlerini tamamla.
5. Play Console iç test kanalında uçtan uca doğrulama yap.

> Güvenlik nedeniyle `main` dalı değiştirilmedi. Değişiklikler `audit/release-readiness` dalında ve taslak PR'da tutuluyor.
