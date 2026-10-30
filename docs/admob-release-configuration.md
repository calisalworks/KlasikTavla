# AdMob release configuration

The repository deliberately distinguishes a validation build from a monetized release.

## Validation build

The GitHub Actions Android job sets `ADMOB_AD_MODE=test` and the official Google sample IDs. Its APK/AAB artifacts are for build validation only; they are not production monetization builds.

## Production release

Set all of the following in the build environment before creating a Play Store AAB:

- `ADMOB_AD_MODE=production`
- `ADMOB_ANDROID_APP_ID`: the real AdMob Android App ID for `com.klasiktavla.app`
- `VITE_ADMOB_MODE=production`
- `VITE_ADMOB_ANDROID_APP_ID`: the same real AdMob App ID
- `VITE_ADMOB_REWARDED_AD_UNIT_ID`: the real rewarded ad unit ID

A release AAB build fails unless real IDs are provided. The client also disables ads if production IDs are missing or are Google's sample IDs. Do not store credentials in source control; configure the identifiers in the build environment rather than hardcoding them.

This change does not enable reward grants: the server-side AdMob SSV signature verifier and durable, idempotent coin-ledger settlement must be implemented and configured before production ad rewards can be enabled. The existing production 503 guard remains intentional.
