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
                let welcome = try? await script(host, "return !!document.querySelector('.welcome-page')")
                if welcome as? Bool == true { try await signIn(host); return host }
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        throw NSError(domain: "CimoaTests", code: 1, userInfo: [NSLocalizedDescriptionKey: "Native host was not ready."])
    }
    private func script(_ host: WebViewController, _ body: String) async throws -> Any {
        try await host.webView.callAsyncJavaScript(body, arguments: [:], in: nil, contentWorld: .page) ?? NSNull()
    }
    private func waitFor(_ host: WebViewController, _ selector: String) async throws {
        for _ in 0..<100 {
            if (try? await script(host, "return !!document.querySelector('\(selector)')")) as? Bool == true { return }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        throw NSError(domain: "CimoaTests", code: 2, userInfo: [NSLocalizedDescriptionKey: "Missing \(selector)"])
    }
    private func signIn(_ host: WebViewController) async throws {
        _ = try await script(host, "document.querySelector('.welcome-login').click(); return true")
        try await waitFor(host, ".login-page input")
        _ = try await script(host, "await new Promise(r=>setTimeout(r,300)); const fields=document.querySelectorAll('.login-page input'); for(const [i,value] of ['cimoa@gmail.com','12341234'].entries()){fields[i].value=value; fields[i].dispatchEvent(new Event('input',{bubbles:true}))} await Promise.resolve();document.querySelector('[data-interaction=\"login.loginNow.click.1\"]').click(); return true")
        try await waitFor(host, ".home-header")
    }
    func testFixedLocalVerificationAndRefresh() async throws {
        let host = try await host()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?verificationProbe=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header")
        }
        do {
            // Alter only the isolated test snapshot, not a production fixture or
            // a public Store bypass. Restore the user's exact bytes afterward.
            _ = try await script(host, "const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2'));const account=envelope.data.accounts.find(a=>a.account_id===envelope.data.session.account_id);delete account.local_verification;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?verificationProbe=code#/pages/auth/verification/code")!))
            try await waitFor(host, ".verification-input input")
            _ = try await script(host, "await Promise.all(document.querySelector('.page-transition').getAnimations().map(a=>a.finished));window.__verificationBefore=localStorage.getItem('cimoa_app_state_v2');const input=document.querySelector('.verification-input input');input.value='000000';input.dispatchEvent(new Event('input',{bubbles:true}));await Promise.resolve();document.querySelector('.verification-submit').click();return true")
            try await waitFor(host, ".loading")
            let unchangedDuringLoading = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')===window.__verificationBefore")
            XCTAssertEqual(unchangedDuringLoading as? Bool, true)
            try await waitFor(host, ".verification-page [role=alert]")
            let wrong = try await script(host, "return {error:document.querySelector('.verification-page [role=alert]').textContent,unchanged:localStorage.getItem('cimoa_app_state_v2')===window.__verificationBefore}") as! [String: Any]
            XCTAssertTrue((wrong["error"] as! String).contains("incorrect")); XCTAssertEqual(wrong["unchanged"] as? Bool, true)
            _ = try await script(host, "const input=document.querySelector('.verification-input input');input.value='009789';input.dispatchEvent(new Event('input',{bubbles:true}));await Promise.resolve();document.querySelector('.verification-submit').click();return true")
            try await waitFor(host, ".verification-success-icon")
            let verified = try await script(host, "await Promise.all(document.querySelector('.verification-success-page .page-transition').getAnimations().map(a=>a.finished));await document.fonts.ready;const a=JSON.parse(window.__verificationBefore).data,b=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;return {verified:b.accounts.find(a=>a.account_id===b.session.account_id).local_verification.status,users:JSON.stringify(a.users)===JSON.stringify(b.users),session:JSON.stringify(a.session)===JSON.stringify(b.session),coins:JSON.stringify(a.coin_transactions)===JSON.stringify(b.coin_transactions),caption:document.querySelector('.verification-success-heading').textContent}") as! [String: Any]
            XCTAssertEqual(verified["verified"] as? String, "verified")
            XCTAssertEqual(verified["users"] as? Bool, true); XCTAssertEqual(verified["session"] as? Bool, true); XCTAssertEqual(verified["coins"] as? Bool, true)
            XCTAssertEqual(verified["caption"] as? String, "Local verification complete")
            let attachment = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil))
            attachment.name = "WKWebView fixed local code success"; attachment.lifetime = .keepAlways; add(attachment)
            let committed = try await script(host, "window.__verificationOldDocument=true;return localStorage.getItem('cimoa_app_state_v2')") as! String
            host.webView.reload()
            var restored = false
            for _ in 0..<100 {
                if (try? await script(host, "return !window.__verificationOldDocument && !!document.querySelector('.verification-success-icon')")) as? Bool == true { restored = true; break }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            XCTAssertTrue(restored)
            let afterRefresh = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
            XCTAssertEqual(afterRefresh, committed)
            _ = try await script(host, "await new Promise(r=>setTimeout(r,300));document.querySelector('[data-interaction=\"verSuccess.goObBasic.click.1\"]').click();return true")
            try await waitFor(host, ".verification-success-page [role=alert]")
            let deferred = try await script(host, "return document.querySelector('.verification-success-page [role=alert]').textContent") as! String
            XCTAssertTrue(deferred.contains("not been restored"))
            try await restore()
        } catch { try? await restore(); throw error }
    }
    func testFreshEntryAndRealLocalLogin() async throws {
        let host = try await host()
        let saved = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("for(const [key,value] of [['cimoa_app_state_v2',snapshot.state],['cimoa_app_state',snapshot.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)};return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html#/pages/auth/splash")!))
        }
        do {
            _ = try await script(host, "localStorage.removeItem('cimoa_app_state_v2');localStorage.removeItem('cimoa_app_state');return true")
            // A hash-only request preserves the existing Pinia session. A query
            // forces a new document, as an actual cold launch would.
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?entryProbe=guest#/pages/auth/splash")!))
            try await waitFor(host, ".welcome-page")
            _ = try await script(host, "await Promise.all(document.querySelector('.welcome-page .page-transition').getAnimations().map(a=>a.finished));await document.fonts.ready;return true")
            let guest = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')===null && !document.querySelector('.tabbar')")
            XCTAssertEqual(guest as? Bool, true)
            let image = try await host.webView.takeSnapshot(configuration: nil)
            let attachment = XCTAttachment(image: image); attachment.name = "Fresh WKWebView Welcome"; attachment.lifetime = .keepAlways; add(attachment)
            let scroll = try await script(host, "const footer=document.querySelector('.welcome-footer'),before=footer.getBoundingClientRect().top; const areas=document.querySelectorAll('.welcome-page .uni-scroll-view');const area=areas[areas.length-1];area.scrollTop=area.scrollHeight;await new Promise(r=>requestAnimationFrame(r));return {fixed:Math.abs(before-footer.getBoundingClientRect().top)<1,descriptionVisible:document.querySelector('.welcome-description').getBoundingClientRect().bottom<=before+1}") as! [String: Any]
            XCTAssertEqual(scroll["fixed"] as? Bool, true); XCTAssertEqual(scroll["descriptionVisible"] as? Bool, true)
            try await signIn(host)
            let signedIn = try await script(host, "const saved=JSON.parse(localStorage.getItem('cimoa_app_state_v2'));return {user:saved.data.session.current_user_id,depth:document.querySelector('.main-tab-frame').dataset.pageDepth,skeleton:!!document.querySelector('.main-skeleton'),plaintext:JSON.stringify(saved).includes('12341234')}") as! [String: Any]
            XCTAssertEqual(signedIn["user"] as? String, "user_cimoa"); XCTAssertEqual(signedIn["depth"] as? String, "1")
            XCTAssertEqual(signedIn["skeleton"] as? Bool, true); XCTAssertEqual(signedIn["plaintext"] as? Bool, false)
            try await restore()
        } catch { try? await restore(); throw error }
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
        let permission = try await script(host, "return await window.CimoaNativeBridge.request('getNotificationPermission')") as! [String: Any]
        XCTAssertTrue(["granted", "denied", "not_requested", "unavailable"].contains(permission["status"] as? String ?? ""))
        XCTAssertEqual(permission["delivery_configured"] as? Bool, false)
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
