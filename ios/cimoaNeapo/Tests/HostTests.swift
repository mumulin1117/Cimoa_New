import XCTest
import WebKit
@testable import cimoaNeapo

@MainActor
final class HostTests: XCTestCase {
    private func host() async throws -> WebViewController {
        for _ in 0..<100 {
            if let host = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).flatMap({ $0.windows }).compactMap({ $0.rootViewController as? WebViewController }).first, host.webView != nil, !host.webView.isLoading, host.isTrustedURL(host.webView.url) {
                // Poll from XCTest: a promise created in about:blank is destroyed
                // by the initial document navigation, before Vue can mount.
                let ready = try? await script(host, "return !!document.querySelector('.home-header,.profile-header,.discover-header,.events-header')")
                if ready as? Bool == true { return host }
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        throw NSError(domain: "CimoaTests", code: 1, userInfo: [NSLocalizedDescriptionKey: "Native host was not ready."])
    }
    private func script(_ host: WebViewController, _ body: String) async throws -> Any {
        try await host.webView.callAsyncJavaScript(body, arguments: [:], in: nil, contentWorld: .page) ?? NSNull()
    }
    private func home(_ host: WebViewController) async throws {
        _ = try await script(host, "location.hash = '#/pages/home/index'; await new Promise((resolve,reject) => { let tries=0; const t=setInterval(() => { const el=document.querySelector('.home-header'); if(el && el.getBoundingClientRect().height>0) {clearInterval(t);resolve(true)} else if(++tries>100) {clearInterval(t);reject(Error('Home unavailable'))}},50)}); return true")
    }
    func testBundledH5AndMeasuredSafeAreas() async throws {
        let host = try await host(); try await home(host); host.publishSafeArea()
        let result = try await script(host, "await document.fonts.ready; await new Promise(r=>setTimeout(r,300)); const frame=document.querySelector('.main-tab-frame'); const bar=document.querySelector('.tabbar').getBoundingClientRect(); return {origin:location.origin,title:document.title,top:frame.querySelector('.safe-area').getBoundingClientRect().height,bottom:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-bottom')),images:[...frame.querySelectorAll('img')].filter(i=>i.src.includes('/static/')).every(i=>i.complete&&i.naturalWidth>0),barBottom:bar.bottom,height:innerHeight,secure:isSecureContext}") as! [String: Any]
        XCTAssertEqual(result["origin"] as? String, BundleHTTPServer.origin)
        XCTAssertEqual(result["title"] as? String, "Cimoa")
        XCTAssertEqual(result["top"] as! Double, Double(host.view.safeAreaInsets.top), accuracy: 1)
        XCTAssertEqual(result["bottom"] as! Double, Double(host.view.safeAreaInsets.bottom), accuracy: 1)
        XCTAssertEqual(result["images"] as? Bool, true); XCTAssertEqual(result["secure"] as? Bool, true)
        XCTAssertLessThan(result["barBottom"] as! Double, (result["height"] as! Double) - Double(host.view.safeAreaInsets.bottom))
        XCTAssertFalse(host.webView.allowsBackForwardNavigationGestures)
        let metrics = XCTAttachment(string: String(data: try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]), encoding: .utf8)!)
        metrics.name = "Native safe area and H5 geometry"; metrics.lifetime = .keepAlways; add(metrics)
        let image = try await host.webView.takeSnapshot(configuration: nil)
        let attachment = XCTAttachment(image: image); attachment.name = "WKWebView Home with measured insets"; attachment.lifetime = .keepAlways; add(attachment)
        print("CIMOA_NATIVE_SAFE_AREA top=\(host.view.safeAreaInsets.top) bottom=\(host.view.safeAreaInsets.bottom)")
    }
    func testNativeRequestReplyAndFailureBoundaries() async throws {
        let host = try await host()
        let result = try await script(host, "const before=localStorage.getItem('cimoa_app_state_v2');const env=await window.CimoaNativeBridge.request('getEnvironment'); const safe=await window.CimoaNativeBridge.request('getSafeArea'); let denied=false;try{await window.webkit.messageHandlers.CimoaHost.postMessage({version:1,request_id:'invalid-method',method:'arbitraryExecution'})}catch{denied=true};let malformed=false;try{await window.webkit.messageHandlers.CimoaHost.postMessage({version:99,request_id:'bad-version',method:'getEnvironment'})}catch{malformed=true};return {env,safe,denied,malformed,unchanged:before===localStorage.getItem('cimoa_app_state_v2')}") as! [String: Any]
        let env = result["env"] as! [String: Any]
        XCTAssertEqual(env["project"] as? String, "cimoaNeapo"); XCTAssertEqual(env["bundle_id"] as? String, "com.cimoa.neapo.dev")
        XCTAssertEqual(env["purchases_available"] as? Bool, false)
        XCTAssertEqual(result["denied"] as? Bool, true); XCTAssertEqual(result["malformed"] as? Bool, true); XCTAssertEqual(result["unchanged"] as? Bool, true)
        let safe = result["safe"] as! [String: Any]
        XCTAssertEqual(safe["top"] as! Double, Double(host.view.safeAreaInsets.top), accuracy: 1)
        // Probe only the callback envelope; never call a Store success action.
        let purchase = try await script(host, "const original=window.CimoaPurchaseBridge;try{return await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('No purchase failure callback')),4000);window.CimoaPurchaseBridge={resolve:(id,result)=>{clearTimeout(t);resolve({id,status:result.status,product:result.product_id})}};window.webkit.messageHandlers.CimoaPurchase.postMessage({request_id:'native-failure-probe',package_id:'pkg_60',owner_user_id:'user_cimoa',product_id:null})})}finally{window.CimoaPurchaseBridge=original}") as! [String: Any]
        XCTAssertEqual(purchase["id"] as? String, "native-failure-probe"); XCTAssertEqual(purchase["status"] as? String, "failure")
    }
    func testProfilePushPopAndMainTabsInRealWebKit() async throws {
        let host = try await host(); try await home(host)
        let result = try await script(host, "const delay=()=>new Promise(r=>setTimeout(r,400));const before=localStorage.getItem('cimoa_app_state_v2');const checks=[]; for(const label of ['Home','Discover','Events']){document.querySelector('.tab[aria-label='+label+']').click();await delay();const main=[...document.querySelectorAll('.main-tab-frame')].find(e=>e.getBoundingClientRect().height>0);main.querySelector('[data-target=\"/pages/profile/index\"]').click();await delay();const profile=document.querySelector('.secondary-page-frame');checks.push(profile?.dataset.pageDepth==='2'&&!!profile.querySelector('.profile-name'));profile.querySelector('[data-interaction=\"profile.goBack.click.1\"]').click();await delay();checks.push(document.querySelector('.tab[aria-current=page]')?.getAttribute('aria-label')===label)}return {checks,unchanged:before===localStorage.getItem('cimoa_app_state_v2')}") as! [String: Any]
        XCTAssertEqual(result["checks"] as? [Bool], [true,true,true,true,true,true]); XCTAssertEqual(result["unchanged"] as? Bool, true)
        try await home(host)
    }
    func testWebKitPersistenceAndReadOnlyTransport() async throws {
        let host = try await host()
        _ = try await script(host, """
        await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('cimoa_native_probe');r.onsuccess=resolve;r.onerror=()=>reject(r.error)});
        localStorage.setItem('cimoa_native_probe','retained');
        const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_native_probe',1);r.onupgradeneeded=()=>r.result.createObjectStore('media');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
        await new Promise((resolve,reject)=>{const t=db.transaction('media','readwrite');t.objectStore('media').put(new Blob(['real native blob'],{type:'text/plain'}),'probe');t.oncomplete=resolve;t.onerror=()=>reject(t.error)});
        db.close();window.__cimoaPreviousDocument=true;return true
        """)
        host.webView.reload()
        var reloaded = false
        for _ in 0..<100 {
            let ready = try? await script(host, "return !window.__cimoaPreviousDocument && !!document.querySelector('.home-header')")
            if ready as? Bool == true { reloaded = true; break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertTrue(reloaded, "A new H5 document must finish mounting before reading persisted data.")
        let result = try await script(host, """
        const retained=localStorage.getItem('cimoa_native_probe');localStorage.removeItem('cimoa_native_probe');
        const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_native_probe',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
        const blob=await new Promise((resolve,reject)=>{const r=db.transaction('media').objectStore('media').get('probe');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
        const text=await blob.text();db.close();
        await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('cimoa_native_probe');r.onsuccess=resolve;r.onerror=()=>reject(r.error)});
        const post=await fetch('/index.html',{method:'POST'});const missing=await fetch('/not-in-the-bundle.swift');
        return {retained,blob:text,post:post.status,missing:missing.status}
        """) as! [String: Any]
        XCTAssertEqual(result["retained"] as? String, "retained"); XCTAssertEqual(result["blob"] as? String, "real native blob")
        XCTAssertEqual(result["post"] as? Int, 405); XCTAssertEqual(result["missing"] as? Int, 404)
        XCTAssertFalse(host.isTrustedURL(URL(string: "https://example.com")))
        XCTAssertFalse(host.isTrustedURL(URL(string: "http://127.0.0.1:5173")))
    }
}
