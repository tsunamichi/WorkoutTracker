import SwiftUI
import WebKit
import Observation

/// Canonical parsing for the YouTube URL formats we accept in Exercise Details.
/// Persisting an ID, instead of an arbitrary URL, keeps references stable and
/// prevents display code from ever loading a user-provided host.
enum YouTubeVideoReference: Equatable, Sendable {
    static func videoID(from rawValue: String) -> String? {
        let value = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let components = URLComponents(string: value),
              let host = components.host?.lowercased() else { return nil }

        let acceptedHosts = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]
        let candidate: String?
        if host == "youtu.be" || host == "www.youtu.be" {
            candidate = components.path.split(separator: "/").first.map(String.init)
        } else if acceptedHosts.contains(host) {
            let path = components.path.split(separator: "/").map(String.init)
            switch path.first {
            case "watch": candidate = components.queryItems?.first(where: { $0.name == "v" })?.value
            case "shorts", "embed", "live": candidate = path.dropFirst().first
            default: candidate = nil
            }
        } else {
            candidate = nil
        }

        guard let candidate,
              candidate.range(of: "^[A-Za-z0-9_-]{11}$", options: .regularExpression) != nil else { return nil }
        return candidate
    }

    static func watchURL(videoID: String) -> URL {
        URL(string: "https://www.youtube.com/watch?v=\(videoID)")!
    }
}

private struct ExerciseDetailsValue: Equatable {
    var notes: String?
    var videoID: String?

    init(notes: String?, videoID: String?) {
        self.notes = Self.normalizedNotes(notes)
        self.videoID = videoID
    }

    static func normalizedNotes(_ value: String?) -> String? {
        let result = value?.trimmingCharacters(in: .whitespacesAndNewlines)
        return result?.isEmpty == false ? result : nil
    }

    var isEmpty: Bool { notes == nil && videoID == nil }
}

/// Read-only Details page inside the established Exercise Settings route stack.
struct ExerciseDetailsContent: View {
    let exerciseID: ExerciseID
    let exerciseName: String
    let repository: any ExerciseRepository
    let onEditNotes: () -> Void
    let onEditVideo: () -> Void
    @State private var value = ExerciseDetailsValue(notes: nil, videoID: nil)
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var videoCannotEmbed = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: EQSpacing.lg) {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch)
                } else if let loadError {
                    ContentUnavailableView("Details unavailable", systemImage: "exclamationmark.triangle", description: Text(loadError))
                        .frame(maxWidth: .infinity, alignment: .top)
                } else {
                    notesSection
                    Divider().overlay(EQColor.Execution.foregroundSecondaryText.opacity(0.2))
                    videoSection
                }
            }
            .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
            .padding(.top, EQLayout.ExerciseOptions.headerToContentSpacing - EQSpacing.xs)
            .padding(.bottom, EQLayout.ExerciseOptions.bottomInset)
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollIndicators(.hidden)
        .task(id: exerciseID) { await load() }
        .accessibilityIdentifier("exercise-details-\(exerciseID.rawValue)")
    }

    private var notesSection: some View {
        section("Notes", edit: onEditNotes) {
            if let notes = value.notes {
                Text(notes)
                    .eqTextStyle(.body)
                    .foregroundStyle(EQColor.Execution.foregroundText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            } else {
                Text("No notes added")
                    .eqTextStyle(.secondaryBody)
                    .foregroundStyle(EQColor.Execution.foregroundSecondaryText)
            }
        }
    }

    private var videoSection: some View {
        section("Video", edit: onEditVideo) {
            if let videoID = value.videoID {
                if videoCannotEmbed {
                    VStack(alignment: .leading, spacing: EQSpacing.sm) {
                        Label("This video can’t play here.", systemImage: "play.slash")
                            .eqTextStyle(.body)
                        Link("Watch on YouTube", destination: YouTubeVideoReference.watchURL(videoID: videoID))
                            .eqTextStyle(.secondaryBody)
                    }
                    .frame(maxWidth: .infinity, minHeight: 120, alignment: .leading)
                    .eqGroupedCard(fill: EQColor.surfaceHighlightDark)
                } else {
                    YouTubeEmbeddedPlayer(videoID: videoID) {
                        videoCannotEmbed = true
                    }
                    .aspectRatio(16 / 9, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: EQRadius.button, style: .continuous))
                }
            } else {
                Text("No video added")
                    .eqTextStyle(.secondaryBody)
                    .foregroundStyle(EQColor.Execution.foregroundSecondaryText)
            }
        }
    }

    private func section<Content: View>(
        _ title: String,
        edit: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: EQSpacing.sm) {
            HStack(spacing: EQLayout.controlGap) {
                Text(title)
                    .eqTextStyle(.sectionLabel)
                    .foregroundStyle(EQColor.Execution.foregroundSecondaryText)
                Spacer(minLength: EQLayout.controlGap)
                EQIconButton(systemImage: "pencil", alignment: .trailing, action: edit)
                    .foregroundStyle(EQColor.Execution.foregroundText)
                    .accessibilityLabel("Edit \(title.lowercased())")
            }
            .frame(minHeight: EQLayout.minimumTouch)
            content()
        }
    }

    @MainActor
    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            guard let definition = try await repository.exercise(id: exerciseID) else {
                loadError = "This exercise is no longer available."
                return
            }
            value = .init(notes: definition.notes, videoID: definition.youtubeVideoID)
            videoCannotEmbed = false
            loadError = nil
        } catch {
            loadError = "Try again after checking your connection."
        }
    }

}

/// Draft state is presentation-only. Each editor persists its own canonical
/// field as the user changes it, without affecting the other Details field.
@MainActor @Observable
final class ExerciseDetailsEditingPresentation {
    var notes = ""
    var youtubeURL = ""
    var validationMessage: String?
    var isSaving = false
    private var loadedRoute: ExerciseOptionsRoute?
    private var loadedExerciseID: ExerciseID?

    func load(
        route: ExerciseOptionsRoute,
        exerciseID: ExerciseID,
        repository: any ExerciseRepository
    ) async {
        guard loadedRoute != route || loadedExerciseID != exerciseID else { return }
        do {
            guard let definition = try await repository.exercise(id: exerciseID) else {
                validationMessage = "This exercise is no longer available."
                return
            }
            switch route {
            case .editNotes:
                notes = definition.notes ?? ""
            case .editVideo:
                youtubeURL = definition.youtubeVideoID.map {
                    YouTubeVideoReference.watchURL(videoID: $0).absoluteString
                } ?? ""
            default:
                return
            }
            validationMessage = nil
            loadedRoute = route
            loadedExerciseID = exerciseID
        } catch {
            validationMessage = "Try again after checking your connection."
        }
    }

    func discard() {
        validationMessage = nil
        isSaving = false
        loadedRoute = nil
        loadedExerciseID = nil
    }

    func persist(
        route: ExerciseOptionsRoute,
        exerciseID: ExerciseID,
        repository: any ExerciseRepository
    ) async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }

        do {
            guard var definition = try await repository.exercise(id: exerciseID) else {
                validationMessage = "This exercise is no longer available."
                return false
            }
            switch route {
            case .editNotes:
                definition.notes = ExerciseDetailsValue.normalizedNotes(notes)
            case .editVideo:
                let trimmedURL = youtubeURL.trimmingCharacters(in: .whitespacesAndNewlines)
                if trimmedURL.isEmpty {
                    definition.youtubeVideoID = nil
                } else if let videoID = YouTubeVideoReference.videoID(from: trimmedURL) {
                    definition.youtubeVideoID = videoID
                } else {
                    validationMessage = "Enter a valid YouTube video URL."
                    return false
                }
            default:
                return false
            }
            try await repository.saveExercise(definition)
            return true
        } catch {
            validationMessage = "Couldn’t save exercise details."
            return false
        }
    }
}

struct ExerciseNotesEditPage: View {
    let exerciseID: ExerciseID
    let repository: any ExerciseRepository
    @Bindable var editor: ExerciseDetailsEditingPresentation
    @State private var autosaveTask: Task<Void, Never>?

    var body: some View {
        ScrollView {
            TextEditor(text: $editor.notes)
                .eqTextStyle(.body)
                .foregroundStyle(EQColor.Execution.foregroundText)
                .scrollContentBackground(.hidden)
                // Match the import editor's text inset and transparent editor
                // canvas; the card supplies the only visible surface.
                .padding(.horizontal, -5)
                .frame(minHeight: 180, alignment: .topLeading)
                .accessibilityLabel("Exercise notes")
                .padding(.horizontal, EQSpacing.md)
                .padding(.vertical, EQSpacing.xs)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(EQColor.surfaceInput, in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous))
                .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
                .padding(.top, EQLayout.ExerciseOptions.headerToContentSpacing - EQSpacing.xs)
                .padding(.bottom, EQLayout.ExerciseOptions.bottomInset)
        }
        .scrollIndicators(.hidden)
        .task(id: exerciseID) {
            await editor.load(route: .editNotes, exerciseID: exerciseID, repository: repository)
        }
        .onChange(of: editor.notes) { _, _ in scheduleAutosave() }
    }

    private func scheduleAutosave() {
        autosaveTask?.cancel()
        autosaveTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(220))
            guard !Task.isCancelled else { return }
            _ = await editor.persist(route: .editNotes, exerciseID: exerciseID, repository: repository)
        }
    }

}

struct ExerciseVideoEditPage: View {
    let exerciseID: ExerciseID
    let repository: any ExerciseRepository
    @Bindable var editor: ExerciseDetailsEditingPresentation
    @State private var autosaveTask: Task<Void, Never>?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: EQSpacing.sm) {
                Text("YouTube URL")
                    .eqTextStyle(.sectionLabel)
                    .foregroundStyle(EQColor.Execution.foregroundSecondaryText)
                TextField("YouTube URL", text: $editor.youtubeURL, axis: .vertical)
                    .eqTextStyle(.body)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .autocorrectionDisabled()
                    .frame(minHeight: EQLayout.minimumTouch)
                    .accessibilityHint("Paste a standard YouTube, shortened, Shorts, or embed URL")
                    .padding(.horizontal, EQSpacing.md)
                    .padding(.vertical, EQSpacing.xs)
                    .background(EQColor.surfaceInput, in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous))
                if let validationMessage = editor.validationMessage {
                    Text(validationMessage)
                        .eqTextStyle(.caption)
                        .foregroundStyle(EQColor.warning)
                }
            }
            .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
            .padding(.top, EQLayout.ExerciseOptions.headerToContentSpacing - EQSpacing.xs)
            .padding(.bottom, EQLayout.ExerciseOptions.bottomInset)
        }
        .scrollIndicators(.hidden)
        .task(id: exerciseID) {
            await editor.load(route: .editVideo, exerciseID: exerciseID, repository: repository)
        }
        .onChange(of: editor.youtubeURL) { _, _ in scheduleAutosave() }
    }

    private func scheduleAutosave() {
        autosaveTask?.cancel()
        autosaveTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(220))
            guard !Task.isCancelled else { return }
            _ = await editor.persist(route: .editVideo, exerciseID: exerciseID, repository: repository)
        }
    }

}

private struct YouTubeEmbeddedPlayer: UIViewRepresentable {
    let videoID: String
    let onEmbedError: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onEmbedError: onEmbedError) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        configuration.userContentController.add(context.coordinator, name: "youtubeError")
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.loadHTMLString(Self.html(videoID: videoID), baseURL: Self.appBaseURL)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.loadedVideoID != videoID else { return }
        context.coordinator.loadedVideoID = videoID
        webView.loadHTMLString(Self.html(videoID: videoID), baseURL: Self.appBaseURL)
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.evaluateJavaScript("if (window.player) { window.player.stopVideo(); }")
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "youtubeError")
        webView.stopLoading()
    }

    static let appBaseURL = URL(string: "https://equilibrium.app/")!

    static func html(videoID: String) -> String {
        """
        <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#player{margin:0;width:100%;height:100%;background:transparent;overflow:hidden}</style></head><body><div id="player"></div><script src="https://www.youtube.com/iframe_api"></script><script>var player;function onYouTubeIframeAPIReady(){player=new YT.Player('player',{videoId:'\(videoID)',playerVars:{'autoplay':0,'playsinline':1,'enablejsapi':1,'origin':'https://equilibrium.app','widget_referrer':'https://equilibrium.app'},events:{'onError':function(e){window.webkit.messageHandlers.youtubeError.postMessage(e.data)}}});}</script></body></html>
        """
    }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        let onEmbedError: () -> Void
        var loadedVideoID: String?
        init(onEmbedError: @escaping () -> Void) { self.onEmbedError = onEmbedError }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            // YouTube reports unavailable/private/blocked embeds through its IFrame
            // API. Replace the player with an explicit external fallback.
            onEmbedError()
        }
    }
}
