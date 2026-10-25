# Klasik Tavla — Yayın Öncesi Teknik Kontrol

Bu kontrol listesi, GitHub'daki mevcut kaynak kodunun ilk incelemesine dayanır. APK'nın derlendiği, canlı sunucunun çalıştığı veya AdMob'un gerçek reklam sunduğu henüz uçtan uca doğrulanmış değildir.

## Kritik: yayın öncesinde tamamlanmalı

- [ ] Android derlemesi için gerçek bir çevrim içi WebSocket sunucusu yayımla ve `VITE_WS_SERVER_URL=wss://...` ile derleme ortamına tanımla. Uygulama, yerel APK'da bu değişken yoksa çevrim içi modun kullanılamayacağını açıkça bildiriyor.
- [ ] Sunucunun `/api/health` uç noktasını ve `/ws` WebSocket bağlantısını gerçek internet üzerinden doğrula.
- [ ] `server.ts` içindeki jeton/maç ödülü uç noktalarını güvenli hâle getir. Mevcut `/api/coins/claim-ad` yalnızca istemciden gelen `adProof` metninin türünü ve uzunluğunu kontrol ediyor; gerçek reklam tamamlanmasını kanıtlamıyor.
- [ ] Maç giriş ücreti, ödül ve iade işlemlerini istemcinin gönderdiği `userId`, `entryFee` veya `prizeAmount` değerlerine güvenmeden sunucu tarafında doğrula. Kimlik doğrulama ve kalıcı, atomik bakiye kaydı olmadan jeton ekonomisi güvenli değildir.
- [ ] AdMob üretim yapılandırmasını tamamla. `src/services/admobService.ts` Google'ın test uygulama/reklam kimliklerini kullanıyor ve `initializeForTesting: true` ayarlı. Gerçek reklam kimlikleri ve Android manifestindeki uygulama kimliği yapılandırılmadan üretim reklamı beklenmemeli.
- [ ] Google AdMob ödülünü mümkünse sunucu tarafı doğrulama (SSV) ile doğrula; istemcinin ürettiği `proof_...` değerini güvenilir kanıt kabul etme.
- [ ] Google ile Android girişi için Firebase Console uygulama kaydı, SHA parmak izleri ve doğru `google-services.json` dosyasını kontrol et.
- [ ] Play Console için imzalı Android App Bundle (AAB) üret ve gerçek cihazda giriş, tekli oyun, çevrim içi eşleşme, arkadaş odası, uygulamayı arka plana alma/yeniden bağlanma ve ödüllü reklam akışlarını test et.

## Doğrulanmış kaynak kodu gözlemleri

- `package.json`: Vite derleme, TypeScript kontrolü ve iki Bun tabanlı test betiği mevcut.
- `server.ts`: Express + WebSocket sunucusu; oda/eşleşme ve ödül durumlarının bir bölümü bellekte tutuluyor. Süreç yeniden başlarsa bu bellek verileri kaybolur.
- `src/utils/wsConfig.ts`: Android için `VITE_WS_SERVER_URL` gereklidir; tarayıcıda mevcut host kullanılır.
- `src/services/admobService.ts`: Resmî Google test reklam kimlikleri ve test modu kullanılır.
- `android/app/src/main/AndroidManifest.xml`: AdMob uygulama kimliği Google test kimliği olarak yazılmış.
- `firestore.rules`: Kullanıcı belgeleri için sahiplik kontrolleri var; ancak bu kurallar kendi başına Express sunucusundaki REST uç noktalarını korumaz.

## Sıradaki uygulama adımları

1. Derleme ve testleri çalıştırıp mevcut hataları kaydet.
2. Sunucu barındırma ve ortam değişkenlerini yapılandır.
3. Jeton/ödül uç noktalarının kimlik doğrulamasını ve sunucu tarafı yetkilendirmesini düzelt.
4. AdMob üretim yapılandırmasını ve SSV doğrulamasını tamamla.
5. Android AAB üretip Play Console test kanalında uçtan uca doğrula.

> Güvenlik nedeniyle bu ilk incelemede mevcut `main` dalı değiştirilmedi. Kontrol listesi ayrı `audit/release-readiness` dalında tutulur.
