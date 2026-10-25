# Klasik Tavla — Yayın Öncesi Teknik Kontrol

Bu kontrol listesi 25 Ekim 2026 tarihinde güncellendi. Render ücretsiz staging servisi canlı ve GitHub Actions TypeScript, web build, sağlık kontrolü ve WebSocket/coin akışı testlerini geçti. Android AAB henüz üretilip gerçek cihazda test edilmedi; AdMob üretim reklamları etkin değil.

## Kritik: yayın öncesinde tamamlanmalı

- [x] Render üzerinde staging WebSocket sunucusu yayımlandı: `https://klasik-tavla-staging.onrender.com` (`/ws` WebSocket yolu). Android AAB oluşturulurken `VITE_WS_SERVER_URL=wss://klasik-tavla-staging.onrender.com` derleme ortamına tanımlanmalı.
- [ ] Render dağıtımı canlı ve sunucu süreci başlıyor; `/api/health` ve `/ws` uç noktaları gerçek Android cihazdan uçtan uca doğrulanmalı.
- [x] Güvenli olmayan jeton kesme, ödül/iade ve reklam ödülü mutasyon uç noktaları geçici olarak 503 döndürecek şekilde kapatıldı. Gerçek kimlik doğrulama, kalıcı/atomik bakiye ve AdMob SSV doğrulaması tamamlanınca yeniden tasarlanmalı.
- [ ] Maç giriş ücreti, ödül ve iade işlemlerini istemcinin gönderdiği `userId`, `entryFee` veya `prizeAmount` değerlerine güvenmeden sunucu tarafında doğrula. Kimlik doğrulama ve kalıcı, atomik bakiye kaydı olmadan jeton ekonomisi güvenli değildir.
- [ ] AdMob üretim yapılandırmasını tamamla. `src/services/admobService.ts` Google'ın test uygulama/reklam kimliklerini kullanıyor ve `initializeForTesting: true` ayarlı. Gerçek reklam kimlikleri ve Android manifestindeki uygulama kimliği yapılandırılmadan üretim reklamı beklenmemeli.
- [ ] Google AdMob ödülünü mümkünse sunucu tarafı doğrulama (SSV) ile doğrula; istemcinin ürettiği `proof_...` değerini güvenilir kanıt kabul etme.
- [ ] Google ile Android girişi için Firebase Console uygulama kaydı, SHA parmak izleri ve doğru `google-services.json` dosyasını kontrol et. Kurulum adımları `docs/ANDROID_FIREBASE_SETUP.md` dosyasına eklendi; `android/app/google-services.json.example` yalnızca yer tutucu örnektir, gerçek dosyanın yerine kullanılamaz.
- [ ] Play Console için imzalı Android App Bundle (AAB) üret ve gerçek cihazda giriş, tekli oyun, çevrim içi eşleşme, arkadaş odası, uygulamayı arka plana alma/yeniden bağlanma ve ödüllü reklam akışlarını test et.

## Doğrulanmış kaynak kodu gözlemleri

- `package.json`: Vite derleme, TypeScript kontrolü ve iki Bun tabanlı test betiği mevcut.
- `server.ts`: Express + WebSocket sunucusu; oda/eşleşme ve ödül durumlarının bir bölümü bellekte tutuluyor. Süreç yeniden başlarsa bu bellek verileri kaybolur.
- `src/utils/wsConfig.ts`: Android için `VITE_WS_SERVER_URL` gereklidir; tarayıcıda mevcut host kullanılır.
- `src/services/admobService.ts`: Resmî Google test reklam kimlikleri ve test modu kullanılır.
- `android/app/src/main/AndroidManifest.xml`: AdMob uygulama kimliği Google test kimliği olarak yazılmış.
- `firestore.rules`: Kullanıcı belgeleri için sahiplik kontrolleri var; ancak bu kurallar kendi başına Express sunucusundaki REST uç noktalarını korumaz.

## Sıradaki uygulama adımları

1. `docs/ANDROID_FIREBASE_SETUP.md` adımlarını izleyip Firebase Console'dan gerçek Android `google-services.json` dosyasını indir; örnek şablonu gerçek yapılandırma gibi kullanma.
2. Gerçek AdMob uygulama/reklam kimliklerini ayarla ve SSV callback doğrulamasını kur.
3. Kimlik doğrulama + kalıcı bakiye altyapısını tamamlayıp jeton ekonomisini güvenle yeniden etkinleştir.
4. Android AAB üret, imzala ve yatay tam ekran gerçek cihaz testlerini yap.
5. Play Console iç test kanalında yayın öncesi uçtan uca doğrulama yap.

> Güvenlik nedeniyle bu ilk incelemede mevcut `main` dalı değiştirilmedi. Kontrol listesi ayrı `audit/release-readiness` dalında tutulur.
