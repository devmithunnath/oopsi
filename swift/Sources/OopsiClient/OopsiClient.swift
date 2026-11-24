import Foundation

public struct OopsiClient: Sendable {
    public let baseURL: URL
    private let session: URLSession

    public init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    public func submitTicket(_ request: OopsiCreateTicketRequest) async throws -> OopsiCreateTicketResponse {
        let endpoint = baseURL.appendingPathComponent("api/tickets")
        var urlRequest = URLRequest(url: endpoint)
        urlRequest.httpMethod = "POST"
        urlRequest.timeoutInterval = 30

        if let attachment = request.attachment {
            let boundary = "OopsiBoundary-\(UUID().uuidString)"
            urlRequest.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
            urlRequest.httpBody = buildMultipartBody(request: request, attachment: attachment, boundary: boundary)
        } else {
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let payload = JSONTicketPayload(
                name: request.name,
                email: request.email,
                category: request.category,
                source: request.source,
                subject: request.subject,
                message: request.message,
                metadata: request.metadata
            )
            urlRequest.httpBody = try JSONEncoder().encode(payload)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: urlRequest)
        } catch let urlError as URLError where urlError.code == .notConnectedToInternet || urlError.code == .networkConnectionLost || urlError.code == .cannotFindHost {
            throw OopsiClientError.offline
        }

        guard let http = response as? HTTPURLResponse else {
            throw OopsiClientError.invalidResponse
        }

        if (200..<300).contains(http.statusCode) {
            return try JSONDecoder().decode(OopsiCreateTicketResponse.self, from: data)
        }

        let errBody = try? JSONDecoder().decode(APIErrorBody.self, from: data)
        throw OopsiClientError.serverError(
            status: http.statusCode,
            message: errBody?.error ?? "Support server returned HTTP \(http.statusCode)."
        )
    }

    private func buildMultipartBody(
        request: OopsiCreateTicketRequest,
        attachment: OopsiAttachmentUpload,
        boundary: String
    ) -> Data {
        var body = Data()
        func appendField(_ name: String, _ value: String) {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }

        if let name = request.name, !name.isEmpty { appendField("name", name) }
        appendField("email", request.email)
        appendField("category", request.category)
        appendField("source", request.source)
        appendField("subject", request.subject)
        appendField("message", request.message)

        if !request.metadata.isEmpty,
           let metaData = try? JSONEncoder().encode(request.metadata),
           let metaString = String(data: metaData, encoding: .utf8) {
            appendField("metadata", metaString)
        }

        let safeName = attachment.filename.replacingOccurrences(of: "\"", with: "_")
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"attachment\"; filename=\"\(safeName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(attachment.contentType)\r\n\r\n".data(using: .utf8)!)
        body.append(attachment.data)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        return body
    }
}

private struct JSONTicketPayload: Encodable {
    let name: String?
    let email: String
    let category: String
    let source: String
    let subject: String
    let message: String
    let metadata: [String: String]
}

private struct APIErrorBody: Decodable {
    let error: String?
}
