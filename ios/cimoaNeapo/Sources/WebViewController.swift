import UIKit
import WebKit

final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private(set) var webView: WKWebView!
    private var server: BundleHTTPServer?
    private let bridge = ScriptBridge()
    private let errorPanel = UIStackView()
    private let errorLabel = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = themeColor("page", "background")
        let content = WKUserContentController()
        bridge.owner = self
        content.add(bridge, name: "CommonTemplateSafeArea")
        content.add(bridge, name: "CimoaPurchase")
        content.addScriptMessageHandler(bridge, contentWorld: .page, name: "CimoaHost")
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = content
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        // H5 owns its route stack. Native swipe navigation must not pop a second time.
        webView.allowsBackForwardNavigationGestures = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.translatesAutoresizingMaskIntoConstraints = false
        #if DEBUG
        webView.isInspectable = true
        #endif
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor), webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor), webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        configureErrorPanel()
        startContent()
    }
    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }
    override func viewSafeAreaInsetsDidChange() { super.viewSafeAreaInsetsDidChange(); publishSafeArea() }
    override func viewDidLayoutSubviews() { super.viewDidLayoutSubviews(); publishSafeArea() }

    @objc private func startContent() {
        errorPanel.isHidden = true
        guard let root = Bundle.main.url(forResource: "H5", withExtension: nil), FileManager.default.fileExists(atPath: root.appendingPathComponent("index.html").path) else {
            showError("Bundled H5 is missing. Run the project’s H5 build and rebuild this app."); return
        }
        if server != nil { loadContent(); return }
        let server = BundleHTTPServer(root: root)
        self.server = server
        server.start { [weak self] result in
            switch result {
            case .success: self?.loadContent()
            case .failure:
                self?.server?.stop(); self?.server = nil
                self?.showError("The local app content could not start. Please retry. Your saved data has not been changed.")
            }
        }
    }
    private func loadContent() {
        webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html#/pages/auth/splash")!))
    }
    func publishSafeArea() {
        guard isViewLoaded, webView != nil, isTrustedURL(webView.url) else { return }
        let insets = view.safeAreaInsets
        webView.callAsyncJavaScript("window.CommonTemplateSafeAreaBridge?.update({top, bottom})", arguments: ["top": insets.top, "bottom": insets.bottom], in: nil, in: .page, completionHandler: nil)
    }
    func isTrustedURL(_ url: URL?) -> Bool {
        url?.scheme == "http" && url?.host == "127.0.0.1" && url?.port == Int(BundleHTTPServer.port)
    }
    func isTrustedMessage(_ message: WKScriptMessage) -> Bool {
        message.frameInfo.isMainFrame && isTrustedURL(message.frameInfo.request.url) && isTrustedURL(webView.url)
    }
    func handle(_ message: WKScriptMessage) {
        guard isTrustedMessage(message) else { return }
        if message.name == "CommonTemplateSafeArea", message.body as? String == "getSafeAreaInsets" { publishSafeArea(); return }
        guard message.name == "CimoaPurchase", let payload = message.body as? [String: Any],
              let id = payload["request_id"] as? String, !id.isEmpty, id.count <= 128,
              payload["package_id"] is String, payload["owner_user_id"] is String else { return }
        // No product IDs or StoreKit receipt-verification service were supplied. Never mint coins.
        let result: [String: Any] = ["request_id": id, "package_id": payload["package_id"]!, "owner_user_id": payload["owner_user_id"]!, "product_id": payload["product_id"] ?? NSNull(), "status": "failure", "message": "App Store purchases are not configured for this local build. Your balance has not changed."]
        webView.callAsyncJavaScript("window.CimoaPurchaseBridge?.resolve(requestID, result)", arguments: ["requestID": id, "result": result], in: nil, in: .page, completionHandler: nil)
    }
    func handle(_ message: WKScriptMessage, reply: @escaping (Any?, String?) -> Void) {
        guard isTrustedMessage(message), let payload = message.body as? [String: Any], payload["version"] as? Int == 1,
              let id = payload["request_id"] as? String, !id.isEmpty, id.count <= 128,
              let method = payload["method"] as? String else { reply(nil, "Invalid or untrusted native bridge request."); return }
        let result: [String: Any]
        switch method {
        case "openSettings":
            guard let url = URL(string: UIApplication.openSettingsURLString) else { reply(nil, "Settings are unavailable."); return }
            UIApplication.shared.open(url, options: [:]) { opened in
                reply(["version": 1, "request_id": id, "success": true, "result": ["opened": opened]], nil)
            }
            return
        case "getEnvironment":
            result = ["platform": "ios", "project": "cimoaNeapo", "bundle_id": Bundle.main.bundleIdentifier ?? "", "system_version": UIDevice.current.systemVersion, "content_source": "bundled-h5", "native_back_gesture": false, "purchases_available": false]
        case "getSafeArea":
            result = ["top": view.safeAreaInsets.top, "bottom": view.safeAreaInsets.bottom, "left": view.safeAreaInsets.left, "right": view.safeAreaInsets.right]
        default: reply(nil, "Unsupported native bridge method."); return
        }
        reply(["version": 1, "request_id": id, "success": true, "result": result], nil)
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(action.targetFrame?.isMainFrame == true && isTrustedURL(action.request.url) ? .allow : .cancel)
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { errorPanel.isHidden = true; publishSafeArea() }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { handleLoadError(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { handleLoadError(error) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { showError("The app view stopped unexpectedly. Retry to restore your saved data.") }
    private func handleLoadError(_ error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { showError("The app view could not load. Please retry. Your saved data has not been changed.") }
    }
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(frame.isMainFrame && isTrustedURL(frame.request.url) ? .prompt : .deny)
    }
    private func themeColor(_ section: String, _ key: String) -> UIColor {
        guard let url = Bundle.main.url(forResource: "theme", withExtension: "json"), let data = try? Data(contentsOf: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let colors = json["colors"] as? [String: [String: Any]], let hex = colors[section]?[key] as? String,
              hex.hasPrefix("#"), let value = UInt32(hex.dropFirst(), radix: 16) else { return section == "text" ? .label : .systemBackground }
        return UIColor(red: CGFloat((value >> 16) & 255) / 255, green: CGFloat((value >> 8) & 255) / 255, blue: CGFloat(value & 255) / 255, alpha: 1)
    }
    private func configureErrorPanel() {
        errorPanel.axis = .vertical; errorPanel.spacing = 20; errorPanel.alignment = .center
        errorPanel.translatesAutoresizingMaskIntoConstraints = false
        errorLabel.numberOfLines = 0; errorLabel.textAlignment = .center
        errorLabel.textColor = themeColor("text", "title")
        let retry = UIButton(type: .system)
        retry.setTitle("Retry", for: .normal); retry.tintColor = themeColor("text", "link")
        retry.addTarget(self, action: #selector(startContent), for: .touchUpInside)
        errorPanel.addArrangedSubview(errorLabel); errorPanel.addArrangedSubview(retry)
        view.addSubview(errorPanel)
        NSLayoutConstraint.activate([errorPanel.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 24), errorPanel.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -24), errorPanel.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor)])
        errorPanel.isHidden = true
    }
    private func showError(_ message: String) { errorLabel.text = message; errorPanel.backgroundColor = view.backgroundColor; errorPanel.isHidden = false }
    deinit {
        server?.stop()
        webView?.configuration.userContentController.removeAllScriptMessageHandlers()
    }
}

private final class ScriptBridge: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    weak var owner: WebViewController?
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) { owner?.handle(message) }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard let owner else { replyHandler(nil, "Native host is unavailable."); return }
        owner.handle(message, reply: replyHandler)
    }
}
