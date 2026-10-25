# Android Firebase yapılandırması

Bu depo, Android'e özel gerçek `google-services.json` dosyasını içermiyor. Güvenlik ve doğru OAuth bağlantısı için bu dosya tahmin edilerek üretilmemelidir. `google-services.json.example` yalnızca şema/yer tutucu örneğidir; doğrudan derlemede kullanılamaz.

## Gerçek dosyayı oluşturma

1. Firebase Console'da mevcut projeyi açın: `ai-studio-applet-webapp-87ad7` projesinin gerçekten uygulamanın kullanması gereken proje olduğunu doğrulayın.
2. Project settings → Your apps → Add app → Android seçin.
3. Android package name olarak tam olarak `com.klasiktavla.app` girin.
4. Android uygulama kaydı oluşturulduktan sonra `google-services.json` dosyasını indirin ve `android/app/google-services.json` yoluna koyun.
5. Firebase Authentication → Sign-in method bölümünde Google sağlayıcısını etkinleştirin.
6. Google girişini dağıtım anahtarıyla doğrulamak için Play App Signing sertifikasının SHA-1 ve SHA-256 parmak izlerini Firebase Android uygulamasına ekleyin. Yerel test için kullanılan debug anahtarının parmak izleri ayrıca eklenebilir.
7. Google girişini fiziksel Android cihazda test edin. Web OAuth client ID tek başına Android uygulama kaydının ve doğru SHA parmak izlerinin yerini tutmaz.

## Derleme öncesi doğrulama

- `android/app/google-services.json` gerçek Firebase Console indirmesi olmalı; örnek dosya yeniden adlandırılmamalı.
- Dosyadaki `package_name` değeri `com.klasiktavla.app` olmalı.
- `android/app/build.gradle` Google Services Gradle eklentisini yalnızca dosya mevcut olduğunda uygular.
- İmzalama anahtarını, parolasını veya servis hesabı özel anahtarını Git'e commit etmeyin. Google Services yapılandırması kimlik doğrulama sırlarıyla aynı şey değildir; yine de projeye özel yapılandırma olarak yönetin.
