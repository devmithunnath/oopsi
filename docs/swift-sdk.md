# Native Apple SDK (`Oopsi` Swift Package)

Supports **macOS 14+** and **iOS 17+** with Swift 6 strict concurrency and **zero third-party dependencies**.

## Installation (Swift Package Manager)

Add `https://github.com/devmithunnath/oopsi` (package root: `swift/`) in Xcode or `Package.swift`.

## Products

- **`OopsiClient`**: `OopsiClient`, `OopsiCreateTicketRequest`, `OopsiAttachmentUpload`, `OopsiSystemInfo`, and `DiagnosticsRedactor`.
- **`OopsiUI`**: Ready-to-present SwiftUI `OopsiSupportSheet`.

## Privacy-First Diagnostics

`DiagnosticsRedactor.redact(_:)` automatically scrubs `/Users/<name>/`, `/home/<name>/`, `Bearer` tokens, common API keys (`sk_`, `dodo_`, `whsec_`, `re_`), and formatted license keys (`XXXX-XXXX-XXXX-XXXX`) before sending any diagnostic log.
