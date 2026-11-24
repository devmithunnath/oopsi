import OopsiClient
import SwiftUI

public struct OopsiCategory: Identifiable, Hashable, Sendable {
    public let id: String
    public let label: String

    public init(id: String, label: String) {
        self.id = id
        self.label = label
    }

    public static let defaults: [OopsiCategory] = [
        OopsiCategory(id: "bug", label: "Bug report"),
        OopsiCategory(id: "licensing", label: "License & activation"),
        OopsiCategory(id: "billing", label: "Billing & refunds"),
        OopsiCategory(id: "feature", label: "Feature request"),
        OopsiCategory(id: "other", label: "Other"),
    ]
}

public struct OopsiSupportSheet: View {
    private let client: OopsiClient
    private let appName: String
    private let categories: [OopsiCategory]
    private let webFallbackURL: URL?
    private let diagnosticsProvider: (@Sendable () -> String)?

    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var name = ""
    @State private var email = ""
    @State private var selectedCategory: String
    @State private var subject = ""
    @State private var message = ""
    @State private var includeSystemInfo = true
    @State private var includeDiagnostics = false
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var submitted: OopsiCreateTicketResponse?

    public init(
        client: OopsiClient,
        appName: String,
        categories: [OopsiCategory] = OopsiCategory.defaults,
        webFallbackURL: URL? = nil,
        diagnosticsProvider: (@Sendable () -> String)? = nil
    ) {
        self.client = client
        self.appName = appName
        self.categories = categories
        self.webFallbackURL = webFallbackURL
        self.diagnosticsProvider = diagnosticsProvider
        self._selectedCategory = State(initialValue: categories.first?.id ?? "bug")
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Contact \(appName) Support")
                        .font(.title3.weight(.bold))
                    Text("Send a bug report, licensing question, or feedback.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("Close") { dismiss() }
                    .keyboardShortcut(.cancelAction)
            }

            Divider()

            if let submitted {
                successView(submitted)
            } else {
                formView
            }
        }
        .padding(22)
        #if os(macOS)
        .frame(minWidth: 500, idealWidth: 540, minHeight: 460)
        #endif
    }

    private var formView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Your Name").font(.caption.weight(.semibold))
                        TextField("Optional", text: $name)
                            .textFieldStyle(.roundedBorder)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Email *").font(.caption.weight(.semibold))
                        TextField("you@example.com", text: $email)
                            .textFieldStyle(.roundedBorder)
                    }
                }

                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Category").font(.caption.weight(.semibold))
                        Picker("Category", selection: $selectedCategory) {
                            ForEach(categories) { cat in
                                Text(cat.label).tag(cat.id)
                            }
                        }
                        .labelsHidden()
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Subject *").font(.caption.weight(.semibold))
                        TextField("Short summary", text: $subject)
                            .textFieldStyle(.roundedBorder)
                    }
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Details *").font(.caption.weight(.semibold))
                    TextEditor(text: $message)
                        .font(.body)
                        .frame(minHeight: 115)
                        .padding(6)
                        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.25)))
                }

                Toggle("Include basic system info (app version, OS version, chip)", isOn: $includeSystemInfo)
                    .font(.callout)

                if diagnosticsProvider != nil {
                    Toggle("Attach redacted diagnostic summary (no media, transcripts, or keys)", isOn: $includeDiagnostics)
                        .font(.callout)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.callout)
                        .foregroundStyle(.red)
                }

                HStack {
                    if let webFallbackURL {
                        Button("Open Web Help Center") { openURL(webFallbackURL) }
                            .buttonStyle(.link)
                    }
                    Spacer()
                    Button(isSubmitting ? "Sending…" : "Send Support Request") {
                        Task { await submit() }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isSubmitting || email.trimmingCharacters(in: .whitespaces).isEmpty || subject.trimmingCharacters(in: .whitespaces).isEmpty || message.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(.top, 4)
            }
        }
    }

    private func successView(_ res: OopsiCreateTicketResponse) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("Support Request Sent", systemImage: "checkmark.circle.fill")
                .font(.headline)
                .foregroundStyle(.green)

            Text("Ticket reference: **\(res.ticketCode)**")
                .font(.body)

            Text("We’ve received your request and will follow up shortly. You can also view status or reply anytime in your browser.")
                .font(.callout)
                .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                if let url = URL(string: res.ticketURL) {
                    Button("View Ticket Online") { openURL(url) }
                        .buttonStyle(.borderedProminent)
                }
                Button("Done") { dismiss() }
            }
        }
        .padding(.vertical, 8)
    }

    private func submit() async {
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        let metadata = includeSystemInfo ? OopsiSystemInfo.basicMetadata(appName: appName) : [:]
        var attachment: OopsiAttachmentUpload?
        if includeDiagnostics, let provider = diagnosticsProvider {
            let redacted = DiagnosticsRedactor.redact(provider())
            if let data = redacted.data(using: .utf8), !data.isEmpty {
                attachment = OopsiAttachmentUpload(
                    filename: "\(appName.lowercased())-diagnostics-redacted.txt",
                    contentType: "text/plain",
                    data: data
                )
            }
        }

        do {
            let response = try await client.submitTicket(
                OopsiCreateTicketRequest(
                    name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                    email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                    category: selectedCategory,
                    subject: subject.trimmingCharacters(in: .whitespacesAndNewlines),
                    message: message.trimmingCharacters(in: .whitespacesAndNewlines),
                    metadata: metadata,
                    attachment: attachment
                )
            )
            submitted = response
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
