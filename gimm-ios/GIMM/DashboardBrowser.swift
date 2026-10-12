import Combine
import SwiftUI
import WebKit
import UIKit

@MainActor
final class DashboardBrowser: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    static let home = URL(string: "https://dashboard.gimmholding.com/dashboard")!
    @Published var loading = false
    @Published var canGoBack = false
    @Published var currentURL = DashboardBrowser.home
    @Published var errorMessage: String?
    let webView: WKWebView
    private let refreshControl = UIRefreshControl()
    private var observations: [NSKeyValueObservation] = []

    override init() {
        let configuration = WKWebViewConfiguration()
        // Keep the existing signed HttpOnly login cookie in WebKit's persistent store.
        configuration.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.055, green: 0.063, blue: 0.086, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.allowsBackForwardNavigationGestures = true
        refreshControl.addTarget(self, action: #selector(refresh), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl
        observations = [
            webView.observe(\.canGoBack, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in self?.canGoBack = view.canGoBack }
            },
            webView.observe(\.url, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in self?.currentURL = view.url ?? Self.home }
            }
        ]
        webView.load(URLRequest(url: Self.home))
    }

    @objc private func refresh() { reload() }
    func reload() {
        errorMessage = nil
        if webView.url == nil { webView.load(URLRequest(url: Self.home)) }
        else { webView.reload() }
    }
    func goBack() { if webView.canGoBack { webView.goBack() } }
    func openInSafari() { UIApplication.shared.open(currentURL) }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        // Only the dashboard runs within the app; external HTTPS links open in Safari.
        if url.scheme == "https", url.host == Self.home.host, url.user == nil, url.password == nil, url.port == nil || url.port == 443 {
            if action.shouldPerformDownload {
                errorMessage = "Für den CSV-Export öffne das Dashboard bitte über das Menü in Safari."
                decisionHandler(.cancel)
            } else { decisionHandler(.allow) }
        } else {
            if action.targetFrame?.isMainFrame != false, url.scheme == "https" { UIApplication.shared.open(url) }
            decisionHandler(.cancel)
        }
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, url.scheme == "https" { UIApplication.shared.open(url) }
        return nil
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { loading = true; errorMessage = nil }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { finishLoading() }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { reload() }
    private func finishLoading() { loading = false; refreshControl.endRefreshing() }
    private func failed(_ error: Error) {
        finishLoading()
        if (error as NSError).code != NSURLErrorCancelled { errorMessage = "Prüfe deine Internetverbindung und versuche es erneut." }
    }
}

struct DashboardWebView: UIViewRepresentable {
    @ObservedObject var browser: DashboardBrowser
    func makeUIView(context: Context) -> WKWebView { browser.webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
