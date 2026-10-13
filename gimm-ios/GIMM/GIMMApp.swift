import SwiftUI

@main
struct GIMMApp: App {
    var body: some Scene {
        WindowGroup { DashboardView() }
    }
}

struct DashboardView: View {
    @StateObject private var browser = DashboardBrowser()

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.055, green: 0.063, blue: 0.086).ignoresSafeArea()
                DashboardWebView(browser: browser)
                if let message = browser.errorMessage {
                    VStack(spacing: 18) {
                        Image(systemName: "wifi.exclamationmark").font(.largeTitle).foregroundStyle(.purple)
                        Text("Dein Dashboard ist gerade nicht erreichbar.").font(.headline).multilineTextAlignment(.center)
                        Text(message).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
                        Button("Erneut versuchen") { browser.reload() }.buttonStyle(.borderedProminent).tint(.purple)
                    }
                    .padding(32).frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(red: 0.055, green: 0.063, blue: 0.086))
                }
                if browser.loading {
                    VStack { ProgressView().tint(.purple).padding(10).background(.ultraThinMaterial, in: Capsule()); Spacer() }
                        .padding(.top, 8).allowsHitTesting(false)
                }
            }
            .navigationTitle("Gimm Dashboard")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { browser.goBack() } label: { Image(systemName: "chevron.left") }
                        .disabled(!browser.canGoBack).accessibilityLabel("Zurück")
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { browser.reload() } label: { Image(systemName: "arrow.clockwise") }.accessibilityLabel("Dashboard aktualisieren")
                    Menu {
                        Button("In Safari öffnen", systemImage: "safari") { browser.openInSafari() }
                        ShareLink(item: browser.currentURL) { Label("Dashboard-Link teilen", systemImage: "square.and.arrow.up") }
                    } label: { Image(systemName: "ellipsis.circle") }.accessibilityLabel("Weitere Optionen")
                }
            }
        }
        .tint(Color(red: 0.6, green: 0.52, blue: 1))
        .preferredColorScheme(.dark)
    }
}
