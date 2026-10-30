import { resolveAdMobConfig, GOOGLE_TEST_ADMOB_APP_ID, GOOGLE_TEST_REWARDED_AD_UNIT_ID } from '../src/services/admobConfig';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
  console.log(`✅ ${message}`);
}

const testConfig = resolveAdMobConfig({ VITE_ADMOB_MODE: 'test' });
assert(testConfig.enabled && testConfig.isTesting, 'explicit test mode enables SDK test mode');
assert(testConfig.appId === GOOGLE_TEST_ADMOB_APP_ID, 'test mode defaults to official sample App ID');
assert(testConfig.rewardedAdUnitId === GOOGLE_TEST_REWARDED_AD_UNIT_ID, 'test mode defaults to official sample rewarded unit');

const productionConfig = resolveAdMobConfig({
  VITE_ADMOB_MODE: 'production',
  VITE_ADMOB_ANDROID_APP_ID: 'ca-app-pub-1234567890123456~1234567890',
  VITE_ADMOB_REWARDED_AD_UNIT_ID: 'ca-app-pub-1234567890123456/1234567890',
});
assert(productionConfig.enabled && !productionConfig.isTesting, 'valid production IDs enable non-test mode');
assert(productionConfig.mode === 'production', 'valid production IDs select production mode');

const missingProductionIds = resolveAdMobConfig({ VITE_ADMOB_MODE: 'production' });
assert(!missingProductionIds.enabled && missingProductionIds.mode === 'disabled', 'production mode without IDs fails closed');

const sampleIdsInProduction = resolveAdMobConfig({
  VITE_ADMOB_MODE: 'production',
  VITE_ADMOB_ANDROID_APP_ID: GOOGLE_TEST_ADMOB_APP_ID,
  VITE_ADMOB_REWARDED_AD_UNIT_ID: GOOGLE_TEST_REWARDED_AD_UNIT_ID,
});
assert(!sampleIdsInProduction.enabled, 'production mode refuses Google sample IDs');

const implicitMode = resolveAdMobConfig({});
assert(!implicitMode.enabled, 'unspecified mode leaves ads disabled');
