# Android imzalı AAB oluşturma

Bu depo henüz bir imzalama anahtarı veya Firebase Android yapılandırması içermez. Bu dosyalar hesap/cihaz sahibine özgü olduğundan tahmin edilerek üretilmez ve özel anahtarlar Git'e eklenmez.

## Gereksinimler

- JDK ve Android SDK / platform araçları
- Bun
- Firebase Console'dan indirilen gerçek `android/app/google-services.json`
- Google Play App Signing için güvenli şekilde saklanan upload keystore
- Üretim çevrim içi sunucusu kararlaştırıldığında doğru WebSocket adresi

## İmzalama bilgileri

Önce güvenli bir yerde upload keystore oluşturun veya mevcut anahtarı kullanın. Anahtar parolalarını kaynak koda yazmayın. Derlemeden önce ortam değişkenlerini tanımlayın:

```bash
export VITE_WS_SERVER_URL="wss://klasik-tavla-staging.onrender.com"
export TAVLA_UPLOAD_STORE_FILE="/absolute/path/to/upload-key.jks"
export TAVLA_UPLOAD_STORE_PASSWORD="..."
export TAVLA_UPLOAD_KEY_ALIAS="upload"
export TAVLA_UPLOAD_KEY_PASSWORD="..."
```

Bu değişkenler hazırlık/ön kontrol betiği tarafından denetlenir. **Not:** Android Gradle projesinin release signing yapılandırması bu ortam değişkenlerini henüz kullanacak şekilde bağlanmadı; bu yüzden imzalı Play Store AAB'si oluştuğunu varsaymayın. Önce `android/app/build.gradle` içindeki release signing yapılandırmasını bu değişkenlere bağlamak ve ardından gerçek keystore ile derlemeyi doğrulamak gerekir.

## Ön kontrol

```bash
bash scripts/android-release-preflight.sh
```

Betik Firebase dosyası, paket adı, WebSocket URL'si ve imzalama girdileri eksikse erken durur; bu bir Play Console'a hazır olma garantisi değildir. Üretim reklam kimlikleri/SSV ve gerçek cihaz testleri ayrıca tamamlanmalıdır.
