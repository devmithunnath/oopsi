import Foundation
import Testing
@testable import OopsiClient

@Suite("OopsiClient & DiagnosticsRedactor")
struct OopsiClientTests {
    @Test("DiagnosticsRedactor scrubs usernames, API keys, bearer headers, and license keys")
    func redactsSensitiveData() {
        let raw = """
        Path: /Users/alexcreator/Movies/secret.mp4
        Auth: Bearer eyJhbGciOiJIUzI1NiJ9.secretpayload
        Key: sk_live_1234567890abcdef
        Webhook: whsec_abcdef1234567890
        License: UGLI-TEST-H5UJ-0SL8
        """
        let clean = DiagnosticsRedactor.redact(raw)
        #expect(!clean.contains("alexcreator"))
        #expect(!clean.contains("secretpayload"))
        #expect(!clean.contains("1234567890abcdef"))
        #expect(!clean.contains("abcdef1234567890"))
        #expect(!clean.contains("UGLI-TEST-H5UJ-0SL8"))
        #expect(clean.contains("/Users/<redacted>/Movies/secret.mp4"))
        #expect(clean.contains("<redacted-license-key>"))
    }

    @Test("OopsiClient submits JSON and multipart tickets cleanly")
    func submitsTickets() async throws {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        let session = URLSession(configuration: config)

        MockURLProtocol.handler = { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 201,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            let json = """
            {"ticket_code":"UGL-1001","access_token":"tok_1234567890abcdef","ticket_url":"https://ugli.app/support/ticket?t=tok_1234567890abcdef","status":"open"}
            """
            return (response, Data(json.utf8))
        }

        let client = OopsiClient(baseURL: URL(string: "https://support.example.com")!, session: session)
        let res = try await client.submitTicket(
            OopsiCreateTicketRequest(
                name: "Alex",
                email: "alex@example.com",
                category: "bug",
                subject: "Export issue",
                message: "Details here",
                metadata: ["app_version": "1.0.0"],
                attachment: OopsiAttachmentUpload(filename: "diag.txt", data: Data("ok".utf8))
            )
        )
        #expect(res.ticketCode == "UGL-1001")
        #expect(res.status == "open")
    }
}

private final class MockURLProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.unknown))
            return
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
