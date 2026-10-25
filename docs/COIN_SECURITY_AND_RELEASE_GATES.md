# Jeton güvenliği ve yayın kapıları

## Mevcut güvenli varsayılan

- API jeton değiştirme/ödül rotaları `503 COIN_ECONOMY_TEMPORARILY_DISABLED` ile kapalı kalmalıdır.
- İstemci, jeton bakiyesini veya ödül sayaçlarını yetkili kaynak olarak belirleyemez. `src/firebase/coinService.ts` artık Firebase ID token'ı olmadan mutasyon isteği göndermez, doğrudan Firestore bakiye/ledger yazmaz ve sunucudan `coinEconomyEnabled: true`, doğrulanmış bakiye ve işlem makbuzu almadan yerel bakiyeyi değiştirmez.
- `firestore.rules` istemcilerin mevcut kullanıcı belgesindeki jeton bakiyesi/ödül zamanlarını değiştirmesini ve `coinTransactions` kayıtları yazmasını engeller. Yeni kullanıcı belgesi varsa başlangıç bakiyesi yalnızca 500 olabilir.
- Firestore kuralları yalnızca Firebase projesine deploy edildikten sonra etkili olur. Bu dalda dosyanın bulunması, Firebase Console'daki kuralların güncellendiği anlamına gelmez.
- Firebase Admin SDK kullanan güvenilir sunucu işlemleri Firestore kurallarını atlar; bu nedenle sunucu her istekte Firebase ID token doğrulamalı ve kullanıcı kimliğini doğrulanmış token'daki `uid` üzerinden belirlemelidir.

## Jeton ekonomisini açmadan önce

1. Gerçek Firebase projesini ve Android uygulamasını doğrulayın; paket adı `com.klasiktavla.app` olmalı.
2. Firebase Authentication'da Google girişini etkinleştirin ve Android uygulamasına debug + Play App Signing SHA-1/SHA-256 parmak izlerini kaydedin.
3. Bu dosyadaki Firestore kurallarını Firebase Console/CLI üzerinden hedef projeye deploy edin; kuralların yayımlanmış sürümünü doğrulayın.
4. Güvenilir sunucuya Firebase Admin SDK hizmet kimliği/ADC üzerinden bağlanın. Servis hesabı özel anahtarını Git'e, istemciye veya sohbet mesajına koymayın.
5. Bakiye değişikliklerini Firestore transaction içinde sunucuda uygulayın: doğrulanmış UID, pozitif/sınırlı miktar, idempotency anahtarı, cooldown ve ledger kaydı tek atomik işlemde kontrol edilmeli.
6. Ödüllü reklam için AdMob SSV callback'ini sunucuda doğrulayın (imza, ad unit, uygulama, kullanıcı ve transaction ID); istemciden gelen `adProof` veya `rewarded=true` tek başına kanıt değildir. Tekrar oynatmayı engelleyin.
7. Sahte/eksik token, başka UID, tekrar oynatılan SSV, paralel talepler, cooldown atlama ve bakiye değiştirme testleri geçmeden coin API'lerini açmayın.

## Android yayın kimlikleri ve imzalama

- `android/app/google-services.json`: Firebase Console'dan indirilen gerçek Android yapılandırması; örnek dosya kullanılamaz.
- `VITE_WS_SERVER_URL`: TLS üzerinden üretim WebSocket sunucusu (`wss://...`); staging adresi olmamalı.
- `VITE_ADMOB_APP_ID` ve `VITE_ADMOB_REWARDED_AD_UNIT_ID`: AdMob'dan alınmış gerçek kimlikler.
- `VITE_ADMOB_TEST_MODE=false`: yalnızca gerçek reklam envanteri ve test/uyumluluk kontrolleri hazır olduğunda.
- `TAVLA_UPLOAD_STORE_FILE`, `TAVLA_UPLOAD_STORE_PASSWORD`, `TAVLA_UPLOAD_KEY_ALIAS`, `TAVLA_UPLOAD_KEY_PASSWORD`: gizli upload keystore ve parolaları. Git'e commit etmeyin; erişimi sınırlı güvenli secret store kullanın.
- Yayın AAB'si Play App Signing açık olacak şekilde hazırlanmalı; upload sertifikası ile Play App Signing sertifikası farklı olabilir.

## Bilinmeyenler / dış erişim gereksinimi

Bu depo tek başına Firebase Console, AdMob veya Play Console ayarlarının gerçekten yapıldığını kanıtlayamaz. Gerçek proje kimlikleri, reklam kimlikleri, sunucu alan adı, keystore ve konsol izinleri sağlanmadan yayın yapılandırması tamamlandı diye işaretlenmemelidir.
