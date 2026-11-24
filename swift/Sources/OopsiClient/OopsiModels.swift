import Foundation

public struct OopsiAttachmentUpload: Sendable {
    public let filename: String
    public let contentType: String
    public let data: Data

    public init(filename: String, contentType: String = "text/plain", data: Data) {
        self.filename = filename
        self.contentType = contentType
        self.data = data
    }
}

public struct OopsiCreateTicketRequest: Sendable {
    public let name: String?
    public let email: String
    public let category: String
    public let source: String
    public let subject: String
    public let message: String
    public let metadata: [String: String]
    public let attachment: OopsiAttachmentUpload?

    public init(
        name: String? = nil,
        email: String,
        category: String = "bug",
        source: String = OopsiSystemInfo.defaultSource,
        subject: String,
        message: String,
        metadata: [String: String] = [:],
        attachment: OopsiAttachmentUpload? = nil
    ) {
        self.name = name
        self.email = email
        self.category = category
        self.source = source
        self.subject = subject
        self.message = message
        self.metadata = metadata
        self.attachment = attachment
    }
}

public struct OopsiAttachmentInfo: Codable, Sendable, Equatable, Identifiable {
    public let id: String
    public let messageId: Int
    public let filename: String
    public let contentType: String
    public let sizeBytes: Int
    public let downloadURL: String
    public let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case messageId = "message_id"
        case filename
        case contentType = "content_type"
        case sizeBytes = "size_bytes"
        case downloadURL = "download_url"
        case createdAt = "created_at"
    }
}

public struct OopsiCreateTicketResponse: Codable, Sendable, Equatable {
    public let ticketCode: String
    public let accessToken: String
    public let ticketURL: String
    public let status: String
    public let attachments: [OopsiAttachmentInfo]?

    enum CodingKeys: String, CodingKey {
        case ticketCode = "ticket_code"
        case accessToken = "access_token"
        case ticketURL = "ticket_url"
        case status
        case attachments
    }
}

public enum OopsiClientError: LocalizedError, Sendable, Equatable {
    case invalidResponse
    case serverError(status: Int, message: String)
    case offline

    public var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "The support server returned an unexpected response."
        case .serverError(_, let message):
            return message
        case .offline:
            return "You appear to be offline. Connect to the internet or submit your request on the web when back online."
        }
    }
}

public enum OopsiSystemInfo {
    public static var defaultSource: String {
        #if os(macOS)
        return "macos"
        #elseif os(iOS)
        return "ios"
        #else
        return "apple"
        #endif
    }

    public static func basicMetadata(appName: String? = nil) -> [String: String] {
        var meta: [String: String] = [:]
        let info = Bundle.main.infoDictionary
        if let version = info?["CFBundleShortVersionString"] as? String {
            meta["app_version"] = version
        }
        if let build = info?["CFBundleVersion"] as? String {
            meta["app_build"] = build
        }
        if let appName, !appName.isEmpty {
            meta["app"] = appName
        }
        let os = ProcessInfo.processInfo.operatingSystemVersion
        #if os(macOS)
        meta["os"] = "macOS \(os.majorVersion).\(os.minorVersion).\(os.patchVersion)"
        #elseif os(iOS)
        meta["os"] = "iOS \(os.majorVersion).\(os.minorVersion).\(os.patchVersion)"
        #endif
        #if arch(arm64)
        meta["arch"] = "arm64"
        #elseif arch(x86_64)
        meta["arch"] = "x86_64"
        #endif
        return meta
    }
}
