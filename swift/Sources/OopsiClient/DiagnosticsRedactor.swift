import Foundation

/// Scrubs personal paths, API tokens, bearer headers, and license keys before diagnostic logs leave a device.
public enum DiagnosticsRedactor {
    private static let patterns: [(pattern: String, replacement: String)] = [
        // macOS / Linux home directory usernames
        (#"/Users/[^/\s"'`]+"#, "/Users/<redacted>"),
        (#"/home/[^/\s"'`]+"#, "/home/<redacted>"),
        // Authorization headers
        (#"(?i)(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}"#, "$1<redacted>"),
        // Common provider API keys & webhook secrets
        (#"\b(sk|pk|rk|whsec|dodo|re|ghp|gho|pat)_[A-Za-z0-9_-]{8,}\b"#, "$1_<redacted>"),
        // Formatted product license keys (e.g. UGLI-ABCD-1234-EFGH)
        (#"\b[A-Z0-9]{3,6}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\b"#, "<redacted-license-key>"),
        // Key-value secret fields in JSON or logs
        (#"(?i)("?(?:license_key|api_key|token|secret|password)"?\s*[:=]\s*"?)[^"\s,}\]]+"#, "$1<redacted>"),
    ]

    public static func redact(_ input: String) -> String {
        var result = input
        for (pattern, replacement) in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: []) {
                let range = NSRange(result.startIndex..<result.endIndex, in: result)
                result = regex.stringByReplacingMatches(in: result, options: [], range: range, withTemplate: replacement)
            }
        }
        return result
    }
}
