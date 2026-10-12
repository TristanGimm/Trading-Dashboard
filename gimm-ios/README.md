# GIMM for iPhone and iPad

Native SwiftUI app shell for the existing HTTPS dashboard. The web application, PostgreSQL and Notion worker continue to run on the server. This project does not contain credentials or trading data.

## Features

- Live dashboard in a persistent WKWebView, including the existing login.
- Native loading indicator, connection-error screen, retry, refresh and pull to refresh.
- Back navigation, link sharing and opening the dashboard in Safari.
- External HTTPS links, including Notion, open outside the embedded dashboard.
- iPhone/iPad layouts, dark appearance and GIMM icon.

The app requires internet access. The existing eight-hour session expiry remains in force. This first version does not add offline trading data, biometrics or push notifications. CSV export should be used in Safari; browser blob downloads are not implemented in the native shell.

## Build and install on your iPhone

The complete Xcode app and an iOS SDK are required; Apple's standalone Command Line Tools are insufficient.

1. Open `GIMM.xcodeproj` in Xcode.
2. Under **GIMM → Signing & Capabilities**, select your Apple team. Use a bundle identifier available to that team if necessary.
3. Connect your iPhone, enable Developer Mode when requested, select it as the run destination and run the app.
4. Sign in with the existing dashboard credentials in the app.

A free Personal Team can be used for local device testing, but its provisioning expires after seven days. A Developer Program membership and App Store Connect configuration are required for TestFlight distribution. Never commit certificates, profiles or Apple credentials.

## Git automation

`.github/workflows/ios-build.yml` builds the iOS Simulator version on relevant pushes to `main`, PRs and manual dispatch. It uploads `GIMM-iOS-Simulator` as a workflow artifact. This archive is **for the Simulator only and cannot be installed on a physical iPhone**.

Install the simulator artifact on a Mac with Xcode using:

```sh
unzip GIMM-Simulator.zip
xcrun simctl bootstatus booted -b
xcrun simctl install booted GIMM.app
xcrun simctl launch booted com.gimmholding.dashboard
```

For automatic TestFlight delivery, first establish the developer team, App Store Connect app record, signing certificates/provisioning and an App Store Connect API key or Xcode Cloud access. This repository does not pretend an unsigned simulator artifact is an installable iPhone download. No TestFlight or App Store publication has been performed.

Server deployments can update the loaded dashboard. Native app changes require a new signed app build; public App Store releases also require review. A thin web wrapper is not guaranteed App Store approval.

## Validation

On a machine with full Xcode:

```sh
xcodebuild -project GIMM.xcodeproj -scheme GIMM -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
```

Then test real login/logout, session expiry, Notion links, connection loss/retry, navigation gestures, chart rendering and rotation on an iPhone simulator and physical device before distributing.
