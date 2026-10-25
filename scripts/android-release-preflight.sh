#!/usr/bin/env bash
set -euo pipefail

fail() { printf 'HATA: %s\n' "$*" >&2; exit 1; }

command -v bun >/dev/null 2>&1 || fail "Bun kurulu değil."
command -v java >/dev/null 2>&1 || fail "JDK kurulu değil."

[[ -f android/app/google-services.json ]] || fail "android/app/google-services.json eksik. Firebase Console'dan gerçek dosyayı indirin; .example dosyası kullanılamaz."
grep -q '"package_name"[[:space:]]*:[[:space:]]*"com.klasiktavla.app"' android/app/google-services.json || fail "google-services.json içindeki Android paket adı com.klasiktavla.app olmalı."
[[ -n "${VITE_WS_SERVER_URL:-}" ]] || fail "VITE_WS_SERVER_URL tanımlı değil. Örnek: wss://klasik-tavla-staging.onrender.com"
[[ -n "${TAVLA_UPLOAD_STORE_FILE:-}" ]] || fail "TAVLA_UPLOAD_STORE_FILE tanımlı değil."
[[ -n "${TAVLA_UPLOAD_STORE_PASSWORD:-}" ]] || fail "TAVLA_UPLOAD_STORE_PASSWORD tanımlı değil."
[[ -n "${TAVLA_UPLOAD_KEY_ALIAS:-}" ]] || fail "TAVLA_UPLOAD_KEY_ALIAS tanımlı değil."
[[ -n "${TAVLA_UPLOAD_KEY_PASSWORD:-}" ]] || fail "TAVLA_UPLOAD_KEY_PASSWORD tanımlı değil."
[[ -f "${TAVLA_UPLOAD_STORE_FILE}" ]] || fail "TAVLA_UPLOAD_STORE_FILE ile belirtilen keystore dosyası bulunamadı."

printf '\n1/3 Web uygulaması derleniyor...\n'
bun install --frozen-lockfile
bun run lint
bun run build

printf '\n2/3 Capacitor Android dosyaları eşitleniyor...\n'
bunx cap sync android

printf '\n3/3 Release AAB oluşturuluyor...\n'
cd android
./gradlew bundleRelease

printf '\nAAB çıktısı: android/app/build/outputs/bundle/release/app-release.aab\n'
