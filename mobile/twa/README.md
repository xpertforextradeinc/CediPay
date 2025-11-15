# Trusted Web Activity (TWA) Build & CI Instructions - CediPay

This document explains how to generate a Trusted Web Activity (TWA) wrapper for the CediPay web app, where to place the generated Android project in this repository, and a GitHub Actions workflow to build and publish an Android App Bundle (AAB) to Google Play.

Summary
- Recommended flow: generate a TWA Android project locally using Bubblewrap, commit the generated Android project to mobile/twa/android, and use GitHub Actions to build and upload the AAB to Google Play.
- Do NOT commit your keystore or service account JSON. Store them in GitHub Secrets instead.

Prerequisites
- A progressive web app (PWA) hosted at an HTTPS URL with a valid web manifest (manifest.json) and service worker.
- Node.js and npm installed for Bubblewrap
- Java JDK (11+), Android SDK and build-tools installed locally for local builds
- Google Play Developer account and a Play Console service account JSON with access to the target app

High-level steps
1. Verify your web app is a PWA
   - manifest.json exists and contains name, short_name, start_url, icons and scope
   - site served over HTTPS
   - service worker registered and functional

2. Install Bubblewrap locally (for generating the Android project)
```bash
npm install -g @bubblewrap/cli
```

3. Generate the TWA project locally (non-interactive)
- Example (replace values):
```bash
bubblewrap init --manifest https://your.web.app/manifest.json \
  --applicationId com.xpertforexcedipay.app \
  --name "CediPay" \
  --short-name "CediPay" \
  --display=standalone \
  --start-url "/"

# Then build the Android project locally (requires Android SDK installed)
bubblewrap build
```
- The commands above create an Android project in the local folder `twa` (or the path you specify). Bubblewrap may produce an `android/` directory that contains a Gradle Android project.

4. Place the generated Android project in the repo
- Copy the generated Android project into this repo at: `mobile/twa/android`
- Commit only the generated Android project files (gradle wrapper, android/ subfolders, app module, etc.)

5. Configure Android signing locally and in CI
- Generate a keystore (local):
```bash
keytool -genkey -v -keystore cedipay-keystore.jks -alias cedipay -keyalg RSA -keysize 2048 -validity 10000
```
- Do NOT commit the .jks file. Create a base64 of the keystore for CI:
```bash
base64 cedipay-keystore.jks | pbcopy   # paste into GitHub secret
```
- Required GitHub Secrets (repository settings → Secrets):
  - PLAY_STORE_SERVICE_ACCOUNT_JSON (paste the JSON content)
  - ANDROID_KEYSTORE_BASE64 (base64 of cedipay-keystore.jks)
  - ANDROID_KEYSTORE_PASSWORD
  - ANDROID_KEY_ALIAS
  - ANDROID_KEY_PASSWORD

6. Update the Android project signing config
- In `mobile/twa/android/app/build.gradle` or `mobile/twa/android/gradle.properties`, configure the signing config to read from the keystore path and environment properties. In CI we will decode the keystore to `mobile/twa/android/keystore.jks` before building.

7. CI build & upload (GitHub Actions)
- The companion workflow `.github/workflows/twa-release.yml` in this repo builds the AAB and uploads to Google Play using `r0adkll/upload-google-play`.
- The workflow expects the Android project to be at `mobile/twa/android` and the secrets listed above to be present.

Local build quick test
1. Copy your keystore to `mobile/twa/android/keystore.jks` and configure `android/gradle.properties` accordingly.
2. From repo root:
```bash
cd mobile/twa/android
./gradlew clean bundleRelease
# result: app/build/outputs/bundle/release/app-release.aab
```

Publishing strategy
- Use internal testing track for initial uploads (internal testers only).
- Move to closed testing / open beta before production.

Troubleshooting
- If the AAB build fails in CI due to missing SDK components, install same Android SDK components locally and add them to the workflow or include a pre-generated Android project with correct Gradle wrapper.
- If Bubblewrap flags interactive prompts, run `bubblewrap init` locally, commit the generated android/ folder, and avoid running Bubblewrap in CI.

Security notes
- Never commit secrets (keystores, service account JSON, API keys) to the repository.
- Use GitHub Secrets and restrict access to maintainers.

If you want, I can:
- Commit `mobile/twa/README.md` and add the GitHub Action to this repository in a PR (I will push the files).
- Or scaffold the initial `mobile/twa/android` folder locally, generate a minimal TWA, and add it (you will need to provide the manifest URL and app ID).
