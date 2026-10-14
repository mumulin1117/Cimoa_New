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
            try await waitFor(host, ".home-header")
            let continued = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
            XCTAssertEqual(continued, committed, "Existing completed fixture returns Home without starting a new local registration.")
            try await restore()
        } catch { try? await restore(); throw error }
    }
    func testLocalPasswordResetAndRelogin() async throws {
        let host = try await host()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?passwordReset=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header")
        }
        do {
            _ = try await script(host, "const e=JSON.parse(localStorage.getItem('cimoa_app_state_v2'));e.data.session={account_id:null,current_user_id:null,expires_at:null};e.data.auth_flow.password_reset=null;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(e));return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?passwordReset=native#/pages/auth/login")!))
            try await waitFor(host, ".login-page")
            let arrived = try await script(host, """
            const delay=ms=>new Promise(r=>setTimeout(r,ms)),visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0),state=()=>JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;
            const wait=async fn=>{for(let i=0;i<200;i++){const value=fn();if(value)return value;await delay(50)}throw Error('Password reset timeout: '+location.hash+' '+document.body.innerText)};
            const click=async id=>{const e=await wait(()=>visible('[data-interaction="'+id+'"]'));await delay(320);e.click();await delay(80)};
            const fill=async(label,value)=>{const e=await wait(()=>visible('uni-input[aria-label="'+label+'"] input'));const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));await delay(100)};
            const original=state(),users=JSON.stringify(original.users),coins=JSON.stringify(original.coin_transactions);
            window.__passwordReset={delay,visible,wait,click,fill,users,coins};
            await click('login.goFpEmail.click.1');await wait(()=>visible('.reset-email-page'));await fill('Reset email','cimoa@gmail.com');await click('fpEmail.goFpCode.click.1');
            const emailLoading=!!visible('.loading')&&state().auth_flow.password_reset===null;await wait(()=>visible('.reset-code-page'));
            await fill('Reset code','111111');await click('fpCode.goFpNew.click.1');await wait(()=>visible('.reset-code-page [role=alert]'));const wrongUnchanged=state().auth_flow.password_reset.verified_at===null;
            await fill('Reset code','009789');await click('fpCode.goFpNew.click.1');const codeLoading=!!visible('.loading')&&state().auth_flow.password_reset.verified_at===null;await wait(()=>visible('.reset-new-page'));
            return {emailLoading,wrongUnchanged,codeLoading,code:document.body.innerText.includes('Choose a new password')}
            """) as! [String: Any]
            XCTAssertEqual(arrived["emailLoading"] as? Bool, true); XCTAssertEqual(arrived["wrongUnchanged"] as? Bool, true)
            XCTAssertEqual(arrived["codeLoading"] as? Bool, true); XCTAssertEqual(arrived["code"] as? Bool, true)
            _ = try await script(host, "await document.fonts.ready;await Promise.all(document.querySelector('.reset-new-page .page-transition').getAnimations().map(animation=>animation.finished));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true")
            try await Task.sleep(nanoseconds: 250_000_000)
            let resetPage = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil))
            resetPage.name = "WKWebView local password reset"; resetPage.lifetime = .keepAlways; add(resetPage)
            let result = try await script(host, """
            const {delay,visible,wait,click,fill,users,coins}=window.__passwordReset,state=()=>JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;
            await fill('New password','nativepass123');await fill('Confirm new password','nativepass123');const before=state().accounts.find(a=>a.email==='cimoa@gmail.com').credential_hash;await click('fpNew.finishReset.click.1');
            const finishLoading=!!visible('.loading')&&state().accounts.find(a=>a.email==='cimoa@gmail.com').credential_hash===before;await wait(()=>visible('.login-page'));const migrated=state(),account=migrated.accounts.find(a=>a.email==='cimoa@gmail.com');
            await fill('Password','12341234');await click('login.loginNow.click.1');await wait(()=>visible('.login-page [role=alert]'));const oldRejected=state().session.account_id===null;
            await fill('Password','nativepass123');await click('login.loginNow.click.1');await wait(()=>visible('.home-header'));const final=state();
            return {finishLoading,oldRejected,provider:account.auth_provider,verified:account.local_verification?.status,onboarding:account.onboarding?.step,reset:migrated.auth_flow.password_reset===null,signedIn:final.session.account_id===account.account_id,users:JSON.stringify(final.users)===users,coins:JSON.stringify(final.coin_transactions)===coins}
            """) as! [String: Any]
            XCTAssertEqual(result["finishLoading"] as? Bool, true); XCTAssertEqual(result["oldRejected"] as? Bool, true)
            XCTAssertEqual(result["provider"] as? String, "local"); XCTAssertEqual(result["verified"] as? String, "verified")
            XCTAssertEqual(result["onboarding"] as? String, "complete"); XCTAssertEqual(result["reset"] as? Bool, true)
            XCTAssertEqual(result["signedIn"] as? Bool, true); XCTAssertEqual(result["users"] as? Bool, true); XCTAssertEqual(result["coins"] as? Bool, true)
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
    func testFreshRegistrationToHomeWithOwnedPhotos() async throws {
        let host = try await host()
        let saved = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
        let existingMedia = try await script(host, "const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_media_v2',1);r.onupgradeneeded=()=>r.result.createObjectStore('blobs');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});const keys=await new Promise((resolve,reject)=>{const r=db.transaction('blobs').objectStore('blobs').getAllKeys();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();return keys") as! [String]
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("""
            const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_media_v2',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
            await new Promise((resolve,reject)=>{const t=db.transaction('blobs','readwrite'),s=t.objectStore('blobs'),r=s.getAllKeys();r.onsuccess=()=>r.result.filter(k=>!existing.includes(k)).forEach(k=>s.delete(k));t.oncomplete=resolve;t.onerror=()=>reject(t.error)});db.close();
            for(const [key,value] of [['cimoa_app_state_v2',snapshot.state],['cimoa_app_state',snapshot.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)};return true
            """, arguments: ["snapshot": saved, "existing": existingMedia], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?registration=restored#/pages/auth/splash")!))
            try await waitFor(host, ".home-header")
        }
        do {
            _ = try await script(host, "localStorage.removeItem('cimoa_app_state_v2');localStorage.removeItem('cimoa_app_state');return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?registration=fresh#/pages/auth/splash")!))
            try await waitFor(host, ".welcome-page")
            let setup = try await script(host, """
            const delay=ms=>new Promise(r=>setTimeout(r,ms));
            const visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden');
            const wait=async fn=>{for(let i=0;i<200;i++){const value=fn();if(value)return value;await delay(50)}throw Error('Registration timeout: '+location.hash+' '+document.body.innerText)};
            const click=async id=>{const e=await wait(()=>visible('[data-interaction="'+id+'"]'));await delay(320);e.click();await delay(80)};
            const fill=async(label,value)=>{const e=await wait(()=>visible('uni-input[aria-label="'+label+'"] input,uni-textarea[aria-label="'+label+'"] textarea'));e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));await delay(80)};
            const choose=async label=>{await delay(320);const e=[...document.querySelectorAll('[role=button],[role=checkbox]')].find(e=>(e.getAttribute('aria-label')===label||e.textContent.trim()===label)&&e.getBoundingClientRect().height>0);if(!e)throw Error('Missing '+label);e.click();await delay(80)};
            window.__registrationHelpers={delay,visible,wait,click,choose};
            await click('welcome.goAge.click.1');await fill('Date of birth','2000-01-01');await click('age.goAgree.click.1');await wait(()=>visible('.community-page'));
            for(const key of ['terms','privacy','community']){await delay(100);document.querySelector('[data-agreement="'+key+'"]').click()}
            await click('agree.goSignup.click.1');await fill('University email','native.registration@campus.edu');await fill('Password','localpass123');await fill('Confirm password','localpass123');await click('signup.createAccount.click.1');
            await wait(()=>visible('.verification-email-page'));await click('verEmail.goVerCode.click.1');await wait(()=>visible('.verification-input input'));const code=document.querySelector('.verification-input input');code.value='009789';code.dispatchEvent(new Event('input',{bubbles:true}));await delay(80);await click('verCode.goVerSuccess.click.1');
            await wait(()=>visible('.verification-success-page'));await click('verSuccess.goObBasic.click.1');await fill('Display name','Native Morgan');await choose('Non-binary');await choose('they / them');await click('obBasic.goObUni.click.1');
            await fill('University','HKUST');await choose('Year 3');await fill('Field of study','Design');await fill('Expected graduation','2027');await click('obUni.goObMajor.click.1');await wait(()=>visible('.onboarding-major-page'));await choose('💻Computer Science');await click('obMajor.goObPhotos.click.1');
            await wait(()=>visible('.photo-slot-1'));await delay(350);document.querySelector('.photo-slot-1').click();await wait(()=>visible('.permission-photos-page'));
            // Feed real bundled images into WebKit's file input. This tests the
            // production decoding/IndexedDB path, not manual system-picker UI.
            const suppress=e=>{if(e.target.matches('input[type=file]'))e.preventDefault()};document.addEventListener('click',suppress,true);
            try{await click('permPhotos.allowPhotos.click.1');await wait(()=>document.querySelector('input[type=file]'));const files=new DataTransfer();for(const name of ['me','maya-card']){const b=await(await fetch('/static/assets/head/'+name+'.png')).blob();files.items.add(new File([b],name+'.png',{type:'image/png'}))}const input=[...document.querySelectorAll('input[type=file]')].at(-1);input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}))}finally{document.removeEventListener('click',suppress,true)}
            await wait(()=>document.querySelectorAll('.onboarding-photos-page .profile-photo[data-media-status=ready]').length===2);await click('obPhotos.goObAbout.click.1');await fill('About you','A local campus profile created in real WKWebView.');await click('obAbout.goObInterests.click.1');await wait(()=>visible('.onboarding-interests-page'));
            for(const label of ['📷Photography','☕Coffee','🎵Live Music'])await choose(label);await click('obInterests.goObGoal.click.1');await wait(()=>visible('.onboarding-goal-page'));await choose('🙋New Friends');await click('obGoal.goObIce.click.1');await wait(()=>visible('.onboarding-ice-page'));await click('obIce.browseQuestions.click.1');await delay(350);
            for(const e of [...document.querySelectorAll('.library-question')].slice(0,3)){e.click();await delay(80)}await choose('Done');await delay(350);await click('obIce.goObNotif.click.1');await wait(()=>visible('.onboarding-notif-page'));await click('obNotif.skipNotifs.click.1');await wait(()=>visible('.onboarding-complete-page'));await delay(350);
            const d=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,u=d.users.find(u=>u.user_id===d.session.current_user_id);return {name:u.user_name,photos:u.photo_ids.length,questions:u.icebreaker_ids.length,permission:d.accounts.find(a=>a.account_id===d.session.account_id).onboarding.notification_permission,complete:u.onboarding_status}
            """) as! [String: Any]
            XCTAssertEqual(setup["name"] as? String, "Native Morgan"); XCTAssertEqual(setup["photos"] as? Int, 2); XCTAssertEqual(setup["questions"] as? Int, 3)
            XCTAssertEqual(setup["permission"] as? String, "skipped"); XCTAssertEqual(setup["complete"] as? String, "in_progress")
            let ready = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); ready.name = "WKWebView registration profile ready"; ready.lifetime = .keepAlways; add(ready)
            let final = try await script(host, """
            const {delay,visible,wait,click,choose}=window.__registrationHelpers;
            await click('obComplete.enterApp.click.1');await wait(()=>visible('.home-header'));
            const depth=document.querySelector('.main-tab-frame').dataset.pageDepth,skeleton=!!document.querySelector('.main-skeleton');await wait(()=>!document.querySelector('.main-skeleton'));
            const cycles=[];for(const label of ['Discover','Events']){await choose(label);await wait(()=>document.querySelector('.tab[aria-current=page]')?.getAttribute('aria-label')===label);cycles.push(!!document.querySelector('.main-skeleton'));await wait(()=>!document.querySelector('.main-skeleton'))}
            await choose('Home');await wait(()=>visible('.home-header'));cycles.push(!document.querySelector('.main-skeleton'));
            await click('home.openMe.click.1');await wait(()=>visible('.profile-name'));await wait(()=>document.querySelector('.profile-photo')?.dataset.mediaStatus==='ready');
            const profile=visible('.profile-name').textContent,verified=!!document.querySelector('.profile-verified');await click('profile.goBack.click.1');await wait(()=>visible('.home-header'));await delay(350);
            const d=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,u=d.users.find(u=>u.user_id===d.session.current_user_id);window.__registrationOldDocument=true;
            return {depth,skeleton,cycles,profile,verified,complete:u.onboarding_status,student:u.verification_status,noCoins:!d.coin_transactions.some(r=>r.owner_user_id===u.user_id),noRelationships:!d.relationships.some(r=>r.from_user_id===u.user_id||r.to_user_id===u.user_id),state:localStorage.getItem('cimoa_app_state_v2')}
            """) as! [String: Any]
            XCTAssertEqual(final["depth"] as? String, "1"); XCTAssertEqual(final["skeleton"] as? Bool, true); XCTAssertEqual(final["cycles"] as? [Bool], [true, true, true])
            XCTAssertTrue((final["profile"] as? String ?? "").contains("Native Morgan")); XCTAssertEqual(final["verified"] as? Bool, false)
            XCTAssertEqual(final["complete"] as? String, "complete"); XCTAssertEqual(final["student"] as? String, "pending"); XCTAssertEqual(final["noCoins"] as? Bool, true); XCTAssertEqual(final["noRelationships"] as? Bool, true)
            let homeImage = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); homeImage.name = "WKWebView newly registered Home"; homeImage.lifetime = .keepAlways; add(homeImage)
            host.webView.reload()
            var refreshed = false
            for _ in 0..<100 { if (try? await script(host, "return !window.__registrationOldDocument && !!document.querySelector('.home-header')")) as? Bool == true { refreshed = true; break }; try await Task.sleep(nanoseconds: 100_000_000) }
            XCTAssertTrue(refreshed)
            let after = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
            XCTAssertEqual(after, final["state"] as? String)
            try await verifyProfileAccountLoop(host)
            try await restore()
        } catch { try? await restore(); throw error }
    }
    private func verifyProfileAccountLoop(_ host: WebViewController) async throws {
        // Continue with the just-registered local account and its real IndexedDB
        // photos. The caller restores the exact pre-test account/media afterward.
        let result = try await script(host, """
        const delay=ms=>new Promise(r=>setTimeout(r,ms));
        const visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden');
        const wait=async fn=>{for(let i=0;i<200;i++){const value=fn();if(value)return value;await delay(50)}throw Error('Profile loop timeout: '+location.hash+' '+document.body.innerText)};
        const click=async id=>{const e=await wait(()=>visible('[data-interaction="'+id+'"]'));await delay(320);e.click();await delay(80)};
        const fill=async(label,value)=>{const e=await wait(()=>visible('uni-input[aria-label="'+label+'"] input,uni-textarea[aria-label="'+label+'"] textarea'));e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));await delay(80)};
        const choose=async label=>{await delay(320);const e=[...document.querySelectorAll('[role=button]')].find(e=>(e.getAttribute('aria-label')===label||e.textContent.trim()===label)&&e.getBoundingClientRect().height>0);if(!e)throw Error('Missing '+label);e.click();await delay(80)};
        const state=()=>JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data, owner=d=>d.users.find(u=>u.user_id===d.session.current_user_id);
        const assert=(value,label)=>{if(!value)throw Error(label)};
        const original=state(),originalUser=owner(original),secondPhoto=original.profile_photos.find(p=>p.photo_id===originalUser.photo_ids[1]);
        await click('home.openMe.click.1');await wait(()=>visible('.profile-name'));await click('profile.openEditBasic.click.1');await wait(()=>visible('.profile-edit-page'));
        await click('profileEdit.basic.click.1');await fill('Display name','Native Updated');await fill('Field of study','Collaborative Design');await click('editBasic.saveBasic.click.1');await wait(()=>visible('.profile-edit-page'));
        await click('editAll.eaInterests.click.1');await wait(()=>visible('.profile-interests-page'));visible('[data-choice-id="films"]').click();await delay(80);await click('editInterests.saveInterests.click.1');await wait(()=>visible('.profile-edit-page'));
        await click('editAll.eaGoals.click.1');await wait(()=>visible('.profile-goals-page'));visible('[data-choice-id="coffee"]').click();await delay(80);await click('editGoals.saveGoals.click.1');await wait(()=>visible('.profile-edit-page'));
        await click('editAll.eaIce.click.1');await wait(()=>visible('.profile-ice-page'));await choose('Remove question 1');await fill('Custom icebreaker','Which campus tradition should we start?');await click('editIce.addCustom.click.1');await click('editIce.saveIce.click.1');await wait(()=>visible('.profile-edit-page'));
        await choose('Edit photo 2');await choose('Set as Primary');await wait(()=>!visible('[role=dialog]'));await click('editAll.eaOpenBio.click.1');await fill('Profile bio','Updated through the native profile editor.');await choose('Poppins');await click('editAll.eaBioDone.click.1');await wait(()=>!visible('[role=dialog]'));await click('editAll.eaSave.click.1');await wait(()=>visible('.profile-name'));
        assert(visible('.profile-name').textContent.includes('Native Updated'),'Profile did not update');await wait(()=>visible('.profile-avatar .profile-photo')?.dataset.mediaStatus==='ready');
        await click('profile.openProfilePreview.click.1');await wait(()=>visible('.profile-preview-page'));await click('profilePreview.nextPhoto.click.1');assert(visible('.photo-dots').children[1].getAttribute('aria-current')==='true','Photo paging failed');
        await click('profilePreview.openEditBasic.click.1');await wait(()=>visible('.profile-edit-page'));await click('editAll.eaSave.click.1');await wait(()=>visible('.profile-preview-page'));await click('profilePreview.goBack.click.1');await wait(()=>visible('.profile-name'));
        await click('profile.openAppSettings.click.1');await wait(()=>visible('.settings-page'));await wait(()=>visible('.settings-avatar .profile-photo')?.dataset.mediaStatus==='ready');
        await click('settings.openEditBasic.click.1');await wait(()=>visible('.profile-edit-page'));await click('editAll.eaSave.click.1');await wait(()=>visible('.settings-page'));
        const saved=state(),user=owner(saved);assert(user.avatar_url===secondPhoto.media_url,'Primary photo did not synchronize');assert(user.interest_ids.includes('films')&&user.goal_ids.includes('coffee'),'Selections not shared');assert(saved.icebreakers.find(q=>q.question_id===user.icebreaker_ids[2]).text==='Which campus tradition should we start?','Questions not shared');assert(user.verification_status==='pending','False student verification');
        const snapshot=localStorage.getItem('cimoa_app_state_v2');await click('settings.openLogoutConfirm.click.1');await click('sheetLogout.closeSheet.click.2');await wait(()=>!visible('[role=dialog]'));assert(localStorage.getItem('cimoa_app_state_v2')===snapshot,'Logout cancellation wrote data');
        await click('settings.openLogoutConfirm.click.1');await click('sheetLogout.logOut2.click.1');assert(!!visible('.loading')&&localStorage.getItem('cimoa_app_state_v2')===snapshot,'Logout wrote before Loading');await wait(()=>visible('.welcome-page'));assert(state().session.account_id===null,'Session not cleared');
        for(const key of ['users','accounts','profile_photos','media_files','icebreakers','relationships','coin_transactions','settings'])assert(JSON.stringify(state()[key])===JSON.stringify(saved[key]),'Logout changed '+key);
        await click('welcome.goLogin.click.1');await fill('Email','native.registration@campus.edu');await fill('Password','wrong-password');await click('login.loginNow.click.1');await wait(()=>visible('.login-page [role=alert]'));assert(state().session.account_id===null,'Wrong password logged in');
        await fill('Password','localpass123');await click('login.loginNow.click.1');await wait(()=>visible('.home-header'));assert(!!visible('.main-skeleton'),'Login skeleton missing');await wait(()=>!visible('.main-skeleton'));
        for(const tab of ['Discover','Events']){await choose(tab);await wait(()=>document.querySelector('.tab[aria-current=page]')?.getAttribute('aria-label')===tab);assert(!!visible('.main-skeleton'),'First Tab skeleton missing');await wait(()=>!visible('.main-skeleton'))}
        await choose('Home');await wait(()=>visible('.home-header'));assert(!visible('.main-skeleton'),'Home skeleton repeated');await click('home.openMe.click.1');await wait(()=>visible('.profile-name'));await click('profile.openProfilePreview.click.1');await wait(()=>visible('.preview-photo .profile-photo')?.dataset.mediaStatus==='ready');
        assert(JSON.stringify(owner(state()))===JSON.stringify(user),'Relogin changed profile');assert(visible('.preview-body').textContent.includes('Updated through the native profile editor.'),'Preview text missing');
        await document.fonts.ready;window.__profileOldDocument=true;
        return {name:user.user_name,photos:user.photo_ids.length,questions:user.icebreaker_ids.length,student:user.verification_status,state:localStorage.getItem('cimoa_app_state_v2')}
        """) as! [String: Any]
        XCTAssertEqual(result["name"] as? String, "Native Updated")
        XCTAssertEqual(result["photos"] as? Int, 2); XCTAssertEqual(result["questions"] as? Int, 3)
        XCTAssertEqual(result["student"] as? String, "pending")
        host.webView.reload()
        var refreshed = false
        for _ in 0..<100 {
            if (try? await script(host, "return !window.__profileOldDocument && document.querySelector('.preview-photo .profile-photo')?.dataset.mediaStatus==='ready'")) as? Bool == true { refreshed = true; break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertTrue(refreshed, "Real profile photos must decode after a fresh WKWebView document.")
        let after = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        XCTAssertEqual(after, result["state"] as? String)
        _ = try await script(host, "await document.fonts.ready;await Promise.all([...document.querySelectorAll('.preview-photo img')].map(image=>image.decode()));await Promise.all(document.querySelector('.profile-preview-page .page-transition').getAnimations().map(animation=>animation.finished));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true")
        // WebKit's UI-process snapshot may trail the DOM/image load by a frame.
        // Wait for compositing, not for any business operation or fake loading.
        try await Task.sleep(nanoseconds: 250_000_000)
        let image = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); image.name = "WKWebView edited local profile after relogin and refresh"; image.lifetime = .keepAlways; add(image)
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
    func testEventAttendanceGroupAndMediaRefresh() async throws {
        let host = try await host()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        let existing = try await script(host, "return JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.media_files.map(m=>m.media_id)") as! [String]
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("""
            const d=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,ids=d.media_files.map(m=>m.media_id).filter(id=>!existing.includes(id));
            if(ids.length){const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_media_v2',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const t=db.transaction('blobs','readwrite');ids.forEach(id=>t.objectStore('blobs').delete(id));t.oncomplete=resolve;t.onerror=()=>reject(t.error)});db.close()}
            localStorage.setItem('cimoa_app_state_v2',snapshot);return true
            """, arguments: ["snapshot": saved, "existing": existing], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?events=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header")
        }
        do {
            _ = try await script(host, """
            const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),d=envelope.data,owner=d.session.current_user_id,e=d.events.find(e=>e.event_id==='event_picnic');
            d.users.find(u=>u.user_id===owner).verification_status='verified';e.starts_at=Date.now()+600000;e.ends_at=Date.now()+7200000;e.capacity=40;
            d.memberships=d.memberships.filter(m=>m.user_id!==owner||m.event_id!=='event_picnic');localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true
            """)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?events=test#/pages/events/detail?event_id=event_picnic")!))
            try await waitFor(host, ".event-detail-page")
            let result = try await script(host, """
            const delay=ms=>new Promise(r=>setTimeout(r,ms)),visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0);
            const wait=async fn=>{for(let i=0;i<160;i++){const v=fn();if(v)return v;await delay(50)}throw Error('Event timeout '+location.hash+' '+document.body.innerText)};
            const click=async id=>{const e=await wait(()=>visible('[data-interaction="'+id+'"]'));await delay(320);e.click();await delay(80)};
            const assert=(ok,message)=>{if(!ok)throw Error(message)},state=()=>JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;
            const original=state(),count=original.memberships.filter(m=>m.event_id==='event_picnic'&&m.status==='joined').length;
            await click('evDetail.askJoin.click.1');const before=localStorage.getItem('cimoa_app_state_v2');await click('sheetEvJoin.confirmJoin.click.1');assert(visible('.event-loading')&&localStorage.getItem('cimoa_app_state_v2')===before,'Join wrote before Loading');await wait(()=>visible('.event-success-page'));await click('evJoinSuccess.openMyEvents.click.1');await wait(()=>visible('.event-upcoming-page'));
            const card=visible('[data-event-id="event_picnic"]');assert(!!card,'My Events missing attendance');await delay(320);card.querySelector('[role=button]').click();await wait(()=>visible('.event-detail-page'));assert(visible('[data-event-count]').textContent.includes((count+1)+' of 40'),'Count did not synchronize');
            await click('evDetail.openParticipantsList.click.1');await wait(()=>visible('.event-participants-page'));assert(document.querySelectorAll('.event-person').length===count+1,'Participants not synchronized');await click('evParticipants.goBack.click.1');await wait(()=>visible('.event-detail-page'));await click('evDetail.openGroup.click.1');await wait(()=>visible('.event-group-page'));
            const field=visible('uni-input[aria-label="Message event group"] input');field.value='Native event message';field.dispatchEvent(new Event('input',{bubbles:true}));await delay(80);await click('evGroup.sendGroup.click.1');await wait(()=>[...document.querySelectorAll('.event-message-bubble')].some(e=>e.textContent==='Native event message'));
            // Real bundle image through the production file-input decoder, not
            // a claim of manually operating the iOS system photo library.
            const suppress=e=>{if(e.target.matches('input[type=file]'))e.preventDefault()};document.addEventListener('click',suppress,true);
            try{await click('evGroup.sendPhoto.click.1');await wait(()=>document.querySelector('input[type=file]'));const transfer=new DataTransfer(),blob=await(await fetch('/static/assets/img/event-picnic.png')).blob();transfer.items.add(new File([blob],'picnic.png',{type:'image/png'}));const input=[...document.querySelectorAll('input[type=file]')].at(-1);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))}finally{document.removeEventListener('click',suppress,true)}
            await wait(()=>visible('.event-media-preview .profile-photo')?.dataset.mediaStatus==='ready');await click('eventGroup.media.send.click.1');await wait(()=>visible('.event-message-image .profile-photo')?.dataset.mediaStatus==='ready');
            await click('evGroup.openGroupMenu.click.1');await click('eventGroup.menu.mute.click.1');await wait(()=>!visible('.event-loading'));await click('eventGroup.menu.close.click.1');await wait(()=>!visible('[role=dialog]'));
            const composer=visible('.event-group-composer').getBoundingClientRect();window.__eventOldDocument=true;
            return {state:localStorage.getItem('cimoa_app_state_v2'),count:count+1,footer:composer.bottom,height:innerHeight,top:visible('.event-group-page .safe-area').getBoundingClientRect().height}
            """) as! [String: Any]
            XCTAssertLessThanOrEqual(result["footer"] as! Double, result["height"] as! Double)
            XCTAssertEqual(result["top"] as! Double, Double(host.view.safeAreaInsets.top), accuracy: 1)
            host.webView.reload()
            var ready = false
            for _ in 0..<100 {
                if (try? await script(host, "return !window.__eventOldDocument && document.querySelector('.event-message-image .profile-photo')?.dataset.mediaStatus==='ready'")) as? Bool == true { ready = true; break }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            XCTAssertTrue(ready)
            let reloaded = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as? String
            XCTAssertEqual(reloaded, result["state"] as? String)
            _ = try await script(host, "await document.fonts.ready;await Promise.all([...document.querySelectorAll('.event-group-page img')].map(image=>image.decode()));await Promise.all(document.querySelector('.event-group-page .page-transition').getAnimations().map(animation=>animation.finished));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true")
            try await Task.sleep(nanoseconds: 250_000_000)
            let screenshot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); screenshot.name = "WKWebView event group after media refresh"; screenshot.lifetime = .keepAlways; add(screenshot)
            let cancelled = try await script(host, """
            const delay=ms=>new Promise(r=>setTimeout(r,ms)),visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0);
            const click=async id=>{await delay(350);visible('[data-interaction="'+id+'"]').click();await delay(100)};
            await click('evGroup.openGroupMenu.click.1');await click('eventGroup.menu.manage.click.1');await click('sheetEvCancel.cancelAttendance.click.1');await delay(700);
            return {blocked:!!visible('[role=alert]'),messages:document.querySelectorAll('.event-message').length,composer:!!visible('.event-group-composer'),joined:JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.memberships.filter(m=>m.event_id==='event_picnic'&&m.status==='joined').length}
            """) as! [String: Any]
            XCTAssertEqual(cancelled["blocked"] as? Bool, true); XCTAssertEqual(cancelled["messages"] as? Int, 0); XCTAssertEqual(cancelled["composer"] as? Bool, false)
            XCTAssertEqual(cancelled["joined"] as! Int, (result["count"] as! Int) - 1)
            try await restore()
        } catch { try? await restore(); throw error }
    }
    func testDirectChatSafetyAndMediaInRealWebKit() async throws {
        let host = try await host()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        let existing = try await script(host, "return JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.media_files.map(m=>m.media_id)") as! [String]
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("""
            const d=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,ids=d.media_files.map(m=>m.media_id).filter(id=>!existing.includes(id));
            if(ids.length){const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_media_v2',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const t=db.transaction('blobs','readwrite');ids.forEach(id=>t.objectStore('blobs').delete(id));t.oncomplete=resolve;t.onerror=()=>reject(t.error)});db.close()}
            localStorage.setItem('cimoa_app_state_v2',snapshot);return true
            """, arguments: ["snapshot": saved, "existing": existing], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?safety=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header")
        }
        do {
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?safety=chat#/pages/messages/chat?conversation_id=conversation_chloe")!))
            try await waitFor(host, ".direct-chat-page")
            let media = try await script(host, """
            const delay=ms=>new Promise(r=>setTimeout(r,ms)),visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0),state=()=>JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;
            const wait=async fn=>{for(let i=0;i<200;i++){const v=fn();if(v)return v;await delay(50)}throw Error('Direct media timeout '+location.hash+' '+document.body.innerText)};
            const click=async id=>{const e=await wait(()=>visible('[data-interaction="'+id+'"]'));await delay(320);e.click();await delay(80)};
            await wait(()=>!visible('.event-loading'));
            const field=visible('uni-input[aria-label="Message"] input'),set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(field,'Native direct message');field.dispatchEvent(new Event('input',{bubbles:true}));await delay(80);
            const count=state().messages.length,beforeText=localStorage.getItem('cimoa_app_state_v2');await click('chat.send.click.1');const textLoading=!!visible('.event-loading')&&localStorage.getItem('cimoa_app_state_v2')===beforeText;await wait(()=>state().messages.length===count+1);
            const beforePhoto=localStorage.getItem('cimoa_app_state_v2'),suppress=e=>{if(e.target.matches('input[type=file]'))e.preventDefault()};document.addEventListener('click',suppress,true);
            try{await click('chat.sendPhoto.click.1');await wait(()=>document.querySelector('input[type=file]'));const transfer=new DataTransfer(),blob=await(await fetch('/static/assets/head/maya-full.png')).blob();transfer.items.add(new File([blob],'maya.png',{type:'image/png'}));const input=[...document.querySelectorAll('input[type=file]')].at(-1);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))}finally{document.removeEventListener('click',suppress,true)}
            await wait(()=>visible('.chat-media-preview .profile-photo')?.dataset.mediaStatus==='ready');const photoDraft=localStorage.getItem('cimoa_app_state_v2')===beforePhoto;await click('chat.media.send.click.1');const photoLoading=!!visible('.event-loading')&&localStorage.getItem('cimoa_app_state_v2')===beforePhoto;await wait(()=>visible('.chat-image .profile-photo')?.dataset.mediaStatus==='ready');
            const last=state().messages.at(-1),file=state().media_files.find(m=>m.media_id===last.media_id);window.__directOldDocument=true;
            return {textLoading,photoDraft,photoLoading,kind:last.kind,media:file?.media_url,state:localStorage.getItem('cimoa_app_state_v2')}
            """) as! [String: Any]
            XCTAssertEqual(media["textLoading"] as? Bool, true); XCTAssertEqual(media["photoDraft"] as? Bool, true); XCTAssertEqual(media["photoLoading"] as? Bool, true)
            XCTAssertEqual(media["kind"] as? String, "image"); XCTAssertTrue((media["media"] as? String ?? "").hasPrefix("indexeddb://"))
            host.webView.reload()
            var refreshed = false
            for _ in 0..<100 {
                if (try? await script(host, "return !window.__directOldDocument && document.querySelector('.chat-image .profile-photo')?.dataset.mediaStatus==='ready'")) as? Bool == true { refreshed = true; break }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            XCTAssertTrue(refreshed, "Direct photo must decode from IndexedDB after a fresh WKWebView document.")
            let afterRefresh = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as? String
            XCTAssertEqual(afterRefresh, media["state"] as? String)
            _ = try await script(host, "await document.fonts.ready;await Promise.all([...document.querySelectorAll('.direct-chat-page img')].map(image=>image.decode()));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true")
            try await Task.sleep(nanoseconds: 250_000_000)
            let screenshot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); screenshot.name = "WKWebView direct chat after media refresh"; screenshot.lifetime = .keepAlways; add(screenshot)

            let safety = try await script(host, """
            const delay=ms=>new Promise(r=>setTimeout(r,ms)),visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0),state=()=>JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;
            const wait=async fn=>{for(let i=0;i<200;i++){const v=fn();if(v)return v;await delay(50)}throw Error('Safety timeout '+location.hash+' '+document.body.innerText)};
            const click=async id=>{const e=await wait(()=>visible('[data-interaction="'+id+'"]'));await delay(320);e.click();await delay(80)};
            const beforeCall=localStorage.getItem('cimoa_app_state_v2');await click('chat.startCall.click.1');await wait(()=>visible('.waiting-call-page'));const waitingOnly=visible('.waiting-call-copy').textContent.includes('never claims the other person answered');await click('callActive.endCall.click.1');await wait(()=>visible('.direct-chat-page'));const callUnchanged=localStorage.getItem('cimoa_app_state_v2')===beforeCall;
            await click('chat.openSafety.click.1');await click('sheetSafety.openReport.click.1');await wait(()=>visible('.safety-report-user-page'));const reportTarget=visible('.editor-title').textContent.includes('Chloe Lin'),reportCount=state().reports.length;await click('safetyReport.goBack.click.1');await wait(()=>visible('.direct-chat-page'));
            await click('chat.openSafety.click.1');const beforeMute=localStorage.getItem('cimoa_app_state_v2');await click('sheetSafety.muteNotifs.click.1');const muteLoading=!!visible('.event-loading')&&localStorage.getItem('cimoa_app_state_v2')===beforeMute;await wait(()=>visible('[data-interaction="sheetSafety.muteNotifs.click.1"]')?.textContent.includes('Unmute'));
            await click('sheetSafety.openBlock.click.1');const beforeCancel=localStorage.getItem('cimoa_app_state_v2');await click('sheetBlock.closeSheet.click.2');await wait(()=>!visible('[role=dialog]'));const cancelUnchanged=localStorage.getItem('cimoa_app_state_v2')===beforeCancel;
            await click('chat.openSafety.click.1');await click('sheetSafety.openBlock.click.1');const beforeBlock=localStorage.getItem('cimoa_app_state_v2');await click('sheetBlock.confirmBlock.click.1');const blockLoading=!!visible('.event-loading')&&localStorage.getItem('cimoa_app_state_v2')===beforeBlock;await wait(()=>visible('.home-header'));
            const blocked=state().blocked_users.some(r=>r.owner_user_id===state().session.current_user_id&&r.user_id==='user_chloe'),conversationGone=!state().conversations.some(r=>r.conversation_id==='conversation_chloe'),messagesGone=!state().messages.some(r=>r.conversation_id==='conversation_chloe');
            location.hash='#/pages/settings/blocked';await wait(()=>visible('.settings-blocked-page'));const card=await wait(()=>[...document.querySelectorAll('.blocked-card')].find(e=>e.textContent.includes('Chloe Lin')));await delay(320);card.querySelector('[data-interaction="blockedList.b.unblock.click.1"]').click();await wait(()=>visible('[data-interaction="unblockOpen.confirmUnblock.click.1"]'));const beforeUnblock=localStorage.getItem('cimoa_app_state_v2');await click('unblockOpen.confirmUnblock.click.1');const unblockLoading=!!visible('.loading')&&localStorage.getItem('cimoa_app_state_v2')===beforeUnblock;await wait(()=>![...document.querySelectorAll('.blocked-card')].some(e=>e.textContent.includes('Chloe Lin')));
            return {waitingOnly,callUnchanged,reportTarget,reportCount,muteLoading,muted:state().settings.find(r=>r.owner_user_id===state().session.current_user_id).muted_direct_user_ids.includes('user_chloe'),cancelUnchanged,blockLoading,blocked,conversationGone,messagesGone,unblockLoading,unblocked:!state().blocked_users.some(r=>r.owner_user_id===state().session.current_user_id&&r.user_id==='user_chloe'),notRestored:!state().conversations.some(r=>r.conversation_id==='conversation_chloe')}
            """) as! [String: Any]
            XCTAssertEqual(safety["waitingOnly"] as? Bool, true); XCTAssertEqual(safety["callUnchanged"] as? Bool, true)
            XCTAssertEqual(safety["reportTarget"] as? Bool, true); XCTAssertEqual(safety["reportCount"] as? Int, 0)
            XCTAssertEqual(safety["muteLoading"] as? Bool, true); XCTAssertEqual(safety["muted"] as? Bool, true); XCTAssertEqual(safety["cancelUnchanged"] as? Bool, true)
            XCTAssertEqual(safety["blockLoading"] as? Bool, true); XCTAssertEqual(safety["blocked"] as? Bool, true); XCTAssertEqual(safety["conversationGone"] as? Bool, true); XCTAssertEqual(safety["messagesGone"] as? Bool, true)
            XCTAssertEqual(safety["unblockLoading"] as? Bool, true); XCTAssertEqual(safety["unblocked"] as? Bool, true); XCTAssertEqual(safety["notRestored"] as? Bool, true)
            try await restore()
        } catch { try? await restore(); throw error }
    }
    func testNativeRequestReplyAndFailureBoundaries() async throws {
        let host = try await host()
        let permission = try await script(host, "return await window.CimoaNativeBridge.request('getNotificationPermission')") as! [String: Any]
        XCTAssertTrue(["granted", "denied", "not_requested", "unavailable"].contains(permission["status"] as? String ?? ""))
        XCTAssertEqual(permission["delivery_configured"] as? Bool, false)
        let permissions = try await script(host, "return await window.CimoaNativeBridge.request('getPermissions')") as! [String: Any]
        for key in ["camera", "microphone", "photos", "notifications", "location"] {
            XCTAssertTrue(["granted", "denied", "not_requested", "unavailable"].contains(permissions[key] as? String ?? ""), "Missing real permission state for \(key)")
        }
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
    func testRestoredDependencyFlowsInRealWebKit() async throws {
        let host = try await host()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?dependencies=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header")
        }
        do {
            _ = try await script(host, """
            const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),data=envelope.data,owner=data.session.current_user_id,target='user_liam';
            data.requests=data.requests.filter(row=>!([row.sender_id,row.recipient_id].includes(owner)&&[row.sender_id,row.recipient_id].includes(target)));
            data.relationships=data.relationships.filter(row=>!([row.from_user_id,row.to_user_id].includes(owner)&&[row.from_user_id,row.to_user_id].includes(target)));
            data.match_sessions=data.match_sessions.filter(row=>!(row.owner_user_id===owner&&row.candidate_id===target));
            data.blocked_users=data.blocked_users.filter(row=>!(row.owner_user_id===owner&&row.user_id===target));
            localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true
            """)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?dependencies=text#/pages/discover/icebreaker/select?user_id=user_liam")!))
            try await waitFor(host, ".flow-choice")
            let textFlow = try await script(host, """
            const delay=ms=>new Promise(r=>setTimeout(r,ms)),visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0),state=()=>JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;
            const wait=async fn=>{for(let i=0;i<200;i++){const value=fn();if(value)return value;await delay(50)}throw Error('Dependency flow timeout: '+location.hash+' '+document.body.innerText)};
            const click=async id=>{const element=await wait(()=>visible('[data-interaction="'+id+'"]'));await delay(320);element.click();await delay(80)};
            const beforeCoins=state().coin_transactions.reduce((sum,row)=>sum+(row.owner_user_id===state().session.current_user_id&&row.status==='completed'?row.amount:0),0);
            visible('[data-interaction="ibSelect.q.pick.click.1"]').click();await click('ibSelect.answerGo.click.1');await wait(()=>visible('uni-textarea[aria-label="Your introduction"] textarea'));
            const field=visible('uni-textarea[aria-label="Your introduction"] textarea'),set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(field,'Native text introduction');field.dispatchEvent(new Event('input',{bubbles:true}));await delay(80);
            const beforeSend=localStorage.getItem('cimoa_app_state_v2');await click('ibText.continueText.click.1');const loading=!!visible('.event-loading')&&localStorage.getItem('cimoa_app_state_v2')===beforeSend;
            await wait(()=>visible('[data-interaction="reqSent.doneSent.click.1"]'));const data=state(),request=data.requests.find(row=>row.sender_id===data.session.current_user_id&&row.recipient_id==='user_liam'&&row.text==='Native text introduction');
            const afterCoins=data.coin_transactions.reduce((sum,row)=>sum+(row.owner_user_id===data.session.current_user_id&&row.status==='completed'?row.amount:0),0);
            return {loading,request:request?.status,kind:request?.kind,free:beforeCoins===afterCoins,linked:data.drafts.some(row=>row.kind==='introduction'&&row.payload.completed_request_id===request?.request_id)}
            """) as! [String: Any]
            XCTAssertEqual(textFlow["loading"] as? Bool, true); XCTAssertEqual(textFlow["request"] as? String, "pending")
            XCTAssertEqual(textFlow["kind"] as? String, "text"); XCTAssertEqual(textFlow["free"] as? Bool, true); XCTAssertEqual(textFlow["linked"] as? Bool, true)

            let boundaries = try await script(host, """
            const delay=ms=>new Promise(r=>setTimeout(r,ms)),visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0),state=()=>localStorage.getItem('cimoa_app_state_v2');
            const wait=async fn=>{for(let i=0;i<200;i++){const value=fn();if(value)return value;await delay(50)}throw Error('Boundary timeout: '+location.hash+' '+document.body.innerText)};
            const open=async hash=>{location.hash=hash;await wait(()=>location.hash===hash);await delay(350)};
            await open('#/pages/profile/prefs');const prefs=!!visible('[data-interaction="editPrefs.savePrefs.click.1"]')&&document.body.innerText.includes('Shared interests');
            await open('#/pages/profile/reverify');const beforeVerify=state();visible('[data-interaction="reverify.goVerEmail.click.1"]').click();await wait(()=>visible('[role=alert]'));const verifyFailure=visible('[role=alert]').textContent.includes('not configured')&&state()===beforeVerify;
            await open('#/pages/auto-match/index');const beforeMatch=state();visible('[data-interaction="amEntry.joinPool.click.1"]').click();await wait(()=>visible('[role=alert]'));const matchFailure=visible('[role=alert]').textContent.includes('not configured')&&state()===beforeMatch;
            await open('#/pages/permissions/camera?fallback=%2Fpages%2Fprofile%2Fedit');const camera=document.body.innerText.includes('used only while you take a photo');
            await open('#/pages/permissions/mic?fallback=%2Fpages%2Fdiscover%2Ficebreaker%2Fvoice');const microphone=document.body.innerText.includes('Recording stops when you leave the page');
            await open('#/pages/coins/processing?return_context_id=missing');const coinFailure=document.body.innerText.includes('No coins were deducted');
            await open('#/pages/system/maintenance');const maintenance=document.body.innerText.includes('temporarily unavailable');
            await open('#/pages/system/session-expired');const session=document.body.innerText.includes('session has expired');
            return {prefs,verifyFailure,matchFailure,camera,microphone,coinFailure,maintenance,session}
            """) as! [String: Any]
            for key in ["prefs", "verifyFailure", "matchFailure", "camera", "microphone", "coinFailure", "maintenance", "session"] { XCTAssertEqual(boundaries[key] as? Bool, true, key) }
            let attachment = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); attachment.name = "WKWebView restored dependency states"; attachment.lifetime = .keepAlways; add(attachment)
            try await restore()
        } catch { try? await restore(); throw error }
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
