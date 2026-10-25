# Android imzalı AAB oluşturma

Bu depo henüz bir imzalama anahtarı veya Firebase Android yapılandırması içermez. Bu dosyalar hesap/cihaz sahibine özgü olduğundan tahmin edilerek üretilmez ve özel anahtarlar Git'e eklenmez.

## Gereksinimler

- JDK ve Android SDK / platform araçları
- Bun
- Firebase Console'dan indirilen gerçek `android/app/google-services.json`
- Google Play App Signing için güvenli şekilde saklanan upload keystore
- Üretim ortamında çalışan WebSocket adresi (`wss://...`); staging adresi yayın derlemesinde bilerek reddedilir
- Gerçek AdMob Android App ID ve ödüllü reklam birimi kimliği

## Ortam değişkenleri

Önce güvenli bir yerde upload keystore oluşturun veya mevcut anahtarı kullanın. Anahtar parolalarını kaynak koda yazmayın. Aşağıdaki örneklerdeki değerleri kendi **üretim** bilgilerinizle değiştirin:

```bash
export VITE_WS_SERVER_URL="wss://YOUR-PRODUCTION-HOST"
export VITE_ADMOB_APP_ID="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"
export VITE_ADMOB_REWARDED_AD_UNIT_ID="ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY"
export VITE_ADMOB_TEST_MODE="false"
export TAVLA_UPLOAD_STORE_FILE="/absolute/path/to/upload-key.jks"
export TAVLA_UPLOAD_STORE_PASSWORD="..."
export TAVLA_UPLOAD_KEY_ALIAS="upload"
export TAVLA_UPLOAD_KEY_PASSWORD="..."
```

- `VITE_WS_SERVER_URL` üretim WebSocket sunucusunu göstermeli; `klasik-tavla-staging.onrender.com` yayın ön kontrolünden geçmez.
- `VITE_ADMOB_APP_ID` hem Android manifestine hem istemci yapılandırmasına bağlanır.
- `VITE_ADMOB_REWARDED_AD_UNIT_ID` ödüllü reklam birimini ayarlar.
- Uygulama geliştirme/CI derlemelerinde Google'ın resmî test kimliklerini ve test modunu varsayılan kullanır. Yayın ön kontrolü test kimliklerini ve `VITE_ADMOB_TEST_MODE=true` durumunu reddeder.
- Örnek kimlikleri gerçek AdMob değerleriyle değiştirmek tek başına SSV doğrulamasını kurmaz. Jeton ekonomisi, sunucu tarafı AdMob SSV ve güvenli bakiye işlemleri tamamlanana kadar kapalı kalmalıdır.

## Ön kontrol ve derleme

```bash
bash scripts/android-release-preflight.sh
```

Betik Firebase dosyasını, paket adını, üretim WebSocket adresini, gerçek AdMob kimliklerini, test dışı reklam modunu ve imzalama girdilerini denetler; ardından TypeScript/web build, Capacitor senkronizasyonu ve imzalı AAB derlemesini çalıştırır. Ön kontrol bir Play Console'a hazır olma garantisi değildir. Gerçek cihaz testleri ve Play Console politika/gizlilik hazırlıkları ayrıca tamamlanmalıdır.

AAB çıktısı: `android/app/build/outputs/bundle/release/app-release.aab`.
