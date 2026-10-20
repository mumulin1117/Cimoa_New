import XCTest
import WebKit
import AVFoundation
@testable import cimoaNeapo

@MainActor
final class HostTests: XCTestCase {
    func testExpandedVoiceOverlayAndThreeSecondCarousel() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String:Any]
        var root = URL(fileURLWithPath:#filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let folder = root.appendingPathComponent("docs/ui-restoration/discover-request-profile/voice-overlay-2026-10-20")
        let fixture = try JSONSerialization.jsonObject(with:Data(contentsOf:folder.appendingPathComponent("native-fixture.json"))) as! [String:Any]
        let driver = """
        const delay=ms=>new Promise(r=>setTimeout(r,ms)),assert=(v,m)=>{if(!v)throw Error(m)};
        const visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0),index=()=>[...(document.querySelector('.expanded-dots')?.children||[])].findIndex(e=>e.classList.contains('active'));
        const wait=async fn=>{for(let i=0;i<180;i++){if(fn())return;await delay(30)}throw Error('Expanded timeout '+location.hash+' '+JSON.stringify({checks:window.expandedChecks,voice:visible('.profile-voice-intro')?.outerHTML}))};
        const click=id=>visible('[data-interaction="'+id+'"]').click();
        """
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("for(const[k,v]of[['cimoa_app_state_v2',snapshot.state],['cimoa_app_state',snapshot.legacy]]){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}return true",arguments:["snapshot":saved],in:nil,contentWorld:.page)
            try await loadFreshConnection(host,route:"/pages/auth/splash",selector:".splash-page")
        }
        do {
            _ = try await host.webView.callAsyncJavaScript("fixture.data.session.expires_at=Date.now()+86400000;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(fixture));return true",arguments:["fixture":fixture],in:nil,contentWorld:.page)
            try await loadFreshConnection(host,route:"/pages/discover/profile?user_id=user_zane",selector:".expanded-heading")
            let geometry = try await script(host,driver + """
            await document.fonts.ready;await wait(()=>visible('.expanded-photo .profile-photo')?.dataset.mediaStatus==='ready');await delay(300);
            const box=s=>{const r=visible(s).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}},photo=box('.expanded-photo-card'),voice=box('.profile-voice-intro'),play=box('.profile-voice-play'),scale=innerWidth/393;
            assert(visible('.expanded-photo-card > .profile-voice-intro')&&document.querySelectorAll('.profile-voice-intro').length===1,'Voice not uniquely inside photo');assert(!visible('.expanded-song'),'Duplicate song/voice');
            assert(Math.abs((voice.x-photo.x)/scale-14)<1&&Math.abs((photo.bottom-voice.bottom)/scale-12)<1&&Math.abs(voice.height/scale-60)<1&&Math.abs(play.width/scale-44)<1,'Wrong source geometry');
            return{photo,voice,play,viewport:[innerWidth,innerHeight],safeTop:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-top')),safeBottom:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-bottom'))};
            """) as! [String:Any]
            XCTAssertEqual(geometry["safeTop"] as! Double,Double(host.view.safeAreaInsets.top),accuracy:1)
            XCTAssertEqual(geometry["safeBottom"] as! Double,Double(host.view.safeAreaInsets.bottom),accuracy:1)
            try (try await host.webView.takeSnapshot(configuration:nil)).pngData()!.write(to:folder.appendingPathComponent("actual-wkwebview.png"))
            try await waitForPreparedAudio(host,selector:".profile-voice-play")
            // Playback must begin in a fresh user-gesture evaluation, not after
            // the asynchronous 3s timer test has consumed its activation.
            _ = try await script(host,driver + """
            click('expanded.voiceIntroPlay.click.1');await wait(()=>visible('.profile-voice-play')?.getAttribute('aria-label')==='Pause voice message'&&visible('.profile-voice-play')?.getAttribute('aria-disabled')!=='true');assert(!visible('[role=dialog]'),'Audio opened gallery');click('expanded.voiceIntroPlay.click.1');await wait(()=>visible('.profile-voice-play')?.getAttribute('aria-label')==='Play voice message');return true;
            """)
            let checks = try await script(host,driver + """
            const checks=window.expandedChecks=['Bundled voice real play/pause uses overlay without opening gallery'],before=localStorage.getItem('cimoa_app_state_v2');
            click('expanded.nextPhoto.click.1');await delay(30);const a=index();await delay(2700);assert(index()===a,'Rotated before 3s');await delay(450);assert(index()===(a+1)%3,'Did not rotate at 3s');checks.push('Actual native timer advances after 3s; manual switch resets deadline');
            click('expanded.openSafetyMini.click.1');await delay(50);const b=index();await delay(3100);assert(index()===b,'Sheet did not pause');click('sheetSafetyMini.closeSheet.click.1');await delay(50);checks.push('Safety sheet pauses automatic photo switching');
            Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));await delay(30);const c=index();assert(!visible('.profile-voice-intro'),'Hidden voice not released');await delay(3100);assert(index()===c,'Hidden timer leaked');Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));await delay(3150);assert(index()===(c+1)%3,'Resume cadence failed');checks.push('Synthetic document visibility lifecycle pauses/releases and resumes without catch-up');
            click('expanded.sayHi.click.1');await wait(()=>visible('.ice-select-page'));await delay(350);assert(!visible('.profile-voice-intro'),'Hidden page retained voice');history.back();await wait(()=>visible('.expanded-profile-page'));await delay(350);assert(location.hash.includes('user_zane')&&localStorage.getItem('cimoa_app_state_v2')===before,'Back/entity/storage mismatch');checks.push('Send shot and Back retain same entity and business state; hidden detail releases player');return checks;
            """) as! [String]
            try await restore()
            try JSONSerialization.data(withJSONObject:["result":"passed","checks":checks,"geometry":geometry,"storage_restored":true,"limits":"Visibility event is synthetic; this is not an OS-background or physical-device benchmark"],options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("native-acceptance.json"))
        } catch {
            let detail = String(describing:try? await script(host,"return {checks:window.expandedChecks,url:location.href,dots:document.querySelector('.expanded-dots')?.outerHTML,voice:document.querySelector('.profile-voice-play')?.outerHTML}"))
            try? await restore()
            try? JSONSerialization.data(withJSONObject:["result":"failed","failure":String(describing:error),"detail":detail],options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("native-acceptance.json"))
            throw error
        }
    }
    func testDiscoverStaggeredSwipeThresholdAndRecovery() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String:Any]
        var root = URL(fileURLWithPath:#filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let folder = root.appendingPathComponent("docs/ui-restoration/discover-request-deck/swipe-2026-10-20")
        let fixture = try JSONSerialization.jsonObject(with:Data(contentsOf:folder.appendingPathComponent("native-fixture.json"))) as! [String:Any]
        let driver = """
        const delay=ms=>new Promise(r=>setTimeout(r,ms)),assert=(v,m)=>{if(!v)throw Error(m)};
        const visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0),front=()=>visible('.discover-photo-card--front'),id=()=>front().dataset.userId;
        const wait=async fn=>{for(let i=0;i<180;i++){if(fn())return;await delay(30)}throw Error('Swipe timeout '+location.hash)};
        const settled=()=>wait(()=>{const e=visible('.discover-deck');return e&&e.dataset.settling==='false'&&e.dataset.resetting==='false'});
        const dispatch=(e,type,x,y,pointer=61)=>e.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:pointer,pointerType:'touch',isPrimary:true,button:0,clientX:x,clientY:y}));
        const gesture=async(ratio,{cancel=false,vertical=false,hold=0}={})=>{const e=front(),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;dispatch(e,'pointerdown',x,y);for(let i=1;i<=8;i++){dispatch(e,'pointermove',x+r.width*ratio*i/8,y+(vertical?100*i/8:0));await delay(12)}if(hold)await delay(hold);dispatch(e,cancel?'pointercancel':'pointerup',x+r.width*ratio,y+(vertical?100:0));await delay(20);await settled();};
        """
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("for(const[k,v]of[['cimoa_app_state_v2',snapshot.state],['cimoa_app_state',snapshot.legacy]]){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}return true",arguments:["snapshot":saved],in:nil,contentWorld:.page)
            try await loadFreshConnection(host,route:"/pages/auth/splash",selector:".splash-page")
        }
        do {
            _ = try await host.webView.callAsyncJavaScript("fixture.data.session.expires_at=Date.now()+86400000;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(fixture));return true",arguments:["fixture":fixture],in:nil,contentWorld:.page)
            try await loadFreshConnection(host,route:"/pages/discover/index",selector:".discover-photo-card--front")
            let geometry = try await script(host,driver + """
            await document.fonts.ready;await Promise.all([...document.querySelectorAll('.discover-photo-card img')].map(e=>e.decode()));await delay(300);assert(document.querySelectorAll('.discover-photo-card').length===3,'Not three layers');const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}},a=box(front()),content=box(visible('.discover-content')),cta=box(visible('.discover-send')),bar=box(visible('.tabbar')),layers=[...document.querySelectorAll('.discover-photo-card')].map(box),info=box(front().querySelector('.discover-info'));
            for(const r of layers)assert(r.x>=content.x-1&&r.right<=content.right+1&&r.bottom<=content.bottom+1,'Rear corners clipped');assert(a.bottom<cta.y&&cta.bottom<=bar.y&&info.y>=a.y-1&&info.bottom<=a.bottom+1,'Card information/CTA clipped');return{card:a,layers,content,cta,bar,safeTop:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-top')),safeBottom:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-bottom'))};
            """) as! [String:Any]
            XCTAssertEqual(geometry["safeTop"] as! Double,Double(host.view.safeAreaInsets.top),accuracy:1)
            XCTAssertEqual(geometry["safeBottom"] as! Double,Double(host.view.safeAreaInsets.bottom),accuracy:1)
            try (try await host.webView.takeSnapshot(configuration:nil)).pngData()!.write(to:folder.appendingPathComponent("actual-wkwebview.png"))
            let checks = try await script(host,driver + """
            const before=localStorage.getItem('cimoa_app_state_v2'),checks=[];
            for(const ratio of [-.1,.24,-.32,1/3,-.34]){const old=id();await gesture(ratio);assert((id()!==old)===(Math.abs(ratio)>=1/3),'Wrong threshold '+ratio)}checks.push('Both directions spring back below 1/3 and commit once at/above 1/3');
            const incoming=visible('.discover-photo-card--back'),image=incoming.querySelector('img'),current=id();await gesture(-.4,{hold:1200});assert(id()!==current&&front()===incoming&&front().querySelector('img')===image,'Clock tick interrupted drag or incoming card remounted');checks.push('Clock tick does not interrupt long drag; incoming card and decoded photo are reused');
            const keep=id();await gesture(-.5,{cancel:true});assert(id()===keep,'Cancel skipped');await gesture(.01,{vertical:true});assert(id()===keep,'Vertical gesture skipped');checks.push('Pointer cancellation and vertical gestures retain the current person');
            const active=front(),r=active.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;dispatch(active,'pointerdown',x,y);dispatch(active,'pointermove',x-r.width*.1,y);dispatch(active,'pointerup',x-r.width*.34,y);active.click();await delay(20);await settled();assert(id()!==keep,'Final release coordinate ignored');assert(!visible('.expanded-profile-page'),'Swipe opened profile');checks.push('Final release sample commits and immediate swipe-generated click is suppressed');
            await delay(350);const selected=id();front().click();await wait(()=>visible('.expanded-profile-page'));assert(location.hash.includes(selected),'Wrong profile ID');visible('[data-interaction="expanded.collapse.click.1"]').click();await wait(()=>front());await delay(300);assert(id()===selected,'Back lost current card');checks.push('Tap opens the same canonical user and Back preserves current deck position');
            const e=front(),b=e.getBoundingClientRect();dispatch(e,'pointerdown',b.x+b.width/2,b.y+b.height/2);dispatch(e,'pointermove',b.x+b.width*.05,b.y+b.height/2);visible('.tab[aria-label="Home"]').click();await wait(()=>visible('.home-header'));await delay(300);visible('.tab[aria-label="Discover"]').click();await wait(()=>front());await delay(400);assert(visible('.discover-deck').dataset.dragging==='false'&&visible('.discover-deck').dataset.settling==='false','Hidden gesture leaked');assert(!visible('.main-skeleton'),'Repeated skeleton');assert(localStorage.getItem('cimoa_app_state_v2')===before,'Browsing mutated business data');checks.push('Tab interruption clears gesture state; no repeated skeleton, request, relationship or ledger write');return checks;
            """) as! [String]
            try await restore()
            try JSONSerialization.data(withJSONObject:["result":"passed","checks":checks,"geometry":geometry,"storage_restored":true,"gesture_method":"Timed touch Pointer Events in bundled WKWebView; not a physical-device frame-rate benchmark"],options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("native-acceptance.json"))
        } catch {
            let detail = String(describing:try? await script(host,"return {url:location.href,deck:{...document.querySelector('.discover-deck')?.dataset},text:document.body.innerText.slice(0,1000)}"))
            try? await restore()
            try? JSONSerialization.data(withJSONObject:["result":"failed","failure":String(describing:error),"detail":detail],options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("native-acceptance.json"))
            throw error
        }
    }
    func testFirstLaunchEulaAndAgreementClose() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let folder = root.appendingPathComponent("docs/ui-restoration/welcome/eula-2026-10-20")
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: folder.appendingPathComponent("native-fixture.json"))) as! [String: Any]
        let driver = """
        const delay=ms=>new Promise(r=>setTimeout(r,ms)),assert=(v,m)=>{if(!v)throw Error(m)};
        const visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden');
        const wait=async fn=>{for(let i=0;i<160;i++){if(fn())return;await delay(40)}throw Error('EULA timeout '+location.hash)};
        const click=async id=>{await wait(()=>visible('[data-interaction="'+id+'"]'));visible('[data-interaction="'+id+'"]').click();await delay(60)};
        const state=()=>{const s=localStorage.getItem('cimoa_app_state_v2');return s?JSON.parse(s).data:null};
        """
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("for(const [k,v] of [['cimoa_app_state_v2',snapshot.state],['cimoa_app_state',snapshot.legacy]]){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}return true", arguments: ["snapshot":saved], in: nil, contentWorld: .page)
            try await loadFreshConnection(host, route: "/pages/auth/splash", selector: ".splash-page")
        }
        var checks: [String] = []
        do {
            _ = try await script(host, "localStorage.removeItem('cimoa_app_state_v2');localStorage.removeItem('cimoa_app_state');return true")
            try await loadFreshConnection(host, route: "/pages/auth/splash", selector: ".eula-dialog.event-dialog--open")
            let first = try await script(host, driver + """
            await delay(350);assert(state()===null,'Launch wrote data');assert(visible('.welcome-consent-toggle').getAttribute('aria-checked')==='false','Preselected agreement');
            const e=visible('.eula-dialog .event-dialog-panel'),r=e.getBoundingClientRect(),top=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-top')),bottom=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-bottom'));
            assert(r.y>=top-1&&r.bottom<=innerHeight-bottom+1,'EULA outside safe area');const s=[...document.querySelectorAll('.eula-dialog .uni-scroll-view')].at(-1);assert(s.scrollHeight>s.clientHeight,'EULA not scrollable');s.scrollTop=s.scrollHeight;await delay(50);assert(s.scrollTop>0,'EULA scroll failed');
            const a=visible('[data-interaction="welcome.eula.accept.click.1"]'),b=a.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);assert(a===hit||a.contains(hit),'Agree covered by document');return {top,bottom,width:innerWidth,height:innerHeight,card:{y:r.y,bottom:r.bottom},scroll:true};
            """) as! [String: Any]
            try (try await host.webView.takeSnapshot(configuration:nil)).pngData()!.write(to:folder.appendingPathComponent("eula-wkwebview.png"))
            checks.append("Fresh launch opens unaccepted EULA with measured safe areas, scroll and hittable fixed actions")
            let decline = try await script(host, driver + """
            for(const kind of ['terms','privacy','community']){await click('welcome.eula.read.'+kind);await wait(()=>visible('.agreement-sheet.event-dialog--open'));await delay(300);assert(visible('.agreement-sheet .legal-document-content').dataset.legalDocument===kind,'Wrong policy');assert(!visible('.agreement-sheet .event-dialog-secondary'),'Bottom Close retained');await click('sheetAgreement.closeSheet.click.2');await wait(()=>!visible('.agreement-sheet'));assert(state()===null,'Reading accepted');}
            await click('welcome.eula.decline.click.1');await wait(()=>!visible('.eula-dialog'));await click('welcome.goLogin.click.1');await click('welcome.goAge.click.1');assert(location.hash.endsWith('/pages/auth/welcome')&&state()===null,'Decline did not gate');return true;
            """) as? Bool
            XCTAssertEqual(decline,true);checks.append("Three canonical readers close with X without accepting; Not Now gates both auth entries")
            try await loadFreshConnection(host, route:"/pages/auth/welcome",selector:".eula-dialog.event-dialog--open")
            let savedOnce = try await script(host, driver + """
            const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='cimoa_app_state_v2')throw Error('Unavailable');return original.call(this,k,v)};
            try{await click('welcome.eula.accept.click.1');await wait(()=>visible('.eula-dialog [role=alert]'));assert(state()===null&&visible('.welcome-consent-toggle').getAttribute('aria-checked')==='false','Failure accepted');}finally{Storage.prototype.setItem=original;}
            await click('welcome.eula.accept.click.1');await wait(()=>visible('.eula-loading'));assert(state()===null,'Saved before Loading');const loading=visible('.eula-loading'),r=loading.getBoundingClientRect(),hit=document.elementFromPoint(r.width/2,r.height/2);assert(loading===hit||loading.contains(hit),'Loading behind dialog');
            await click('welcome.eula.accept.click.1');await click('welcome.eula.decline.click.1');await wait(()=>!visible('.eula-dialog'));assert(state().revision===1,'Duplicate acceptance writes');assert(visible('.welcome-consent-toggle').getAttribute('aria-checked')==='true','Checkbox not linked');assert(Object.values(state().auth_flow.agreements).every(v=>v===false),'Community autoaccepted');return true;
            """) as? Bool
            XCTAssertEqual(savedOnce,true);checks.append("Storage failure rolls back; Loading precedes a single save and links checkbox without accepting registration choices")
            try await loadFreshConnection(host, route:"/pages/auth/welcome",selector:".welcome-page")
            let restored = try await script(host,driver + """
            await delay(350);assert(!visible('.eula-dialog')&&visible('.welcome-consent-toggle').getAttribute('aria-checked')==='true','Consent not restored');const before=localStorage.getItem('cimoa_app_state_v2');await click('welcome.goLogin.click.1');await wait(()=>visible('.login-page'));await click('login.goBack.click.1');await wait(()=>visible('.welcome-page'));assert(localStorage.getItem('cimoa_app_state_v2')===before,'Navigation changed data');await click('welcome.toggleAgreement.click.1');assert(state().app_consent.revision===null,'Revoke not saved');return true;
            """) as? Bool
            XCTAssertEqual(restored,true);checks.append("Refresh and Login return preserve agreement; unchecking revokes it")
            try await loadFreshConnection(host, route:"/pages/auth/community",selector:".community-page")
            let close = try await script(host,driver + """
            const before=localStorage.getItem('cimoa_app_state_v2');for(const kind of ['Terms','Privacy','Guides']){await click('agree.read'+kind+'.click.1');await wait(()=>visible('.agreement-sheet.event-dialog--open'));await delay(300);const x=visible('.agreement-close'),a=x.getBoundingClientRect(),s=[...document.querySelectorAll('.agreement-sheet .uni-scroll-view')].at(-1);s.scrollTop=s.scrollHeight;await delay(60);const b=x.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);assert(Math.abs(a.y-b.y)<1&&(x===hit||x.contains(hit)),'X not fixed/hittable');await click('sheetAgreement.closeSheet.click.2');await wait(()=>!visible('.agreement-sheet'));assert([...document.querySelectorAll('.community-check-area')].every(e=>e.getAttribute('aria-checked')==='false'),'Reading checked registration');}assert(localStorage.getItem('cimoa_app_state_v2')===before,'Reading wrote data');return true;
            """) as? Bool
            XCTAssertEqual(close,true);checks.append("Community long documents retain fixed right X and zero-write, independent registration choices")
            _ = try await host.webView.callAsyncJavaScript("fixture.data.session.expires_at=Date.now()+86400000;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(fixture));return true",arguments:["fixture":fixture],in:nil,contentWorld:.page)
            try await loadFreshConnection(host,route:"/pages/auth/splash",selector:".eula-dialog.event-dialog--open")
            let session = try await script(host,driver + """
            const before=JSON.stringify(state().session);await click('welcome.eula.accept.click.1');await wait(()=>visible('.home-header'));assert(JSON.stringify(state().session)===before,'Existing session changed');assert(!visible('.main-skeleton'),'Consent prepared auth skeleton');return true;
            """) as? Bool
            XCTAssertEqual(session,true);checks.append("Existing session resumes Home after explicit agreement without a new login/skeleton")
            try await restore()
            try JSONSerialization.data(withJSONObject:["result":"passed","checks":checks,"first_launch":first,"storage_restored":true,"scope":"EULA and shared agreement X increment; no App Store approval claim"],options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("native-acceptance.json"))
        } catch { try? await restore();throw error }
    }
    func testUnifiedLegalDocumentsAndCommunityGuidelines() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let folder = root.appendingPathComponent("docs/ui-restoration/community/legal-unification-2026-10-19")
        let browser = try JSONSerialization.jsonObject(with: Data(contentsOf: folder.appendingPathComponent("browser-acceptance.json"))) as! [String: Any]
        let documents = browser["documents"] as! [String: Any]
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: folder.appendingPathComponent("native-fixture.json"))) as! [String: Any]
        let driver = """
        const delay=ms=>new Promise(r=>setTimeout(r,ms));
        const visible=s=>[...document.querySelectorAll(s)].find(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.width>0&&r.height>0&&c.display!=='none'&&c.visibility!=='hidden'});
        const wait=async fn=>{for(let i=0;i<200;i++){const v=fn();if(v)return v;await delay(40)}throw Error('Legal document timeout '+location.hash)};
        const assert=(v,m)=>{if(!v)throw Error(m)};
        const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
        const sheetScroll=()=>[...document.querySelectorAll('.agreement-sheet .uni-scroll-view')].filter(e=>e.getBoundingClientRect().height>0).at(-1);
        const click=async id=>{const e=await wait(()=>visible('[data-interaction="'+id+'"]'));e.scrollIntoView({block:'nearest'});await delay(300);e.click();await delay(80)};
        const read=kind=>{const e=visible('.legal-document-content'),actual={id:e.dataset.legalDocument,revision:e.dataset.legalRevision,updated:e.querySelector('.legal-document-updated').textContent,intro:e.querySelector('.legal-document-intro').textContent,sections:[...e.querySelectorAll('.legal-document-section')].map(s=>[s.querySelector('.legal-document-heading').textContent,s.querySelector('.legal-document-copy').textContent]),footer:e.querySelector('.legal-document-footer').textContent};assert(JSON.stringify(canonical(actual))===JSON.stringify(canonical(documents[kind])),'Canonical text differs for '+kind);return actual};
        const openSheet=async(id,kind)=>{await click(id);await wait(()=>visible('.agreement-sheet.event-dialog--open'));await delay(300);read(kind);assert(visible('[role=dialog]').getAttribute('aria-label')==={terms:'Terms of Use',privacy:'Privacy Policy',community:'Community Guidelines'}[kind],'Document title differs');};
        const closeSheet=async()=>{const e=sheetScroll();e.scrollTop=e.scrollHeight;await click('sheetAgreement.closeSheet.click.2');await wait(()=>!visible('.agreement-sheet'));};
        """
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("for(const [key,value] of [['cimoa_app_state_v2',saved.state],['cimoa_app_state',saved.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}return true", arguments: ["saved": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?legalRestored=\(UUID().uuidString)#/pages/auth/splash")!))
        }
        var checks: [String] = []
        do {
            XCTAssertEqual(browser["result"] as? String, "passed")
            _ = try await script(host, "localStorage.removeItem('cimoa_app_state_v2');localStorage.removeItem('cimoa_app_state');return true")
            try await loadFreshConnection(host, route: "/pages/auth/community", selector: ".community-page")
            host.publishSafeArea()
            for (kind, name) in [("terms", "Terms"), ("privacy", "Privacy"), ("community", "Guides")] {
                let result = try await host.webView.callAsyncJavaScript(driver + """
                const before=localStorage.getItem('cimoa_app_state_v2');await openSheet('agree.read'+name+'.click.1',kind);
                const panel=visible('[role=dialog]').getBoundingClientRect(),scroll=sheetScroll();assert(scroll.scrollTop===0,'Sheet did not reset to the top');assert(scroll.scrollHeight>scroll.clientHeight,'Document must scroll');
                assert([...document.querySelectorAll('.community-check-area')].every(e=>e.getAttribute('aria-checked')==='false'),'Reading changed consent');assert(localStorage.getItem('cimoa_app_state_v2')===before,'Reading wrote storage');
                return {kind,sections:read(kind).sections.length,panel:{y:panel.y,bottom:panel.bottom},viewport:{width:innerWidth,height:innerHeight},safe:[...document.querySelectorAll('.community-page > .safe-area')].map(e=>e.getBoundingClientRect().height)};
                """, arguments: ["documents": documents, "kind": kind, "name": name], in: nil, contentWorld: .page) as! [String: Any]
                let safe = result["safe"] as! [Double], panel = result["panel"] as! [String: Double]
                guard safe.count == 2, safe.allSatisfy({ $0.isFinite }), abs(safe[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safe[1] - Double(host.view.safeAreaInsets.bottom)) <= 1, panel["y"]! >= safe[0] - 1 else {
                    throw NSError(domain: "CimoaTests", code: 19, userInfo: [NSLocalizedDescriptionKey: "Legal Sheet failed measured safe-area bounds"])
                }
                try (try await host.webView.takeSnapshot(configuration: nil)).pngData()!.write(to: folder.appendingPathComponent("\(kind)-sheet-wkwebview.png"))
                _ = try await host.webView.callAsyncJavaScript(driver + "await closeSheet();return true", arguments: ["documents": documents], in: nil, contentWorld: .page)
                checks.append("Community \(kind): identical complete text, measured safe areas, scroll, Close and zero consent writes")
            }
            try await loadFreshConnection(host, route: "/pages/auth/welcome", selector: ".welcome-page")
            let welcome = try await host.webView.callAsyncJavaScript(driver + """
            const before=localStorage.getItem('cimoa_app_state_v2');
            for(const [kind,name] of [['terms','Terms'],['privacy','Privacy']])for(const prefix of ['welcome.','welcome.consent.']){await click(prefix+'open'+name+'.click.1');await wait(()=>visible('.legal-'+kind+'-page'));read(kind);assert(visible('.event-page-header-title').textContent===({terms:'Terms of Use',privacy:'Privacy Policy'}[kind]),'Page title mismatch');await click('isLegalDoc.goBack.click.1');await wait(()=>visible('.welcome-page'));assert(visible('.welcome-consent-toggle').getAttribute('aria-checked')==='false','Policy accepted Welcome consent');}
            assert(localStorage.getItem('cimoa_app_state_v2')===before,'Welcome policy wrote data');return true
            """, arguments: ["documents": documents], in: nil, contentWorld: .page) as? Bool
            XCTAssertEqual(welcome, true); checks.append("Both Welcome link pairs match Community; Back preserves unaccepted gate and empty storage")
            _ = try await host.webView.callAsyncJavaScript("fixture.data.session.expires_at=Date.now()+86400000;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(fixture));return true", arguments: ["fixture": fixture], in: nil, contentWorld: .page)
            try await loadFreshConnection(host, route: "/pages/settings/legal", selector: ".settings-legal-page")
            let settings = try await host.webView.callAsyncJavaScript(driver + """
            const before=localStorage.getItem('cimoa_app_state_v2');for(const [kind,name] of [['terms','Terms'],['privacy','Privacy']]){await click('setLegal.open'+name+'.click.1');await wait(()=>visible('.legal-'+kind+'-page'));read(kind);await click('isLegalDoc.goBack.click.1');await wait(()=>visible('.settings-legal-page'));}
            await openSheet('setLegal.openAgreeInfo.click.1','community');await closeSheet();assert(localStorage.getItem('cimoa_app_state_v2')===before,'Settings policy wrote data');return true
            """, arguments: ["documents": documents], in: nil, contentWorld: .page) as? Bool
            XCTAssertEqual(settings, true); checks.append("Settings Legal reuses all three complete documents without account mutation")
            try await loadFreshConnection(host, route: "/pages/settings/index", selector: ".settings-page")
            _ = try await host.webView.callAsyncJavaScript(driver + "await openSheet('settings.openAgreeInfo.click.1','community');await closeSheet();return true", arguments: ["documents": documents], in: nil, contentWorld: .page)
            checks.append("Direct Settings Guidelines entry shares the same document")
            try await loadFreshConnection(host, route: "/pages/coins/help", selector: ".coin-help-page")
            let coins = try await host.webView.callAsyncJavaScript(driver + """
            const before=localStorage.getItem('cimoa_app_state_v2');for(const [kind,name] of [['terms','Terms'],['privacy','Privacy']]){await click('coinHelp.open'+name+'.click.1');await wait(()=>visible('.legal-'+kind+'-page'));read(kind);assert(location.hash.includes('origin=coins'),'Missing coin return origin');await click('isLegalDoc.goBack.click.1');await wait(()=>visible('.coin-help-page'));}assert(localStorage.getItem('cimoa_app_state_v2')===before,'Policy changed coin/account data');return true
            """, arguments: ["documents": documents], in: nil, contentWorld: .page) as? Bool
            XCTAssertEqual(coins, true); checks.append("Coin Help shows identical policies and returns to its own origin with zero ledger writes")
            try await restore()
            try JSONSerialization.data(withJSONObject: ["result":"passed","checks":checks,"snapshot_restored":true,"scope":"Shared legal content and UI entry regression, not App Store approval or full-App acceptance"], options: [.prettyPrinted,.sortedKeys]).write(to: folder.appendingPathComponent("native-acceptance.json"))
        } catch { try? await restore(); throw error }
    }
    private func autoMatchPixel(_ phase: String) async throws {
        let host = try await rawHost()
        let snapshot = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let folder = root.appendingPathComponent("docs/ui-restoration/auto-match-\(phase)")
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: folder.appendingPathComponent("native-fixture.json"))) as! [String: Any]
        let scripts = host.webView.configuration.userContentController.userScripts
        let matchTime = Date().timeIntervalSince1970 * 1000
        if phase == "found" {
            host.webView.configuration.userContentController.addUserScript(WKUserScript(source: "Date.now=()=>\(matchTime);", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        func restore() async throws {
            host.webView.configuration.userContentController.removeAllUserScripts()
            for script in scripts { host.webView.configuration.userContentController.addUserScript(script) }
            _ = try await host.webView.callAsyncJavaScript("for(const [key,value] of [['cimoa_app_state_v2',saved.state],['cimoa_app_state',saved.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}return true", arguments: ["saved": snapshot], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?matchRestore=\(UUID().uuidString)#/pages/auth/splash")!))
        }
        do {
            let encodedFixture=String(data: try JSONSerialization.data(withJSONObject: fixture), encoding: .utf8)!
            host.webView.configuration.userContentController.addUserScript(WKUserScript(source: "const fixture=\(encodedFixture);const at=\(matchTime);const data=fixture.data;data.session.expires_at=at+86400000;for(const m of data.match_sessions)if(m.match_id==='match_pixel'&&m.status==='found')m.expires_at=at+45000;localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data}));", injectionTime: .atDocumentStart, forMainFrameOnly: true))
            _ = try await host.webView.callAsyncJavaScript("const data=fixture.data;data.session.expires_at=at+86400000;for(const m of data.match_sessions)if(m.match_id==='match_pixel'&&m.status==='found')m.expires_at=at+45000;localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data}));return true", arguments: ["fixture": fixture,"at":matchTime], in: nil, contentWorld: .page)
            await WKWebsiteDataStore.default().removeData(ofTypes: [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache], modifiedSince: .distantPast)
            let servedEntry = try await script(host, "return await (await fetch('/index.html?verify=' + Date.now(),{cache:'no-store'})).text()") as! String
            let bundledEntry = try String(contentsOf: Bundle.main.url(forResource: "H5", withExtension: nil)!.appendingPathComponent("index.html"), encoding: .utf8)
            XCTAssertEqual(servedEntry, bundledEntry, "The host must serve the installed H5 bundle, not an older app shell")
            try await loadFreshConnection(host, route: fixture["route"] as! String, selector: ".auto-match-\(phase)")
            host.publishSafeArea()
            let metrics = try await script(host, """
            await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));for(const a of document.getAnimations()){if(a.effect.getComputedTiming().iterations===Infinity){a.pause();a.currentTime=0}else a.finish()}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
            const root=document.querySelector('.auto-match-\(phase)'),box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}},header=root.querySelector('.secondary-page-header'),footer=root.querySelector('.am-footer');
            return {viewport:{width:innerWidth,height:innerHeight},origin:location.origin,safe:[getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-top'),getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-bottom')],overflow:document.documentElement.scrollWidth>innerWidth,header:box(header),footer:footer?box(footer):null,errors:[...root.querySelectorAll('[role="alert"]')].map(e=>e.textContent),images:[...root.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0),text:root.innerText};
            """) as! [String: Any]
            XCTAssertEqual(metrics["overflow"] as? Bool, false)
            XCTAssertEqual(metrics["images"] as? Bool, true)
            XCTAssertEqual(metrics["origin"] as? String, BundleHTTPServer.origin)
            XCTAssertEqual((metrics["errors"] as? [String])?.count, 0)
            let image = try await host.webView.takeSnapshot(configuration: nil)
            try image.pngData()!.write(to: folder.appendingPathComponent("actual-wkwebview.png"))
            try JSONSerialization.data(withJSONObject: metrics, options: [.prettyPrinted,.sortedKeys]).write(to: folder.appendingPathComponent("wkwebview-geometry.json"))
            if phase == "preferences" {
                for (entry, name) in [("amPrefs.openUniPicker.click.1","university"),("amPrefs.openInterestsPicker.click.1","interests")] {
                    _ = try await script(host, "const e=document.querySelector('[data-interaction=\"\(entry)\"]');e.scrollIntoView({block:'center'});e.click();await new Promise(r=>setTimeout(r,350));return true")
                    let shot = try await host.webView.takeSnapshot(configuration: nil)
                    let output = folder.appendingPathComponent(name)
                    try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
                    try shot.pngData()!.write(to: output.appendingPathComponent("actual-wkwebview.png"))
                    _ = try await script(host, "document.querySelector('.match-picker .event-dialog-mask').click();await new Promise(r=>setTimeout(r,300));return true")
                }
            }
            if phase == "searching" || phase == "found" {
                let cases = phase == "searching" ? [("amSearching.openAmHelp.click.1","help"),("amSearching.openBoost.click.1","boost"),("amSearching.askLeave.click.1","leaving")] : [("amFound.connectAsk.click.1","accepting"),("amFound.askLeaveMatch.click.1","leave-match")]
                for (entry,name) in cases {
                    _ = try await script(host, "document.querySelector('[data-interaction=\"\(entry)\"]').click();await new Promise(r=>setTimeout(r,350));return true")
                    let output = folder.appendingPathComponent(name)
                    try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
                    let shot = try await host.webView.takeSnapshot(configuration: nil)
                    try shot.pngData()!.write(to: output.appendingPathComponent("actual-wkwebview.png"))
                    _ = try await script(host, "document.querySelector('.match-source-sheet .event-dialog--open .event-dialog-mask').click();await new Promise(r=>setTimeout(r,300));return true")
                }
            }
            if phase == "waiting" {
                _ = try await script(host, "document.querySelector('[data-interaction=\"amWaiting.cancelRequest.click.1\"]').click();await new Promise(r=>setTimeout(r,350));return true")
                let output = folder.appendingPathComponent("cancel")
                try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
                let shot = try await host.webView.takeSnapshot(configuration: nil)
                try shot.pngData()!.write(to: output.appendingPathComponent("actual-wkwebview.png"))
                _ = try await script(host, "document.querySelector('.match-source-sheet .event-dialog--open .event-dialog-mask').click();await new Promise(r=>setTimeout(r,300));return true")
            }
            try await restore()
        } catch {
            if let debug = try? await script(host, "return {url:location.href,text:document.body.innerText,html:document.body.innerHTML.slice(0,4000),scripts:[...document.scripts].map(s=>s.src),served:await (await fetch('/index.html?debug='+Date.now(),{cache:'no-store'})).text()}") {
                try? JSONSerialization.data(withJSONObject: debug, options: [.prettyPrinted,.sortedKeys]).write(to: folder.appendingPathComponent("wkwebview-failure.json"))
            }
            try? await restore(); throw error
        }
    }
    func testAutoMatchIndexPixel() async throws { try await autoMatchPixel("index") }
    func testAutoMatchPreferencesPixel() async throws { try await autoMatchPixel("preferences") }
    func testAutoMatchSearchingPixel() async throws { try await autoMatchPixel("searching") }
    func testAutoMatchPausedPixel() async throws { try await autoMatchPixel("paused") }
    func testAutoMatchFoundPixel() async throws { try await autoMatchPixel("found") }
    func testAutoMatchWaitingPixel() async throws { try await autoMatchPixel("waiting") }
    func testAutoMatchConnectedPixel() async throws { try await autoMatchPixel("connected") }
    func testAutoMatchPassedPixel() async throws { try await autoMatchPixel("passed") }
    func testAutoMatchExpiredPixel() async throws { try await autoMatchPixel("expired") }
    func testAutoMatchNoMatchPixel() async throws { try await autoMatchPixel("no-match") }
    func testAutoMatchHistoryPixel() async throws { try await autoMatchPixel("history") }
    func testAutoMatchFullRecoveryFlow() async throws {
        let host=try await rawHost()
        let snapshot=try await script(host,"return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String:Any]
        let originalScripts=host.webView.configuration.userContentController.userScripts
        var root=URL(fileURLWithPath:#filePath);for _ in 0..<4 {root.deleteLastPathComponent()}
        let folder=root.appendingPathComponent("docs/evidence/auto-match")
        let fixture=try JSONSerialization.jsonObject(with:Data(contentsOf:folder.appendingPathComponent("flow-native-fixture.json"))) as! [String:Any]
        var checks=[String]()
        func click(_ id:String) async throws {
            _=try await script(host,"const e=[...document.querySelectorAll('[data-interaction=\"\(id)\"]')].find(e=>e.closest('uni-page')===[...document.querySelectorAll('uni-page')].at(-1));if(!e)throw Error('Missing \(id)');e.scrollIntoView({block:'center'});e.click();await new Promise(r=>setTimeout(r,280));return true")
        }
        func open(_ route:String,_ selector:String) async throws {try await loadFreshConnection(host,route:route,selector:selector)}
        func login(_ email:String) async throws {
            try await open("/pages/settings/index",".settings-page")
            try await click("settings.openLogoutConfirm.click.1");try await click("sheetLogout.logOut2.click.1");try await waitFor(host,".welcome-page")
            _=try await script(host,"const check=document.querySelector('.welcome-consent-toggle');if(check.getAttribute('aria-checked')!=='true')check.click();document.querySelector('.welcome-login').click();return true");try await waitFor(host,".login-page input")
            _=try await host.webView.callAsyncJavaScript("await new Promise(r=>setTimeout(r,280));const inputs=document.querySelectorAll('.login-page input');for(const [i,v]of[email,'12341234'].entries()){inputs[i].value=v;inputs[i].dispatchEvent(new Event('input',{bubbles:true}))}await Promise.resolve();document.querySelector('[data-interaction=\"login.loginNow.click.1\"]').click();return true",arguments:["email":email],in:nil,contentWorld:.page)
            try await waitFor(host,".home-header");try await Task.sleep(nanoseconds:800_000_000)
        }
        func restore() async throws {
            host.webView.configuration.userContentController.removeAllUserScripts();for item in originalScripts {host.webView.configuration.userContentController.addUserScript(item)}
            _=try await host.webView.callAsyncJavaScript("for(const [k,v]of[['cimoa_app_state_v2',saved.state],['cimoa_app_state',saved.legacy]]){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}return true",arguments:["saved":snapshot],in:nil,contentWorld:.page)
            host.webView.load(URLRequest(url:URL(string:BundleHTTPServer.origin+"/index.html?matchFlowRestore=\(UUID().uuidString)#/pages/auth/splash")!))
        }
        do {
            let text=String(data:try JSONSerialization.data(withJSONObject:fixture),encoding:.utf8)!
            host.webView.configuration.userContentController.addUserScript(WKUserScript(source:"const data=\(text);data.session.expires_at=Date.now()+86400000;localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data}));",injectionTime:.atDocumentStart,forMainFrameOnly:true))
            await WKWebsiteDataStore.default().removeData(ofTypes:[WKWebsiteDataTypeDiskCache,WKWebsiteDataTypeMemoryCache],modifiedSince:.distantPast)
            try await open("/pages/auto-match/index",".auto-match-index")
            host.webView.configuration.userContentController.removeAllUserScripts();for item in originalScripts {host.webView.configuration.userContentController.addUserScript(item)}
            try await click("amEntry.joinPool.click.1");try await waitFor(host,".auto-match-searching")
            let id=try await script(host,"return JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.match_sessions.find(m=>m.owner_user_id==='user_cimoa').match_id") as! String
            try await click("amSearching.pauseQueue.click.1");try await waitFor(host,".auto-match-paused")
            let remaining=try await script(host,"return JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.match_sessions.find(m=>m.match_id==='\(id)').search_remaining_ms") as! Double
            let backgroundToken=UUID().uuidString
            try Data(backgroundToken.utf8).write(to:folder.appendingPathComponent("native-background-ready.txt"))
            var backgroundReturned=false
            for _ in 0..<120 {
                if (try? String(contentsOf:folder.appendingPathComponent("native-background-done.txt"),encoding:.utf8))==backgroundToken {backgroundReturned=true;break}
                try await Task.sleep(nanoseconds:100_000_000)
            }
            XCTAssertTrue(backgroundReturned,"The simulator background/foreground check must finish before recovery")
            try await open("/pages/auto-match/paused?match_id=\(id)",".auto-match-paused")
            let restored=try await script(host,"return JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.match_sessions.find(m=>m.match_id==='\(id)').search_remaining_ms") as! Double
            XCTAssertEqual(remaining,restored)
            try await open("/pages/home/index",".home-header");try await click("home.amCardGo.click.1");try await waitFor(host,".auto-match-paused")
            try await click("amPaused.resumeQueue.click.1");try await waitFor(host,".auto-match-searching");try await waitFor(host,".auto-match-found")
            checks.append("Actual simulator background/foreground, device-engine search, same-ID pause/reload/resume, Home recovery")
            try await click("amFound.connectAsk.click.1");try await click("sheetAccepting.confirmConnect.click.1");try await waitFor(host,".auto-match-waiting")
            try await click("amWaiting.returnHome.click.1");try await waitFor(host,".home-header");try await click("home.amCardGo.click.1");try await waitFor(host,".auto-match-waiting")
            try await open("/pages/auto-match/waiting?match_id=\(id)",".auto-match-waiting")
            let noConsent=try await script(host,"return JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.match_sessions.find(m=>m.match_id==='\(id)').peer_accepted") as! Bool;XCTAssertFalse(noConsent)
            checks.append("Invitation persists through Home and a fresh WKWebView document, without peer consent")
            try await login("zane@cimoa.test");try await click("home.openMatchInvitation.click.1");try await waitFor(host,".connection-received-page")
            try await click("reqReceived.accept.click.1");_=try await script(host,"document.querySelector('.dialog__confirm').click();return true");try await waitFor(host,".connection-accepted-page")
            try await login("cimoa@gmail.com");try await open("/pages/auto-match/waiting?match_id=\(id)",".auto-match-connected")
            try await click("amConnected.startChat.click.1");try await waitFor(host,".direct-chat-page");try await click("chat.goBack.click.1");try await waitFor(host,".auto-match-connected")
            try await click("amConnected.viewProfile.click.1");try await waitFor(host,".expanded-profile-page")
            let chat=try await script(host,"return [...document.querySelectorAll('[data-interaction=\"expanded.sayHi.click.1\"]')].some(e=>e.textContent.trim()==='Chat')") as! Bool;XCTAssertTrue(chat)
            try await click("expanded.collapse.click.1");try await waitFor(host,".auto-match-connected");try await click("amConnected.goBack.click.1");try await waitFor(host,".home-header")
            checks.append("Signed-in peer accepts via UI; reciprocal consent, owner recovery, profile Chat and existing Conversation")
            try await open("/pages/auto-match/index",".auto-match-index");try await click("amEntry.openHistory.click.1");try await waitFor(host,".auto-match-history");try await click("amHistory.h.go.click.1");try await waitFor(host,".auto-match-connected")
            let report=try await script(host,"const d=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,m=d.match_sessions.find(m=>m.match_id==='\(id)');return {match_id:m.match_id,state:m.status,consents:d.relationships.filter(r=>r.source_match_id===m.match_id).length,quota:d.match_quota.find(q=>q.owner_user_id==='user_cimoa').used_count,balance:d.coin_transactions.filter(t=>t.owner_user_id==='user_cimoa'&&t.status==='completed').reduce((n,t)=>n+t.amount,0),overflow:document.documentElement.scrollWidth>innerWidth,origin:location.origin}") as! [String:Any]
            XCTAssertEqual(report["state"] as? String,"connected");XCTAssertEqual(report["consents"] as? Int,2);XCTAssertEqual(report["quota"] as? Int,1);XCTAssertEqual(report["balance"] as? Int,260);XCTAssertEqual(report["overflow"] as? Bool,false)
            checks.append("Entry History restores the same result; one admission, unchanged ledger, correct bundle origin")
            try JSONSerialization.data(withJSONObject:["passed":true,"checks":checks,"state":report],options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("flow-wkwebview.json"))
            try await restore()
        } catch {
            if let debug=try? await script(host,"return {url:location.href,text:document.body.innerText}"){try? JSONSerialization.data(withJSONObject:debug,options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("flow-wkwebview-failure.json"))}
            try? await restore();throw error
        }
    }
    private func discoverRequestPixel(_ phase: String) async throws {
        let host = try await rawHost()
        let snapshot = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let folder = root.appendingPathComponent("docs/ui-restoration/discover-request-\(phase)")
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: folder.appendingPathComponent("native-fixture.json"))) as! [String: Any]
        var installedMedia = false
        func restore() async throws {
            if installedMedia {
                _ = try await host.webView.callAsyncJavaScript("const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_media_v2',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const t=db.transaction('blobs','readwrite');t.objectStore('blobs').delete(id);t.oncomplete=resolve;t.onerror=()=>reject(t.error)});db.close();return true", arguments: ["id": fixture["media_id"]!], in: nil, contentWorld: .page)
            }
            _ = try await host.webView.callAsyncJavaScript("for(const [key,value] of [['cimoa_app_state_v2',saved.state],['cimoa_app_state',saved.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}return true", arguments: ["saved": snapshot], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?discoverRequestRestore=\(UUID().uuidString)#/pages/auth/splash")!))
        }
        do {
            _ = try await host.webView.callAsyncJavaScript("const data=fixture.data;data.session.expires_at=Date.now()+86400000;localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data}));return true", arguments: ["fixture": fixture], in: nil, contentWorld: .page)
            if let base64 = fixture["media_base64"] as? String {
                _ = try await host.webView.callAsyncJavaScript("const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_media_v2',1);r.onupgradeneeded=()=>r.result.createObjectStore('blobs');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const t=db.transaction('blobs','readwrite');t.objectStore('blobs').add(new Blob([bytes],{type:'audio/wav'}),id);t.oncomplete=resolve;t.onerror=()=>reject(t.error)});db.close();return true", arguments: ["base64": base64, "id": fixture["media_id"]!], in: nil, contentWorld: .page)
                installedMedia = true
            }
            let selector = phase == "deck" ? ".discover-photo-card--front" : phase == "profile" ? ".expanded-profile-page" : ".ice-\(phase)-page"
            try await loadFreshConnection(host, route: fixture["route"] as! String, selector: selector)
            host.publishSafeArea()
            let metrics = try await script(host, """
            const delay=ms=>new Promise(r=>setTimeout(r,ms));await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));for(const a of document.getAnimations())if(a.effect.getComputedTiming().iterations!==Infinity)a.finish();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await delay(200);
            const root=document.querySelector('\(selector)'),box=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
            return {viewport:{width:innerWidth,height:innerHeight},origin:location.origin,safe:[getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-top'),getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-bottom')],overflow:document.documentElement.scrollWidth>innerWidth,images:[...root.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0),header:box('.discover-toolbar,.expanded-header,.ice-header'),card:box('.discover-photo-card--front,.ice-person,.ice-question'),footer:box('.discover-send,.ice-footer'),text:root.innerText};
            """) as! [String: Any]
            XCTAssertEqual(metrics["overflow"] as? Bool, false); XCTAssertEqual(metrics["images"] as? Bool, true)
            XCTAssertEqual(metrics["origin"] as? String, BundleHTTPServer.origin)
            let image = try await host.webView.takeSnapshot(configuration: nil)
            try image.pngData()!.write(to: folder.appendingPathComponent("actual-wkwebview.png"))
            try JSONSerialization.data(withJSONObject: metrics, options: [.prettyPrinted,.sortedKeys]).write(to: folder.appendingPathComponent("wkwebview-geometry.json"))
            if phase == "deck" {
                let result = try await script(host, """
                const delay=ms=>new Promise(r=>setTimeout(r,ms)),wait=async s=>{for(let i=0;i<150;i++){const e=[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0);if(e)return e;await delay(40)}throw Error(s)};
                const before=localStorage.getItem('cimoa_app_state_v2'),card=document.querySelector('.discover-photo-card--front'),id=card.dataset.userId;card.click();await wait('.expanded-profile-page');await delay(300);(await wait('[data-interaction="expanded.collapse.click.1"]')).click();const returned=(await wait('.discover-photo-card--front')).dataset.userId;await delay(300);(await wait('[data-interaction="photo.sayHi.click.1"]')).click();await wait('[data-interaction="ibSelect.answerGo.click.1"]');return {id,returned,user:location.hash.includes('user_zane'),read_only:before===localStorage.getItem('cimoa_app_state_v2')};
                """) as! [String: Any]
                XCTAssertEqual(result["returned"] as? String, result["id"] as? String); XCTAssertEqual(result["user"] as? Bool, true); XCTAssertEqual(result["read_only"] as? Bool, true)
                try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted,.sortedKeys]).write(to: folder.appendingPathComponent("wkwebview-acceptance.json"))
            }
            if phase == "text" {
                let result = try await script(host, """
                const delay=ms=>new Promise(r=>setTimeout(r,ms)),wait=async fn=>{for(let i=0;i<200;i++){const v=fn();if(v)return v;await delay(40)}throw Error('Text flow '+document.body.innerText)};
                const input=document.querySelector('textarea');input.value='A campus walk after lectures sounds good.';input.dispatchEvent(new Event('input',{bubbles:true}));await wait(()=>JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.drafts.find(d=>d.draft_id==='draft_discover').payload.text===input.value);
                const before=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;document.querySelector('[data-interaction="ibText.continueText.click.1"]').click();document.querySelector('[data-interaction="ibText.continueText.click.1"]').click();await wait(()=>document.querySelector('.connection-sent-page'));
                const after=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,requests=after.requests.filter(r=>r.sender_id==='user_cimoa'&&r.recipient_id==='user_zane');return {count:requests.length,pending:requests[0]?.status==='pending',free:JSON.stringify(before.coin_transactions)===JSON.stringify(after.coin_transactions),text:requests[0]?.text};
                """) as! [String: Any]
                XCTAssertEqual(result["count"] as? Int, 1); XCTAssertEqual(result["pending"] as? Bool, true); XCTAssertEqual(result["free"] as? Bool, true)
                try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted,.sortedKeys]).write(to: folder.appendingPathComponent("wkwebview-acceptance.json"))
            }
            if phase == "voice" {
                let result = try await script(host, """
                const delay=ms=>new Promise(r=>setTimeout(r,ms)),before=localStorage.getItem('cimoa_app_state_v2');document.querySelector('[data-interaction="ibVoice.record.click.1"]').click();for(let i=0;i<100;i++){const dialog=document.querySelector('.intro-sheet .event-dialog--open'),deny=document.querySelector('[data-interaction="sheetMic.denyMic.click.1"]');if(deny&&deny.getBoundingClientRect().height>0){await delay(300);deny.click();return {cancel_read_only:before===localStorage.getItem('cimoa_app_state_v2'),recorder_supported:typeof MediaRecorder==='function',capture_supported:typeof navigator.mediaDevices?.getUserMedia==='function'}}await delay(40)}throw Error('Mic pre-prompt missing');
                """) as! [String: Any]
                XCTAssertEqual(result["cancel_read_only"] as? Bool, true)
                try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted,.sortedKeys]).write(to: folder.appendingPathComponent("wkwebview-acceptance.json"))
            }
            if phase == "preview" {
                let result = try await script(host, """
                const delay=ms=>new Promise(r=>setTimeout(r,ms)),visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0),wait=async fn=>{for(let i=0;i<200;i++){const v=fn();if(v)return v;await delay(40)}throw Error('Voice confirmation '+document.body.innerText)};
                await wait(()=>visible('[data-interaction="ibPreview.togglePlay.click.1"]')?.getAttribute('aria-disabled')!=='true');visible('[data-interaction="ibPreview.togglePlay.click.1"]').click();await wait(()=>visible('.ice-audio')?.dataset.playing==='true');await delay(200);const progress=visible('.ice-audio-track > uni-view').style.width;
                const before=localStorage.getItem('cimoa_app_state_v2');visible('[data-interaction="ibPreview.continueVoice.click.1"]').click();await wait(()=>visible('[data-interaction="sheetVoiceCoin.spendVoice.click.1"]'));const no_write=before===localStorage.getItem('cimoa_app_state_v2');await delay(300);visible('[data-interaction="sheetVoiceCoin.spendVoice.click.1"]').click();await wait(()=>visible('.connection-sent-page'));const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,request=data.requests.find(r=>r.recipient_id==='user_zane'&&r.sender_id==='user_cimoa');return {played:true,progress,no_write,kind:request?.kind,status:request?.status,debits:data.coin_transactions.filter(t=>t.related_id===request?.request_id&&t.amount===-10).length};
                """) as! [String: Any]
                XCTAssertEqual(result["played"] as? Bool, true); XCTAssertEqual(result["no_write"] as? Bool, true); XCTAssertEqual(result["kind"] as? String, "voice"); XCTAssertEqual(result["status"] as? String, "pending"); XCTAssertEqual(result["debits"] as? Int, 1)
                try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted,.sortedKeys]).write(to: folder.appendingPathComponent("wkwebview-acceptance.json"))
            }
            try await restore()
        } catch { try? await restore(); throw error }
    }
    func testDiscoverRequestDeckPixel() async throws { try await discoverRequestPixel("deck") }
    func testDiscoverRequestProfilePixel() async throws { try await discoverRequestPixel("profile") }
    func testDiscoverRequestSelectPixel() async throws { try await discoverRequestPixel("select") }
    func testDiscoverRequestTextPixel() async throws { try await discoverRequestPixel("text") }
    func testDiscoverRequestVoicePixel() async throws { try await discoverRequestPixel("voice") }
    func testDiscoverRequestPreviewPixel() async throws { try await discoverRequestPixel("preview") }
    // Explicit user approval: a short real microphone capture, never retained in evidence.
    func testDiscoverRequestRealMicrophoneAndCleanup() async throws {
        let host = try await rawHost()
        let snapshot = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let folder = root.appendingPathComponent("docs/ui-restoration/discover-request-voice")
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: folder.appendingPathComponent("native-fixture.json"))) as! [String: Any]
        var recordedID: String?
        func restore() async throws {
            // Dispose the page's recorder/playback before removing only the isolated test Blob.
            if recordedID == nil {
                recordedID = try? await script(host, "const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;return data.drafts.find(d=>d.draft_id==='draft_discover')?.payload.audio_id||''") as? String
            }
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?micCleanup=\(UUID().uuidString)#/pages/discover/icebreaker/voice?user_id=user_zane&draft_id=draft_discover")!))
            for _ in 0..<60 {
                if !host.webView.isLoading { break }
                try await Task.sleep(nanoseconds: 50_000_000)
            }
            if let id = recordedID, !id.isEmpty {
                let removed = try await host.webView.callAsyncJavaScript("const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_media_v2',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const t=db.transaction('blobs','readwrite');t.objectStore('blobs').delete(id);t.oncomplete=resolve;t.onerror=()=>reject(t.error)});const removed=await new Promise((resolve,reject)=>{const t=db.transaction('blobs','readonly'),r=t.objectStore('blobs').get(id);r.onsuccess=()=>resolve(r.result===undefined);r.onerror=()=>reject(r.error)});db.close();return removed", arguments: ["id": id], in: nil, contentWorld: .page) as? Bool
                XCTAssertEqual(removed, true)
            }
            _ = try await host.webView.callAsyncJavaScript("for(const [key,value] of [['cimoa_app_state_v2',saved.state],['cimoa_app_state',saved.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}return true", arguments: ["saved": snapshot], in: nil, contentWorld: .page)
            let restored = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
            XCTAssertEqual(restored as NSDictionary, snapshot as NSDictionary)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?micRestored=\(UUID().uuidString)#/pages/auth/splash")!))
        }
        do {
            _ = try await host.webView.callAsyncJavaScript("const data=fixture.data;data.session.expires_at=Date.now()+86400000;localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data}));return true", arguments: ["fixture": fixture], in: nil, contentWorld: .page)
            try await loadFreshConnection(host, route: fixture["route"] as! String, selector: ".ice-voice-page")
            _ = try await script(host, "document.querySelector('[data-interaction=\"ibVoice.record.click.1\"]').click();return true")
            try await waitFor(host, "[data-interaction=\"sheetMic.allowMic.click.1\"]")
            try await Task.sleep(nanoseconds: 300_000_000)
            _ = try await script(host, "document.querySelector('[data-interaction=\"sheetMic.allowMic.click.1\"]').click();return true")
            var started = false
            for _ in 0..<240 {
                if (try? await script(host, "return !!document.querySelector('[aria-label=\"Stop recording\"]')")) as? Bool == true { started = true; break }
                try await Task.sleep(nanoseconds: 250_000_000)
            }
            guard started else { throw NSError(domain: "CimoaTests", code: 31, userInfo: [NSLocalizedDescriptionKey: "Real microphone did not start: \(try await script(host, "return document.body.innerText"))"]) }
            try await Task.sleep(nanoseconds: 2_000_000_000)
            _ = try await script(host, "document.querySelector('[aria-label=\"Stop recording\"]').click();return true")
            try await waitForPreparedAudio(host, selector: "[data-interaction=\"ibVoice.toggleVoicePlay.click.1\"]")
            _ = try await script(host, "document.querySelector('[data-interaction=\"ibVoice.goBack.click.1\"]').click();for(let i=0;i<80;i++){const e=document.querySelector('[data-interaction=\"sheetVoiceDiscard.closeSheet.click.2\"]');if(e&&e.getBoundingClientRect().height>0){await new Promise(r=>setTimeout(r,300));return true}await new Promise(r=>setTimeout(r,30))}throw Error('Source discard sheet missing')")
            let discardImage = try await host.webView.takeSnapshot(configuration: nil)
            try discardImage.pngData()!.write(to: folder.appendingPathComponent("actual-wkwebview-discard.png"))
            _ = try await script(host, "document.querySelector('[data-interaction=\"sheetVoiceDiscard.closeSheet.click.2\"]').click();return true")
            try await Task.sleep(nanoseconds: 300_000_000)
            _ = try await script(host, "document.querySelector('[data-interaction=\"ibVoice.sendVoiceRequest.click.1\"]').click();return true")
            try await waitFor(host, ".ice-preview-page")
            let media = try await script(host, "const d=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,id=d.drafts.find(d=>d.draft_id==='draft_discover').payload.audio_id,m=d.media_files.find(m=>m.media_id===id);return {id,duration:m.duration_ms,requests:d.requests.filter(r=>r.sender_id==='user_cimoa'&&r.recipient_id==='user_zane').length}") as! [String: Any]
            recordedID = media["id"] as? String
            XCTAssertGreaterThan(media["duration"] as? Double ?? 0, 1000); XCTAssertEqual(media["requests"] as? Int, 0)
            try await loadFreshConnection(host, route: "/pages/discover/icebreaker/preview?user_id=user_zane&draft_id=draft_discover&media_id=\(recordedID!)", selector: ".ice-preview-page")
            try await waitForPreparedAudio(host, selector: "[data-interaction=\"ibPreview.togglePlay.click.1\"]")
            let played = try await script(host, "document.querySelector('[data-interaction=\"ibPreview.togglePlay.click.1\"]').click();for(let i=0;i<80;i++){if(document.querySelector('.ice-audio')?.dataset.playing==='true')return true;await new Promise(r=>setTimeout(r,30))}return false") as? Bool
            XCTAssertEqual(played, true)
            try await restore()
            let evidence: [String: Any] = ["result": "passed", "capture": "real WKWebView getUserMedia/MediaRecorder", "duration_ms": media["duration"]!, "discard_cancel_preserved_recording": true, "playable_after_refresh": played == true, "test_blob_removed": true, "account_snapshot_restored": true, "recording_bytes_saved_to_evidence": false]
            try JSONSerialization.data(withJSONObject: evidence, options: [.prettyPrinted,.sortedKeys]).write(to: folder.appendingPathComponent("wkwebview-real-microphone.json"))
        } catch { try? await restore(); throw error }
    }
    private func installConnectionChatFixture(_ host: WebViewController) async throws {
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("docs/ui-restoration/connection-chat/native-fixture.json"))) as! [String: Any]
        _ = try await host.webView.callAsyncJavaScript("const data=fixture.data,owner=data.session.current_user_id;for(const message of data.messages)if(message.conversation_id==='conversation_chloe'&&!message.read_by.includes(owner))message.read_by.push(owner);localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data}));return true", arguments: ["fixture": fixture], in: nil, contentWorld: .page)
        let installed = try await script(host, "const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;return {revision:'isolated-audio-v2',owner:data.session.current_user_id,conversation:!!data.conversations.find(row=>row.conversation_id==='conversation_chloe'),blocked:data.blocked_users.some(row=>row.user_id==='user_chloe')}")
        try JSONSerialization.data(withJSONObject: installed, options: [.prettyPrinted,.sortedKeys]).write(to: root.appendingPathComponent("docs/evidence/connection-core/native-isolation.json"))
    }
    private func loadFreshConnection(_ host: WebViewController, route: String, selector: String) async throws {
        _ = try await script(host, "window.__connectionRegressionOld=true;return true")
        host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?connectionRegression=\(UUID().uuidString)#\(route)")!, cachePolicy: .reloadIgnoringLocalCacheData))
        for _ in 0..<100 {
            if (try? await script(host, "return !window.__connectionRegressionOld&&!!document.querySelector('\(selector)')")) as? Bool == true { return }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        throw NSError(domain: "CimoaTests", code: 9, userInfo: [NSLocalizedDescriptionKey: "Fresh regression document unavailable"])
    }
    private func waitForPreparedAudio(_ host: WebViewController, selector: String) async throws {
        for _ in 0..<100 {
            if (try? await script(host, "const element=document.querySelector('\(selector)');return !!element&&element.getAttribute('aria-disabled')!=='true'")) as? Bool == true { return }
            try await Task.sleep(nanoseconds: 30_000_000)
        }
        throw NSError(domain: "CimoaTests", code: 10, userInfo: [NSLocalizedDescriptionKey: "Audio is still preparing"])
    }
    private func connectionPixel(_ page: String) async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let output = root.appendingPathComponent("docs/ui-restoration/connection-\(page)")
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: output.appendingPathComponent("native-fixture.json"))) as! [String: Any]
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("for(const [key,value] of [['cimoa_app_state_v2',snapshot.state],['cimoa_app_state',snapshot.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)};return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?connectionRestore=1#/pages/auth/splash")!))
        }
        do {
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data:fixture}));window.__connectionOld=true;return true", arguments: ["fixture": fixture["data"]!], in: nil, contentWorld: .page)
            let route = fixture["route"] as! String
            await WKWebsiteDataStore.default().removeData(ofTypes: [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache], modifiedSince: .distantPast)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?connectionPixel=\(page)-\(UUID().uuidString)#\(route)")!, cachePolicy: .reloadIgnoringLocalCacheData))
            let selector = page == "chat" ? ".direct-chat-page" : ".connection-\(page)-page"
            for _ in 0..<100 {
                if (try? await script(host, "return !window.__connectionOld&&!!document.querySelector('\(selector)')")) as? Bool == true { break }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            let freshDocument = try await script(host, "return !window.__connectionOld") as? Bool
            XCTAssertEqual(freshDocument, true, "A fresh bundled document is required; an old visible route is not evidence.")
            try await waitFor(host, selector); host.publishSafeArea()
            if page == "chat" {
                for _ in 0..<30 {
                    if (try? await script(host, "return ![...document.querySelectorAll('.event-loading')].some(el=>el.getBoundingClientRect().height>0&&getComputedStyle(el).display!=='none')")) as? Bool == true { break }
                    try await Task.sleep(nanoseconds: 100_000_000)
                }
            }
            let metrics = try await script(host, """
            await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})));for(const animation of document.getAnimations())if(animation.effect.getComputedTiming().iterations!==Infinity)animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            const root=document.querySelector('\(selector)'),box=selector=>{const el=document.querySelector(selector);if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
            return {viewport:{width:innerWidth,height:innerHeight},safe:[...root.children].filter(el=>el.classList.contains('safe-area')).map(el=>el.getBoundingClientRect().height),header:box('.connection-header,.chat-header'),footer:box('.connection-footer,.chat-composer'),photo:box('.received-photo-card'),overflow:document.documentElement.scrollWidth>innerWidth,images:[...root.querySelectorAll('img')].every(image=>image.complete&&image.naturalWidth>0),text:root.innerText,origin:location.origin};
            """) as! [String: Any]
            XCTAssertEqual(metrics["origin"] as? String, BundleHTTPServer.origin)
            XCTAssertEqual(metrics["overflow"] as? Bool, false); XCTAssertEqual(metrics["images"] as? Bool, true)
            let safe = metrics["safe"] as! [Double]
            XCTAssertEqual(safe[0], Double(host.view.safeAreaInsets.top), accuracy: 1)
            XCTAssertEqual(safe[1], Double(host.view.safeAreaInsets.bottom), accuracy: 1)
            let viewport = metrics["viewport"] as! [String: Double], scale = viewport["width"]! / 393
            if let header = metrics["header"] as? [String: Double] { XCTAssertEqual(header["y"]!, safe[0] + (page == "chat" ? 2 : 4) * scale, accuracy: 1) }
            if let footer = metrics["footer"] as? [String: Double] { XCTAssertLessThanOrEqual(footer["bottom"]!, viewport["height"]! - safe[1] + 1) }
            try await Task.sleep(nanoseconds: 200_000_000)
            let snapshot = try await host.webView.takeSnapshot(configuration: nil)
            try snapshot.pngData()!.write(to: output.appendingPathComponent("actual-wkwebview.png"))
            let attachment = XCTAttachment(image: snapshot); attachment.name = "Connection \(page) real WKWebView"; attachment.lifetime = .keepAlways; add(attachment)
            try JSONSerialization.data(withJSONObject: metrics, options: [.prettyPrinted,.sortedKeys]).write(to: output.appendingPathComponent("wkwebview-geometry.json"))
            if page == "received" {
                let gallery = try await script(host, """
                document.querySelector('[data-interaction="reqReceived.openGallery.click.1"]').click();for(let i=0;i<80;i++){const panel=document.querySelector('.received-gallery .profile-photo[data-media-status="ready"]'),dialog=panel?.closest('.event-dialog--open');if(dialog&&dialog.getBoundingClientRect().height>0){const layer=dialog.getBoundingClientRect();document.querySelector('[data-interaction="reqReceived.gallery.close.click.2"]').click();return {height:layer.height,width:layer.width,viewport:innerHeight}}await new Promise(resolve=>setTimeout(resolve,30))}throw Error('Native gallery unavailable');
                """) as! [String: Double]
                XCTAssertEqual(gallery["height"]!, gallery["viewport"]!, accuracy: 1)
            }
            try await restore()
        } catch {
            let details = try? await script(host, "return {url:location.href,text:document.body.innerText,html:document.body.innerHTML.slice(0,10000),errors:performance.getEntriesByType('resource').filter(r=>r.responseStatus>=400).map(r=>r.name)}")
            if let details { let attachment = XCTAttachment(string: String(describing: details)); attachment.name = "Connection \(page) failure DOM"; attachment.lifetime = .keepAlways; add(attachment) }
            if let image = try? await host.webView.takeSnapshot(configuration: nil) { let attachment = XCTAttachment(image: image); attachment.name = "Connection \(page) failure"; attachment.lifetime = .keepAlways; add(attachment) }
            try? await restore(); throw error
        }
    }
    func testHomeAggregateInRealWebKit() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let output = root.appendingPathComponent("docs/ui-restoration/home")
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: output.appendingPathComponent("native-fixture.json"))) as! [String: Any]
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("for(const [key,value]of[['cimoa_app_state_v2',snapshot.state],['cimoa_app_state',snapshot.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?homeRestored=\(UUID().uuidString)#/pages/auth/splash")!, cachePolicy: .reloadIgnoringLocalCacheData))
        }
        do {
            _ = try await host.webView.callAsyncJavaScript("const data=fixture.data;data.session.expires_at=Date.now()+30*86400000;for(const row of data.match_sessions)if(row.fixture&&row.status==='found')row.expires_at=Date.now()+120000;localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data}));return true", arguments: ["fixture": fixture], in: nil, contentWorld: .page)
            try await loadFreshConnection(host, route: "/pages/home/index", selector: ".home-header")
            host.publishSafeArea()
            for _ in 0..<100 {
                if (try? await script(host, "const images=[...document.querySelectorAll('.connection-avatar img')];return images.length===3&&images.every(image=>image.complete&&image.naturalWidth>0)&&Number(getComputedStyle(document.querySelector('.page-transition')).opacity)===1")) as? Bool == true { break }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            let geometry = try await script(host, """
            await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})));for(const animation of document.getAnimations())if(animation.effect.getComputedTiming().iterations!==Infinity)animation.finish();
            await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
            return {viewport:{width:innerWidth,height:innerHeight},safe:[parseFloat(getComputedStyle(document.querySelector('.top-safe-area,.safe-area')).height),innerHeight-box('.tabbar').bottom-28*innerWidth/393],header:box('.home-header'),card:box('.connection'),avatar:box('.connection-avatar'),tabbar:box('.tabbar'),names:[...document.querySelectorAll('.connection-name')].map(x=>x.textContent),overflow:document.documentElement.scrollWidth>innerWidth,origin:location.origin,skeleton:!!document.querySelector('.main-skeleton'),images_loaded:[...document.querySelectorAll('.connection-avatar img')].filter(x=>x.complete&&x.naturalWidth>0).length,opacity:Number(getComputedStyle(document.querySelector('.page-transition')).opacity)}
            """) as! [String: Any]
            XCTAssertEqual(geometry["names"] as? [String], ["Chloe Lin, 21", "Liam Park, 22", "Lina, 21"])
            XCTAssertEqual(geometry["overflow"] as? Bool, false); XCTAssertEqual(geometry["skeleton"] as? Bool, false)
            XCTAssertEqual(geometry["images_loaded"] as? Int, 3); XCTAssertEqual(geometry["opacity"] as? Double, 1)
            try await Task.sleep(nanoseconds: 200_000_000)
            let image = try await host.webView.takeSnapshot(configuration: nil)
            try image.pngData()?.write(to: output.appendingPathComponent("actual-wkwebview.png"))
            try JSONSerialization.data(withJSONObject: geometry, options: [.prettyPrinted,.sortedKeys]).write(to: output.appendingPathComponent("wkwebview-geometry.json"))
            let result = try await script(host, """
            const delay=ms=>new Promise(r=>setTimeout(r,ms)),visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0),state=()=>localStorage.getItem('cimoa_app_state_v2');
            const wait=async fn=>{for(let i=0;i<160;i++){const x=fn();if(x)return x;await delay(30)}throw Error('Home aggregate timeout '+location.hash+' '+document.body.innerText.slice(0,200))};
            const click=async id=>{const e=await wait(()=>visible('[data-interaction="'+id+'"]'));await delay(300);e.click();await delay(40)};
            const assert=(x,message)=>{if(!x)throw Error(message)};const before=state();
            for(let i=0;i<2;i++){await click('home.popMaya.click.1');await wait(()=>visible('.goals-panel--open'));visible('.goal-label').click();assert(!!visible('.goals-panel--open'),'Goals panel bubbled');visible('.goals-mask').click();await wait(()=>!visible('.goals-panel'));}
            const checks=[];
            for(const [entry,selector,back]of[['home.openMe.click.1','.profile-name','profile.goBack.click.1'],['home.startAutoMatch.click.1','[data-interaction="amEntry.joinPool.click.1"]','amEntry.goBack.click.1'],['home.openMaya.click.1','.chat-composer','chat.goBack.click.1'],['home.openJordan.click.1','.received-actions','reqReceived.goBack.click.1']]){await click(entry);await wait(()=>visible(selector));await click(back);await wait(()=>visible('.home-header'));assert(visible('.main-tab-frame').dataset.pageDepth==='1','Wrong Home Back depth');checks.push(state()===before)}
            for(let cycle=0;cycle<2;cycle++)for(const name of['Discover','Events','Home']){visible('.tab[aria-label="'+name+'"]').click();await wait(()=>visible('.tab[aria-current="page"]')?.getAttribute('aria-label')===name);await delay(300);assert(visible('.main-tab-frame').dataset.pageDepth==='1'&&!visible('.main-skeleton'),'Tab depth/skeleton');}
            await click('home.openLiam.click.1');await wait(()=>visible('.match-found-avatar'));await click('amFound.passMatch.click.1');await wait(()=>visible('.dialog__confirm'));visible('.dialog__confirm').click();await wait(()=>visible('[data-interaction="amPassed.returnHome.click.1"]'));await click('amPassed.returnHome.click.1');await wait(()=>location.hash.includes('/pages/home/index')&&visible('.home-header'));assert(visible('.main-tab-frame').dataset.pageDepth==='1','Candidate result retained a second Home');assert(!document.querySelector('#connection-user_liam'),'Passed candidate remained in Home');
            await click('home.openJordan.click.1');await wait(()=>visible('.received-actions'));await click('reqReceived.accept.click.1');await click('reqReceived.accept.click.1');await wait(()=>visible('.dialog__confirm'));const pending=state();visible('.dialog__confirm').click();await delay(30);const loading=!!visible('.event-loading')&&state()===pending;await wait(()=>visible('.connection-accepted-page'));await click('reqAccepted.closeAccepted.click.1');await wait(()=>visible('#connection-user_lina'));assert(visible('#connection-user_lina .connection-status').textContent==='Connected','Acceptance did not aggregate');assert(document.querySelectorAll('#connection-user_lina').length===1,'Duplicate person');
            visible('#connection-user_chloe').click();await wait(()=>visible('.chat-composer'));await wait(()=>visible('.chat-heading')?.textContent.includes('Chloe'));await click('chat.openSafety.click.1');await click('sheetSafety.openBlock.click.1');await click('sheetBlock.confirmBlock.click.1');await wait(()=>JSON.parse(state()).data.blocked_users.some(row=>row.owner_user_id==='user_cimoa'&&row.user_id==='user_chloe'));await wait(()=>location.hash.includes('/pages/home/index')&&visible('.home-header'));await wait(()=>!document.querySelector('#connection-user_chloe'));
            return {navigation_read_only:checks,popover:true,tab_cycles:2,passed_to_root:true,loading_before_accept:loading,accepted_once:true,blocked_filtered:true,depth:visible('.main-tab-frame').dataset.pageDepth};
            """) as! [String: Any]
            XCTAssertEqual(result["navigation_read_only"] as? [Bool], [true,true,true,true]); XCTAssertEqual(result["loading_before_accept"] as? Bool, true)
            XCTAssertEqual(result["depth"] as? String, "1")
            try await loadFreshConnection(host, route: "/pages/home/index", selector: ".home-header")
            let restored = try await script(host, "return !document.querySelector('#connection-user_chloe')&&document.querySelector('#connection-user_lina .connection-status')?.textContent==='Connected'") as? Bool
            XCTAssertEqual(restored,true)
            try JSONSerialization.data(withJSONObject: ["result":"passed","checks":result,"refresh_restored":restored == true,"fixture_deadline":"relative 120s only in isolated test setup; production deadline is untouched"], options: [.prettyPrinted,.sortedKeys]).write(to: output.appendingPathComponent("wkwebview-acceptance.json"))
            try await restore()
        } catch { try? await restore(); throw error }
    }
    func testConnectionSentPixel() async throws { try await connectionPixel("sent") }
    func testConnectionReceivedPixel() async throws { try await connectionPixel("received") }
    func testConnectionAcceptedPixel() async throws { try await connectionPixel("accepted") }
    func testConnectionDeclinedPixel() async throws { try await connectionPixel("declined") }
    func testWaitingCallDeadlineAndBackgroundRecovery() async throws {
        let host = try await rawHost()
        let snapshot = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
        let originalScripts = host.webView.configuration.userContentController.userScripts
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let folder = root.appendingPathComponent("docs/ui-restoration/call-waiting")
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("docs/ui-restoration/connection-chat/native-fixture.json"))) as! [String: Any]
        func restoreScripts() {
            host.webView.configuration.userContentController.removeAllUserScripts()
            for item in originalScripts { host.webView.configuration.userContentController.addUserScript(item) }
        }
        func restore() async throws {
            restoreScripts()
            _ = try await host.webView.callAsyncJavaScript("for(const [key,value]of[['cimoa_app_state_v2',saved.state],['cimoa_app_state',saved.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}return true", arguments: ["saved": snapshot], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?callRestore=\(UUID().uuidString)#/pages/auth/splash")!))
        }
        do {
            let encoded = String(data: try JSONSerialization.data(withJSONObject: fixture["data"]!), encoding: .utf8)!
            host.webView.configuration.userContentController.addUserScript(WKUserScript(source: "const data=\(encoded);data.session.expires_at=Date.now()+86400000;data.call_sessions=[];for(const m of data.messages)if(m.conversation_id==='conversation_chloe')m.read_by=['user_cimoa','user_chloe'];localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data}));", injectionTime: .atDocumentStart, forMainFrameOnly: true))
            try await loadFreshConnection(host, route: "/pages/messages/chat?conversation_id=conversation_chloe", selector: ".chat-composer")
            restoreScripts()
            _ = try await script(host, "document.querySelector('[data-interaction=\"chat.startCall.click.1\"]').click();return true")
            try await waitFor(host, ".waiting-call-own")
            host.publishSafeArea()
            let first = try await script(host, "await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));for(const a of document.getAnimations())a.finish();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const call=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.call_sessions.at(-1),box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};return {call,viewport:{width:innerWidth,height:innerHeight},back:box('.waiting-call-round'),own:box('.waiting-call-own'),end:box('.waiting-call-end'),images:[...document.querySelectorAll('.waiting-call-page .profile-photo')].every(e=>e.dataset.mediaStatus==='ready'),video:document.querySelectorAll('video').length,origin:location.origin}") as! [String: Any]
            XCTAssertEqual(first["images"] as? Bool, true); XCTAssertEqual(first["video"] as? Int, 0); XCTAssertEqual(first["origin"] as? String, BundleHTTPServer.origin)
            let viewport = first["viewport"] as! [String: Double], back = first["back"] as! [String: Double], own = first["own"] as! [String: Double], end = first["end"] as! [String: Double], scale = viewport["width"]! / 393
            XCTAssertEqual(back["y"]!, Double(host.view.safeAreaInsets.top) + 4 * scale, accuracy: 1)
            XCTAssertEqual(own["width"]!, 104 * scale, accuracy: 1); XCTAssertEqual(own["height"]!,142 * scale,accuracy:1)
            XCTAssertEqual(end["bottom"]!, viewport["height"]! - Double(host.view.safeAreaInsets.bottom) - 44 * scale, accuracy: 1)
            try (await host.webView.takeSnapshot(configuration: nil)).pngData()!.write(to: folder.appendingPathComponent("actual-wkwebview.png"))
            let call = first["call"] as! [String: Any], id = call["call_id"] as! String
            try await loadFreshConnection(host, route: "/pages/messages/call/waiting?conversation_id=conversation_chloe&call_id=\(id)", selector: ".waiting-call-own")
            let restoredDeadline = try await script(host, "return JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.call_sessions.at(-1).expires_at") as! Double
            XCTAssertEqual(restoredDeadline, call["expires_at"] as! Double)
            _ = try await script(host, "const e=document.querySelector('[data-interaction=\"callActive.endCall.click.1\"]');e.click();e.click();return true")
            try await waitFor(host, ".chat-composer")
            let manual = try await script(host, "const d=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;return {ended:d.call_sessions.at(-1).ended_at!==null,conversation:location.hash.includes('conversation_id=conversation_chloe')}") as! [String: Bool]
            XCTAssertEqual(manual["ended"],true); XCTAssertEqual(manual["conversation"],true)
            _ = try await script(host, "document.querySelector('[data-interaction=\"chat.startCall.click.1\"]').click();return true")
            try await waitFor(host, ".waiting-call-own")
            let backgroundToken = UUID().uuidString
            try Data(backgroundToken.utf8).write(to: folder.appendingPathComponent("native-background-ready.txt"))
            var backgroundReturned = false
            for _ in 0..<60 {
                if (try? String(contentsOf: folder.appendingPathComponent("native-background-done.txt"), encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines)) == backgroundToken { backgroundReturned = true; break }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            XCTAssertTrue(backgroundReturned, "Actual simulator background/foreground is required")
            try await waitFor(host, ".chat-composer")
            let timeout = try await script(host, "const d=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,c=d.call_sessions.at(-1);return {once:d.call_sessions.length===2,timeout:c.ended_at===null&&Date.now()>=c.expires_at,elapsed:Date.now()-c.started_at,conversation:location.hash.includes('conversation_id=conversation_chloe')}") as! [String: Any]
            XCTAssertEqual(timeout["once"] as? Bool,true); XCTAssertEqual(timeout["timeout"] as? Bool,true); XCTAssertEqual(timeout["conversation"] as? Bool,true); XCTAssertLessThan(timeout["elapsed"] as! Double,14500)
            try JSONSerialization.data(withJSONObject: ["result":"passed","geometry":first,"manual":manual,"timeout":timeout,"actual_background_foreground":backgroundReturned], options: [.prettyPrinted,.sortedKeys]).write(to: folder.appendingPathComponent("wkwebview-acceptance.json"))
            try await restore()
        } catch { try? await restore(); throw error }
    }
    func testConnectionChatPixel() async throws { try await connectionPixel("chat") }
    func testConnectionVoiceLifecycleInRealWebKit() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')")
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let output = root.appendingPathComponent("docs/evidence/connection-core")
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: output.appendingPathComponent("native-lifecycle-fixture.json"))) as! [String: Any]
        let mediaID = fixture["media_id"] as! String
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("""
            const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_media_v2',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
            await new Promise((resolve,reject)=>{const t=db.transaction('blobs','readwrite');t.objectStore('blobs').delete(mediaID);t.oncomplete=resolve;t.onerror=()=>reject(t.error)});db.close();
            if(snapshot===null)localStorage.removeItem('cimoa_app_state_v2');else localStorage.setItem('cimoa_app_state_v2',snapshot);return true
            """, arguments: ["snapshot": saved, "mediaID": mediaID], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?voiceLifecycleRestored=\(UUID().uuidString)#/pages/auth/splash")!, cachePolicy: .reloadIgnoringLocalCacheData))
        }
        do {
            _ = try await host.webView.callAsyncJavaScript("""
            const buffer=new ArrayBuffer(48044),view=new DataView(buffer),write=(offset,text)=>[...text].forEach((char,index)=>view.setUint8(offset+index,char.charCodeAt(0)));
            write(0,'RIFF');view.setUint32(4,48036,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,48000,true);for(let i=0;i<24000;i++)view.setInt16(44+i*2,Math.sin(i*2*Math.PI*220/16000)*5000,true);
            const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_media_v2',1);r.onupgradeneeded=()=>r.result.createObjectStore('blobs');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
            await new Promise((resolve,reject)=>{const t=db.transaction('blobs','readwrite');t.objectStore('blobs').add(new Blob([buffer],{type:'audio/wav'}),fixture.media_id);t.oncomplete=resolve;t.onerror=()=>reject(t.error)});db.close();localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data:fixture.data}));return true
            """, arguments: ["fixture": fixture], in: nil, contentWorld: .page)
            await WKWebsiteDataStore.default().removeData(ofTypes: [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache], modifiedSince: .distantPast)
            try await loadFreshConnection(host, route: "/pages/home/index", selector: ".home-header")
            _ = try await script(host, """
            document.querySelector('[data-interaction="home.openJordan.click.1"]').click();for(let i=0;i<160;i++){const button=document.querySelector('.request-audio-play');if(button&&button.getAttribute('aria-disabled')!=='true')return true;await new Promise(resolve=>setTimeout(resolve,30))}throw Error('Request audio did not prepare');
            """)
            let introDuration = try await script(host, """
            document.querySelector('.request-audio-play').click();for(let i=0;i<120;i++){const playing=document.querySelector('[aria-label="Pause voice introduction"]'),wave=document.querySelector('.request-audio-wave');if(playing&&Number(wave?.getAttribute('aria-valuenow'))>0){playing.click();return document.querySelector('.request-audio-duration').textContent}await new Promise(resolve=>setTimeout(resolve,30))}throw Error('Request audio did not play '+document.body.innerText);
            """) as? String
            XCTAssertEqual(introDuration, "0:02")
            let flow = try await script(host, """
            const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),visible=selector=>[...document.querySelectorAll(selector)].find(el=>{const rect=el.getBoundingClientRect(),style=getComputedStyle(el);return rect.height>0&&style.display!=='none'&&style.visibility!=='hidden'&&rect.right>0&&rect.left<innerWidth}),state=()=>JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;
            const wait=async(fn,label='')=>{for(let i=0;i<160;i++){const value=fn();if(value)return value;await delay(50)}throw Error('Voice lifecycle timeout '+window.__voiceStage+' '+label+' '+location.hash+' '+document.body.innerText)};
            const assert=(ok,message)=>{if(!ok)throw Error(message)},click=async id=>{window.__voiceStage=id;const element=await wait(()=>visible('[data-interaction="'+id+'"]'));await delay(280);element.click();await delay(60)};
            const duration=visible('.request-audio-duration').textContent,beforeNotNow=localStorage.getItem('cimoa_app_state_v2');await click('reqReceived.notNow.click.1');await wait(()=>visible('.home-header'));assert(localStorage.getItem('cimoa_app_state_v2')===beforeNotNow,'Not Now modified the request');
            await click('home.openJordan.click.1');await wait(()=>visible('.request-audio-play'));await click('reqReceived.accept.click.1');await wait(()=>visible('.dialog__confirm'));const beforeAccept=localStorage.getItem('cimoa_app_state_v2');visible('.dialog__confirm').click();visible('.dialog__confirm')?.click();await delay(30);const loading=!!visible('.event-loading')&&localStorage.getItem('cimoa_app_state_v2')===beforeAccept;await wait(()=>visible('.connection-accepted-page'));
            await click('reqAccepted.startChat.click.1');await wait(()=>visible('.chat-composer'),'chat composer');await wait(()=>!visible('.event-loading'),'read loading hidden');
            const request=state().requests.find(row=>row.request_id==='request_native_voice'),conversation=state().conversations.find(row=>row.kind==='direct'&&row.participant_ids.includes('user_noah')),message=state().messages.find(row=>row.message_id==='introduction_request_native_voice');
            assert(request.status==='accepted'&&message.kind==='audio'&&message.sender_id==='user_noah'&&message.media_id===request.audio_id,'Original voice/sender did not survive acceptance');assert(state().conversations.filter(row=>row.kind==='direct'&&row.participant_ids.includes('user_noah')).length===1,'Duplicate conversation');
            return {duration,loading,conversation_id:conversation.conversation_id,media_id:message.media_id,state:localStorage.getItem('cimoa_app_state_v2'),header:visible('.chat-heading').textContent};
            """) as! [String: Any]
            XCTAssertEqual(flow["loading"] as? Bool, true); XCTAssertEqual(flow["media_id"] as? String, mediaID); XCTAssertEqual(flow["duration"] as? String, "0:02")
            // A fresh WebKit evaluation preserves the deliberate activation
            // boundary; a click scheduled many async seconds ago is not a tap.
            try await waitForPreparedAudio(host, selector: "[data-interaction=\"chat.media.play.click.1\"]")
            let firstPlayback = try await script(host, """
            document.querySelector('[data-interaction="chat.media.play.click.1"]').click();for(let i=0;i<100;i++){if(document.querySelector('[aria-label="Pause voice message"]')){window.__voiceOld=true;return true}await new Promise(resolve=>setTimeout(resolve,30))}throw Error('Native voice message did not start');
            """) as? Bool
            XCTAssertEqual(firstPlayback, true)
            host.webView.reload()
            for _ in 0..<100 {
                if (try? await script(host, "return !window.__voiceOld&&!!document.querySelector('.chat-composer')")) as? Bool == true { break }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            try await waitForPreparedAudio(host, selector: "[data-interaction=\"chat.media.play.click.1\"]")
            let restored = try await script(host, """
            const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),visible=s=>[...document.querySelectorAll(s)].find(el=>el.getBoundingClientRect().height>0),wait=async fn=>{for(let i=0;i<160;i++){if(fn())return;await delay(50)}throw Error('Restored audio failed '+document.body.innerText)};
            await wait(()=>visible('[data-interaction="chat.media.play.click.1"]'));visible('[data-interaction="chat.media.play.click.1"]').click();await wait(()=>visible('[aria-label="Pause voice message"]'));return {state:localStorage.getItem('cimoa_app_state_v2'),audio:true};
            """) as! [String: Any]
            XCTAssertEqual(restored["state"] as? String, flow["state"] as? String); XCTAssertEqual(restored["audio"] as? Bool, true)
            let image = try await host.webView.takeSnapshot(configuration: nil)
            try image.pngData()!.write(to: output.appendingPathComponent("actual-wkwebview-voice.png"))
            var record = flow
            record.removeValue(forKey: "state"); record["initial_audio_played"] = firstPlayback; record["refreshed_audio_played"] = restored["audio"]
            try JSONSerialization.data(withJSONObject: record, options: [.prettyPrinted,.sortedKeys]).write(to: output.appendingPathComponent("native-voice-lifecycle.json"))
            try await restore()
        } catch {
            let attachment = XCTAttachment(string: String(describing: try? await script(host, "return {url:location.href,stage:window.__voiceStage,text:document.body.innerText,loading:[...document.querySelectorAll('.event-loading')].map(el=>({display:getComputedStyle(el).display,visibility:getComputedStyle(el).visibility,rect:el.getBoundingClientRect().toJSON(),parent:el.closest('uni-page')?.outerHTML.slice(0,500)}))}"))); attachment.name = "Voice lifecycle failure"; attachment.lifetime = .keepAlways; add(attachment)
            try? await restore(); throw error
        }
    }
    private func rawHost() async throws -> WebViewController {
        for _ in 0..<100 {
            if let host = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).flatMap({ $0.windows }).compactMap({ $0.rootViewController as? WebViewController }).first, host.webView != nil, !host.webView.isLoading, host.isTrustedURL(host.webView.url) { return host }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        throw NSError(domain: "CimoaTests", code: 3, userInfo: [NSLocalizedDescriptionKey: "Native host WebView was not ready."])
    }
    private func host() async throws -> WebViewController {
        var recoveredEntry = false
        for attempt in 0..<120 {
            if let host = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).flatMap({ $0.windows }).compactMap({ $0.rootViewController as? WebViewController }).first, host.webView != nil, !host.webView.isLoading, host.isTrustedURL(host.webView.url) {
                // Poll from XCTest: a promise created in about:blank is destroyed
                // by the initial document navigation, before Vue can mount.
                let ready = try? await script(host, "return !!document.querySelector('.home-header,.profile-header,.discover-header,.events-header')")
                if ready as? Bool == true { return host }
                let welcome = try? await script(host, "return !!document.querySelector('.welcome-page')")
                if welcome as? Bool == true { try await signIn(host); return host }
                if !recoveredEntry, attempt >= 10 {
                    recoveredEntry = true
                    host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?hostReadyRecovery=1#/pages/auth/splash")!))
                }
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
    private var birthDatePickerDriver: String {
        """
        const chooseBirthDate=async value=>{
          const pause=ms=>new Promise(r=>setTimeout(r,ms)),visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0),wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await pause(20)}throw Error('Birth date picker timeout')};
          visible('[data-interaction="age.openDatePicker.click.1"]').click();await wait(()=>visible('.dob-picker.event-dialog--open'));await pause(280);
          for(const[index,label]of ['Year','Month','Day'].entries()){
            const column=visible('[role=spinbutton][aria-label="'+label+'"]'),target=Number(value.split('-')[index]);let steps=0;
            while(Number(column.getAttribute('aria-valuenow'))!==target&&steps++<250){const delta=target-Number(column.getAttribute('aria-valuenow')),key=Math.abs(delta)>=10?(delta>0?'PageUp':'PageDown'):(delta>0?'ArrowUp':'ArrowDown');column.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));await pause(4)}
            if(Number(column.getAttribute('aria-valuenow'))!==target)throw Error('Could not select '+label+' '+target)
          }
          visible('[data-interaction="age.datePicker.confirm.click.1"]').click();await wait(()=>!visible('.dob-picker [role=dialog]'));
        };
        """
    }
    private func chooseBirthDate(_ host: WebViewController, _ value: String) async throws {
        _ = try await host.webView.callAsyncJavaScript(birthDatePickerDriver + "await chooseBirthDate(value);return true", arguments: ["value":value], in: nil, contentWorld: .page)
    }
    private func signIn(_ host: WebViewController) async throws {
        _ = try await script(host, "const pause=ms=>new Promise(r=>setTimeout(r,ms)),check=document.querySelector('.welcome-consent-toggle');if(check.getAttribute('aria-checked')!=='true'){if(!document.querySelector('.eula-dialog.event-dialog--open'))check.click();await pause(300);document.querySelector('[data-interaction=\"welcome.eula.accept.click.1\"]').click();for(let i=0;i<80&&check.getAttribute('aria-checked')!=='true';i++)await pause(40);await pause(300)}if(document.querySelector('.welcome-login'))document.querySelector('.welcome-login').click();return true")
        if (try? await script(host, "return !!document.querySelector('.home-header')")) as? Bool == true { return }
        try await waitFor(host, ".login-page input")
        _ = try await script(host, "await new Promise(r=>setTimeout(r,300)); const fields=document.querySelectorAll('.login-page input'); for(const [i,value] of ['cimoa@gmail.com','12341234'].entries()){fields[i].value=value; fields[i].dispatchEvent(new Event('input',{bubbles:true}))} await Promise.resolve();document.querySelector('[data-interaction=\"login.loginNow.click.1\"]').click(); return true")
        try await waitFor(host, ".home-header")
    }
    func testSplashPixelRestoration() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("for(const [key,value] of [['cimoa_app_state_v2',snapshot.state],['cimoa_app_state',snapshot.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)};return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?splashPixel=restored#/pages/auth/splash")!))
        }
        do {
            _ = try await script(host, "localStorage.removeItem('cimoa_app_state_v2');localStorage.removeItem('cimoa_app_state');return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?splashPixel=guest#/pages/auth/splash")!))
            try await waitFor(host, ".splash-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const a of document.getAnimations()){const t=a.effect?.getComputedTiming();if(t?.iterations===Infinity){a.pause();a.currentTime=750}else a.finish()}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
                const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2}},root=box('.splash-page'),content=box('.splash-content'),brand=box('.brand--splash'),track=box('.splash-track'),safes=[...document.querySelectorAll('.splash-page > .safe-area')].map(e=>e.getBoundingClientRect().height),visualCenter=(Math.min(brand.y,track.y)+Math.max(brand.y+brand.height,track.y+track.height))/2;
                return {root,content,brand,track,safes,visualCenter,role:document.querySelector('.splash-page').getAttribute('role'),interaction:document.querySelector('.splash-page').dataset.interaction,padding:getComputedStyle(document.querySelector('.splash-content')).padding};
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root = metrics["root"] as! [String: Double], content = metrics["content"] as! [String: Double], brand = metrics["brand"] as! [String: Double], safes = metrics["safes"] as! [Double]
            XCTAssertEqual(metrics["role"] as? String, "button"); XCTAssertEqual(metrics["interaction"] as? String, "splash.goWelcome.click.1")
            XCTAssertEqual(metrics["padding"] as? String, "0px")
            XCTAssertEqual(root["x"]!, 0, accuracy: 1); XCTAssertEqual(root["y"]!, 0, accuracy: 1)
            XCTAssertEqual(root["width"]!, Double(host.webView.bounds.width), accuracy: 1); XCTAssertEqual(root["height"]!, Double(host.webView.bounds.height), accuracy: 1)
            XCTAssertEqual(safes[0], Double(host.view.safeAreaInsets.top), accuracy: 1); XCTAssertEqual(safes[1], Double(host.view.safeAreaInsets.bottom), accuracy: 1)
            XCTAssertEqual(content["cy"]!, safes[0] + (root["height"]! - safes[0] - safes[1]) / 2, accuracy: 1)
            XCTAssertEqual(metrics["visualCenter"] as! Double, content["cy"]!, accuracy: 1); XCTAssertEqual(brand["cx"]!, root["width"]! / 2, accuracy: 1)
            let screenshot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil))
            screenshot.name = "WKWebView Splash deterministic"; screenshot.lifetime = .keepAlways; add(screenshot)
            let rootWidth = root["width"] ?? -1
            let rootHeight = root["height"] ?? -1
            print(
                "CIMOA_SPLASH_SAFE_AREA "
                    + "top=\(safes[0]) bottom=\(safes[1]) "
                    + "viewport=\(rootWidth)x\(rootHeight)"
            )
            try await waitFor(host, ".welcome-page")
            let guestStorageRemainsEmpty = try await script(
                host,
                "return localStorage.getItem('cimoa_app_state_v2')===null"
            ) as? Bool
            XCTAssertEqual(guestStorageRemainsEmpty, true)

            try await signIn(host)
            let valid = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?splashPixel=valid#/pages/auth/splash")!))
            try await waitFor(host, ".splash-page")
            _ = try await script(host, "const root=document.querySelector('.splash-page');root.click();root.click();return true")
            try await waitFor(host, ".home-header"); try await Task.sleep(nanoseconds: 1_900_000_000)
            let restored = try await script(host, "return {home:!!document.querySelector('.home-header'),depth:document.querySelector('.main-tab-frame')?.dataset.pageDepth,skeleton:!!document.querySelector('.main-skeleton')}") as! [String: Any]
            XCTAssertEqual(restored["home"] as? Bool, true); XCTAssertEqual(restored["depth"] as? String, "1"); XCTAssertEqual(restored["skeleton"] as? Bool, false)

            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2','{corrupt');return true", arguments: [:], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?splashPixel=corrupt#/pages/auth/splash")!))
            try await waitFor(host, ".splash-page [role=alert]")
            let corruptStorageSnapshot = try await script(
                host,
                "return localStorage.getItem('cimoa_app_state_v2')"
            ) as? String
            XCTAssertEqual(corruptStorageSnapshot, "{corrupt")
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);document.querySelector('.splash-page').click();return true", arguments: ["snapshot": valid], in: nil, contentWorld: .page)
            try await waitFor(host, ".home-header")
            try await restore()
        } catch { try? await restore(); throw error }
    }
    func testWelcomePixelRestoration() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let output = root.appendingPathComponent("docs/ui-restoration/welcome/copy-visibility-2026-10-20")
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("for(const [key,value] of [['cimoa_app_state_v2',snapshot.state],['cimoa_app_state',snapshot.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)};return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?welcomePixel=restored#/pages/auth/splash")!))
        }
        do {
            _ = try await script(host, "localStorage.removeItem('cimoa_app_state_v2');localStorage.removeItem('cimoa_app_state');return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?welcomePixel=native#/pages/auth/welcome")!))
            try await waitFor(host, ".welcome-page")
            for _ in 0..<100 {
                if (try? await script(host, "return !document.querySelector('.welcome-photo-status')")) as? Bool == true { break }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            let initiallyVisible = try await script(host, """
            await document.fonts.ready;for(const a of document.getAnimations())a.finish();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
            const create=document.querySelector('.welcome-create').getBoundingClientRect(),rows=[];
            for(const selector of ['.welcome-brand','.welcome-title','.welcome-description']){const e=document.querySelector(selector),r=e.getBoundingClientRect();if(r.height<=0||r.top<0||r.bottom>create.top)throw Error('Welcome copy not initially visible: '+selector);for(let p=e.parentElement;p;p=p.parentElement){const c=getComputedStyle(p),b=p.getBoundingClientRect();if(/hidden|auto|scroll|clip/.test(c.overflowY)&&(r.top<b.top-1||r.bottom>b.bottom+1))throw Error('Welcome copy clipped by '+p.className)}const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(hit!==e&&!e.contains(hit))throw Error('Welcome copy covered: '+selector);rows.push({selector,y:r.y,bottom:r.bottom})}return {rows,createTop:create.top,scrollTop:[...document.querySelectorAll('.secondary-page-scroll .uni-scroll-view')].at(-1).scrollTop};
            """) as! [String: Any]
            XCTAssertEqual(initiallyVisible["scrollTop"] as? Double, 0)
            try (try await host.webView.takeSnapshot(configuration: nil)).pngData()!.write(to: output.appendingPathComponent("actual-wkwebview-first-entry.png"))
            let rejected = try await script(host, """
            const before=localStorage.getItem('cimoa_app_state_v2'),check=document.querySelector('.welcome-consent-toggle');if(check.getAttribute('aria-checked')!=='false')throw Error('Welcome preselected consent');for(const s of ['.welcome-create','.welcome-login']){const e=document.querySelector(s);if(e.getAttribute('aria-disabled')!=='true')throw Error('Entry not disabled');e.click()}await new Promise(r=>setTimeout(r,350));return location.hash.endsWith('/pages/auth/welcome')&&!!document.querySelector('.welcome-error')&&localStorage.getItem('cimoa_app_state_v2')===before
            """) as? Bool
            XCTAssertEqual(rejected, true)
            for (interaction, destination, backSelector) in [
                ("welcome.consent.openTerms.click.1", ".legal-terms-page", ".legal-terms-page .event-page-round"),
                ("welcome.consent.openPrivacy.click.1", ".legal-privacy-page", ".legal-privacy-page .event-page-round")
            ] {
                _ = try await script(host, "document.querySelector('[data-interaction=\"\(interaction)\"]').click();await new Promise(r=>setTimeout(r,350));return true")
                try await waitFor(host, destination)
                _ = try await script(host, "document.querySelector('\(backSelector)').click();await new Promise(r=>setTimeout(r,350));return true")
                let unchanged = try await script(host, "return document.querySelector('.welcome-consent-toggle').getAttribute('aria-checked')==='false'&&localStorage.getItem('cimoa_app_state_v2')===null") as? Bool
                XCTAssertEqual(unchanged, true)
            }
            _ = try await script(host, "document.querySelector('.welcome-consent-toggle').click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom,cx:rect.x+rect.width/2}},root=box('.welcome-page'),photo=box('.welcome-photo-region'),copy=box('.welcome-copy'),brand=box('.welcome-brand'),create=box('.welcome-create'),login=box('.welcome-login'),legal=box('.welcome-legal'),safes=[...document.querySelectorAll('.welcome-page > .safe-area')].map(element=>element.getBoundingClientRect().height),image=document.querySelector('.welcome-photo .uni-image-element,.welcome-photo img')||document.querySelector('.welcome-photo');
                return {root,photo,copy,brand,create,login,legal,safes,imagePosition:image?getComputedStyle(image).objectPosition:null,status:!!document.querySelector('.welcome-photo-status'),text:{brand:document.querySelector('.welcome-brand').textContent,title:document.querySelector('.welcome-title').textContent,description:document.querySelector('.welcome-description').textContent,create:document.querySelector('.welcome-create').textContent.trim(),login:document.querySelector('.welcome-login').textContent.trim(),legal:document.querySelector('.welcome-legal').textContent.replace(/\\s+/g,' ').trim()}};
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root = metrics["root"] as! [String: Double]
            let photo = metrics["photo"] as! [String: Double]
            let copy = metrics["copy"] as! [String: Double]
            let brand = metrics["brand"] as! [String: Double]
            let create = metrics["create"] as! [String: Double]
            let login = metrics["login"] as! [String: Double]
            let legal = metrics["legal"] as! [String: Double]
            let safes = metrics["safes"] as! [Double]
            let text = metrics["text"] as! [String: String]
            let sourceScale = root["width"]! / 393
            XCTAssertEqual(root["x"]!, 0, accuracy: 1); XCTAssertEqual(root["y"]!, 0, accuracy: 1)
            XCTAssertEqual(root["width"]!, Double(host.webView.bounds.width), accuracy: 1); XCTAssertEqual(root["height"]!, Double(host.webView.bounds.height), accuracy: 1)
            XCTAssertEqual(safes[0], Double(host.view.safeAreaInsets.top), accuracy: 1); XCTAssertEqual(safes[1], Double(host.view.safeAreaInsets.bottom), accuracy: 1)
            XCTAssertEqual(photo["x"]!, 4 * sourceScale, accuracy: 1); XCTAssertEqual(photo["y"]!, safes[0], accuracy: 1); XCTAssertEqual(photo["width"]!, root["width"]! - 8 * sourceScale, accuracy: 1); XCTAssertGreaterThan(photo["height"]!, 0)
            XCTAssertEqual(copy["y"]!, photo["bottom"]! + 44 * sourceScale, accuracy: 1); XCTAssertLessThanOrEqual(copy["bottom"]!, create["y"]!); XCTAssertEqual(brand["cx"]!, root["width"]! / 2, accuracy: 1)
            XCTAssertEqual(create["x"]!, 20 * sourceScale, accuracy: 1); XCTAssertEqual(create["width"]!, root["width"]! - 40 * sourceScale, accuracy: 1); XCTAssertEqual(create["height"]!, 60 * sourceScale, accuracy: 1); XCTAssertEqual(login["height"]!, 56 * sourceScale, accuracy: 1)
            XCTAssertEqual(legal["bottom"]!, root["height"]! - safes[1] - 30 * sourceScale, accuracy: 2)
            XCTAssertTrue(["50% 0%", "center top"].contains(metrics["imagePosition"] as? String ?? "")); XCTAssertEqual(metrics["status"] as? Bool, false)
            XCTAssertEqual(text["brand"], "Cimoa"); XCTAssertEqual(text["title"], "Meet your campus")
            XCTAssertEqual(text["description"], "Discover people, conversations, and events around university life.")
            XCTAssertEqual(text["create"], "Create Account"); XCTAssertEqual(text["login"], "Log In")
            XCTAssertEqual(text["legal"], "By continuing, you agree to our Terms and Privacy Policy.")
            let screenshot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil))
            screenshot.name = "WKWebView Welcome deterministic"; screenshot.lifetime = .keepAlways; add(screenshot)
            try (try await host.webView.takeSnapshot(configuration: nil)).pngData()!.write(to: output.appendingPathComponent("actual-wkwebview.png"))
            let consent = try await script(host, "const e=document.querySelector('.welcome-consent-toggle'),r=e.getBoundingClientRect();return {checked:e.getAttribute('aria-checked'),width:r.width,height:r.height,copy:document.querySelector('.welcome-consent-copy').textContent,overflow:document.documentElement.scrollWidth>innerWidth}") as! [String:Any]
            XCTAssertEqual(consent["checked"] as? String, "true"); XCTAssertEqual(consent["copy"] as? String, "I agree to the Terms and Privacy Policy.")
            XCTAssertEqual(consent["width"] as! Double, 24 * sourceScale, accuracy: 1); XCTAssertEqual(consent["height"] as! Double, 24 * sourceScale, accuracy: 1); XCTAssertEqual(consent["overflow"] as? Bool, false)
            let scrolled = try await script(host, """
            const scroller=[...document.querySelectorAll('.secondary-page-scroll .uni-scroll-view')].at(-1),footer=document.querySelector('.welcome-footer').getBoundingClientRect();
            const before={clientHeight:scroller.clientHeight,scrollHeight:scroller.scrollHeight,footerY:footer.y};scroller.scrollTop=scroller.scrollHeight;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            const description=document.querySelector('.welcome-description').getBoundingClientRect(),afterFooter=document.querySelector('.welcome-footer').getBoundingClientRect();return {clientHeight:before.clientHeight,scrollHeight:before.scrollHeight,scrollTop:scroller.scrollTop,footerY:before.footerY,afterFooterY:afterFooter.y,descriptionBottom:description.bottom};
            """) as! [String: Double]
            XCTAssertLessThanOrEqual(scrolled["scrollHeight"]!, scrolled["clientHeight"]! + 1); XCTAssertLessThanOrEqual(scrolled["scrollTop"]!, 1)
            XCTAssertEqual(scrolled["afterFooterY"]!, scrolled["footerY"]!, accuracy: 1); XCTAssertLessThanOrEqual(scrolled["descriptionBottom"]!, scrolled["afterFooterY"]! + 1)
            let scrolledScreenshot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil))
            scrolledScreenshot.name = "WKWebView Welcome safe-area scrolled"; scrolledScreenshot.lifetime = .keepAlways; add(scrolledScreenshot)
            try (try await host.webView.takeSnapshot(configuration: nil)).pngData()!.write(to: output.appendingPathComponent("actual-wkwebview-scrolled.png"))
            print("CIMOA_WELCOME_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")

            _ = try await script(host, "const entry=document.querySelector('[data-interaction=\"welcome.goAge.click.1\"]');entry.click();entry.click();return true")
            try await waitFor(host, ".age-page")
            let ageDepth = try await script(host, "return document.querySelector('.age-page').dataset.pageDepth") as? String
            XCTAssertEqual(ageDepth, "2")
            _ = try await script(host, "document.querySelector('.age-page .auth-back').click();await new Promise(r=>setTimeout(r,350));return true"); try await waitFor(host, ".welcome-page")
            for (interaction, destination, backSelector) in [
                ("welcome.goLogin.click.1", ".login-page", ".login-page .auth-back"),
                ("welcome.openTerms.click.1", ".legal-terms-page", ".legal-terms-page .event-page-round"),
                ("welcome.openPrivacy.click.1", ".legal-privacy-page", ".legal-privacy-page .event-page-round")
            ] {
                _ = try await script(host, "document.querySelector('[data-interaction=\"\(interaction)\"]').click();return true")
                try await waitFor(host, destination)
                let depth = try await script(host, "return document.querySelector('\(destination)').dataset.pageDepth") as? String
                XCTAssertEqual(depth, "2")
                _ = try await script(host, "document.querySelector('\(backSelector)').click();await new Promise(r=>setTimeout(r,350));return true"); try await waitFor(host, ".welcome-page")
                let retained = try await script(host, "return document.querySelector('.welcome-consent-toggle').getAttribute('aria-checked')==='true'") as? Bool
                XCTAssertEqual(retained, true)
            }
            let blockedAgain = try await script(host, "document.querySelector('.welcome-consent-toggle').click();document.querySelector('.welcome-login').click();document.querySelector('.welcome-create').click();await new Promise(r=>setTimeout(r,350));return location.hash.endsWith('/pages/auth/welcome')&&document.querySelector('.welcome-consent-toggle').getAttribute('aria-checked')==='false'") as? Bool
            XCTAssertEqual(blockedAgain, true)
            let guestStorageRemainsEmpty = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')===null") as? Bool
            XCTAssertEqual(guestStorageRemainsEmpty, true)
            host.webView.reload(); try await waitFor(host, ".welcome-page")
            let refreshStorageRemainsEmpty = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')===null") as? Bool
            XCTAssertEqual(refreshStorageRemainsEmpty, true)
            let reset = try await script(host, "return document.querySelector('.welcome-consent-toggle').getAttribute('aria-checked')==='false'&&document.querySelector('.welcome-login').getAttribute('aria-disabled')==='true'") as? Bool
            XCTAssertEqual(reset, true)
            try JSONSerialization.data(withJSONObject: ["result":"passed","initial_copy_visibility":initiallyVisible,"initial_auth_rejected":rejected == true,"policy_reading_does_not_accept":true,"consent":consent,"unchecking_blocks_again":blockedAgain == true,"refresh_resets":reset == true,"zero_business_writes":refreshStorageRemainsEmpty == true,"metrics":metrics,"scrolled":scrolled,"scope":"Welcome first-entry copy visibility and unchanged consent/navigation; no whole-app or whole-screen pixel acceptance claim"], options: [.prettyPrinted,.sortedKeys]).write(to: output.appendingPathComponent("native-acceptance.json"))
            try await restore()
        } catch { try? await restore(); throw error }
    }
    func testLoginPixelRestoration() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("for(const [key,value] of [['cimoa_app_state_v2',snapshot.state],['cimoa_app_state',snapshot.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)};return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?loginPixel=restored#/pages/auth/splash")!))
        }
        func reloadAndWait(_ selector: String) async throws {
            _ = try await script(host, "window.__loginOldDocument=true;return true")
            host.webView.reload()
            for _ in 0..<100 {
                if (try? await script(host, "return !window.__loginOldDocument&&!!document.querySelector('\(selector)')")) as? Bool == true { return }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            throw NSError(domain: "CimoaTests", code: 4, userInfo: [NSLocalizedDescriptionKey: "Missing new document \(selector)"])
        }
        var stage = "prepare guest Login"
        do {
            _ = try await script(host, "localStorage.removeItem('cimoa_app_state_v2');localStorage.removeItem('cimoa_app_state');return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?loginPixel=native#/pages/auth/login")!))
            try await waitFor(host, ".login-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom,cx:rect.x+rect.width/2}},fields=[...document.querySelectorAll('.auth-field')].map(element=>{const rect=element.getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,bottom:rect.bottom}}),chips=[...document.querySelectorAll('.auth-test-chip')].map(element=>{const rect=element.getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,text:element.textContent.trim()}}),inputs=[...document.querySelectorAll('.login-page .auth-input')].map(element=>({interaction:element.dataset.interaction,placeholder:element.querySelector('.uni-input-placeholder')?.textContent||null,type:element.querySelector('input')?.type||null}));
                return {root:box('.login-page'),header:box('.auth-header'),back:box('.auth-back'),title:box('.auth-header-title'),content:box('.auth-content'),heading:box('.auth-heading'),fields,forgot:box('.auth-forgot'),tests:box('.auth-test-states'),chips,note:box('.auth-local-note'),login:box('.auth-primary'),create:box('.auth-secondary'),safes:[...document.querySelectorAll('.login-page > .safe-area')].map(element=>element.getBoundingClientRect().height),text:{header:document.querySelector('.auth-header-title').textContent,heading:document.querySelector('.auth-heading').textContent,hasApple:!!document.querySelector('.auth-apple'),hasDivider:!!document.querySelector('.auth-divider'),labels:[...document.querySelectorAll('.auth-label')].map(element=>element.textContent),forgot:document.querySelector('.auth-forgot').textContent,tests:document.querySelector('.auth-test-title').textContent,note:document.querySelector('.auth-local-note').textContent,login:document.querySelector('.auth-primary').textContent.trim(),create:document.querySelector('.auth-secondary').textContent.trim()},inputs,backInteraction:document.querySelector('.auth-back').dataset.interaction,alert:!!document.querySelector('.login-page [role=alert]')};
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root = metrics["root"] as! [String: Double], header = metrics["header"] as! [String: Double]
            let back = metrics["back"] as! [String: Double], heading = metrics["heading"] as! [String: Double]
            let fields = metrics["fields"] as! [[String: Double]]
            let forgot = metrics["forgot"] as! [String: Double], tests = metrics["tests"] as! [String: Double], note = metrics["note"] as! [String: Double]
            let chips = metrics["chips"] as! [[String: Any]], login = metrics["login"] as! [String: Double]
            let create = metrics["create"] as! [String: Double], safes = metrics["safes"] as! [Double]
            let text = metrics["text"] as! [String: Any], inputs = metrics["inputs"] as! [[String: Any]]
            let sourceScale = root["width"]! / 393
            XCTAssertEqual(root["x"]!, 0, accuracy: 1); XCTAssertEqual(root["y"]!, 0, accuracy: 1)
            XCTAssertEqual(root["width"]!, Double(host.webView.bounds.width), accuracy: 1); XCTAssertEqual(root["height"]!, Double(host.webView.bounds.height), accuracy: 1)
            XCTAssertEqual(safes[0], Double(host.view.safeAreaInsets.top), accuracy: 1); XCTAssertEqual(safes[1], Double(host.view.safeAreaInsets.bottom), accuracy: 1)
            XCTAssertEqual(header["x"]!, 20 * sourceScale, accuracy: 1); XCTAssertEqual(header["y"]!, safes[0] + 4 * sourceScale, accuracy: 1); XCTAssertEqual(header["height"]!, 48 * sourceScale, accuracy: 1)
            XCTAssertEqual(back["width"]!, 46 * sourceScale, accuracy: 1); XCTAssertEqual(back["height"]!, 46 * sourceScale, accuracy: 1)
            XCTAssertEqual(heading["y"]!, safes[0] + 68 * sourceScale, accuracy: 1)
            XCTAssertEqual(fields[0]["y"]!, heading["bottom"]! + 14 * sourceScale, accuracy: 1); XCTAssertEqual(fields[1]["y"]!, fields[0]["bottom"]! + 14 * sourceScale, accuracy: 1)
            XCTAssertEqual(forgot["y"]!, fields[1]["bottom"]! + 16 * sourceScale, accuracy: 1); XCTAssertEqual(tests["y"]!, forgot["bottom"]! + 22 * sourceScale, accuracy: 1); XCTAssertEqual(note["y"]!, tests["bottom"]! + 22 * sourceScale, accuracy: 1)
            XCTAssertEqual(chips.map { $0["text"] as! String }, ["Wrong password", "Unverified account"])
            for chip in chips { XCTAssertEqual(chip["height"] as! Double, 40 * sourceScale, accuracy: 1) }
            XCTAssertEqual(login["x"]!, 20 * sourceScale, accuracy: 1); XCTAssertEqual(login["height"]!, 60 * sourceScale, accuracy: 1)
            XCTAssertEqual(create["height"]!, 46 * sourceScale, accuracy: 1); XCTAssertEqual(create["bottom"]!, root["height"]! - safes[1] - 30 * sourceScale, accuracy: 2)
            XCTAssertEqual(text["header"] as? String, "Log in"); XCTAssertEqual(text["heading"] as? String, "Welcome back")
            XCTAssertEqual(text["hasApple"] as? Bool, false); XCTAssertEqual(text["hasDivider"] as? Bool, false)
            XCTAssertEqual(text["labels"] as? [String], ["Email", "Password"]); XCTAssertEqual(text["forgot"] as? String, "Forgot password?")
            XCTAssertEqual(text["tests"] as? String, "TEST STATES"); XCTAssertEqual(text["note"] as? String, "Local accounts are stored on this device. Signing in does not verify your student status.")
            XCTAssertEqual(text["login"] as? String, "Log In"); XCTAssertEqual(text["create"] as? String, "New here? Create an account")
            XCTAssertEqual(inputs[0]["interaction"] as? String, "login.onEmail.change.1"); XCTAssertEqual(inputs[0]["placeholder"] as? String, "you@university.edu")
            XCTAssertEqual(inputs[1]["interaction"] as? String, "login.onPw.change.1"); XCTAssertEqual(inputs[1]["placeholder"] as? String, "Your password")
            XCTAssertEqual(inputs[1]["type"] as? String, "password"); XCTAssertEqual(metrics["backInteraction"] as? String, "login.goBack.click.1"); XCTAssertEqual(metrics["alert"] as? Bool, false)
            let screenshot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil))
            screenshot.name = "WKWebView Login deterministic"; screenshot.lifetime = .keepAlways; add(screenshot)
            print("CIMOA_LOGIN_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")

            stage = "wrong-password source state"
            _ = try await script(host, "document.querySelector('[data-interaction=\"login.loginWrong.click.1\"]').click();return true")
            try await waitFor(host, ".login-page [role=alert]")
            var state = try await script(host, "return {error:document.querySelector('.login-page [role=alert]').textContent,storage:localStorage.getItem('cimoa_app_state_v2')}") as! [String: Any]
            XCTAssertEqual(state["error"] as? String, "Incorrect password. Try again or reset it."); XCTAssertTrue(state["storage"] is NSNull)
            stage = "unverified source state"
            try await reloadAndWait(".login-page")
            _ = try await script(host, "document.querySelector('[data-interaction=\"login.loginUnverified.click.1\"]').click();return true")
            try await waitFor(host, ".login-page [role=alert]")
            state = try await script(host, "return {error:document.querySelector('.login-page [role=alert]').textContent,storage:localStorage.getItem('cimoa_app_state_v2')}") as! [String: Any]
            XCTAssertEqual(state["error"] as? String, "No unverified local account is available on this device. No changes were made."); XCTAssertTrue(state["storage"] is NSNull)
            stage = "password toggle and absent Apple entry"
            _ = try await script(host, "document.querySelector('[data-interaction=\"login.togglePw.click.1\"]').click();return true")
            let shownType = try await script(host, "return document.querySelectorAll('.login-page input')[1].type") as? String
            XCTAssertEqual(shownType, "text")
            _ = try await script(host, "document.querySelector('[data-interaction=\"login.togglePw.click.1\"]').click();return true")
            state = try await script(host, "return {type:document.querySelectorAll('.login-page input')[1].type,hasApple:!!document.querySelector('.auth-apple'),storage:localStorage.getItem('cimoa_app_state_v2')}") as! [String: Any]
            XCTAssertEqual(state["type"] as? String, "password"); XCTAssertEqual(state["hasApple"] as? Bool, false); XCTAssertTrue(state["storage"] is NSNull)

            stage = "successful delayed Login"
            try await reloadAndWait(".login-page")
            _ = try await script(host, "await new Promise(resolve=>setTimeout(resolve,300));const fields=document.querySelectorAll('.login-page input');for(const [index,value] of ['cimoa@gmail.com','12341234'].entries()){fields[index].value=value;fields[index].dispatchEvent(new Event('input',{bubbles:true}))}await Promise.resolve();document.querySelector('[data-interaction=\"login.loginNow.click.1\"]').click();return true")
            try await waitFor(host, ".loading")
            let loading = try await script(host, "return {visible:!!document.querySelector('.loading'),storage:localStorage.getItem('cimoa_app_state_v2')}") as! [String: Any]
            XCTAssertEqual(loading["visible"] as? Bool, true); XCTAssertTrue(loading["storage"] is NSNull)
            try await waitFor(host, ".home-header")
            let committed = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
            XCTAssertEqual((try JSONSerialization.jsonObject(with: Data(committed.utf8)) as! [String: Any])["type"] as? String, "object")
            try await reloadAndWait(".home-header")
            let restoredSession = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as? String
            XCTAssertEqual(restoredSession, committed)
            stage = "restore original storage"
            try await restore()
        } catch { XCTFail("Login WKWebView stage \(stage) failed: \(error)"); try? await restore(); throw error }
    }
    func testAgePixelRestoration() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
        var projectRoot = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { projectRoot.deleteLastPathComponent() }
        let output = projectRoot.appendingPathComponent("docs/ui-restoration/age/date-picker-2026-10-19")
        func restore() async throws {
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?agePixel=restore#/pages/auth/welcome")!))
            try await waitFor(host, ".welcome-page")
            _ = try await host.webView.callAsyncJavaScript("for(const [key,value] of [['cimoa_app_state_v2',snapshot.state],['cimoa_app_state',snapshot.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)};return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?agePixel=restored#/pages/auth/splash")!))
        }
        func openFreshAge(_ suffix: String) async throws {
            _ = try await script(host, "localStorage.removeItem('cimoa_app_state_v2');localStorage.removeItem('cimoa_app_state');return true")
            _ = try await script(host, "window.__ageOldDocument=true;return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?agePixel=\(suffix)#/pages/auth/age")!))
            for _ in 0..<100 {
                if (try? await script(host, "return !window.__ageOldDocument&&!!document.querySelector('.age-page')")) as? Bool == true { return }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            throw NSError(domain: "CimoaTests", code: 5, userInfo: [NSLocalizedDescriptionKey: "Missing new Age document"])
        }
        var stage = "prepare guest Age"
        do {
            try await openFreshAge("native")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom,cx:rect.x+rect.width/2}},input=document.querySelector('.age-page .auth-input');
                return {root:box('.age-page'),header:box('.auth-header'),back:box('.auth-back'),heading:box('.auth-heading'),description:box('.auth-description'),field:box('.auth-field'),inputBox:box('.auth-input-box'),continueButton:box('.auth-primary'),underButton:box('.auth-secondary'),safes:[...document.querySelectorAll('.age-page > .safe-area')].map(element=>element.getBoundingClientRect().height),text:{header:document.querySelector('.auth-header-title').textContent,heading:document.querySelector('.auth-heading').textContent,description:document.querySelector('.auth-description').textContent,label:document.querySelector('.auth-label').textContent,continueButton:document.querySelector('.auth-primary').textContent.trim(),underButton:document.querySelector('.auth-secondary').textContent.trim()},backInteraction:document.querySelector('.auth-back').dataset.interaction,inputInteraction:document.querySelector('.auth-input-box').dataset.interaction,placeholder:input.dataset.placeholder,value:input.dataset.dateValue,alert:!!document.querySelector('.age-page [role=alert]')};
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root = metrics["root"] as! [String: Double], header = metrics["header"] as! [String: Double], back = metrics["back"] as! [String: Double]
            let heading = metrics["heading"] as! [String: Double], description = metrics["description"] as! [String: Double], field = metrics["field"] as! [String: Double]
            let inputBox = metrics["inputBox"] as! [String: Double], continueButton = metrics["continueButton"] as! [String: Double], underButton = metrics["underButton"] as! [String: Double]
            let safes = metrics["safes"] as! [Double], text = metrics["text"] as! [String: String], sourceScale = root["width"]! / 393
            XCTAssertEqual(root["x"]!, 0, accuracy: 1); XCTAssertEqual(root["y"]!, 0, accuracy: 1)
            XCTAssertEqual(root["width"]!, Double(host.webView.bounds.width), accuracy: 1); XCTAssertEqual(root["height"]!, Double(host.webView.bounds.height), accuracy: 1)
            XCTAssertEqual(safes[0], Double(host.view.safeAreaInsets.top), accuracy: 1); XCTAssertEqual(safes[1], Double(host.view.safeAreaInsets.bottom), accuracy: 1)
            XCTAssertEqual(header["x"]!, 20 * sourceScale, accuracy: 1); XCTAssertEqual(header["y"]!, safes[0] + 4 * sourceScale, accuracy: 1); XCTAssertEqual(header["height"]!, 48 * sourceScale, accuracy: 1)
            XCTAssertEqual(back["width"]!, 46 * sourceScale, accuracy: 1); XCTAssertEqual(back["height"]!, 46 * sourceScale, accuracy: 1)
            XCTAssertEqual(heading["y"]!, safes[0] + 68 * sourceScale, accuracy: 1); XCTAssertEqual(description["y"]!, heading["bottom"]! + 10 * sourceScale, accuracy: 1); XCTAssertEqual(field["y"]!, description["bottom"]! + 14 * sourceScale, accuracy: 1); XCTAssertEqual(inputBox["height"]!, 56 * sourceScale, accuracy: 1)
            XCTAssertEqual(continueButton["x"]!, 20 * sourceScale, accuracy: 1); XCTAssertEqual(continueButton["height"]!, 60 * sourceScale, accuracy: 1); XCTAssertEqual(underButton["height"]!, 46 * sourceScale, accuracy: 1); XCTAssertEqual(underButton["bottom"]!, root["height"]! - safes[1] - 30 * sourceScale, accuracy: 2)
            XCTAssertEqual(text["header"], "Age check"); XCTAssertEqual(text["heading"], "Are you 18 or older?"); XCTAssertEqual(text["description"], "Cimoa is available only to university students aged 18 or older. Your date of birth stays private — other students only see your age.")
            XCTAssertEqual(text["label"], "Date of birth"); XCTAssertEqual(text["continueButton"], "Continue"); XCTAssertEqual(text["underButton"], "I’m under 18")
            XCTAssertEqual(metrics["backInteraction"] as? String, "age.goBack.click.1"); XCTAssertEqual(metrics["inputInteraction"] as? String, "age.openDatePicker.click.1"); XCTAssertEqual(metrics["placeholder"] as? String, "YYYY-MM-DD"); XCTAssertEqual(metrics["value"] as? String, ""); XCTAssertEqual(metrics["alert"] as? Bool, false)
            let defaultShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); defaultShot.name = "WKWebView Age deterministic"; defaultShot.lifetime = .keepAlways; add(defaultShot)
            try (try await host.webView.takeSnapshot(configuration: nil)).pngData()!.write(to: output.appendingPathComponent("actual-wkwebview.png"))
            print("CIMOA_AGE_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")

            stage = "underage source card"
            _ = try await script(host, "document.querySelector('[data-interaction=\"age.underage.click.1\"]').click();return true")
            try await waitFor(host, ".age-under")
            let underage = try await script(host, """
            const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {y:rect.y,height:rect.height,bottom:rect.bottom}},style=selector=>getComputedStyle(document.querySelector(selector));return {card:box('.age-under'),title:box('.age-title'),copy:box('.age-under-copy'),close:box('.age-close'),padding:parseFloat(style('.age-under').padding),radius:parseFloat(style('.age-under').borderRadius),titleSize:parseFloat(style('.age-title').fontSize),titleSpacing:parseFloat(style('.age-title').letterSpacing),copySize:parseFloat(style('.age-under-copy').fontSize),text:document.querySelector('.age-under').innerText,storage:localStorage.getItem('cimoa_app_state_v2')};
            """) as! [String: Any]
            let card = underage["card"] as! [String: Double], title = underage["title"] as! [String: Double], copy = underage["copy"] as! [String: Double], close = underage["close"] as! [String: Double]
            XCTAssertEqual(underage["padding"] as! Double, 20 * sourceScale, accuracy: 0.1); XCTAssertEqual(underage["radius"] as! Double, 24 * sourceScale, accuracy: 0.1); XCTAssertEqual(card["y"]!, inputBox["bottom"]! + 18 * sourceScale, accuracy: 2)
            XCTAssertEqual(underage["titleSize"] as! Double, 20 * sourceScale, accuracy: 0.1); XCTAssertEqual(underage["titleSpacing"] as! Double, -0.5 * sourceScale, accuracy: 0.1); XCTAssertEqual(underage["copySize"] as! Double, 16 * sourceScale, accuracy: 0.1); XCTAssertEqual(copy["y"]!, title["bottom"]! + 8 * sourceScale, accuracy: 1); XCTAssertEqual(close["y"]!, copy["bottom"]! + 14 * sourceScale, accuracy: 1); XCTAssertEqual(close["height"]!, 50 * sourceScale, accuracy: 1)
            XCTAssertEqual((underage["text"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines), "Cimoa isn’t available yet\nYou need to be 18 or older to create an account. Nothing has been saved.\nClose"); XCTAssertTrue(underage["storage"] is NSNull)
            let underageShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); underageShot.name = "WKWebView Age underage"; underageShot.lifetime = .keepAlways; add(underageShot)
            _ = try await script(host, "document.querySelector('[data-interaction=\"age.closeUnder.click.1\"]').click();return true"); try await waitFor(host, ".welcome-page")
            let closeStorage = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')")
            XCTAssertTrue(closeStorage is NSNull)

            stage = "validation and delayed adult write"
            try await openFreshAge("flow")
            _ = try await script(host, "document.querySelector('[data-interaction=\"age.goAgree.click.1\"]').click();return true"); try await waitFor(host, ".age-page [role=alert]")
            let invalidMessage = try await script(host, "return document.querySelector('.age-page [role=alert]').textContent") as! String
            let invalidStorage = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')")
            XCTAssertTrue(invalidMessage.contains("valid date")); XCTAssertTrue(invalidStorage is NSNull)
            try await chooseBirthDate(host, "2020-01-01")
            _ = try await script(host, "document.querySelector('[data-interaction=\"age.goAgree.click.1\"]').click();return true"); try await waitFor(host, ".age-under")
            let underageStorage = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')")
            XCTAssertTrue(underageStorage is NSNull)
            try await chooseBirthDate(host, "2000-01-01")
            _ = try await script(host, "document.querySelector('[data-interaction=\"age.goAgree.click.1\"]').click();return true"); try await waitFor(host, ".loading")
            let loadingStorage = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')")
            XCTAssertTrue(loadingStorage is NSNull); try await waitFor(host, ".community-page")
            let committed = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
            let envelope = try JSONSerialization.jsonObject(with: Data(committed.utf8)) as! [String: Any], data = envelope["data"] as! [String: Any], auth = data["auth_flow"] as! [String: Any], profile = auth["profile_draft"] as! [String: Any]
            XCTAssertEqual(profile["date_of_birth"] as? String, "2000-01-01"); XCTAssertEqual(auth["step"] as? String, "community")
            try await loadFreshConnection(host, route: "/pages/auth/age", selector: ".age-date-value")
            let restoredDOB = try await script(host, "return document.querySelector('.age-date-value').dataset.dateValue") as? String
            XCTAssertEqual(restoredDOB, "2000-01-01")

            stage = "three-column picker without text keyboard"
            let viewportBefore = try await script(host, "return visualViewport.height") as! Double
            let picker = try await script(host, """
            document.querySelector('[data-interaction="age.openDatePicker.click.1"]').click();await new Promise(r=>setTimeout(r,380));await document.fonts.ready;for(const a of document.getAnimations())if(a.effect?.getComputedTiming().iterations!==Infinity)a.finish();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
            const panel=document.querySelector('.dob-picker [role=dialog]').getBoundingClientRect();return {height:visualViewport.height,columns:document.querySelectorAll('.dob-picker [role=spinbutton]').length,year:document.querySelector('[role=spinbutton][aria-label=Year]').getAttribute('aria-valuenow'),inputCount:document.querySelectorAll('.age-page input').length,top:panel.top,bottom:panel.bottom,overflow:document.documentElement.scrollWidth>innerWidth};
            """) as! [String:Any]
            XCTAssertEqual(picker["height"] as! Double, viewportBefore, accuracy: 1); XCTAssertEqual(picker["columns"] as? Int, 3); XCTAssertEqual(picker["year"] as? String, "2000"); XCTAssertEqual(picker["inputCount"] as? Int, 0); XCTAssertEqual(picker["overflow"] as? Bool, false)
            XCTAssertGreaterThanOrEqual(picker["top"] as! Double, safes[0]); XCTAssertLessThanOrEqual(picker["bottom"] as! Double, root["height"]! - safes[1] + 1)
            try (try await host.webView.takeSnapshot(configuration: nil)).pngData()!.write(to: output.appendingPathComponent("picker-wkwebview.png"))
            let cancelled = try await script(host, "document.querySelector('[role=spinbutton][aria-label=Year]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));await Promise.resolve();document.querySelector('[data-interaction=\"age.datePicker.cancel.click.1\"]').click();await new Promise(r=>setTimeout(r,300));return document.querySelector('.age-date-value').dataset.dateValue==='2000-01-01'") as? Bool
            XCTAssertEqual(cancelled, true)

            stage = "direct Back fallback"
            try await openFreshAge("back")
            _ = try await script(host, "document.querySelector('[data-interaction=\"age.goBack.click.1\"]').click();return true"); try await waitFor(host, ".welcome-page")
            let backStorage = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')")
            XCTAssertTrue(backStorage is NSNull)
            try JSONSerialization.data(withJSONObject: ["result":"passed","metrics":metrics,"picker":picker,"cancel_preserves_date":cancelled == true,"adult_persisted":"2000-01-01","underage_zero_writes":true,"refresh_restored":restoredDOB == "2000-01-01","no_text_keyboard":true,"scope":"Age date-picker increment only"], options: [.prettyPrinted,.sortedKeys]).write(to: output.appendingPathComponent("native-acceptance.json"))
            try await restore()
        } catch { XCTFail("Age WKWebView stage \(stage) failed: \(error)"); try? await restore(); throw error }
    }
    func testCommunityPixelRestoration() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
        func restore() async throws {
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?communityPixel=restore#/pages/auth/welcome")!))
            try await waitFor(host, ".welcome-page")
            _ = try await host.webView.callAsyncJavaScript("for(const [key,value] of [['cimoa_app_state_v2',snapshot.state],['cimoa_app_state',snapshot.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)};return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?communityPixel=restored#/pages/auth/splash")!))
        }
        func loadFresh(_ route: String, _ suffix: String, _ selector: String) async throws {
            _ = try await script(host, "localStorage.removeItem('cimoa_app_state_v2');localStorage.removeItem('cimoa_app_state');window.__communityOldDocument=true;return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?communityPixel=\(suffix)#\(route)")!))
            for _ in 0..<100 {
                if (try? await script(host, "return !window.__communityOldDocument&&!!document.querySelector('\(selector)')")) as? Bool == true { return }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            throw NSError(domain: "CimoaTests", code: 6, userInfo: [NSLocalizedDescriptionKey: "Missing new Community document"])
        }
        var stage = "prepare Community default"
        do {
            try await loadFresh("/pages/auth/community", "native", ".community-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                const box=value=>{const element=typeof value==='string'?document.querySelector(value):value,rect=element.getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},rows=[...document.querySelectorAll('.community-row')],checks=[...document.querySelectorAll('.community-box')],reads=[...document.querySelectorAll('.community-read')],ruleStyle=getComputedStyle(document.querySelector('.community-rules'));
                return {root:box('.community-page'),header:box('.auth-header'),back:box('.auth-back'),heading:box('.auth-heading'),rules:box('.community-rules'),rows:rows.map(box),checks:checks.map(box),footer:box('.auth-footer'),continueButton:box('.auth-primary'),safes:[...document.querySelectorAll('.community-page > .safe-area')].map(element=>element.getBoundingClientRect().height),ruleStyle:{gap:parseFloat(ruleStyle.gap),padding:parseFloat(ruleStyle.padding),radius:parseFloat(ruleStyle.borderRadius),fontSize:parseFloat(ruleStyle.fontSize)},text:{header:document.querySelector('.auth-header-title').textContent,heading:document.querySelector('.auth-heading').textContent,rules:[...document.querySelectorAll('.community-rules > uni-text')].map(element=>element.textContent),rows:rows.map(element=>element.innerText.split(String.fromCharCode(10)).join(' ').split(' ').filter(Boolean).join(' ')),continueButton:document.querySelector('.auth-primary').textContent.trim()},interactions:{back:document.querySelector('.auth-back').dataset.interaction,toggles:[...document.querySelectorAll('.community-check-area')].map(element=>element.dataset.interaction),reads:reads.map(element=>element.dataset.interaction),continueButton:document.querySelector('.auth-primary').dataset.interaction},selected:[...document.querySelectorAll('.community-check-area')].map(element=>element.getAttribute('aria-checked')),disabled:document.querySelector('.auth-primary').getAttribute('aria-disabled'),alert:!!document.querySelector('.community-page [role=alert]'),note:!!document.querySelector('.community-page .auth-local-note'),storage:localStorage.getItem('cimoa_app_state_v2')};
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root = metrics["root"] as! [String: Double], header = metrics["header"] as! [String: Double], back = metrics["back"] as! [String: Double]
            let heading = metrics["heading"] as! [String: Double], rules = metrics["rules"] as! [String: Double], rows = metrics["rows"] as! [[String: Double]], checks = metrics["checks"] as! [[String: Double]]
            let continueButton = metrics["continueButton"] as! [String: Double], safes = metrics["safes"] as! [Double], ruleStyle = metrics["ruleStyle"] as! [String: Double], sourceScale = root["width"]! / 393
            let text = metrics["text"] as! [String: Any], interactions = metrics["interactions"] as! [String: Any]
            XCTAssertEqual(root["x"]!, 0, accuracy: 1); XCTAssertEqual(root["y"]!, 0, accuracy: 1); XCTAssertEqual(root["width"]!, Double(host.webView.bounds.width), accuracy: 1); XCTAssertEqual(root["height"]!, Double(host.webView.bounds.height), accuracy: 1)
            XCTAssertEqual(safes[0], Double(host.view.safeAreaInsets.top), accuracy: 1); XCTAssertEqual(safes[1], Double(host.view.safeAreaInsets.bottom), accuracy: 1)
            XCTAssertEqual(header["x"]!, 20 * sourceScale, accuracy: 1); XCTAssertEqual(header["y"]!, safes[0] + 4 * sourceScale, accuracy: 1); XCTAssertEqual(header["height"]!, 48 * sourceScale, accuracy: 1); XCTAssertEqual(back["width"]!, 46 * sourceScale, accuracy: 1); XCTAssertEqual(back["height"]!, 46 * sourceScale, accuracy: 1)
            XCTAssertEqual(heading["y"]!, safes[0] + 68 * sourceScale, accuracy: 1); XCTAssertEqual(rules["y"]!, heading["bottom"]! + 16 * sourceScale, accuracy: 1)
            XCTAssertEqual(ruleStyle["gap"]!, 9 * sourceScale, accuracy: 0.2); XCTAssertEqual(ruleStyle["padding"]!, 18 * sourceScale, accuracy: 0.2); XCTAssertEqual(ruleStyle["radius"]!, 24 * sourceScale, accuracy: 0.2); XCTAssertEqual(ruleStyle["fontSize"]!, 16.5 * sourceScale, accuracy: 0.2)
            for index in rows.indices { let previous = index == 0 ? rules : rows[index - 1]; XCTAssertEqual(rows[index]["y"]!, previous["bottom"]! + 10 * sourceScale, accuracy: 1.5); XCTAssertEqual(checks[index]["width"]!, 28 * sourceScale, accuracy: 0.2); XCTAssertEqual(checks[index]["height"]!, 28 * sourceScale, accuracy: 0.2) }
            XCTAssertEqual(continueButton["x"]!, 20 * sourceScale, accuracy: 1); XCTAssertEqual(continueButton["height"]!, 60 * sourceScale, accuracy: 1); XCTAssertEqual(continueButton["bottom"]!, root["height"]! - safes[1] - 34 * sourceScale, accuracy: 2)
            XCTAssertEqual(text["header"] as? String, "Community"); XCTAssertEqual(text["heading"] as? String, "How Cimoa works")
            XCTAssertEqual(text["rules"] as? [String], ["Be respectful.", "Use your real university identity.", "Never harass or pressure anyone.", "Respect boundaries and consent.", "No illegal or unsafe content.", "Report anything concerning."])
            XCTAssertEqual(text["rows"] as? [String], ["I agree to the Terms of Use Read", "I have read the Privacy Policy Read", "I agree to follow the Community Guidelines Read"]); XCTAssertEqual(text["continueButton"] as? String, "Continue")
            XCTAssertEqual(interactions["back"] as? String, "agree.goBack.click.1"); XCTAssertEqual(interactions["toggles"] as? [String], ["agree.tTerms.click.1", "agree.tPrivacy.click.1", "agree.tGuides.click.1"]); XCTAssertEqual(interactions["reads"] as? [String], ["agree.readTerms.click.1", "agree.readPrivacy.click.1", "agree.readGuides.click.1"]); XCTAssertEqual(interactions["continueButton"] as? String, "agree.goSignup.click.1")
            XCTAssertEqual(metrics["selected"] as? [String], ["false", "false", "false"]); XCTAssertEqual(metrics["disabled"] as? String, "true"); XCTAssertEqual(metrics["alert"] as? Bool, false); XCTAssertEqual(metrics["note"] as? Bool, false); XCTAssertTrue(metrics["storage"] is NSNull)
            let defaultShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); defaultShot.name = "WKWebView Community deterministic"; defaultShot.lifetime = .keepAlways; add(defaultShot)
            print("CIMOA_COMMUNITY_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")

            stage = "Agreement Sheet first and repeated open"
            _ = try await script(host, "document.querySelector('[data-interaction=\"agree.readPrivacy.click.1\"]').click();return true")
            try await waitFor(host, ".event-dialog--open [role=dialog]"); try await Task.sleep(nanoseconds: 300_000_000)
            let sheet = try await script(host, "return {text:document.querySelector('[role=dialog]').innerText,selected:[...document.querySelectorAll('.community-check-area')].map(element=>element.getAttribute('aria-checked')),storage:localStorage.getItem('cimoa_app_state_v2'),mask:document.querySelector('.event-dialog-mask').dataset.interaction,close:document.querySelector('.event-dialog-secondary').dataset.interaction,overflow:getComputedStyle(document.querySelector('.event-dialog-scroll .uni-scroll-view')).overflowY}") as! [String: Any]
            XCTAssertTrue((sheet["text"] as? String)?.contains("This notice describes information handled by this local Cimoa build.") == true); XCTAssertTrue((sheet["text"] as? String)?.contains("stored locally") == true); XCTAssertEqual(sheet["selected"] as? [String], ["false", "false", "false"]); XCTAssertTrue(sheet["storage"] is NSNull); XCTAssertEqual(sheet["mask"] as? String, "sheetAgreement.closeSheet.click.1"); XCTAssertEqual(sheet["close"] as? String, "sheetAgreement.closeSheet.click.2")
            let sheetShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); sheetShot.name = "WKWebView Community Agreement Sheet"; sheetShot.lifetime = .keepAlways; add(sheetShot)
            _ = try await script(host, "document.querySelector('[data-interaction=\"sheetAgreement.closeSheet.click.2\"]').click();return true"); try await Task.sleep(nanoseconds: 350_000_000)
            let firstClose = try await script(host, "return getComputedStyle(document.querySelector('.event-dialog')).display==='none'&&!document.querySelector('.community-check-area').getAttribute('aria-checked').includes('true')") as? Bool
            XCTAssertEqual(firstClose, true)
            _ = try await script(host, "document.querySelector('[data-interaction=\"agree.readPrivacy.click.1\"]').click();return true"); try await waitFor(host, ".event-dialog--open [role=dialog]")
            let repeatedOpen = try await script(host, "return document.querySelector('[role=dialog]').innerText.includes('No production privacy or support contact is configured')") as? Bool
            XCTAssertEqual(repeatedOpen, true)
            _ = try await script(host, "document.querySelector('[data-interaction=\"sheetAgreement.closeSheet.click.1\"]').click();return true"); try await Task.sleep(nanoseconds: 350_000_000)

            stage = "validation and atomic agreement write"
            try await loadFresh("/pages/auth/age", "flow", ".age-page")
            try await chooseBirthDate(host, "2000-01-01")
            _ = try await script(host, "document.querySelector('[data-interaction=\"age.goAgree.click.1\"]').click();return true"); try await waitFor(host, ".community-page")
            let before = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
            _ = try await script(host, "document.querySelector('[data-interaction=\"agree.goSignup.click.1\"]').click();return true"); try await waitFor(host, ".community-page [role=alert]")
            let validationStorage = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as? String
            XCTAssertEqual(validationStorage, before)
            _ = try await script(host, "for(const id of ['agree.tTerms.click.1','agree.tPrivacy.click.1','agree.tGuides.click.1'])document.querySelector('[data-interaction=\"'+id+'\"]').click();const action=document.querySelector('[data-interaction=\"agree.goSignup.click.1\"]');action.click();action.click();return true")
            try await waitFor(host, ".loading"); let loadingStorage = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as? String; XCTAssertEqual(loadingStorage, before); try await waitFor(host, ".signup-page")
            let committed = try await script(host, "const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2'));return {step:envelope.data.auth_flow.step,agreements:envelope.data.auth_flow.agreements,signupCount:document.querySelectorAll('.signup-page').length}") as! [String: Any]
            let agreements = committed["agreements"] as! [String: Bool]
            XCTAssertEqual(committed["step"] as? String, "signup"); XCTAssertEqual(agreements, ["age": true, "student": false, "terms": true, "privacy": true, "community": true]); XCTAssertEqual(committed["signupCount"] as? Int, 1)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?communityPixel=refresh#/pages/auth/community")!)); try await waitFor(host, ".community-page")
            let restoredChecks = try await script(host, "return document.querySelectorAll('[aria-checked=true]').length") as? Int
            XCTAssertEqual(restoredChecks, 3)

            stage = "persistence failure rollback"
            try await loadFresh("/pages/auth/age", "failure", ".age-page")
            try await chooseBirthDate(host, "2000-01-01")
            _ = try await script(host, "document.querySelector('[data-interaction=\"age.goAgree.click.1\"]').click();return true"); try await waitFor(host, ".community-page")
            let failureBefore = try await script(host, "for(const key of ['terms','privacy','community'])document.querySelector('[data-agreement=\"'+key+'\"]').click();const original=Storage.prototype.setItem;window.__restoreCommunityStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')throw new DOMException('Injected agreement storage failure','QuotaExceededError');return original.call(this,key,value)};return localStorage.getItem('cimoa_app_state_v2')") as! String
            _ = try await script(host, "document.querySelector('[data-interaction=\"agree.goSignup.click.1\"]').click();return true"); try await waitFor(host, ".loading"); try await waitFor(host, ".community-page [role=alert]")
            let failure = try await script(host, "const result={message:document.querySelector('.community-page [role=alert]').textContent,storage:localStorage.getItem('cimoa_app_state_v2'),selected:document.querySelectorAll('[aria-checked=true]').length,signup:!!document.querySelector('.signup-page')};window.__restoreCommunityStorage();return result") as! [String: Any]
            XCTAssertTrue((failure["message"] as? String)?.contains("Injected agreement storage failure") == true); XCTAssertEqual(failure["storage"] as? String, failureBefore); XCTAssertEqual(failure["selected"] as? Int, 3); XCTAssertEqual(failure["signup"] as? Bool, false)

            stage = "direct Back fallback"
            try await loadFresh("/pages/auth/community", "back", ".community-page")
            _ = try await script(host, "document.querySelector('[data-interaction=\"agree.goBack.click.1\"]').click();return true"); try await waitFor(host, ".age-page")
            let backStorage = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')")
            XCTAssertTrue(backStorage is NSNull)
            try await restore()
        } catch { XCTFail("Community WKWebView stage \(stage) failed: \(error)"); try? await restore(); throw error }
    }
    func testSignupPixelRestoration() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
        func restore() async throws {
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?signupPixel=restore#/pages/auth/welcome")!))
            try await waitFor(host, ".welcome-page")
            _ = try await host.webView.callAsyncJavaScript("for(const [key,value] of [['cimoa_app_state_v2',snapshot.state],['cimoa_app_state',snapshot.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)};return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?signupPixel=restored#/pages/auth/splash")!))
        }
        func loadFresh(_ route: String, _ suffix: String, _ selector: String) async throws {
            _ = try await script(host, "localStorage.removeItem('cimoa_app_state_v2');localStorage.removeItem('cimoa_app_state');window.__signupOldDocument=true;return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?signupPixel=\(suffix)#\(route)")!))
            for _ in 0..<100 {
                if (try? await script(host, "return !window.__signupOldDocument&&!!document.querySelector('\(selector)')")) as? Bool == true { return }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            throw NSError(domain: "CimoaTests", code: 7, userInfo: [NSLocalizedDescriptionKey: "Missing new Signup document"])
        }
        func reachSignup(_ suffix: String) async throws {
            try await loadFresh("/pages/auth/age", suffix, ".age-page")
            try await chooseBirthDate(host, "2000-01-01")
            _ = try await script(host, "document.querySelector('[data-interaction=\"age.goAgree.click.1\"]').click();return true")
            try await waitFor(host, ".community-page")
            _ = try await script(host, "for(const id of ['agree.tTerms.click.1','agree.tPrivacy.click.1','agree.tGuides.click.1'])document.querySelector('[data-interaction=\"'+id+'\"]').click();document.querySelector('[data-interaction=\"agree.goSignup.click.1\"]').click();return true")
            try await waitFor(host, ".signup-page")
        }
        var stage = "prepare Signup default"
        do {
            try await loadFresh("/pages/auth/signup", "native", ".signup-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                const box=value=>{const element=typeof value==='string'?document.querySelector(value):value,rect=element.getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},fields=[...document.querySelectorAll('.auth-field')],inputs=[...document.querySelectorAll('.signup-page .auth-input')];
                return {root:box('.signup-page'),header:box('.auth-header'),back:box('.auth-back'),heading:box('.auth-heading'),fields:fields.map(box),note:box('.signup-note'),primary:box('.auth-primary'),secondary:box('.auth-secondary'),safes:[...document.querySelectorAll('.signup-page > .safe-area')].map(element=>element.getBoundingClientRect().height),text:{header:document.querySelector('.auth-header-title').textContent,heading:document.querySelector('.auth-heading').textContent,hasApple:!!document.querySelector('.auth-apple'),hasDivider:!!document.querySelector('.auth-divider'),labels:[...document.querySelectorAll('.auth-label')].map(element=>element.textContent),hint:document.querySelector('.signup-hint').textContent,note:document.querySelector('.signup-note').textContent,primary:document.querySelector('.auth-primary').textContent.trim(),secondary:document.querySelector('.auth-secondary').textContent.trim()},interactions:{back:document.querySelector('.auth-back').dataset.interaction,inputs:inputs.map(element=>element.dataset.interaction),toggle:document.querySelector('.auth-show').dataset.interaction,primary:document.querySelector('.auth-primary').dataset.interaction,secondary:document.querySelector('.auth-secondary').dataset.interaction},placeholders:inputs.map(element=>element.querySelector('.uni-input-placeholder')?.textContent||element.getAttribute('placeholder')),types:inputs.map(element=>element.querySelector('input')?.type||element.type),disabled:document.querySelector('.auth-primary').getAttribute('aria-disabled'),alert:!!document.querySelector('.signup-page [role=alert]'),storage:localStorage.getItem('cimoa_app_state_v2')};
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root = metrics["root"] as! [String: Double], header = metrics["header"] as! [String: Double], back = metrics["back"] as! [String: Double]
            let heading = metrics["heading"] as! [String: Double]
            let fields = metrics["fields"] as! [[String: Double]], primary = metrics["primary"] as! [String: Double], secondary = metrics["secondary"] as! [String: Double], safes = metrics["safes"] as! [Double], sourceScale = root["width"]! / 393
            let text = metrics["text"] as! [String: Any], interactions = metrics["interactions"] as! [String: Any]
            XCTAssertEqual(root["x"]!, 0, accuracy: 1); XCTAssertEqual(root["y"]!, 0, accuracy: 1); XCTAssertEqual(root["width"]!, Double(host.webView.bounds.width), accuracy: 1); XCTAssertEqual(root["height"]!, Double(host.webView.bounds.height), accuracy: 1)
            XCTAssertEqual(safes[0], Double(host.view.safeAreaInsets.top), accuracy: 1); XCTAssertEqual(safes[1], Double(host.view.safeAreaInsets.bottom), accuracy: 1)
            XCTAssertEqual(header["x"]!, 20 * sourceScale, accuracy: 1); XCTAssertEqual(header["y"]!, safes[0] + 4 * sourceScale, accuracy: 1); XCTAssertEqual(header["height"]!, 48 * sourceScale, accuracy: 1); XCTAssertEqual(back["width"]!, 46 * sourceScale, accuracy: 1); XCTAssertEqual(back["height"]!, 46 * sourceScale, accuracy: 1)
            XCTAssertEqual(heading["y"]!, safes[0] + 68 * sourceScale, accuracy: 1)
            XCTAssertEqual(fields[0]["y"]!, heading["bottom"]! + 14 * sourceScale, accuracy: 1.5); XCTAssertEqual(fields[1]["y"]!, fields[0]["bottom"]! + 14 * sourceScale, accuracy: 1.5); XCTAssertEqual(fields[2]["y"]!, fields[1]["bottom"]! + 14 * sourceScale, accuracy: 1.5)
            XCTAssertEqual(primary["x"]!, 20 * sourceScale, accuracy: 1); XCTAssertEqual(primary["height"]!, 60 * sourceScale, accuracy: 1); XCTAssertEqual(secondary["height"]!, 46 * sourceScale, accuracy: 1); XCTAssertEqual(secondary["bottom"]!, root["height"]! - safes[1] - 30 * sourceScale, accuracy: 2)
            XCTAssertEqual(text["header"] as? String, "Sign up"); XCTAssertEqual(text["heading"] as? String, "Create your account"); XCTAssertEqual(text["hasApple"] as? Bool, false); XCTAssertEqual(text["hasDivider"] as? Bool, false)
            XCTAssertEqual(text["labels"] as? [String], ["University email", "Password", "Confirm password"]); XCTAssertEqual(text["hint"] as? String, "At least 8 characters with a number"); XCTAssertEqual(text["note"] as? String, "Your university email is only used for this local account. It is never shown on your profile."); XCTAssertEqual(text["primary"] as? String, "Create Account"); XCTAssertEqual(text["secondary"] as? String, "Already have an account? Log in")
            XCTAssertEqual(interactions["back"] as? String, "signup.goBack.click.1"); XCTAssertEqual(interactions["inputs"] as? [String], ["signup.onEmail.change.1", "signup.onPw.change.1", "signup.onPw2.change.1"]); XCTAssertEqual(interactions["toggle"] as? String, "signup.togglePw.click.1"); XCTAssertEqual(interactions["primary"] as? String, "signup.createAccount.click.1"); XCTAssertEqual(interactions["secondary"] as? String, "signup.goLogin.click.1")
            let placeholders = (metrics["placeholders"] as? [Any])?.compactMap { $0 as? String }
            XCTAssertEqual(placeholders, ["you@university.edu", "At least 8 characters", "Repeat your password"]); XCTAssertEqual(metrics["types"] as? [String], ["text", "password", "password"]); XCTAssertEqual(metrics["disabled"] as? String, "true"); XCTAssertEqual(metrics["alert"] as? Bool, false); XCTAssertTrue(metrics["storage"] is NSNull)
            let defaultShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); defaultShot.name = "WKWebView Signup deterministic"; defaultShot.lifetime = .keepAlways; add(defaultShot)
            print("CIMOA_SIGNUP_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")

            stage = "input, absent Apple and real keyboard"
            let inputStates = try await script(host, """
            const inputs=[...document.querySelectorAll('.signup-page input')],set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set,fill=(index,value)=>{set.call(inputs[index],value);inputs[index].dispatchEvent(new Event('input',{bubbles:true}))};
            fill(1,'short');await new Promise(resolve=>setTimeout(resolve,60));const short=document.querySelector('.signup-hint').textContent;fill(1,'longpassword');await new Promise(resolve=>setTimeout(resolve,60));const noNumber=document.querySelector('.signup-hint').textContent;fill(2,'different');await new Promise(resolve=>setTimeout(resolve,60));const mismatch=document.querySelector('.signup-mismatch').textContent;document.querySelector('[data-interaction=\"signup.togglePw.click.1\"]').click();await new Promise(resolve=>requestAnimationFrame(resolve));const shown=[inputs[1].type,inputs[2].type];document.querySelector('[data-interaction=\"signup.togglePw.click.1\"]').click();await new Promise(resolve=>requestAnimationFrame(resolve));const hidden=[inputs[1].type,inputs[2].type];await new Promise(resolve=>requestAnimationFrame(resolve));return {short,noNumber,mismatch,shown,hidden,hasApple:!!document.querySelector('.auth-apple'),storage:localStorage.getItem('cimoa_app_state_v2')};
            """) as! [String: Any]
            XCTAssertEqual(inputStates["short"] as? String, "Too short — 8 characters minimum"); XCTAssertEqual(inputStates["noNumber"] as? String, "Include at least one number"); XCTAssertEqual(inputStates["mismatch"] as? String, "Passwords don’t match yet"); XCTAssertEqual(inputStates["shown"] as? [String], ["text", "text"]); XCTAssertEqual(inputStates["hidden"] as? [String], ["password", "password"]); XCTAssertEqual(inputStates["hasApple"] as? Bool, false); XCTAssertTrue(inputStates["storage"] is NSNull)
            let viewportBefore = try await script(host, "return window.visualViewport.height") as! Double
            _ = try await script(host, "const input=document.querySelectorAll('.signup-page input')[2];input.click();input.focus();return true")
            var keyboard: [String: Any] = [:]
            for _ in 0..<50 {
                keyboard = try await script(host, "const input=document.querySelectorAll('.signup-page input')[2].getBoundingClientRect();return {height:window.visualViewport.height,open:document.querySelector('.signup-page').classList.contains('signup-page--keyboard'),footer:getComputedStyle(document.querySelector('.auth-footer')).display,inputTop:input.top,inputBottom:input.bottom}") as! [String: Any]
                if keyboard["open"] as? Bool == true { break }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            XCTAssertLessThan(keyboard["height"] as! Double, viewportBefore - 120); XCTAssertEqual(keyboard["open"] as? Bool, true); XCTAssertEqual(keyboard["footer"] as? String, "none"); XCTAssertGreaterThanOrEqual(keyboard["inputTop"] as! Double, 0); XCTAssertLessThanOrEqual(keyboard["inputBottom"] as! Double, keyboard["height"] as! Double)
            let keyboardShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); keyboardShot.name = "WKWebView Signup keyboard"; keyboardShot.lifetime = .keepAlways; add(keyboardShot)
            _ = try await script(host, "document.querySelectorAll('.signup-page input')[2].blur();return true"); try await Task.sleep(nanoseconds: 350_000_000)

            stage = "duplicate, Loading, atomic local account and refresh"
            try await reachSignup("flow")
            _ = try await script(host, "const values=['cimoa@gmail.com','localpass123','localpass123'],inputs=[...document.querySelectorAll('.signup-page input')],set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;inputs.forEach((input,index)=>{set.call(input,values[index]);input.dispatchEvent(new Event('input',{bubbles:true}))});window.__signupBefore=localStorage.getItem('cimoa_app_state_v2');document.querySelector('[data-interaction=\"signup.createAccount.click.1\"]').click();return true")
            try await waitFor(host, ".loading"); let duplicateLoading = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')===window.__signupBefore") as? Bool; XCTAssertEqual(duplicateLoading, true); try await waitFor(host, ".signup-page [role=alert]")
            let duplicate = try await script(host, "return {error:document.querySelector('.signup-page [role=alert]').textContent,unchanged:localStorage.getItem('cimoa_app_state_v2')===window.__signupBefore}") as! [String: Any]
            XCTAssertEqual(duplicate["error"] as? String, "This email is already registered. Log in instead."); XCTAssertEqual(duplicate["unchanged"] as? Bool, true)
            let errorShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); errorShot.name = "WKWebView Signup duplicate error"; errorShot.lifetime = .keepAlways; add(errorShot)
            _ = try await script(host, "const input=document.querySelectorAll('.signup-page input')[0],set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'signup.native@campus.edu');input.dispatchEvent(new Event('input',{bubbles:true}));const action=document.querySelector('[data-interaction=\"signup.createAccount.click.1\"]');action.click();action.click();return true")
            try await waitFor(host, ".loading"); let accountLoading = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')===window.__signupBefore") as? Bool; XCTAssertEqual(accountLoading, true); try await waitFor(host, ".verification-email-page")
            let committed = try await script(host, "const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,accounts=data.accounts.filter(row=>row.email==='signup.native@campus.edu'),account=accounts[0],user=data.users.find(row=>row.user_id===account.user_id);return {count:accounts.length,provider:account.auth_provider,algorithm:account.credential_algorithm,plaintext:JSON.stringify(data).includes('localpass123'),session:data.session.current_user_id,pending:data.auth_flow.pending_registration_account_id===account.account_id,verification:user.verification_status}") as! [String: Any]
            XCTAssertEqual(committed["count"] as? Int, 1); XCTAssertEqual(committed["provider"] as? String, "local"); XCTAssertEqual(committed["algorithm"] as? String, "pbkdf2_sha256"); XCTAssertEqual(committed["plaintext"] as? Bool, false); XCTAssertTrue(committed["session"] is NSNull); XCTAssertEqual(committed["pending"] as? Bool, true); XCTAssertEqual(committed["verification"] as? String, "pending")
            _ = try await script(host, "window.__signupOldDocument=true;return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?signupPixel=recovery#/pages/auth/signup")!))
            for _ in 0..<100 {
                if (try? await script(host, "return !window.__signupOldDocument&&document.querySelector('[data-interaction=\"signup.createAccount.click.1\"]')?.textContent.trim()==='Continue verification'")) as? Bool == true { break }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            let recovery = try await script(host, "const inputs=[...document.querySelectorAll('.signup-page input')];return {button:document.querySelector('[data-interaction=\"signup.createAccount.click.1\"]').textContent.trim(),password:inputs[1].value,confirmation:inputs[2].value,email:inputs[0].value}") as! [String: Any]
            XCTAssertEqual(recovery["button"] as? String, "Continue verification"); XCTAssertEqual(recovery["password"] as? String, ""); XCTAssertEqual(recovery["confirmation"] as? String, ""); XCTAssertEqual(recovery["email"] as? String, "signup.native@campus.edu")
            _ = try await script(host, "document.querySelector('[data-interaction=\"signup.createAccount.click.1\"]').click();return true"); try await waitFor(host, ".verification-email-page")

            stage = "persistence failure rollback"
            try await reachSignup("failure")
            let failureBefore = try await script(host, "const values=['failure.native@campus.edu','localpass123','localpass123'],inputs=[...document.querySelectorAll('.signup-page input')],set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;inputs.forEach((input,index)=>{set.call(input,values[index]);input.dispatchEvent(new Event('input',{bubbles:true}))});const original=Storage.prototype.setItem;window.__restoreSignupStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')throw new DOMException('Injected signup storage failure','QuotaExceededError');return original.call(this,key,value)};return localStorage.getItem('cimoa_app_state_v2')") as! String
            _ = try await script(host, "document.querySelector('[data-interaction=\"signup.createAccount.click.1\"]').click();return true"); try await waitFor(host, ".loading"); try await waitFor(host, ".signup-page [role=alert]")
            let failure = try await script(host, "const inputs=[...document.querySelectorAll('.signup-page input')],result={error:document.querySelector('.signup-page [role=alert]').textContent,storage:localStorage.getItem('cimoa_app_state_v2'),password:inputs[1].value,confirmation:inputs[2].value,verification:!!document.querySelector('.verification-email-page')};window.__restoreSignupStorage();return result") as! [String: Any]
            XCTAssertEqual(failure["error"] as? String, "Injected signup storage failure"); XCTAssertEqual(failure["storage"] as? String, failureBefore); XCTAssertEqual(failure["password"] as? String, "localpass123"); XCTAssertEqual(failure["confirmation"] as? String, "localpass123"); XCTAssertEqual(failure["verification"] as? Bool, false)

            stage = "Login round-trip and direct Back fallback"
            try await loadFresh("/pages/auth/signup", "back", ".signup-page")
            _ = try await script(host, "document.querySelector('[data-interaction=\"signup.goLogin.click.1\"]').click();return true"); try await waitFor(host, ".login-page")
            _ = try await script(host, "document.querySelector('[data-interaction=\"login.goBack.click.1\"]').click();return true"); try await waitFor(host, ".signup-page")
            _ = try await script(host, "document.querySelector('[data-interaction=\"signup.goBack.click.1\"]').click();return true"); try await waitFor(host, ".community-page")
            let backStorage = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')"); XCTAssertTrue(backStorage is NSNull)
            try await restore()
        } catch { XCTFail("Signup WKWebView stage \(stage) failed: \(error)"); try? await restore(); throw error }
    }
    func testVerificationEmailPixelRestoration() async throws {
        let host = try await host()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?verificationEmail=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header")
        }
        var stage = "prepare pending local account"
        do {
            _ = try await script(host, "const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),account=envelope.data.accounts.find(row=>row.account_id===envelope.data.session.account_id);delete account.local_verification;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?verificationEmail=native#/pages/auth/verification/email")!))
            try await waitFor(host, ".verification-email-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},root=box('.verification-email-page'),header=box('.auth-header'),back=box('.auth-back'),heading=box('.auth-heading'),description=box('.auth-description'),input=box('.auth-input-box'),info=box('.email-info'),example=box('.email-example'),primary=box('.auth-primary'),safes=[...document.querySelectorAll('.verification-email-page > .safe-area')].map(element=>element.getBoundingClientRect().height),field=document.querySelector('.verification-email-page .auth-input');
                return {root,header,back,heading,description,input,info,example,primary,safes,text:{header:document.querySelector('.auth-header-title').textContent,heading:document.querySelector('.auth-heading').textContent,description:document.querySelector('.auth-description').textContent,info:document.querySelector('.email-info').textContent,example:document.querySelector('.email-example').textContent,primary:document.querySelector('.auth-primary').textContent.trim()},backInteraction:document.querySelector('.auth-back').dataset.interaction,inputInteraction:field.dataset.interaction,value:field.querySelector('input')?.value||''};
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root = metrics["root"] as! [String: Double], header = metrics["header"] as! [String: Double], back = metrics["back"] as! [String: Double], heading = metrics["heading"] as! [String: Double], description = metrics["description"] as! [String: Double], input = metrics["input"] as! [String: Double], info = metrics["info"] as! [String: Double], example = metrics["example"] as! [String: Double], primary = metrics["primary"] as! [String: Double], safes = metrics["safes"] as! [Double], text = metrics["text"] as! [String: String]
            let scale = root["width"]! / 393
            XCTAssertEqual(safes[0], Double(host.view.safeAreaInsets.top), accuracy: 1); XCTAssertEqual(safes[1], Double(host.view.safeAreaInsets.bottom), accuracy: 1)
            XCTAssertEqual(header["y"]!, safes[0] + 4 * scale, accuracy: 1); XCTAssertEqual(header["height"]!, 48 * scale, accuracy: 1); XCTAssertEqual(back["width"]!, 46 * scale, accuracy: 1); XCTAssertEqual(back["height"]!, 46 * scale, accuracy: 1)
            XCTAssertEqual(heading["y"]!, safes[0] + 68 * scale, accuracy: 1); XCTAssertEqual(description["y"]!, heading["bottom"]! + 10 * scale, accuracy: 1); XCTAssertEqual(input["height"]!, 56 * scale, accuracy: 1); XCTAssertEqual(info["y"]!, input["bottom"]! + 16 * scale, accuracy: 1); XCTAssertEqual(example["y"]!, info["bottom"]! + 14 * scale, accuracy: 1); XCTAssertEqual(primary["height"]!, 60 * scale, accuracy: 1); XCTAssertEqual(primary["bottom"]!, root["height"]! - safes[1] - 34 * scale, accuracy: 2)
            XCTAssertEqual(text["header"], "Local verification"); XCTAssertEqual(text["heading"], "Confirm your email"); XCTAssertEqual(text["description"], "This local account uses the fixed code 009789. No email is sent. This does not verify your university or student identity."); XCTAssertEqual(text["info"], "Your address identifies your account on this device. It stays private and is never shown on your profile."); XCTAssertEqual(text["example"], "Example · a.chan@connect.hkust.edu"); XCTAssertEqual(text["primary"], "Continue to Local Code")
            XCTAssertEqual(metrics["backInteraction"] as? String, "verEmail.goBack.click.1"); XCTAssertEqual(metrics["inputInteraction"] as? String, "verEmail.onEmail.change.1")
            let defaultShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); defaultShot.name = "WKWebView Verification Email default"; defaultShot.lifetime = .keepAlways; add(defaultShot)

            stage = "validation and real keyboard"
            _ = try await script(host, "const input=document.querySelector('.verification-email-page input'),set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'bad');input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-interaction=\"verEmail.goVerCode.click.1\"]').click();return true")
            try await waitFor(host, ".verification-email-page [role=alert]")
            let invalid = try await script(host, "return {error:document.querySelector('.verification-email-page [role=alert]').textContent,unchanged:localStorage.getItem('cimoa_app_state_v2')!==null,loading:!!document.querySelector('.loading')}") as! [String: Any]
            XCTAssertTrue((invalid["error"] as? String)?.contains("valid email") == true); XCTAssertEqual(invalid["unchanged"] as? Bool, true); XCTAssertEqual(invalid["loading"] as? Bool, false)
            let errorShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); errorShot.name = "WKWebView Verification Email invalid"; errorShot.lifetime = .keepAlways; add(errorShot)
            let viewportBefore = try await script(host, "return visualViewport.height") as! Double
            _ = try await script(host, "const input=document.querySelector('.verification-email-page input'),set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'native.email@campus.edu');input.dispatchEvent(new Event('input',{bubbles:true}));input.click();input.focus();return true")
            var keyboard: [String: Any] = [:]
            for _ in 0..<50 {
                keyboard = try await script(host, "const input=document.querySelector('.verification-email-page input').getBoundingClientRect();return {height:visualViewport.height,open:document.querySelector('.verification-email-page').classList.contains('verification-email-page--keyboard'),footer:getComputedStyle(document.querySelector('.auth-footer')).display,inputTop:input.top,inputBottom:input.bottom}") as! [String: Any]
                if keyboard["open"] as? Bool == true { break }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            XCTAssertLessThan(keyboard["height"] as! Double, viewportBefore - 120); XCTAssertEqual(keyboard["open"] as? Bool, true); XCTAssertEqual(keyboard["footer"] as? String, "none"); XCTAssertGreaterThanOrEqual(keyboard["inputTop"] as! Double, 0); XCTAssertLessThanOrEqual(keyboard["inputBottom"] as! Double, keyboard["height"] as! Double)
            let keyboardShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); keyboardShot.name = "WKWebView Verification Email keyboard"; keyboardShot.lifetime = .keepAlways; add(keyboardShot)
            _ = try await script(host, "document.querySelector('.verification-email-page input').blur();return true"); try await Task.sleep(nanoseconds: 350_000_000)

            stage = "persistence rollback and atomic correction"
            let failureBefore = try await script(host, "const original=Storage.prototype.setItem;window.__restoreVerificationEmailStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')throw new DOMException('Injected email storage failure','QuotaExceededError');return original.call(this,key,value)};return localStorage.getItem('cimoa_app_state_v2')") as! String
            _ = try await script(host, "document.querySelector('[data-interaction=\"verEmail.goVerCode.click.1\"]').click();return true"); try await waitFor(host, ".loading"); try await waitFor(host, ".verification-email-page [role=alert]")
            let failed = try await script(host, "const result={error:document.querySelector('.verification-email-page [role=alert]').textContent,state:localStorage.getItem('cimoa_app_state_v2'),value:document.querySelector('.verification-email-page input').value};window.__restoreVerificationEmailStorage();return result") as! [String: Any]
            XCTAssertTrue((failed["error"] as? String)?.contains("failure") == true); XCTAssertEqual(failed["state"] as? String, failureBefore); XCTAssertEqual(failed["value"] as? String, "native.email@campus.edu")
            _ = try await script(host, "const original=Storage.prototype.setItem;window.__verificationEmailWrites=0;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')window.__verificationEmailWrites++;return original.call(this,key,value)};const action=document.querySelector('[data-interaction=\"verEmail.goVerCode.click.1\"]');action.click();action.click();return true")
            try await waitFor(host, ".loading"); try await waitFor(host, ".verification-page")
            let committed = try await script(host, "const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,account=data.accounts.find(row=>row.account_id===data.session.account_id);return {email:account.email,writes:window.__verificationEmailWrites}") as! [String: Any]
            XCTAssertEqual(committed["email"] as? String, "native.email@campus.edu"); XCTAssertEqual(committed["writes"] as? Int, 1)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?verificationEmail=refresh#/pages/auth/verification/email")!)); try await waitFor(host, ".verification-email-page")
            let restoredEmail = try await script(host, "return document.querySelector('.verification-email-page input').value") as? String; XCTAssertEqual(restoredEmail, "native.email@campus.edu")
            try await restore()
        } catch { XCTFail("Verification Email WKWebView stage \(stage) failed: \(error)"); try? await restore(); throw error }
    }
    func testVerificationCodePixelRestoration() async throws {
        let host = try await host()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?verificationCode=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header")
        }
        var stage = "prepare pending local account"
        do {
            _ = try await script(host, "const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),account=envelope.data.accounts.find(row=>row.account_id===envelope.data.session.account_id);delete account.local_verification;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?verificationCode=native#/pages/auth/verification/code")!))
            try await waitFor(host, ".verification-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},root=box('.verification-page'),header=box('.auth-header'),back=box('.auth-back'),hero=box('.verification-hero'),emblem=box('.verification-emblem'),heading=box('.verification-heading'),description=box('.verification-description'),cells=[...document.querySelectorAll('.verification-cell')].map(element=>{const rect=element.getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height}}),hint=box('.verification-code-hint'),change=box('.verification-change'),info=box('.verification-info'),mark=box('.verification-info>.source-icon'),primary=box('.verification-submit'),safes=[...document.querySelectorAll('.verification-page>.safe-area')].map(element=>element.getBoundingClientRect().height);
                return {root,header,back,hero,emblem,heading,description,cells,hint,change,info,mark,primary,safes,text:{header:document.querySelector('.auth-header-title').textContent,heading:document.querySelector('.verification-heading').textContent,description:document.querySelector('.verification-description').innerText,hint:document.querySelector('.verification-code-hint').textContent,change:document.querySelector('.verification-change').textContent.trim(),info:document.querySelector('.verification-info-copy').innerText,primary:document.querySelector('.verification-submit').textContent.trim()},backInteraction:document.querySelector('.auth-back').dataset.interaction};
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root = metrics["root"] as! [String: Double], header = metrics["header"] as! [String: Double], back = metrics["back"] as! [String: Double], hero = metrics["hero"] as! [String: Double], emblem = metrics["emblem"] as! [String: Double], heading = metrics["heading"] as! [String: Double], description = metrics["description"] as! [String: Double], cells = metrics["cells"] as! [[String: Double]], hint = metrics["hint"] as! [String: Double], change = metrics["change"] as! [String: Double], info = metrics["info"] as! [String: Double], mark = metrics["mark"] as! [String: Double], primary = metrics["primary"] as! [String: Double], safes = metrics["safes"] as! [Double], text = metrics["text"] as! [String: String]
            let scale = root["width"]! / 393
            XCTAssertEqual(safes[0], Double(host.view.safeAreaInsets.top), accuracy: 1); XCTAssertEqual(safes[1], Double(host.view.safeAreaInsets.bottom), accuracy: 1)
            XCTAssertEqual(header["y"]!, safes[0] + 4 * scale, accuracy: 1); XCTAssertEqual(back["width"]!, 46 * scale, accuracy: 1); XCTAssertEqual(hero["y"]!, safes[0] + 74 * scale, accuracy: 1); XCTAssertEqual(emblem["width"]!, 120 * scale, accuracy: 1); XCTAssertEqual(heading["y"]!, emblem["bottom"]! + 8 * scale, accuracy: 1); XCTAssertEqual(description["y"]!, heading["bottom"]! + 10 * scale, accuracy: 1)
            XCTAssertEqual(cells.count, 6); for cell in cells { XCTAssertEqual(cell["width"]!, 44 * scale, accuracy: 1); XCTAssertEqual(cell["height"]!, 60 * scale, accuracy: 1) }; XCTAssertEqual(cells[0]["y"]!, description["bottom"]! + 22 * scale, accuracy: 1); XCTAssertEqual(hint["y"]!, cells[0]["y"]! + 78 * scale, accuracy: 1); XCTAssertEqual(change["y"]!, hint["bottom"]! + 6 * scale, accuracy: 1); XCTAssertEqual(info["y"]!, change["bottom"]! + 22 * scale, accuracy: 1); XCTAssertEqual(mark["width"]!, 46 * scale, accuracy: 1); XCTAssertEqual(primary["height"]!, 60 * scale, accuracy: 1); XCTAssertEqual(primary["bottom"]!, root["height"]! - safes[1] - 34 * scale, accuracy: 2)
            XCTAssertEqual(text["header"], "Local verification"); XCTAssertEqual(text["heading"], "Enter your code"); XCTAssertTrue(text["description"]?.contains("Verify this local account on this device.") == true); XCTAssertEqual(text["hint"], "Local code: 009789 · No email is sent."); XCTAssertEqual(text["change"], "Change email"); XCTAssertEqual(text["info"], "Local verification\nThis fixed code does not confirm email ownership or student status."); XCTAssertEqual(text["primary"], "Verify Code"); XCTAssertEqual(metrics["backInteraction"] as? String, "verCode.goBack.click.1")
            let defaultShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); defaultShot.name = "WKWebView Verification Code default"; defaultShot.lifetime = .keepAlways; add(defaultShot)

            stage = "wrong code and real numeric keyboard"
            _ = try await script(host, "const input=document.querySelector('.verification-input input'),set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'000000');input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-interaction=\"verCode.goVerSuccess.click.1\"]').click();return true")
            try await waitFor(host, ".loading"); try await waitFor(host, ".verification-page [role=alert]")
            let wrong = try await script(host, "return {error:document.querySelector('.verification-page [role=alert]').textContent,cells:[...document.querySelectorAll('.verification-cell')].map(element=>element.textContent).join('')}") as! [String: Any]
            XCTAssertTrue((wrong["error"] as? String)?.contains("incorrect") == true); XCTAssertEqual(wrong["cells"] as? String, "000000")
            let errorShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); errorShot.name = "WKWebView Verification Code invalid"; errorShot.lifetime = .keepAlways; add(errorShot)
            let viewportBefore = try await script(host, "return visualViewport.height") as! Double
            _ = try await script(host, "const input=document.querySelector('.verification-input input'),set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'009789');input.dispatchEvent(new Event('input',{bubbles:true}));input.click();input.focus();return true")
            var keyboard: [String: Any] = [:]
            for _ in 0..<50 {
                keyboard = try await script(host, "const cells=document.querySelector('.verification-cells').getBoundingClientRect();return {height:visualViewport.height,open:document.querySelector('.verification-page').classList.contains('verification-page--keyboard'),footer:getComputedStyle(document.querySelector('.auth-footer')).display,cellsTop:cells.top,cellsBottom:cells.bottom}") as! [String: Any]
                if keyboard["open"] as? Bool == true { break }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            XCTAssertLessThan(keyboard["height"] as! Double, viewportBefore - 120); XCTAssertEqual(keyboard["open"] as? Bool, true); XCTAssertEqual(keyboard["footer"] as? String, "none"); XCTAssertGreaterThanOrEqual(keyboard["cellsTop"] as! Double, 0); XCTAssertLessThanOrEqual(keyboard["cellsBottom"] as! Double, keyboard["height"] as! Double)
            let keyboardShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); keyboardShot.name = "WKWebView Verification Code keyboard"; keyboardShot.lifetime = .keepAlways; add(keyboardShot)
            _ = try await script(host, "document.querySelector('.verification-input input').blur();return true"); try await Task.sleep(nanoseconds: 350_000_000)

            stage = "atomic fixed-code persistence"
            let failureBefore = try await script(host, "const original=Storage.prototype.setItem;window.__restoreVerificationCodeStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')throw new DOMException('Injected code storage failure','QuotaExceededError');return original.call(this,key,value)};return localStorage.getItem('cimoa_app_state_v2')") as! String
            _ = try await script(host, "document.querySelector('[data-interaction=\"verCode.goVerSuccess.click.1\"]').click();return true"); try await waitFor(host, ".loading"); try await waitFor(host, ".verification-page [role=alert]")
            let failed = try await script(host, "const result={error:document.querySelector('.verification-page [role=alert]').textContent,state:localStorage.getItem('cimoa_app_state_v2')};window.__restoreVerificationCodeStorage();return result") as! [String: Any]
            XCTAssertTrue((failed["error"] as? String)?.contains("saved") == true || (failed["error"] as? String)?.contains("storage") == true); XCTAssertEqual(failed["state"] as? String, failureBefore)
            _ = try await script(host, "const original=Storage.prototype.setItem;window.__verificationCodeWrites=0;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')window.__verificationCodeWrites++;return original.call(this,key,value)};const action=document.querySelector('[data-interaction=\"verCode.goVerSuccess.click.1\"]');action.click();action.click();return true")
            try await waitFor(host, ".loading"); try await waitFor(host, ".verification-success-page")
            let committed = try await script(host, "const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,account=data.accounts.find(row=>row.account_id===data.session.account_id);return {status:account.local_verification.status,writes:window.__verificationCodeWrites}") as! [String: Any]
            XCTAssertEqual(committed["status"] as? String, "verified"); XCTAssertEqual(committed["writes"] as? Int, 1)
            try await restore()
        } catch { XCTFail("Verification Code WKWebView stage \(stage) failed: \(error)"); try? await restore(); throw error }
    }
    func testVerificationSuccessPixelRestoration() async throws {
        let host = try await host()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?verificationSuccess=reset#/pages/auth/login")!))
            try await waitFor(host, ".login-page")
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?verificationSuccess=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header")
        }
        var stage = "prepare verified account"
        do {
            _ = try await script(host, "const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),account=envelope.data.accounts.find(row=>row.account_id===envelope.data.session.account_id),user=envelope.data.users.find(row=>row.user_id===envelope.data.session.current_user_id);account.auth_provider='local';account.local_verification={method:'fixed_code',status:'verified',verified_at:Date.now()};delete account.onboarding;user.onboarding_status='not_started';user.verification_status='pending';envelope.data.auth_flow.pending_registration_account_id=account.account_id;envelope.data.session={account_id:null,current_user_id:null,expires_at:null};localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?verificationSuccess=native#/pages/auth/verification/success")!))
            try await waitFor(host, ".verification-success-icon")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},root=box('.verification-success-page'),icon=box('.verification-success-icon'),check=box('.verification-success-icon svg'),heading=box('.verification-success-heading'),pill=box('.verification-success-pill'),badge=box('.verification-success-pill svg'),primary=box('[data-interaction="verSuccess.goObBasic.click.1"]'),safes=[...document.querySelectorAll('.verification-success-page>.safe-area')].map(element=>element.getBoundingClientRect().height);
                return {root,icon,check,heading,pill,badge,primary,safes,text:{heading:document.querySelector('.verification-success-heading').textContent,pill:document.querySelector('.verification-success-pill').textContent,primary:document.querySelector('[data-interaction="verSuccess.goObBasic.click.1"]').textContent},interaction:document.querySelector('[data-interaction="verSuccess.goObBasic.click.1"]').dataset.interaction};
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root = metrics["root"] as! [String: Double], icon = metrics["icon"] as! [String: Double], check = metrics["check"] as! [String: Double], pill = metrics["pill"] as! [String: Double], badge = metrics["badge"] as! [String: Double], primary = metrics["primary"] as! [String: Double], safes = metrics["safes"] as! [Double], text = metrics["text"] as! [String: String]
            let scale = root["width"]! / 393
            XCTAssertEqual(safes[0], Double(host.view.safeAreaInsets.top), accuracy: 1); XCTAssertEqual(safes[1], Double(host.view.safeAreaInsets.bottom), accuracy: 1)
            XCTAssertEqual(icon["y"]!, safes[0] + 142 * scale, accuracy: 1); XCTAssertEqual(icon["width"]!, 96 * scale, accuracy: 1); XCTAssertEqual(icon["height"]!, 96 * scale, accuracy: 1); XCTAssertEqual(check["width"]!, 44 * scale, accuracy: 1); XCTAssertEqual(check["height"]!, 44 * scale, accuracy: 1); XCTAssertEqual(pill["height"]!, 42 * scale, accuracy: 1); XCTAssertEqual(badge["width"]!, 18 * scale, accuracy: 1); XCTAssertEqual(primary["height"]!, 60 * scale, accuracy: 1); XCTAssertEqual(primary["bottom"]!, root["height"]! - safes[1] - 34 * scale, accuracy: 2)
            XCTAssertEqual(text["heading"], "Local verification complete"); XCTAssertEqual(text["pill"], "Local account · This device"); XCTAssertEqual(text["primary"], "Continue Profile Setup"); XCTAssertEqual(metrics["interaction"] as? String, "verSuccess.goObBasic.click.1")
            let defaultShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); defaultShot.name = "WKWebView Verification Success default"; defaultShot.lifetime = .keepAlways; add(defaultShot)

            stage = "rollback and atomic onboarding start"
            let failureBefore = try await script(host, "const original=Storage.prototype.setItem;window.__restoreVerificationSuccessStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')throw new DOMException('Injected success storage failure','QuotaExceededError');return original.call(this,key,value)};return localStorage.getItem('cimoa_app_state_v2')") as! String
            _ = try await script(host, "document.querySelector('[data-interaction=\"verSuccess.goObBasic.click.1\"]').click();return true"); try await waitFor(host, ".loading"); try await waitFor(host, ".verification-success-page [role=alert]")
            let failed = try await script(host, "const result={error:document.querySelector('.verification-success-page [role=alert]').textContent,state:localStorage.getItem('cimoa_app_state_v2')};window.__restoreVerificationSuccessStorage();return result") as! [String: Any]
            XCTAssertTrue((failed["error"] as? String)?.contains("Injected success storage failure") == true); XCTAssertEqual(failed["state"] as? String, failureBefore)
            let errorShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); errorShot.name = "WKWebView Verification Success failure"; errorShot.lifetime = .keepAlways; add(errorShot)
            _ = try await script(host, "const original=Storage.prototype.setItem;window.__verificationSuccessBefore=localStorage.getItem('cimoa_app_state_v2');window.__verificationSuccessWrites=0;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')window.__verificationSuccessWrites++;return original.call(this,key,value)};const action=document.querySelector('[data-interaction=\"verSuccess.goObBasic.click.1\"]');action.click();action.click();return true")
            try await waitFor(host, ".loading"); let unchangedDuringLoading = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')===window.__verificationSuccessBefore")
            XCTAssertEqual(unchangedDuringLoading as? Bool, true)
            try await waitFor(host, ".onboarding-basic-page")
            let committed = try await script(host, "const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);return {step:account.onboarding.step,status:user.onboarding_status,verification:user.verification_status,writes:window.__verificationSuccessWrites}") as! [String: Any]
            XCTAssertEqual(committed["step"] as? String, "basic"); XCTAssertEqual(committed["status"] as? String, "in_progress"); XCTAssertEqual(committed["verification"] as? String, "pending"); XCTAssertEqual(committed["writes"] as? Int, 1)

            stage = "direct unverified recovery"
            _ = try await script(host, "const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),account=envelope.data.accounts.find(row=>row.account_id===envelope.data.session.account_id);delete account.local_verification;delete account.onboarding;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true")
            let unverified = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?verificationSuccess=unverified#/pages/auth/verification/success")!)); try await waitFor(host, ".verification-success-page [role=alert]")
            let recovery = try await script(host, "return {success:!!document.querySelector('.verification-success-icon'),error:document.querySelector('.verification-success-page [role=alert]').textContent,label:document.querySelector('.verification-success-footer .auth-primary').textContent.trim(),state:localStorage.getItem('cimoa_app_state_v2')}") as! [String: Any]
            XCTAssertEqual(recovery["success"] as? Bool, false); XCTAssertTrue((recovery["error"] as? String)?.contains("not been completed") == true); XCTAssertEqual(recovery["label"] as? String, "Enter Code"); XCTAssertEqual(recovery["state"] as? String, unverified)
            try await restore()
        } catch { XCTFail("Verification Success WKWebView stage \(stage) failed: \(error)"); try? await restore(); throw error }
    }
    func testVerificationUnsupportedPixelRestoration() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')")
        if saved is NSNull {
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?verificationUnsupported=fixture#/pages/auth/welcome")!))
            try await waitFor(host, ".welcome-page")
            try await signIn(host)
        }
        func restore() async throws {
            _ = try? await script(host, "document.activeElement?.blur();return true")
            _ = try await host.webView.callAsyncJavaScript("if(snapshot===null)localStorage.removeItem('cimoa_app_state_v2');else localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?verificationUnsupported=restored#/pages/auth/welcome")!))
            try await waitFor(host, ".welcome-page")
        }
        var stage = "prepare unsupported registration"
        do {
            _ = try await script(host, """
            const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),data=envelope.data,account=data.accounts.find(row=>row.status==='active'),user=data.users.find(row=>row.user_id===account.user_id);
            account.email='unsupported.native@example.com';account.auth_provider='local';delete account.local_verification;delete account.onboarding;user.onboarding_status='not_started';user.verification_status='pending';data.session={account_id:null,current_user_id:null,expires_at:null};data.auth_flow={flow_id:'native-unsupported-flow',step:'registered',email:account.email,verification_request_id:null,pending_registration_account_id:account.account_id,password_reset:null,agreements:{age:true,student:false,terms:true,privacy:true,community:true},profile_draft:{}};localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true
            """)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?verificationUnsupported=native#/pages/auth/verification/unsupported?auth_flow_id=native-unsupported-flow")!))
            try await waitFor(host, ".unsupported-hero")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},root=box('.verification-unsupported-page'),header=box('.auth-header'),back=box('.auth-back'),icon=box('.unsupported-emblem'),svg=box('.unsupported-emblem svg'),heading=box('.unsupported-title'),description=box('.unsupported-description'),primary=box('[data-interaction="verUnsupported.changeEmail.click.1"]'),support=box('[data-interaction="verUnsupported.supportUni.click.1"]'),logout=box('[data-interaction="verUnsupported.logOut.click.1"]'),safes=[...document.querySelectorAll('.verification-unsupported-page>.safe-area')].map(element=>element.getBoundingClientRect().height);
                return {root,header,back,icon,svg,heading,description,primary,support,logout,safes,text:{header:document.querySelector('.auth-header-title').textContent,heading:document.querySelector('.unsupported-title').textContent,description:document.querySelector('.unsupported-description').textContent,primary:document.querySelector('[data-interaction="verUnsupported.changeEmail.click.1"]').textContent.trim(),support:document.querySelector('[data-interaction="verUnsupported.supportUni.click.1"]').textContent.trim(),logout:document.querySelector('[data-interaction="verUnsupported.logOut.click.1"]').textContent.trim()},interactions:[...document.querySelectorAll('.verification-unsupported-page [data-interaction]')].map(element=>element.dataset.interaction)};
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root = metrics["root"] as! [String: Double], header = metrics["header"] as! [String: Double], back = metrics["back"] as! [String: Double], icon = metrics["icon"] as! [String: Double], svg = metrics["svg"] as! [String: Double], primary = metrics["primary"] as! [String: Double], support = metrics["support"] as! [String: Double], logout = metrics["logout"] as! [String: Double], safes = metrics["safes"] as! [Double], text = metrics["text"] as! [String: String], interactions = metrics["interactions"] as! [String]
            let scale = root["width"]! / 393
            XCTAssertEqual(safes[0], Double(host.view.safeAreaInsets.top), accuracy: 1); XCTAssertEqual(safes[1], Double(host.view.safeAreaInsets.bottom), accuracy: 1)
            XCTAssertEqual(header["y"]!, safes[0] + 4 * scale, accuracy: 1); XCTAssertEqual(back["width"]!, 46 * scale, accuracy: 1)
            XCTAssertEqual(icon["y"]!, safes[0] + 124 * scale, accuracy: 1.5); XCTAssertEqual(icon["width"]!, 92 * scale, accuracy: 1); XCTAssertEqual(icon["height"]!, 92 * scale, accuracy: 1); XCTAssertEqual(svg["width"]!, 40 * scale, accuracy: 1)
            XCTAssertEqual(primary["height"]!, 60 * scale, accuracy: 1); XCTAssertEqual(support["height"]!, 56 * scale, accuracy: 1); XCTAssertEqual(logout["height"]!, 46 * scale, accuracy: 1); XCTAssertEqual(logout["bottom"]!, root["height"]! - safes[1] - 30 * scale, accuracy: 2)
            XCTAssertEqual(text["header"], "University verification"); XCTAssertEqual(text["heading"], "That university isn’t supported yet"); XCTAssertEqual(text["description"], "Try another university email to continue. Support delivery isn’t available yet."); XCTAssertEqual(text["primary"], "Try Another University Email"); XCTAssertEqual(text["support"], "Contact Support"); XCTAssertEqual(text["logout"], "Log Out")
            for id in ["verUnsupported.goBack.click.1", "verUnsupported.changeEmail.click.1", "verUnsupported.supportUni.click.1", "verUnsupported.logOut.click.1"] { XCTAssertTrue(interactions.contains(id), "Missing \(id)") }
            let defaultShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); defaultShot.name = "WKWebView Verification Unsupported default"; defaultShot.lifetime = .keepAlways; add(defaultShot)
            print("CIMOA_VERIFICATION_UNSUPPORTED_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")

            stage = "truthful unavailable support"
            let supportBefore = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
            _ = try await script(host, "document.querySelector('[data-interaction=\"verUnsupported.supportUni.click.1\"]').click();return true")
            try await waitFor(host, ".verification-unsupported-page [role=alert]")
            let supportResult = try await script(host, "return {message:document.querySelector('.verification-unsupported-page [role=alert]').textContent,state:localStorage.getItem('cimoa_app_state_v2')}") as! [String: Any]
            XCTAssertTrue((supportResult["message"] as? String)?.contains("not configured") == true); XCTAssertEqual(supportResult["state"] as? String, supportBefore)
            let errorShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); errorShot.name = "WKWebView Verification Unsupported support unavailable"; errorShot.lifetime = .keepAlways; add(errorShot)

            stage = "confirmed atomic logout"
            _ = try await script(host, "document.querySelector('[data-interaction=\"verUnsupported.logOut.click.1\"]').click();return true"); try await waitFor(host, ".logout-dialog")
            _ = try await script(host, "document.querySelector('[data-interaction=\"sheetLogout.closeSheet.click.2\"]').click();return true"); try await Task.sleep(nanoseconds: 350_000_000)
            let stateAfterCancel = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as? String
            XCTAssertEqual(stateAfterCancel, supportBefore)
            _ = try await script(host, "const original=Storage.prototype.setItem;window.__unsupportedNativeBefore=localStorage.getItem('cimoa_app_state_v2');window.__unsupportedNativeWrites=0;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')window.__unsupportedNativeWrites++;return original.call(this,key,value)};document.querySelector('[data-interaction=\"verUnsupported.logOut.click.1\"]').click();return true"); try await waitFor(host, ".logout-dialog")
            _ = try await script(host, "const action=document.querySelector('[data-interaction=\"sheetLogout.logOut2.click.1\"]');action.click();action.click();return true"); try await waitFor(host, ".loading")
            let unchangedDuringLoading = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')===window.__unsupportedNativeBefore") as? Bool
            XCTAssertEqual(unchangedDuringLoading, true)
            try await waitFor(host, ".welcome-page")
            let loggedOut = try await script(host, "const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;return {pending:data.auth_flow.pending_registration_account_id,account:data.accounts.some(row=>row.email==='unsupported.native@example.com'),writes:window.__unsupportedNativeWrites,depth:document.querySelector('.welcome-page').dataset.pageDepth}") as! [String: Any]
            XCTAssertTrue(loggedOut["pending"] is NSNull); XCTAssertEqual(loggedOut["account"] as? Bool, true); XCTAssertEqual(loggedOut["writes"] as? Int, 1); XCTAssertEqual(loggedOut["depth"] as? String, "1")
            try await restore()
        } catch { XCTFail("Verification Unsupported WKWebView stage \(stage) failed: \(error)"); try? await restore(); throw error }
    }
    func testOnboardingBasicPixelRestoration() async throws {
        let host = try await host()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            _ = try? await script(host, "document.activeElement?.blur();return true")
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingBasic=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header")
        }
        var stage = "prepare basic account"
        do {
            _ = try await script(host, """
            const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),data=envelope.data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);
            account.auth_provider='local';account.local_verification={method:'fixed_code',status:'verified',verified_at:Date.now()};account.date_of_birth='2000-01-01';account.onboarding={step:'basic',completed_steps:[]};user.user_name='New member';user.age=26;user.gender='';user.pronouns='';user.onboarding_status='in_progress';user.verification_status='pending';data.auth_flow.pending_registration_account_id=account.account_id;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true
            """)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingBasic=native#/pages/onboarding/basic")!))
            try await waitFor(host, ".onboarding-basic-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},root=box('.onboarding-basic-page'),header=box('.onboarding-header'),back=box('.onboarding-back'),track=box('.onboarding-track'),progress=box('.onboarding-track>uni-view'),title=box('.onboarding-title'),name=box('.onboarding-content>.auth-field .auth-input-box'),chip=box('.onboarding-section .onboarding-chip'),primary=box('[data-interaction="obBasic.goObUni.click.1"]'),safes=[...document.querySelectorAll('.onboarding-basic-page>.safe-area')].map(element=>element.getBoundingClientRect().height),values=selector=>[...document.querySelectorAll(selector)].map(element=>element.textContent.trim());
                return {root,header,back,track,progress,title,name,chip,primary,safes,text:{step:document.querySelector('.onboarding-step').textContent.trim(),title:document.querySelector('.onboarding-title').textContent,description:document.querySelector('.auth-description').textContent,genders:values('[data-interaction="obBasic.o.pick.click.1"]'),pronouns:values('[data-interaction="obBasic.o.pick.click.2"]'),primary:document.querySelector('[data-interaction="obBasic.goObUni.click.1"]').textContent.trim()},interactions:[...document.querySelectorAll('[data-interaction]')].map(element=>element.dataset.interaction)};
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root = metrics["root"] as! [String: Double], header = metrics["header"] as! [String: Double], back = metrics["back"] as! [String: Double], track = metrics["track"] as! [String: Double], progress = metrics["progress"] as! [String: Double], title = metrics["title"] as! [String: Double], name = metrics["name"] as! [String: Double], chip = metrics["chip"] as! [String: Double], primary = metrics["primary"] as! [String: Double], safes = metrics["safes"] as! [Double], text = metrics["text"] as! [String: Any], interactions = metrics["interactions"] as! [String]
            let scale = root["width"]! / 393
            XCTAssertEqual(safes[0], Double(host.view.safeAreaInsets.top), accuracy: 1); XCTAssertEqual(safes[1], Double(host.view.safeAreaInsets.bottom), accuracy: 1)
            XCTAssertEqual(header["x"]!, 20 * scale, accuracy: 1); XCTAssertEqual(header["y"]!, safes[0] + 4 * scale, accuracy: 1); XCTAssertEqual(header["height"]!, 48 * scale, accuracy: 1); XCTAssertEqual(back["width"]!, 46 * scale, accuracy: 1); XCTAssertEqual(track["height"]!, 6 * scale, accuracy: 1); XCTAssertEqual(progress["width"]! / track["width"]!, 0.14, accuracy: 0.003)
            XCTAssertEqual(title["y"]!, safes[0] + 70 * scale, accuracy: 1.5); XCTAssertEqual(name["height"]!, 56 * scale, accuracy: 1); XCTAssertEqual(chip["height"]!, 48 * scale, accuracy: 1); XCTAssertEqual(primary["height"]!, 60 * scale, accuracy: 1); XCTAssertEqual(primary["bottom"]!, root["height"]! - safes[1] - 34 * scale, accuracy: 2)
            XCTAssertEqual(text["step"] as? String, "1 / 8"); XCTAssertEqual(text["title"] as? String, "About you"); XCTAssertEqual(text["description"] as? String, "Your name and age are public. Your date of birth and email stay private."); XCTAssertEqual(text["genders"] as? [String], ["Woman", "Man", "Non-binary", "Self-describe", "Prefer not to say"]); XCTAssertEqual(text["pronouns"] as? [String], ["she / her", "he / him", "they / them", "Add your own"]); XCTAssertEqual(text["primary"] as? String, "Continue")
            for id in ["obBasic.goBack.click.1", "obBasic.onObName.change.1", "obBasic.onObDob.change.1", "obBasic.o.pick.click.1", "obBasic.o.pick.click.2", "obBasic.goObUni.click.1"] { XCTAssertTrue(interactions.contains(id), "Missing \(id)") }
            let defaultShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); defaultShot.name = "WKWebView Onboarding Basic default"; defaultShot.lifetime = .keepAlways; add(defaultShot)
            print("CIMOA_ONBOARDING_BASIC_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")

            stage = "real keyboard viewport"
            let viewportBefore = try await script(host, "return visualViewport.height") as! Double
            _ = try await script(host, "const input=document.querySelector('uni-input[aria-label=\"Display name\"] input');input.click();input.focus();return true")
            var keyboard: [String: Any] = [:]
            for _ in 0..<50 {
                keyboard = try await script(host, "const input=document.querySelector('uni-input[aria-label=\"Display name\"] input').getBoundingClientRect(),footer=document.querySelector('.onboarding-footer');return {height:visualViewport.height,open:document.querySelector('.onboarding-basic-page').classList.contains('onboarding-page--keyboard'),footer:getComputedStyle(footer).display,inputTop:input.top,inputBottom:input.bottom}") as! [String: Any]
                if keyboard["open"] as? Bool == true { break }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            XCTAssertLessThan(keyboard["height"] as! Double, viewportBefore - 120); XCTAssertEqual(keyboard["open"] as? Bool, true); XCTAssertEqual(keyboard["footer"] as? String, "none"); XCTAssertGreaterThanOrEqual(keyboard["inputTop"] as! Double, 0); XCTAssertLessThanOrEqual(keyboard["inputBottom"] as! Double, keyboard["height"] as! Double)
            let keyboardShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); keyboardShot.name = "WKWebView Onboarding Basic keyboard"; keyboardShot.lifetime = .keepAlways; add(keyboardShot)
            _ = try await script(host, "document.activeElement?.blur();return true"); try await Task.sleep(nanoseconds: 350_000_000)

            stage = "validation and rollback"
            let before = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
            _ = try await script(host, "document.querySelector('[data-interaction=\"obBasic.goObUni.click.1\"]').click();return true"); try await waitFor(host, ".onboarding-basic-page [role=alert]")
            let invalid = try await script(host, "return {message:document.querySelector('.onboarding-basic-page [role=alert]').textContent,state:localStorage.getItem('cimoa_app_state_v2'),loading:!!document.querySelector('.loading')}") as! [String: Any]
            XCTAssertTrue((invalid["message"] as? String)?.contains("display name") == true); XCTAssertEqual(invalid["state"] as? String, before); XCTAssertEqual(invalid["loading"] as? Bool, false)
            _ = try await script(host, """
            const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set,name=document.querySelector('uni-input[aria-label="Display name"] input'),choice=label=>[...document.querySelectorAll('[role=button]')].find(element=>element.textContent.trim()===label);set.call(name,'Native Morgan');name.dispatchEvent(new Event('input',{bubbles:true}));choice('Non-binary').click();const original=Storage.prototype.setItem;window.__restoreOnboardingBasicStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')throw new DOMException('Injected basic storage failure','QuotaExceededError');return original.call(this,key,value)};document.querySelector('[data-interaction="obBasic.goObUni.click.1"]').click();return true
            """); try await waitFor(host, ".loading"); try await waitFor(host, ".onboarding-basic-page [role=alert]")
            let failed = try await script(host, "const result={message:document.querySelector('.onboarding-basic-page [role=alert]').textContent,state:localStorage.getItem('cimoa_app_state_v2'),name:document.querySelector('uni-input[aria-label=\"Display name\"] input').value,uni:!!document.querySelector('.onboarding-uni-page')};window.__restoreOnboardingBasicStorage();return result") as! [String: Any]
            XCTAssertTrue((failed["message"] as? String)?.contains("Injected basic storage failure") == true); XCTAssertEqual(failed["state"] as? String, before); XCTAssertEqual(failed["name"] as? String, "Native Morgan"); XCTAssertEqual(failed["uni"] as? Bool, false)
            _ = try await script(host, "const scroller=[...document.querySelectorAll('.onboarding-basic-page .uni-scroll-view')].at(-1);scroller.scrollTop=scroller.scrollHeight;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true")
            let errorShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); errorShot.name = "WKWebView Onboarding Basic failure"; errorShot.lifetime = .keepAlways; add(errorShot)

            stage = "atomic basic persistence"
            _ = try await script(host, "const original=Storage.prototype.setItem;window.__onboardingBasicBefore=localStorage.getItem('cimoa_app_state_v2');window.__onboardingBasicWrites=0;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')window.__onboardingBasicWrites++;return original.call(this,key,value)};[...document.querySelectorAll('[role=button]')].find(element=>element.textContent.trim()==='they / them').click();const action=document.querySelector('[data-interaction=\"obBasic.goObUni.click.1\"]');action.click();action.click();return true")
            try await waitFor(host, ".loading"); let unchanged = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')===window.__onboardingBasicBefore") as? Bool; XCTAssertEqual(unchanged, true); try await waitFor(host, ".onboarding-uni-page")
            let committed = try await script(host, "const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);return {step:account.onboarding.step,name:user.user_name,gender:user.gender,pronouns:user.pronouns,writes:window.__onboardingBasicWrites,student:user.verification_status}") as! [String: Any]
            XCTAssertEqual(committed["step"] as? String, "uni"); XCTAssertEqual(committed["name"] as? String, "Native Morgan"); XCTAssertEqual(committed["gender"] as? String, "Non-binary"); XCTAssertEqual(committed["pronouns"] as? String, "they / them"); XCTAssertEqual(committed["writes"] as? Int, 1); XCTAssertEqual(committed["student"] as? String, "pending")
            try await restore()
        } catch { XCTFail("Onboarding Basic WKWebView stage \(stage) failed: \(error)"); try? await restore(); throw error }
    }
    func testOnboardingUniversityPixelRestoration() async throws {
        let host = try await host()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            _ = try? await script(host, "document.activeElement?.blur();return true")
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingUniversity=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header")
        }
        var stage = "prepare university account"
        do {
            _ = try await script(host, """
            const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),data=envelope.data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);
            account.auth_provider='local';account.local_verification={method:'fixed_code',status:'verified',verified_at:Date.now()};account.date_of_birth='2000-01-01';account.onboarding={step:'uni',completed_steps:['basic']};user.user_name='Ethan';user.age=26;user.gender='Man';user.pronouns='he / him';user.university='HKUST';user.year='Year 3';user.major='Interaction Design';user.graduation_year='2027';user.onboarding_status='in_progress';user.verification_status='pending';data.auth_flow.pending_registration_account_id=account.account_id;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true
            """)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingUniversity=native#/pages/onboarding/uni")!))
            try await waitFor(host, ".onboarding-uni-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},root=box('.onboarding-uni-page'),header=box('.onboarding-header'),back=box('.onboarding-back'),track=box('.onboarding-track'),progress=box('.onboarding-track>uni-view'),title=box('.onboarding-title'),card=box('.university-card'),mark=box('.university-mark'),chip=box('.university-year .onboarding-chip'),major=box('.university-major .auth-input-box'),primary=box('[data-interaction="obUni.goObMajor.click.1"]'),safes=[...document.querySelectorAll('.onboarding-uni-page>.safe-area')].map(element=>element.getBoundingClientRect().height),values=selector=>[...document.querySelectorAll(selector)].map(element=>element.textContent.trim());
                return {root,header,back,track,progress,title,card,mark,chip,major,primary,safes,text:{step:document.querySelector('.onboarding-step').textContent.trim(),title:document.querySelector('.onboarding-title').textContent,university:document.querySelector('uni-input[aria-label="University"] input').value,status:document.querySelector('.university-status').textContent,years:values('[data-interaction="obUni.o.pick.click.1"]'),field:document.querySelector('uni-input[aria-label="Field of study"] input').value,graduation:document.querySelector('.university-graduation').textContent,primary:document.querySelector('[data-interaction="obUni.goObMajor.click.1"]').textContent.trim()},interactions:[...document.querySelectorAll('[data-interaction]')].map(element=>element.dataset.interaction)};
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root = metrics["root"] as! [String: Double], header = metrics["header"] as! [String: Double], back = metrics["back"] as! [String: Double], track = metrics["track"] as! [String: Double], progress = metrics["progress"] as! [String: Double], title = metrics["title"] as! [String: Double], card = metrics["card"] as! [String: Double], mark = metrics["mark"] as! [String: Double], chip = metrics["chip"] as! [String: Double], major = metrics["major"] as! [String: Double], primary = metrics["primary"] as! [String: Double], safes = metrics["safes"] as! [Double], text = metrics["text"] as! [String: Any], interactions = metrics["interactions"] as! [String]
            let scale = root["width"]! / 393
            XCTAssertEqual(safes[0], Double(host.view.safeAreaInsets.top), accuracy: 1); XCTAssertEqual(safes[1], Double(host.view.safeAreaInsets.bottom), accuracy: 1)
            XCTAssertEqual(header["x"]!, 20 * scale, accuracy: 1); XCTAssertEqual(header["y"]!, safes[0] + 4 * scale, accuracy: 1); XCTAssertEqual(header["height"]!, 48 * scale, accuracy: 1); XCTAssertEqual(back["width"]!, 46 * scale, accuracy: 1); XCTAssertEqual(track["height"]!, 6 * scale, accuracy: 1); XCTAssertEqual(progress["width"]! / track["width"]!, 0.26, accuracy: 0.003)
            XCTAssertEqual(title["y"]!, safes[0] + 70 * scale, accuracy: 1.5); XCTAssertEqual(card["y"]! - title["bottom"]!, 18 * scale, accuracy: 1.5); XCTAssertEqual(mark["width"]!, 20 * scale, accuracy: 1); XCTAssertEqual(chip["height"]!, 48 * scale, accuracy: 1); XCTAssertEqual(major["height"]!, 56 * scale, accuracy: 1); XCTAssertEqual(primary["height"]!, 60 * scale, accuracy: 1); XCTAssertEqual(primary["bottom"]!, root["height"]! - safes[1] - 34 * scale, accuracy: 2)
            XCTAssertEqual(text["step"] as? String, "2 / 8"); XCTAssertEqual(text["title"] as? String, "Your university"); XCTAssertEqual(text["university"] as? String, "HKUST"); XCTAssertEqual(text["status"] as? String, "Self-reported · verification pending"); XCTAssertEqual(text["years"] as? [String], ["Year 1", "Year 2", "Year 3", "Year 4", "Postgraduate"]); XCTAssertEqual(text["field"] as? String, "Interaction Design"); XCTAssertEqual(text["graduation"] as? String, "Expected graduation · 2027"); XCTAssertEqual(text["primary"] as? String, "Continue")
            for id in ["obUni.goBack.click.1", "obUni.o.pick.click.1", "obUni.onObField.change.1", "obUni.goObMajor.click.1"] { XCTAssertTrue(interactions.contains(id), "Missing \(id)") }
            let defaultShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); defaultShot.name = "WKWebView Onboarding University default"; defaultShot.lifetime = .keepAlways; add(defaultShot)
            print("CIMOA_ONBOARDING_UNIVERSITY_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")

            stage = "real keyboard viewport"
            let viewportBefore = try await script(host, "return visualViewport.height") as! Double
            _ = try await script(host, "const input=document.querySelector('uni-input[aria-label=\"Field of study\"] input');input.click();input.focus();return true")
            var keyboard: [String: Any] = [:]
            for _ in 0..<50 {
                keyboard = try await script(host, "const input=document.querySelector('uni-input[aria-label=\"Field of study\"] input').getBoundingClientRect(),footer=document.querySelector('.onboarding-footer');return {height:visualViewport.height,open:document.querySelector('.onboarding-uni-page').classList.contains('onboarding-page--keyboard'),footer:getComputedStyle(footer).display,inputTop:input.top,inputBottom:input.bottom}") as! [String: Any]
                if keyboard["open"] as? Bool == true { break }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            XCTAssertLessThan(keyboard["height"] as! Double, viewportBefore - 120); XCTAssertEqual(keyboard["open"] as? Bool, true); XCTAssertEqual(keyboard["footer"] as? String, "none"); XCTAssertGreaterThanOrEqual(keyboard["inputTop"] as! Double, 0); XCTAssertLessThanOrEqual(keyboard["inputBottom"] as! Double, keyboard["height"] as! Double)
            let keyboardShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); keyboardShot.name = "WKWebView Onboarding University keyboard"; keyboardShot.lifetime = .keepAlways; add(keyboardShot)
            _ = try await script(host, "document.activeElement?.blur();return true"); try await Task.sleep(nanoseconds: 350_000_000)

            stage = "validation and rollback"
            _ = try await script(host, "const input=document.querySelector('uni-input[aria-label=\"University\"] input'),set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'');input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-interaction=\"obUni.goObMajor.click.1\"]').click();return true")
            try await waitFor(host, ".onboarding-uni-page [role=alert]")
            let invalid = try await script(host, "return {message:document.querySelector('.onboarding-uni-page [role=alert]').textContent,loading:!!document.querySelector('.loading')}") as! [String: Any]
            XCTAssertTrue((invalid["message"] as? String)?.contains("university") == true); XCTAssertEqual(invalid["loading"] as? Bool, false)
            let before = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
            _ = try await script(host, """
            const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set,input=document.querySelector('uni-input[aria-label="University"] input');set.call(input,'Retry University');input.dispatchEvent(new Event('input',{bubbles:true}));const original=Storage.prototype.setItem;window.__restoreOnboardingUniversityStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')throw new DOMException('Injected university storage failure','QuotaExceededError');return original.call(this,key,value)};document.querySelector('[data-interaction="obUni.goObMajor.click.1"]').click();return true
            """); try await waitFor(host, ".loading"); try await waitFor(host, ".onboarding-uni-page [role=alert]")
            let failed = try await script(host, "const result={message:document.querySelector('.onboarding-uni-page [role=alert]').textContent,state:localStorage.getItem('cimoa_app_state_v2'),name:document.querySelector('uni-input[aria-label=\"University\"] input').value,major:!!document.querySelector('.onboarding-major-page')};window.__restoreOnboardingUniversityStorage();return result") as! [String: Any]
            XCTAssertTrue((failed["message"] as? String)?.contains("Injected university storage failure") == true); XCTAssertEqual(failed["state"] as? String, before); XCTAssertEqual(failed["name"] as? String, "Retry University"); XCTAssertEqual(failed["major"] as? Bool, false)
            let errorShot = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); errorShot.name = "WKWebView Onboarding University failure"; errorShot.lifetime = .keepAlways; add(errorShot)

            stage = "atomic university persistence"
            _ = try await script(host, "const original=Storage.prototype.setItem;window.__onboardingUniversityBefore=localStorage.getItem('cimoa_app_state_v2');window.__onboardingUniversityWrites=0;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')window.__onboardingUniversityWrites++;return original.call(this,key,value)};const action=document.querySelector('[data-interaction=\"obUni.goObMajor.click.1\"]');action.click();action.click();return true")
            try await waitFor(host, ".loading"); let unchanged = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')===window.__onboardingUniversityBefore") as? Bool; XCTAssertEqual(unchanged, true); try await waitFor(host, ".onboarding-major-page")
            let committed = try await script(host, "const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);return {step:account.onboarding.step,university:user.university,year:user.year,field:user.major,graduation:user.graduation_year,writes:window.__onboardingUniversityWrites}") as! [String: Any]
            XCTAssertEqual(committed["step"] as? String, "major"); XCTAssertEqual(committed["university"] as? String, "Retry University"); XCTAssertEqual(committed["year"] as? String, "Year 3"); XCTAssertEqual(committed["field"] as? String, "Interaction Design"); XCTAssertEqual(committed["graduation"] as? String, "2027"); XCTAssertEqual(committed["writes"] as? Int, 1)
            try await restore()
        } catch { XCTFail("Onboarding University WKWebView stage \(stage) failed: \(error)"); try? await restore(); throw error }
    }
    func testOnboardingMajorPixelRestoration() async throws {
        let host = try await host()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingMajor=restored#/pages/home/index")!)); try await waitFor(host, ".home-header")
        }
        var stage = "prepare major account"
        do {
            _ = try await script(host, """
            const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),data=envelope.data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);account.auth_provider='local';account.local_verification={method:'fixed_code',status:'verified',verified_at:Date.now()};account.date_of_birth='2000-01-01';account.onboarding={step:'major',completed_steps:['basic','uni']};Object.assign(user,{user_name:'Ethan',age:26,gender:'Man',pronouns:'he / him',university:'HKUST',year:'Year 3',major:'Interaction Design',graduation_year:'2027',onboarding_status:'in_progress',verification_status:'pending'});data.auth_flow.pending_registration_account_id=account.account_id;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true
            """)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingMajor=native#/pages/onboarding/major")!)); try await waitFor(host, ".onboarding-major-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},root=box('.onboarding-major-page'),header=box('.onboarding-header'),track=box('.onboarding-track'),progress=box('.onboarding-track>uni-view'),title=box('.onboarding-title'),description=box('.auth-description'),grid=box('.major-grid'),card=box('.major-card'),primary=box('[data-interaction="obMajor.goObPhotos.click.1"]'),safes=[...document.querySelectorAll('.onboarding-major-page>.safe-area')].map(element=>element.getBoundingClientRect().height),values=selector=>[...document.querySelectorAll(selector)].map(element=>element.textContent.trim());return {root,header,track,progress,title,description,grid,card,primary,safes,text:{step:document.querySelector('.onboarding-step').textContent.trim(),title:document.querySelector('.onboarding-title').textContent,description:document.querySelector('.auth-description').textContent,choices:values('[data-interaction="obMajor.m.pick.click.1"]'),primary:document.querySelector('[data-interaction="obMajor.goObPhotos.click.1"]').textContent.trim()},interactions:[...document.querySelectorAll('[data-interaction]')].map(element=>element.dataset.interaction)}
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]; if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }; host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root=metrics["root"] as! [String:Double],header=metrics["header"] as! [String:Double],track=metrics["track"] as! [String:Double],progress=metrics["progress"] as! [String:Double],title=metrics["title"] as! [String:Double],description=metrics["description"] as! [String:Double],grid=metrics["grid"] as! [String:Double],card=metrics["card"] as! [String:Double],primary=metrics["primary"] as! [String:Double],safes=metrics["safes"] as! [Double],text=metrics["text"] as! [String:Any],interactions=metrics["interactions"] as! [String],scale=root["width"]!/393
            XCTAssertEqual(safes[0],Double(host.view.safeAreaInsets.top),accuracy:1); XCTAssertEqual(safes[1],Double(host.view.safeAreaInsets.bottom),accuracy:1); XCTAssertEqual(header["y"]!,safes[0]+4*scale,accuracy:1); XCTAssertEqual(track["height"]!,6*scale,accuracy:1); XCTAssertEqual(progress["width"]!/track["width"]!,0.39,accuracy:0.003); XCTAssertEqual(title["y"]!,safes[0]+70*scale,accuracy:1.5); XCTAssertEqual(description["y"]!-title["bottom"]!,8*scale,accuracy:1); XCTAssertEqual(grid["y"]!-description["bottom"]!,20*scale,accuracy:1); XCTAssertEqual(card["width"]!,card["height"]!,accuracy:1); XCTAssertEqual(primary["height"]!,60*scale,accuracy:1); XCTAssertEqual(primary["bottom"]!,root["height"]!-safes[1]-34*scale,accuracy:2)
            XCTAssertEqual(text["step"] as? String,"3 / 9"); XCTAssertEqual(text["title"] as? String,"I am studying…"); XCTAssertEqual(text["description"] as? String,"Pick the major closest to yours."); XCTAssertEqual((text["choices"] as? [String])?.count,15); XCTAssertEqual(text["primary"] as? String,"Continue"); for id in ["obMajor.goBack.click.1","obMajor.m.pick.click.1","obMajor.goObPhotos.click.1"] { XCTAssertTrue(interactions.contains(id),"Missing \(id)") }
            let defaultShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); defaultShot.name="WKWebView Onboarding Major default"; defaultShot.lifetime = .keepAlways; add(defaultShot); print("CIMOA_ONBOARDING_MAJOR_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")

            stage = "validation and rollback"
            let before=try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as! String; _=try await script(host,"document.querySelector('[data-interaction=\"obMajor.goObPhotos.click.1\"]').click();return true"); try await waitFor(host,".onboarding-major-page [role=alert]"); let invalid=try await script(host,"return {message:document.querySelector('.onboarding-major-page [role=alert]').textContent,state:localStorage.getItem('cimoa_app_state_v2'),loading:!!document.querySelector('.loading')}") as! [String:Any]; XCTAssertTrue((invalid["message"] as? String)?.contains("major closest") == true); XCTAssertEqual(invalid["state"] as? String,before); XCTAssertEqual(invalid["loading"] as? Bool,false)
            _=try await script(host,"[...document.querySelectorAll('[role=button]')].find(element=>element.getAttribute('aria-label')==='Engineering').click();const original=Storage.prototype.setItem;window.__restoreOnboardingMajorStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')throw new DOMException('Injected major storage failure','QuotaExceededError');return original.call(this,key,value)};document.querySelector('[data-interaction=\"obMajor.goObPhotos.click.1\"]').click();return true"); try await waitFor(host,".loading"); try await waitFor(host,".onboarding-major-page [role=alert]"); let failed=try await script(host,"const result={message:document.querySelector('.onboarding-major-page [role=alert]').textContent,state:localStorage.getItem('cimoa_app_state_v2'),selected:[...document.querySelectorAll('[aria-pressed=true]')].map(element=>element.getAttribute('aria-label')),photos:!!document.querySelector('.onboarding-photos-page')};window.__restoreOnboardingMajorStorage();return result") as! [String:Any]; XCTAssertTrue((failed["message"] as? String)?.contains("Injected major storage failure") == true); XCTAssertEqual(failed["state"] as? String,before); XCTAssertEqual(failed["selected"] as? [String],["Engineering"]); XCTAssertEqual(failed["photos"] as? Bool,false)
            let errorShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); errorShot.name="WKWebView Onboarding Major failure"; errorShot.lifetime = .keepAlways; add(errorShot)

            stage = "atomic major persistence"
            _=try await script(host,"[...document.querySelectorAll('[role=button]')].find(element=>element.getAttribute('aria-label')==='Computer Science').click();const original=Storage.prototype.setItem;window.__onboardingMajorBefore=localStorage.getItem('cimoa_app_state_v2');window.__onboardingMajorWrites=0;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')window.__onboardingMajorWrites++;return original.call(this,key,value)};const action=document.querySelector('[data-interaction=\"obMajor.goObPhotos.click.1\"]');action.click();action.click();return true"); try await waitFor(host,".loading"); let unchanged = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')===window.__onboardingMajorBefore") as? Bool; XCTAssertEqual(unchanged,true); try await waitFor(host,".onboarding-photos-page"); let committed=try await script(host,"const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);return {step:account.onboarding.step,major:user.major,writes:window.__onboardingMajorWrites}") as! [String:Any]; XCTAssertEqual(committed["step"] as? String,"photos"); XCTAssertEqual(committed["major"] as? String,"Computer Science"); XCTAssertEqual(committed["writes"] as? Int,1)
            try await restore()
        } catch { XCTFail("Onboarding Major WKWebView stage \(stage) failed: \(error)"); try? await restore(); throw error }
    }
    func testOnboardingPhotosPixelRestoration() async throws {
        let host = try await host()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        let existingMedia = try await script(host, "const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_media_v2',1);r.onupgradeneeded=()=>r.result.createObjectStore('blobs');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});const keys=await new Promise((resolve,reject)=>{const r=db.transaction('blobs').objectStore('blobs').getAllKeys();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();return keys") as! [String]
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("""
            const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_media_v2',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
            await new Promise((resolve,reject)=>{const t=db.transaction('blobs','readwrite'),s=t.objectStore('blobs'),r=s.getAllKeys();r.onsuccess=()=>r.result.filter(k=>!existing.includes(k)).forEach(k=>s.delete(k));t.oncomplete=resolve;t.onerror=()=>reject(t.error)});db.close();localStorage.setItem('cimoa_app_state_v2',snapshot);return true
            """, arguments: ["snapshot": saved, "existing": existingMedia], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingPhotos=restored#/pages/home/index")!)); try await waitFor(host, ".home-header")
        }
        var stage = "prepare photos account"
        do {
            _ = try await script(host, """
            const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),data=envelope.data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);account.auth_provider='local';account.local_verification={method:'fixed_code',status:'verified',verified_at:Date.now()};account.date_of_birth='2000-01-01';account.onboarding={step:'photos',completed_steps:['basic','uni','major']};data.profile_photos=data.profile_photos.filter(row=>row.user_id!==user.user_id);Object.assign(user,{user_name:'Ethan',age:26,gender:'Man',pronouns:'he / him',university:'HKUST',year:'Year 3',major:'Computer Science',graduation_year:'2027',onboarding_status:'in_progress',verification_status:'pending',photo_ids:[],avatar_url:''});data.auth_flow.pending_registration_account_id=account.account_id;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true
            """)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingPhotos=native#/pages/onboarding/photos")!)); try await waitFor(host, ".onboarding-photos-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},root=box('.onboarding-photos-page'),header=box('.onboarding-header'),track=box('.onboarding-track'),progress=box('.onboarding-track>uni-view'),title=box('.onboarding-title'),description=box('.auth-description'),fan=box('.photo-fan'),center=box('.photo-slot-1'),hint=box('.photos-hint'),primary=box('[data-interaction="obPhotos.goObAbout.click.1"]'),safes=[...document.querySelectorAll('.onboarding-photos-page>.safe-area')].map(element=>element.getBoundingClientRect().height);return {root,header,track,progress,title,description,fan,center,hint,primary,safes,text:{step:document.querySelector('.onboarding-step').textContent.trim(),title:document.querySelector('.onboarding-title').textContent,description:document.querySelector('.auth-description').textContent,hint:document.querySelector('.photos-hint').textContent,primary:document.querySelector('[data-interaction="obPhotos.goObAbout.click.1"]').textContent.trim()},disabled:document.querySelector('[data-interaction="obPhotos.goObAbout.click.1"]').getAttribute('aria-disabled'),interactions:[...document.querySelectorAll('[data-interaction]')].map(element=>element.dataset.interaction)}
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]; if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }; host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root=metrics["root"] as! [String:Double],header=metrics["header"] as! [String:Double],track=metrics["track"] as! [String:Double],progress=metrics["progress"] as! [String:Double],title=metrics["title"] as! [String:Double],description=metrics["description"] as! [String:Double],fan=metrics["fan"] as! [String:Double],center=metrics["center"] as! [String:Double],primary=metrics["primary"] as! [String:Double],safes=metrics["safes"] as! [Double],text=metrics["text"] as! [String:Any],interactions=metrics["interactions"] as! [String],scale=root["width"]!/393
            XCTAssertEqual(safes[0],Double(host.view.safeAreaInsets.top),accuracy:1); XCTAssertEqual(safes[1],Double(host.view.safeAreaInsets.bottom),accuracy:1); XCTAssertEqual(header["y"]!,safes[0]+4*scale,accuracy:1); XCTAssertEqual(track["height"]!,6*scale,accuracy:1); XCTAssertEqual(progress["width"]!/track["width"]!,0.38,accuracy:0.003); XCTAssertEqual(title["y"]!,safes[0]+70*scale,accuracy:1.5); XCTAssertEqual(description["y"]!-title["bottom"]!,10*scale,accuracy:1); XCTAssertEqual(fan["y"]!-description["bottom"]!,26*scale,accuracy:1); XCTAssertEqual(center["width"]!,146*scale,accuracy:1); XCTAssertEqual(center["height"]!,204*scale,accuracy:1); XCTAssertEqual(primary["bottom"]!,root["height"]!-safes[1]-34*scale,accuracy:2)
            XCTAssertEqual(text["step"] as? String,"3 / 8"); XCTAssertEqual(text["title"] as? String,"Add your photos"); XCTAssertEqual(text["description"] as? String,"Add at least 2 photos"); XCTAssertEqual(text["hint"] as? String,"Add at least 2 photos to continue"); XCTAssertEqual(text["primary"] as? String,"Continue"); XCTAssertEqual(metrics["disabled"] as? String,"true"); for id in ["obPhotos.goBack.click.1","obPhotos.p.tap.click.1","obPhotos.goObAbout.click.1"] { XCTAssertTrue(interactions.contains(id),"Missing \(id)") }
            let emptyShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); emptyShot.name="WKWebView Onboarding Photos empty"; emptyShot.lifetime = .keepAlways; add(emptyShot); print("CIMOA_ONBOARDING_PHOTOS_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")

            stage = "photo library permission"
            _=try await script(host,"document.querySelector('.photo-slot-1').click();return true"); try await waitFor(host,".permission-photos-page")
            let permission=try await script(host,"""
            await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},root=box('.permission-photos-page'),icon=box('.permission-icon'),primary=box('[data-interaction="permPhotos.allowPhotos.click.1"]'),secondary=box('[data-interaction="permPhotos.denyPhotos.click.1"]'),safes=[...document.querySelectorAll('.permission-photos-page>.safe-area')].map(element=>element.getBoundingClientRect().height);return {root,icon,primary,secondary,safes,title:document.querySelector('.permission-title').textContent,copy:document.querySelector('.permission-copy').textContent}
            """) as! [String:Any]
            let permissionRoot=permission["root"] as! [String:Double],icon=permission["icon"] as! [String:Double],permissionPrimary=permission["primary"] as! [String:Double],secondary=permission["secondary"] as! [String:Double],permissionSafes=permission["safes"] as! [Double],permissionScale=permissionRoot["width"]!/393
            XCTAssertEqual(icon["y"]!,permissionSafes[0]+118*permissionScale,accuracy:1.5); XCTAssertEqual(icon["width"]!,92*permissionScale,accuracy:1); XCTAssertEqual(permissionPrimary["height"]!,60*permissionScale,accuracy:1); XCTAssertEqual(secondary["height"]!,46*permissionScale,accuracy:1); XCTAssertEqual(secondary["bottom"]!,permissionRoot["height"]!-permissionSafes[1]-30*permissionScale,accuracy:2); XCTAssertEqual(permission["title"] as? String,"Choose photos from your library"); XCTAssertEqual(permission["copy"] as? String,"Cimoa only sees the photos you pick for your profile. Nothing else is read.")
            let permissionShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); permissionShot.name="WKWebView Onboarding Photos permission"; permissionShot.lifetime = .keepAlways; add(permissionShot)
            let before=try await script(host,"window.__photoPermissionBefore=localStorage.getItem('cimoa_app_state_v2');return window.__photoPermissionBefore") as! String
            _=try await script(host,#"document.querySelector('[data-interaction="permPhotos.denyPhotos.click.1"]').click();return true"#); try await waitFor(host,".permission-error")
            let denied=try await script(host,#"return {title:document.querySelector('.permission-error-title').textContent,message:document.querySelector('[role=alert]').textContent,state:localStorage.getItem('cimoa_app_state_v2'),back:!!document.querySelector('[data-interaction="permPhotos.back.click.1"]')}"#) as! [String:Any]
            XCTAssertEqual(denied["title"] as? String,"Access is off"); XCTAssertTrue((denied["message"] as? String)?.contains("Without it you can’t add") == true); XCTAssertEqual(denied["state"] as? String,before); XCTAssertEqual(denied["back"] as? Bool,true)
            _=try await script(host,#"document.querySelector('[data-interaction="permPhotos.back.click.1"]').click();return true"#); try await waitFor(host,".onboarding-photos-page")

            stage = "owned photo persistence"
            let added=try await script(host,"""
            const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),visible=selector=>[...document.querySelectorAll(selector)].find(element=>element.getBoundingClientRect().height>0),wait=async fn=>{for(let index=0;index<200;index++){const value=fn();if(value)return value;await delay(50)}throw Error('Photo acceptance timeout')};document.querySelector('.photo-slot-1').click();await wait(()=>visible('.permission-photos-page'));const suppress=event=>{if(event.target.matches('input[type=file]'))event.preventDefault()};document.addEventListener('click',suppress,true);try{document.querySelector('[data-interaction="permPhotos.allowPhotos.click.1"]').click();await wait(()=>document.querySelector('input[type=file]'));const files=new DataTransfer();for(const [url,name] of [['/static/assets/head/me.png','me.png'],['/static/assets/head/maya-card.png','maya-card.png'],['/static/assets/img/event-picnic.png','event-picnic.png']]){const blob=await(await fetch(url)).blob();files.items.add(new File([blob],name,{type:'image/png'}))}const input=[...document.querySelectorAll('input[type=file]')].at(-1);input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));await wait(()=>visible('.loading'));const draft=localStorage.getItem('cimoa_app_state_v2')===window.__photoPermissionBefore;await wait(()=>document.querySelectorAll('.onboarding-photos-page .profile-photo[data-media-status=ready]').length===3);await wait(()=>!visible('.loading'));await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,user=data.users.find(row=>row.user_id===data.session.current_user_id),photos=data.profile_photos.filter(row=>row.user_id===user.user_id).sort((a,b)=>a.position-b.position),media=photos.filter(photo=>data.media_files.some(row=>row.owner_user_id===user.user_id&&row.kind==='image'&&row.media_url===photo.media_url));return {draft,count:photos.length,media:media.length,avatar:user.avatar_url,primary:photos[0].media_url,hint:document.querySelector('.photos-hint').textContent,disabled:document.querySelector('[data-interaction="obPhotos.goObAbout.click.1"]').getAttribute('aria-disabled')}}finally{document.removeEventListener('click',suppress,true)}
            """) as! [String:Any]
            XCTAssertEqual(added["draft"] as? Bool,true); XCTAssertEqual(added["count"] as? Int,3); XCTAssertEqual(added["media"] as? Int,3); XCTAssertEqual(added["avatar"] as? String,added["primary"] as? String); XCTAssertEqual(added["hint"] as? String,"Tap a photo to replace, reorder, delete, or set it as your primary."); XCTAssertEqual(added["disabled"] as? String,"false")
            let addedShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); addedShot.name="WKWebView Onboarding Photos added"; addedShot.lifetime = .keepAlways; add(addedShot)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingPhotos=refresh#/pages/onboarding/photos")!))
            for _ in 0..<100 {
                if (try? await script(host,"return location.search.includes('onboardingPhotos=refresh')&&!!document.querySelector('.onboarding-photos-page')")) as? Bool == true { break }
                try await Task.sleep(nanoseconds:100_000_000)
            }
            var refreshed = false
            for _ in 0..<100 { if (try? await script(host,"return document.querySelectorAll('.onboarding-photos-page .profile-photo[data-media-status=ready]').length===3")) as? Bool == true { refreshed = true; break }; try await Task.sleep(nanoseconds:100_000_000) }
            XCTAssertTrue(refreshed,"Owned photos must decode after a fresh WKWebView document.")
            _=try await script(host,#"window.__photosBefore=localStorage.getItem('cimoa_app_state_v2');window.__photosWrites=0;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')window.__photosWrites++;return original.call(this,key,value)};const action=document.querySelector('[data-interaction="obPhotos.goObAbout.click.1"]');action.click();action.click();return true"#); try await waitFor(host,".loading"); let unchanged=try await script(host,"return localStorage.getItem('cimoa_app_state_v2')===window.__photosBefore") as? Bool; XCTAssertEqual(unchanged,true)
            var reachedAbout = false
            for _ in 0..<150 {
                if (try? await script(host,"return !!document.querySelector('.onboarding-about-page')")) as? Bool == true { reachedAbout = true; break }
                if let diagnostic = (try? await script(host,"return document.querySelector('.onboarding-photos-page [role=alert]')?.textContent||''")) as? String, !diagnostic.isEmpty { XCTFail("Photos could not advance: \(diagnostic)"); break }
                try await Task.sleep(nanoseconds:100_000_000)
            }
            XCTAssertTrue(reachedAbout,"Photos must advance to About after the atomic write.")
            let committed=try await script(host,"const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,account=data.accounts.find(row=>row.account_id===data.session.account_id);return {step:account.onboarding.step,writes:window.__photosWrites}") as! [String:Any]; XCTAssertEqual(committed["step"] as? String,"about"); XCTAssertEqual(committed["writes"] as? Int,1)
            try await restore()
        } catch { XCTFail("Onboarding Photos WKWebView stage \(stage) failed: \(error)"); try? await restore(); throw error }
    }
    func testOnboardingAboutPixelRestoration() async throws {
        let host = try await host()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            _ = try? await script(host, "document.activeElement?.blur();return true")
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingAbout=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header")
        }
        var stage = "prepare about account"
        do {
            _ = try await script(host, """
            const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),data=envelope.data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);account.auth_provider='local';account.local_verification={method:'fixed_code',status:'verified',verified_at:Date.now()};account.date_of_birth='2000-01-01';account.onboarding={step:'about',completed_steps:['basic','uni','major','photos']};Object.assign(user,{user_name:'Ethan',age:26,gender:'Man',pronouns:'he / him',university:'HKUST',year:'Year 3',major:'Computer Science',graduation_year:'2027',bio:'',onboarding_status:'in_progress',verification_status:'pending'});data.auth_flow.pending_registration_account_id=account.account_id;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true
            """)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingAbout=native#/pages/onboarding/about")!))
            try await waitFor(host, ".onboarding-about-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},root=box('.onboarding-about-page'),header=box('.onboarding-header'),track=box('.onboarding-track'),progress=box('.onboarding-track>uni-view'),title=box('.onboarding-title'),description=box('.auth-description'),card=box('.about-card'),textarea=box('uni-textarea'),counter=box('.about-counter'),primary=box('[data-interaction="obAbout.goObInterests.click.1"]'),safes=[...document.querySelectorAll('.onboarding-about-page>.safe-area')].map(element=>element.getBoundingClientRect().height),counterText=[...document.querySelector('.about-counter').children].map(element=>element.textContent.trim()).join(' ');return {root,header,track,progress,title,description,card,textarea,counter,primary,safes,text:{step:document.querySelector('.onboarding-step').textContent.trim(),title:document.querySelector('.onboarding-title').textContent,description:document.querySelector('.auth-description').textContent,placeholder:document.querySelector('.uni-textarea-placeholder')?.textContent||'',counter:counterText,primary:document.querySelector('[data-interaction="obAbout.goObInterests.click.1"]').textContent.trim()},interactions:[...document.querySelectorAll('[data-interaction]')].map(element=>element.dataset.interaction)}
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root=metrics["root"] as! [String:Double],header=metrics["header"] as! [String:Double],track=metrics["track"] as! [String:Double],progress=metrics["progress"] as! [String:Double],title=metrics["title"] as! [String:Double],description=metrics["description"] as! [String:Double],card=metrics["card"] as! [String:Double],textarea=metrics["textarea"] as! [String:Double],counter=metrics["counter"] as! [String:Double],primary=metrics["primary"] as! [String:Double],safes=metrics["safes"] as! [Double],text=metrics["text"] as! [String:Any],interactions=metrics["interactions"] as! [String],scale=root["width"]!/393
            XCTAssertEqual(safes[0],Double(host.view.safeAreaInsets.top),accuracy:1); XCTAssertEqual(safes[1],Double(host.view.safeAreaInsets.bottom),accuracy:1); XCTAssertEqual(header["y"]!,safes[0]+4*scale,accuracy:1); XCTAssertEqual(track["height"]!,6*scale,accuracy:1); XCTAssertEqual(progress["width"]!/track["width"]!,0.5,accuracy:0.003); XCTAssertEqual(title["y"]!,safes[0]+70*scale,accuracy:1.5); XCTAssertEqual(description["y"]!-title["bottom"]!,10*scale,accuracy:1); XCTAssertEqual(card["y"]!-description["bottom"]!,18*scale,accuracy:1); XCTAssertEqual(textarea["height"]!,150*scale,accuracy:1); XCTAssertEqual(counter["y"]!-textarea["bottom"]!,8*scale,accuracy:1); XCTAssertEqual(primary["height"]!,60*scale,accuracy:1); XCTAssertEqual(primary["bottom"]!,root["height"]!-safes[1]-34*scale,accuracy:2)
            XCTAssertEqual(text["step"] as? String,"4 / 8"); XCTAssertEqual(text["title"] as? String,"A line about you"); XCTAssertEqual(text["description"] as? String,"Optional, but it makes conversations easier to start."); XCTAssertEqual(text["placeholder"] as? String,"Design student who loves quiet cafés, live music, and spontaneous photowalks."); XCTAssertEqual(text["counter"] as? String,"Keep it short 0 / 300"); XCTAssertEqual(text["primary"] as? String,"Continue"); for id in ["obAbout.goBack.click.1","obAbout.onObBio.change.1","obAbout.goObInterests.click.1"] { XCTAssertTrue(interactions.contains(id),"Missing \(id)") }
            let defaultShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); defaultShot.name="WKWebView Onboarding About default"; defaultShot.lifetime = .keepAlways; add(defaultShot); print("CIMOA_ONBOARDING_ABOUT_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")

            stage = "real keyboard viewport"
            let viewportBefore = try await script(host,"return visualViewport.height") as! Double
            _ = try await script(host,"const input=document.querySelector('uni-textarea textarea');input.click();input.focus();return true")
            var keyboard: [String: Any] = [:]
            for _ in 0..<50 {
                keyboard = try await script(host,"const input=document.querySelector('uni-textarea').getBoundingClientRect(),footer=document.querySelector('.onboarding-footer');return {height:visualViewport.height,open:document.querySelector('.onboarding-about-page').classList.contains('onboarding-page--keyboard'),footer:getComputedStyle(footer).display,inputTop:input.top,inputBottom:input.bottom}") as! [String: Any]
                if keyboard["open"] as? Bool == true { break }
                try await Task.sleep(nanoseconds:100_000_000)
            }
            XCTAssertLessThan(keyboard["height"] as! Double,viewportBefore-120); XCTAssertEqual(keyboard["open"] as? Bool,true); XCTAssertEqual(keyboard["footer"] as? String,"none"); XCTAssertGreaterThanOrEqual(keyboard["inputTop"] as! Double,0); XCTAssertLessThanOrEqual(keyboard["inputBottom"] as! Double,keyboard["height"] as! Double)
            let keyboardShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); keyboardShot.name="WKWebView Onboarding About keyboard"; keyboardShot.lifetime = .keepAlways; add(keyboardShot)
            _ = try await script(host,"document.activeElement?.blur();return true"); try await Task.sleep(nanoseconds:350_000_000)

            stage = "failure rollback"
            let before = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as! String
            _ = try await script(host,"""
            const input=document.querySelector('uni-textarea textarea'),set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(input,'Keep this biography for retry.');input.dispatchEvent(new Event('input',{bubbles:true}));const original=Storage.prototype.setItem;window.__restoreOnboardingAboutStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')throw new DOMException('Injected about storage failure','QuotaExceededError');return original.call(this,key,value)};document.querySelector('[data-interaction="obAbout.goObInterests.click.1"]').click();return true
            """); try await waitFor(host,".loading"); try await waitFor(host,".onboarding-about-page [role=alert]")
            let failed=try await script(host,"const result={message:document.querySelector('.onboarding-about-page [role=alert]').textContent,state:localStorage.getItem('cimoa_app_state_v2'),bio:document.querySelector('uni-textarea textarea').value,interests:!!document.querySelector('.onboarding-interests-page')};window.__restoreOnboardingAboutStorage();return result") as! [String:Any]
            XCTAssertTrue((failed["message"] as? String)?.contains("Injected about storage failure") == true); XCTAssertEqual(failed["state"] as? String,before); XCTAssertEqual(failed["bio"] as? String,"Keep this biography for retry."); XCTAssertEqual(failed["interests"] as? Bool,false)
            let failureShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); failureShot.name="WKWebView Onboarding About failure"; failureShot.lifetime = .keepAlways; add(failureShot)

            stage = "atomic biography persistence"
            _ = try await script(host,"""
            const input=document.querySelector('uni-textarea textarea'),set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set,bio='A'.repeat(300);set.call(input,bio);input.dispatchEvent(new Event('input',{bubbles:true}));window.__aboutBefore=localStorage.getItem('cimoa_app_state_v2');window.__aboutWrites=0;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')window.__aboutWrites++;return original.call(this,key,value)};const action=document.querySelector('[data-interaction="obAbout.goObInterests.click.1"]');action.click();action.click();return true
            """); try await waitFor(host,".loading"); let unchanged=try await script(host,"return localStorage.getItem('cimoa_app_state_v2')===window.__aboutBefore") as? Bool; XCTAssertEqual(unchanged,true); try await waitFor(host,".onboarding-interests-page")
            let committed=try await script(host,"const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);return {step:account.onboarding.step,bio:user.bio,writes:window.__aboutWrites}") as! [String:Any]
            XCTAssertEqual(committed["step"] as? String,"interests"); XCTAssertEqual((committed["bio"] as? String)?.count,300); XCTAssertEqual(committed["writes"] as? Int,1)
            try await restore()
        } catch { XCTFail("Onboarding About WKWebView stage \(stage) failed: \(error)"); try? await restore(); throw error }
    }
    func testOnboardingInterestsPixelRestoration() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingInterests=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header,.onboarding-page,.welcome-page")
        }
        var stage = "prepare interests account"
        do {
            _ = try await script(host, """
            const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),data=envelope.data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);account.auth_provider='local';account.local_verification={method:'fixed_code',status:'verified',verified_at:Date.now()};account.date_of_birth='2000-01-01';account.onboarding={step:'interests',completed_steps:['basic','uni','major','photos','about']};Object.assign(user,{user_name:'Ethan',age:26,gender:'Man',pronouns:'he / him',university:'HKUST',year:'Year 3',major:'Computer Science',graduation_year:'2027',bio:'Campus walks, coffee and new conversations.',interest_ids:['photography','coffee','music'],onboarding_status:'in_progress',verification_status:'pending'});data.auth_flow.pending_registration_account_id=account.account_id;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true
            """)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingInterests=native#/pages/onboarding/interests")!))
            try await waitFor(host, ".onboarding-interests-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},root=box('.onboarding-interests-page'),header=box('.onboarding-header'),track=box('.onboarding-track'),progress=box('.onboarding-track>uni-view'),title=box('.onboarding-title'),description=box('.auth-description'),counter=box('.interests-counter'),chips=box('.interest-chips'),first=box('.interest-chips [role=checkbox]'),primary=box('[data-interaction="obInterests.goObGoal.click.1"]'),safes=[...document.querySelectorAll('.onboarding-interests-page>.safe-area')].map(element=>element.getBoundingClientRect().height),rows=[...document.querySelectorAll('.interest-chips [role=checkbox]')];return {root,header,track,progress,title,description,counter,chips,first,primary,safes,text:{step:document.querySelector('.onboarding-step').textContent.trim(),title:document.querySelector('.onboarding-title').textContent,description:document.querySelector('.auth-description').textContent,counter:document.querySelector('.interests-counter').textContent.trim(),primary:document.querySelector('[data-interaction="obInterests.goObGoal.click.1"]').textContent.trim()},choices:rows.map(element=>element.getAttribute('aria-label')),selected:rows.filter(element=>element.getAttribute('aria-checked')==='true').map(element=>element.getAttribute('aria-label')),interactions:[...document.querySelectorAll('[data-interaction]')].map(element=>element.dataset.interaction)}
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root=metrics["root"] as! [String:Double],header=metrics["header"] as! [String:Double],track=metrics["track"] as! [String:Double],progress=metrics["progress"] as! [String:Double],title=metrics["title"] as! [String:Double],description=metrics["description"] as! [String:Double],counter=metrics["counter"] as! [String:Double],chips=metrics["chips"] as! [String:Double],first=metrics["first"] as! [String:Double],primary=metrics["primary"] as! [String:Double],safes=metrics["safes"] as! [Double],text=metrics["text"] as! [String:Any],choices=metrics["choices"] as! [String],selected=metrics["selected"] as! [String],interactions=metrics["interactions"] as! [String],scale=root["width"]!/393
            XCTAssertEqual(safes[0],Double(host.view.safeAreaInsets.top),accuracy:1); XCTAssertEqual(safes[1],Double(host.view.safeAreaInsets.bottom),accuracy:1); XCTAssertEqual(header["y"]!,safes[0]+4*scale,accuracy:1); XCTAssertEqual(track["height"]!,6*scale,accuracy:1); XCTAssertEqual(progress["width"]!/track["width"]!,0.62,accuracy:0.003); XCTAssertEqual(title["y"]!,safes[0]+70*scale,accuracy:1.5); XCTAssertEqual(description["y"]!-title["bottom"]!,10*scale,accuracy:1); XCTAssertEqual(counter["y"]!-description["bottom"]!,16*scale,accuracy:1); XCTAssertEqual(chips["y"]!-counter["bottom"]!,12*scale,accuracy:1); XCTAssertEqual(first["height"]!,50*scale,accuracy:1); XCTAssertEqual(primary["height"]!,60*scale,accuracy:1); XCTAssertEqual(primary["bottom"]!,root["height"]!-safes[1]-34*scale,accuracy:2)
            XCTAssertEqual(text["step"] as? String,"5 / 8"); XCTAssertEqual(text["title"] as? String,"What are you into?"); XCTAssertEqual(text["description"] as? String,"Pick at least three. They help us suggest people and events."); XCTAssertEqual(text["counter"] as? String,"3 of 3 minimum"); XCTAssertEqual(text["primary"] as? String,"Continue"); XCTAssertEqual(choices,["Photography","Coffee","Live Music","Sports","Gaming","Travel","Art","Films","Books","Volunteering","Study Groups","Food","Fitness","Hiking","Cooking","Dance","K-pop"]); XCTAssertEqual(selected,["Photography","Coffee","Live Music"]); for id in ["obInterests.goBack.click.1","obInterests.o.pick.click.1","obInterests.goObGoal.click.1"] { XCTAssertTrue(interactions.contains(id),"Missing \(id)") }
            let defaultShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); defaultShot.name="WKWebView Onboarding Interests default"; defaultShot.lifetime = .keepAlways; add(defaultShot); print("CIMOA_ONBOARDING_INTERESTS_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")

            stage = "empty disabled gate"
            _ = try await script(host,"const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),data=envelope.data,user=data.users.find(row=>row.user_id===data.session.current_user_id);user.interest_ids=[];localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingInterests=empty#/pages/onboarding/interests")!)); try await waitFor(host,".onboarding-interests-page")
            let emptyBefore=try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as! String
            _ = try await script(host,"document.querySelector('[data-interaction=\"obInterests.goObGoal.click.1\"]').click();return true"); try await Task.sleep(nanoseconds:650_000_000)
            let empty=try await script(host,"return {counter:document.querySelector('.interests-counter').textContent.trim(),disabled:document.querySelector('[data-interaction=\"obInterests.goObGoal.click.1\"]').getAttribute('aria-disabled'),state:localStorage.getItem('cimoa_app_state_v2'),loading:!!document.querySelector('.loading'),goal:!!document.querySelector('.onboarding-goal-page')}") as! [String:Any]
            XCTAssertEqual(empty["counter"] as? String,"0 of 3 minimum"); XCTAssertEqual(empty["disabled"] as? String,"true"); XCTAssertEqual(empty["state"] as? String,emptyBefore); XCTAssertEqual(empty["loading"] as? Bool,false); XCTAssertEqual(empty["goal"] as? Bool,false)
            let emptyShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); emptyShot.name="WKWebView Onboarding Interests empty"; emptyShot.lifetime = .keepAlways; add(emptyShot)

            stage = "scroll and failure rollback"
            let scroll=try await script(host,"const area=[...document.querySelectorAll('.secondary-page-scroll .uni-scroll-view')].at(-1);area.scrollTop=area.scrollHeight;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const last=[...document.querySelectorAll('.interest-chips [role=checkbox]')].at(-1).getBoundingClientRect(),primary=document.querySelector('[data-interaction=\"obInterests.goObGoal.click.1\"]').getBoundingClientRect();return {lastTop:last.top,lastBottom:last.bottom,primaryTop:primary.top}") as! [String:Double]
            XCTAssertGreaterThan(scroll["lastBottom"]!,0); XCTAssertLessThan(scroll["lastTop"]!,scroll["primaryTop"]!)
            _ = try await script(host,"""
            const area=[...document.querySelectorAll('.secondary-page-scroll .uni-scroll-view')].at(-1);area.scrollTop=0;const pick=label=>[...document.querySelectorAll('.interest-chips [role=checkbox]')].find(element=>element.getAttribute('aria-label')===label).click();for(const label of ['Sports','Gaming','Travel'])pick(label);await Promise.resolve();await new Promise(resolve=>requestAnimationFrame(resolve));const action=document.querySelector('[data-interaction="obInterests.goObGoal.click.1"]');if(action.getAttribute('aria-disabled')!=='false')throw Error('Three-interest gate stayed disabled');window.__interestsBefore=localStorage.getItem('cimoa_app_state_v2');const original=Storage.prototype.setItem;window.__restoreOnboardingInterestsStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')throw new DOMException('Injected interests storage failure','QuotaExceededError');return original.call(this,key,value)};action.click();return true
            """); try await waitFor(host,".loading"); try await waitFor(host,".onboarding-interests-page [role=alert]")
            let failed=try await script(host,"const rows=[...document.querySelectorAll('.interest-chips [role=checkbox]')],result={message:document.querySelector('.onboarding-interests-page [role=alert]').textContent,state:localStorage.getItem('cimoa_app_state_v2'),selected:rows.filter(element=>element.getAttribute('aria-checked')==='true').map(element=>element.getAttribute('aria-label')),goal:!!document.querySelector('.onboarding-goal-page')};window.__restoreOnboardingInterestsStorage();return result") as! [String:Any]
            XCTAssertTrue((failed["message"] as? String)?.contains("Injected interests storage failure") == true); XCTAssertEqual(failed["state"] as? String,emptyBefore); XCTAssertEqual(failed["selected"] as? [String],["Sports","Gaming","Travel"]); XCTAssertEqual(failed["goal"] as? Bool,false)
            let failureShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); failureShot.name="WKWebView Onboarding Interests failure"; failureShot.lifetime = .keepAlways; add(failureShot)

            stage = "atomic interests persistence"
            _ = try await script(host,"window.__interestsWrites=0;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')window.__interestsWrites++;return original.call(this,key,value)};const action=document.querySelector('[data-interaction=\"obInterests.goObGoal.click.1\"]');action.click();action.click();return true"); try await waitFor(host,".loading"); let unchanged=try await script(host,"return localStorage.getItem('cimoa_app_state_v2')===window.__interestsBefore") as? Bool; XCTAssertEqual(unchanged,true); try await waitFor(host,".onboarding-goal-page")
            let committed=try await script(host,"const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);return {step:account.onboarding.step,ids:[...user.interest_ids].sort(),labels:user.interest_ids.map(id=>data.interests.find(row=>row.item_id===id).label).sort(),writes:window.__interestsWrites}") as! [String:Any]
            XCTAssertEqual(committed["step"] as? String,"goal"); XCTAssertEqual(committed["ids"] as? [String],["gaming","sports","travel"]); XCTAssertEqual(committed["labels"] as? [String],["Gaming","Sports","Travel"]); XCTAssertEqual(committed["writes"] as? Int,1)
            try await restore()
        } catch { XCTFail("Onboarding Interests WKWebView stage \(stage) failed: \(error)"); _ = try? await script(host,"window.__restoreOnboardingInterestsStorage?.();return true"); try? await restore(); throw error }
    }
    func testOnboardingGoalPixelRestoration() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingGoal=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header,.onboarding-page,.welcome-page")
        }
        var stage = "prepare goal account"
        do {
            _ = try await script(host, """
            const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),data=envelope.data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);account.auth_provider='local';account.local_verification={method:'fixed_code',status:'verified',verified_at:Date.now()};account.date_of_birth='2000-01-01';account.onboarding={step:'goal',completed_steps:['basic','uni','major','photos','about','interests']};Object.assign(user,{user_name:'Ethan',age:26,gender:'Man',pronouns:'he / him',university:'HKUST',year:'Year 3',major:'Computer Science',graduation_year:'2027',bio:'Campus walks, coffee and new conversations.',interest_ids:['photography','coffee','music'],goal_ids:[],onboarding_status:'in_progress',verification_status:'pending'});data.auth_flow.pending_registration_account_id=account.account_id;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true
            """)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingGoal=native#/pages/onboarding/goal")!))
            try await waitFor(host, ".onboarding-goal-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},root=box('.onboarding-goal-page'),header=box('.onboarding-header'),track=box('.onboarding-track'),progress=box('.onboarding-track>uni-view'),title=box('.onboarding-title'),description=box('.auth-description'),chips=box('.goal-chips'),first=box('.goal-chips [role=checkbox]'),primary=box('[data-interaction="obGoal.goObIce.click.1"]'),safes=[...document.querySelectorAll('.onboarding-goal-page>.safe-area')].map(element=>element.getBoundingClientRect().height),rows=[...document.querySelectorAll('.goal-chips [role=checkbox]')];return {root,header,track,progress,title,description,chips,first,primary,safes,text:{step:document.querySelector('.onboarding-step').textContent.trim(),title:document.querySelector('.onboarding-title').textContent,description:document.querySelector('.auth-description').textContent,primary:document.querySelector('[data-interaction="obGoal.goObIce.click.1"]').textContent.trim()},choices:rows.map(element=>element.getAttribute('aria-label')),selected:rows.filter(element=>element.getAttribute('aria-checked')==='true').map(element=>element.getAttribute('aria-label')),disabled:document.querySelector('[data-interaction="obGoal.goObIce.click.1"]').getAttribute('aria-disabled'),interactions:[...document.querySelectorAll('[data-interaction]')].map(element=>element.dataset.interaction)}
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root=metrics["root"] as! [String:Double],header=metrics["header"] as! [String:Double],track=metrics["track"] as! [String:Double],progress=metrics["progress"] as! [String:Double],title=metrics["title"] as! [String:Double],description=metrics["description"] as! [String:Double],chips=metrics["chips"] as! [String:Double],first=metrics["first"] as! [String:Double],primary=metrics["primary"] as! [String:Double],safes=metrics["safes"] as! [Double],text=metrics["text"] as! [String:Any],choices=metrics["choices"] as! [String],selected=metrics["selected"] as! [String],interactions=metrics["interactions"] as! [String],scale=root["width"]!/393
            XCTAssertEqual(safes[0],Double(host.view.safeAreaInsets.top),accuracy:1); XCTAssertEqual(safes[1],Double(host.view.safeAreaInsets.bottom),accuracy:1); XCTAssertEqual(header["y"]!,safes[0]+4*scale,accuracy:1); XCTAssertEqual(track["height"]!,6*scale,accuracy:1); XCTAssertEqual(progress["width"]!/track["width"]!,0.72,accuracy:0.003); XCTAssertEqual(title["y"]!,safes[0]+70*scale,accuracy:1.5); XCTAssertEqual(description["y"]!-title["bottom"]!,10*scale,accuracy:1); XCTAssertEqual(chips["y"]!-description["bottom"]!,18*scale,accuracy:1); XCTAssertEqual(first["height"]!,50*scale,accuracy:1); XCTAssertEqual(primary["height"]!,60*scale,accuracy:1); XCTAssertEqual(primary["bottom"]!,root["height"]!-safes[1]-30*scale,accuracy:2)
            XCTAssertEqual(text["step"] as? String,"6 / 8"); XCTAssertEqual(text["title"] as? String,"What are you here for?"); XCTAssertEqual(text["description"] as? String,"Choose as many as you like. You can update this anytime."); XCTAssertEqual(text["primary"] as? String,"Continue"); XCTAssertEqual(choices,["New Friends","Study Partners","Activity Buddies","Campus Events","Meaningful Conversations","Language Exchange","Gym & Sports","Coffee Chats","Project Teammates","Music & Gigs","Food Explorers","Travel Buddies","Gaming","Career Networking","Dating"]); XCTAssertEqual(selected,[]); XCTAssertEqual(metrics["disabled"] as? String,"true"); for id in ["obGoal.goBack.click.1","obGoal.o.pick.click.1","obGoal.goObIce.click.1"] { XCTAssertTrue(interactions.contains(id),"Missing \(id)") }
            let defaultShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); defaultShot.name="WKWebView Onboarding Goal default"; defaultShot.lifetime = .keepAlways; add(defaultShot); print("CIMOA_ONBOARDING_GOAL_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")

            stage = "empty disabled gate"
            let emptyBefore=try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as! String
            _ = try await script(host,"document.querySelector('[data-interaction=\"obGoal.goObIce.click.1\"]').click();return true"); try await Task.sleep(nanoseconds:650_000_000)
            let empty=try await script(host,"return {state:localStorage.getItem('cimoa_app_state_v2'),loading:!!document.querySelector('.loading'),ice:!!document.querySelector('.onboarding-ice-page')}") as! [String:Any]
            XCTAssertEqual(empty["state"] as? String,emptyBefore); XCTAssertEqual(empty["loading"] as? Bool,false); XCTAssertEqual(empty["ice"] as? Bool,false)

            stage = "scroll and failure rollback"
            let scroll=try await script(host,"const area=[...document.querySelectorAll('.secondary-page-scroll .uni-scroll-view')].at(-1);area.scrollTop=area.scrollHeight;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const last=[...document.querySelectorAll('.goal-chips [role=checkbox]')].at(-1).getBoundingClientRect(),primary=document.querySelector('[data-interaction=\"obGoal.goObIce.click.1\"]').getBoundingClientRect();return {lastTop:last.top,lastBottom:last.bottom,primaryTop:primary.top}") as! [String:Double]
            XCTAssertGreaterThan(scroll["lastBottom"]!,0); XCTAssertLessThan(scroll["lastTop"]!,scroll["primaryTop"]!)
            _ = try await script(host,"""
            const area=[...document.querySelectorAll('.secondary-page-scroll .uni-scroll-view')].at(-1);area.scrollTop=0;const row=[...document.querySelectorAll('.goal-chips [role=checkbox]')].find(element=>element.getAttribute('aria-label')==='Campus Events');row.click();await Promise.resolve();await new Promise(resolve=>requestAnimationFrame(resolve));const action=document.querySelector('[data-interaction="obGoal.goObIce.click.1"]');if(action.getAttribute('aria-disabled')!=='false')throw Error('Goal gate stayed disabled');window.__goalBefore=localStorage.getItem('cimoa_app_state_v2');window.__goalOriginalSetItem=Storage.prototype.setItem;window.__restoreOnboardingGoalStorage=()=>{Storage.prototype.setItem=window.__goalOriginalSetItem;delete window.__goalOriginalSetItem};return true
            """)
            let selectedShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); selectedShot.name="WKWebView Onboarding Goal selected"; selectedShot.lifetime = .keepAlways; add(selectedShot)
            _ = try await script(host,"Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')throw new DOMException('Injected goal storage failure','QuotaExceededError');return window.__goalOriginalSetItem.call(this,key,value)};document.querySelector('[data-interaction=\"obGoal.goObIce.click.1\"]').click();return true")
            try await waitFor(host,".loading"); try await waitFor(host,".onboarding-goal-page [role=alert]")
            let failed=try await script(host,"const rows=[...document.querySelectorAll('.goal-chips [role=checkbox]')],result={message:document.querySelector('.onboarding-goal-page [role=alert]').textContent,state:localStorage.getItem('cimoa_app_state_v2'),selected:rows.filter(element=>element.getAttribute('aria-checked')==='true').map(element=>element.getAttribute('aria-label')),ice:!!document.querySelector('.onboarding-ice-page')};window.__restoreOnboardingGoalStorage();return result") as! [String:Any]
            XCTAssertTrue((failed["message"] as? String)?.contains("Injected goal storage failure") == true); XCTAssertEqual(failed["state"] as? String,emptyBefore); XCTAssertEqual(failed["selected"] as? [String],["Campus Events"]); XCTAssertEqual(failed["ice"] as? Bool,false)
            let failureShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); failureShot.name="WKWebView Onboarding Goal failure"; failureShot.lifetime = .keepAlways; add(failureShot)

            stage = "atomic goal persistence"
            _ = try await script(host,"window.__goalWrites=0;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')window.__goalWrites++;return original.call(this,key,value)};const action=document.querySelector('[data-interaction=\"obGoal.goObIce.click.1\"]');action.click();action.click();return true"); try await waitFor(host,".loading"); let unchanged=try await script(host,"return localStorage.getItem('cimoa_app_state_v2')===window.__goalBefore") as? Bool; XCTAssertEqual(unchanged,true); try await waitFor(host,".onboarding-ice-page")
            let committed=try await script(host,"const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);return {step:account.onboarding.step,ids:user.goal_ids,metadata:data.goals.some(row=>row.item_id==='campus'&&row.label==='Campus Events'),writes:window.__goalWrites}") as! [String:Any]
            XCTAssertEqual(committed["step"] as? String,"ice"); XCTAssertEqual(committed["ids"] as? [String],["campus"]); XCTAssertEqual(committed["metadata"] as? Bool,true); XCTAssertEqual(committed["writes"] as? Int,1)
            try await restore()
        } catch { XCTFail("Onboarding Goal WKWebView stage \(stage) failed: \(error)"); _ = try? await script(host,"window.__restoreOnboardingGoalStorage?.();return true"); try? await restore(); throw error }
    }
    func testOnboardingIcePixelRestoration() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingIce=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header,.onboarding-page,.welcome-page")
        }
        func loadIce(_ suffix: String) async throws {
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingIce=\(suffix)#/pages/onboarding/ice")!))
            try await waitFor(host, ".onboarding-ice-page")
            try await Task.sleep(nanoseconds: 300_000_000)
        }
        var stage = "prepare ice account"
        do {
            _ = try await script(host, """
            const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),data=envelope.data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);account.status='active';account.auth_provider='local';account.local_verification={method:'fixed_code',status:'verified',verified_at:Date.now()};account.date_of_birth='2000-01-01';account.onboarding={step:'ice',completed_steps:['basic','uni','major','photos','about','interests','goal']};Object.assign(user,{user_name:'Ethan',age:26,gender:'Man',pronouns:'he / him',university:'HKUST',year:'Year 3',major:'Computer Science',graduation_year:'2027',bio:'Campus walks, coffee and new conversations.',interest_ids:['photography','coffee','music'],goal_ids:['friends'],icebreaker_ids:[],onboarding_status:'in_progress',verification_status:'pending',deleted:false});data.session={account_id:account.account_id,current_user_id:user.user_id,expires_at:Date.now()+30*86400000};data.requests=data.requests.filter(row=>row.recipient_id!==user.user_id);data.icebreakers=data.icebreakers.filter(row=>row.user_id!==user.user_id);data.auth_flow.pending_registration_account_id=account.account_id;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true
            """)
            try await loadIce("native")
            let prepared = try await script(host, "return {questions:document.querySelectorAll('.ice-question').length,access:document.querySelector('.onboarding-ice-page [role=alert]')?.textContent||'',step:JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.accounts.find(row=>row.account_id===JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.session.account_id)?.onboarding?.step,selectors:['.onboarding-header','.onboarding-track','.onboarding-track>uni-view','.auth-heading','.auth-description','.ice-list','.ice-question','.ice-browse','[data-interaction=\"obIce.goObNotif.click.1\"]'].map(selector=>[selector,!!document.querySelector(selector)])}") as! [String:Any]
            XCTAssertEqual(prepared["questions"] as? Int,3,"Ice preparation failed: \(prepared)"); XCTAssertEqual(prepared["access"] as? String,""); XCTAssertEqual(prepared["step"] as? String,"ice")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},root=box('.onboarding-ice-page'),header=box('.onboarding-header'),track=box('.onboarding-track'),progress=box('.onboarding-track>uni-view'),title=box('.auth-heading'),description=box('.auth-description'),list=box('.ice-list'),first=box('.ice-question'),browse=box('.ice-browse'),primary=box('[data-interaction="obIce.goObNotif.click.1"]'),safes=[...document.querySelectorAll('.onboarding-ice-page>.safe-area')].map(element=>element.getBoundingClientRect().height),rows=[...document.querySelectorAll('.ice-question')];return {root,header,track,progress,title,description,list,first,browse,primary,safes,text:{progress:document.querySelector('.ice-progress').textContent.trim(),title:document.querySelector('.auth-heading').textContent,description:document.querySelector('.auth-description').textContent,browse:document.querySelector('.ice-browse').textContent.trim(),custom:document.querySelector('.ice-custom').textContent.trim(),primary:document.querySelector('[data-interaction="obIce.goObNotif.click.1"]').textContent.trim()},questions:rows.map(element=>element.innerText.trim()),disabled:document.querySelector('[data-interaction="obIce.goObNotif.click.1"]').getAttribute('aria-disabled'),interactions:[...document.querySelectorAll('[data-interaction]')].map(element=>element.dataset.interaction)}
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root=metrics["root"] as! [String:Double],header=metrics["header"] as! [String:Double],track=metrics["track"] as! [String:Double],progress=metrics["progress"] as! [String:Double],title=metrics["title"] as! [String:Double],description=metrics["description"] as! [String:Double],list=metrics["list"] as! [String:Double],first=metrics["first"] as! [String:Double],browse=metrics["browse"] as! [String:Double],primary=metrics["primary"] as! [String:Double],safes=metrics["safes"] as! [Double],text=metrics["text"] as! [String:Any],questions=metrics["questions"] as! [String],interactions=metrics["interactions"] as! [String],scale=root["width"]!/393
            XCTAssertEqual(safes[0],Double(host.view.safeAreaInsets.top),accuracy:1); XCTAssertEqual(safes[1],Double(host.view.safeAreaInsets.bottom),accuracy:1); XCTAssertEqual(header["y"]!,safes[0]+4*scale,accuracy:1); XCTAssertEqual(track["y"]!,safes[0]+33*scale,accuracy:1.5); XCTAssertEqual(track["height"]!,6*scale,accuracy:1); XCTAssertEqual(progress["width"]!/track["width"]!,0.82,accuracy:0.003); XCTAssertEqual(title["y"]!,safes[0]+92*scale,accuracy:1.5); XCTAssertEqual(description["y"]!-title["bottom"]!,10*scale,accuracy:1); XCTAssertEqual(list["y"]!-description["bottom"]!,22*scale,accuracy:1); XCTAssertEqual(first["height"]!,76*scale,accuracy:1); XCTAssertEqual(browse["height"]!,58*scale,accuracy:1); XCTAssertEqual(primary["height"]!,60*scale,accuracy:1); XCTAssertEqual(primary["bottom"]!,root["height"]!-safes[1]-34*scale,accuracy:2)
            XCTAssertEqual(text["progress"] as? String,"Profile setup · 6 of 7"); XCTAssertEqual(text["title"] as? String,"Your icebreakers"); XCTAssertEqual(text["description"] as? String,"Choose three questions people can answer when they say hi."); XCTAssertEqual(text["browse"] as? String,"Browse more questions"); XCTAssertEqual(text["custom"] as? String,"Write my own"); XCTAssertEqual(text["primary"] as? String,"Continue"); XCTAssertEqual(questions,["1\nChoose a question","2\nChoose a question","3\nChoose a question"]); XCTAssertEqual(metrics["disabled"] as? String,"true"); for id in ["obIce.goBack.click.1","obIce.e.tap.click.1","obIce.browseQuestions.click.1","obIce.writeOwnQuestion.click.1","obIce.goObNotif.click.1"] { XCTAssertTrue(interactions.contains(id),"Missing \(id)") }
            let emptyShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); emptyShot.name="WKWebView Onboarding Ice empty"; emptyShot.lifetime = .keepAlways; add(emptyShot); print("CIMOA_ONBOARDING_ICE_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")

            stage = "back ownership"
            let beforeBack=try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as! String
            _ = try await script(host,"document.querySelector('[data-interaction=\"obIce.goBack.click.1\"]').click();return true"); try await waitFor(host,".onboarding-goal-page")
            let afterBack=try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as? String
            XCTAssertEqual(afterBack,beforeBack); try await loadIce("back-return")

            stage = "library and custom sheets"
            _ = try await script(host,"document.querySelector('[data-interaction=\"obIce.browseQuestions.click.1\"]').click();return true"); try await waitFor(host,".ice-library.event-dialog--open"); try await Task.sleep(nanoseconds: 400_000_000)
            let library=try await script(host,"const root=document.querySelector('.onboarding-ice-page').getBoundingClientRect(),panel=document.querySelector('.ice-library .event-dialog-panel').getBoundingClientRect();return {rootWidth:root.width,panelY:panel.y,rows:[...document.querySelectorAll('.library-question')].map(row=>row.textContent.trim()),done:[...document.querySelectorAll('[role=button]')].some(row=>row.textContent.trim()==='Done'),close:document.querySelector('.ice-library .event-dialog-mask').dataset.interaction}") as! [String:Any]
            let nativeScale=(library["rootWidth"] as! Double)/393; XCTAssertEqual(library["panelY"] as! Double,Double(host.view.safeAreaInsets.top)+66*nativeScale,accuracy:2); XCTAssertEqual(library["rows"] as? [String],["What’s your ideal Sunday?","Which song is on repeat?","Best hidden spot on campus?","What could you talk about for hours?","What’s one thing you want to try this semester?","Coffee, tea, or something else?"]); XCTAssertEqual(library["done"] as? Bool,false); XCTAssertEqual(library["close"] as? String,"sheetIceLibrary.closeSheet.click.1")
            _ = try await script(host,"const rows=[...document.querySelectorAll('.library-question')];rows[0].click();rows[1].click();rows[2].click();rows[3].click();return true"); try await waitFor(host,".ice-library [role=alert]")
            let libraryShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); libraryShot.name="WKWebView Onboarding Ice library"; libraryShot.lifetime = .keepAlways; add(libraryShot)
            _ = try await script(host,"document.querySelector('.ice-library .event-dialog-mask').click();return true"); try await waitFor(host,".ice-library:not(.event-dialog--open)")
            _ = try await script(host,"document.querySelector('[aria-label=\"Remove question 3\"]').click();document.querySelector('[data-interaction=\"obIce.writeOwnQuestion.click.1\"]').click();return true"); try await waitFor(host,".ice-custom-sheet.event-dialog--open"); try await Task.sleep(nanoseconds: 400_000_000)
            _ = try await script(host,"const input=document.querySelector('.custom-question-box input'),set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'What is your password?');input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,80));document.querySelector('[data-interaction=\"sheetIceCustom.addCustom.click.1\"]').click();return true"); try await waitFor(host,".ice-custom-sheet [role=alert]")
            let unsafeMessage=try await script(host,"return document.querySelector('.ice-custom-sheet [role=alert]').textContent") as? String
            XCTAssertEqual(unsafeMessage,"That question can’t be used — keep it safe and non-personal.")
            _ = try await script(host,"const input=document.querySelector('.custom-question-box input'),set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'Where would you explore on campus?');input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,80));document.querySelector('[data-interaction=\"sheetIceCustom.addCustom.click.1\"]').click();return true"); try await waitFor(host,".ice-custom-sheet [role=status]"); try await Task.sleep(nanoseconds: 200_000_000)
            let customState=try await script(host,"return {notice:document.querySelector('.ice-custom-sheet [role=status]').textContent,input:document.querySelector('.custom-question-box input').value,cancel:[...document.querySelectorAll('[role=button]')].some(row=>row.textContent.trim()==='Cancel')}") as! [String:Any]
            XCTAssertEqual(customState["notice"] as? String,"Question added · checked automatically"); XCTAssertEqual(customState["input"] as? String,""); XCTAssertEqual(customState["cancel"] as? Bool,false)
            let customShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); customShot.name="WKWebView Onboarding Ice custom"; customShot.lifetime = .keepAlways; add(customShot)
            _ = try await script(host,"document.querySelector('.ice-custom-sheet .event-dialog-mask').click();return true"); try await waitFor(host,".ice-custom-sheet:not(.event-dialog--open)"); try await Task.sleep(nanoseconds: 400_000_000)
            let completed=try await script(host,"return {questions:[...document.querySelectorAll('.ice-question:not(.ice-empty) .ice-text')].map(row=>row.textContent),arrow:!!document.querySelector('.ice-continue-arrow'),disabled:document.querySelector('[data-interaction=\"obIce.goObNotif.click.1\"]').getAttribute('aria-disabled')}") as! [String:Any]
            XCTAssertEqual(completed["questions"] as? [String],["What’s your ideal Sunday?","Which song is on repeat?","Where would you explore on campus?"]); XCTAssertEqual(completed["arrow"] as? Bool,true); XCTAssertEqual(completed["disabled"] as? String,"false")
            let completedShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); completedShot.name="WKWebView Onboarding Ice completed"; completedShot.lifetime = .keepAlways; add(completedShot)

            stage = "failure rollback and atomic persistence"
            _ = try await script(host,"window.__iceBefore=localStorage.getItem('cimoa_app_state_v2');window.__iceOriginalSetItem=Storage.prototype.setItem;window.__restoreOnboardingIceStorage=()=>{Storage.prototype.setItem=window.__iceOriginalSetItem;delete window.__iceOriginalSetItem};Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')throw new DOMException('Injected ice storage failure','QuotaExceededError');return window.__iceOriginalSetItem.call(this,key,value)};document.querySelector('[data-interaction=\"obIce.goObNotif.click.1\"]').click();return true"); try await waitFor(host,".loading"); try await waitFor(host,".onboarding-ice-page [role=alert]")
            let failed=try await script(host,"const result={message:document.querySelector('.onboarding-ice-page [role=alert]').textContent,state:localStorage.getItem('cimoa_app_state_v2'),count:document.querySelectorAll('.ice-question:not(.ice-empty)').length,notif:!!document.querySelector('.onboarding-notif-page')};window.__restoreOnboardingIceStorage();return result") as! [String:Any]
            XCTAssertTrue((failed["message"] as? String)?.contains("Injected ice storage failure") == true); XCTAssertEqual(failed["state"] as? String,beforeBack); XCTAssertEqual(failed["count"] as? Int,3); XCTAssertEqual(failed["notif"] as? Bool,false)
            let failureShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); failureShot.name="WKWebView Onboarding Ice failure"; failureShot.lifetime = .keepAlways; add(failureShot)
            _ = try await script(host,"window.__iceWrites=0;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')window.__iceWrites++;return original.call(this,key,value)};const action=document.querySelector('[data-interaction=\"obIce.goObNotif.click.1\"]');action.click();action.click();return true"); try await waitFor(host,".loading"); let unchanged=try await script(host,"return localStorage.getItem('cimoa_app_state_v2')===window.__iceBefore") as? Bool; XCTAssertEqual(unchanged,true); try await waitFor(host,".onboarding-notif-page")
            let committed=try await script(host,"const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);return {step:account.onboarding.step,questions:user.icebreaker_ids.map(id=>data.icebreakers.find(row=>row.question_id===id).text),writes:window.__iceWrites}") as! [String:Any]
            XCTAssertEqual(committed["step"] as? String,"notif"); XCTAssertEqual(committed["questions"] as? [String],["What’s your ideal Sunday?","Which song is on repeat?","Where would you explore on campus?"]); XCTAssertEqual(committed["writes"] as? Int,1)
            try await restore()
        } catch { XCTFail("Onboarding Ice WKWebView stage \(stage) failed: \(error)"); _ = try? await script(host,"window.__restoreOnboardingIceStorage?.();return true"); try? await restore(); throw error }
    }
    func testOnboardingNotificationsPixelRestoration() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingNotif=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header,.onboarding-page,.welcome-page")
        }
        func loadNotifications(_ suffix: String) async throws {
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingNotif=\(suffix)#/pages/onboarding/notif")!))
            try await waitFor(host, ".onboarding-notif-page")
            try await Task.sleep(nanoseconds: 300_000_000)
        }
        var stage = "prepare notifications account"
        do {
            _ = try await script(host, """
            const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),data=envelope.data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);account.status='active';account.auth_provider='local';account.local_verification={method:'fixed_code',status:'verified',verified_at:Date.now()};account.onboarding={step:'notif',completed_steps:['basic','uni','major','photos','about','interests','goal','ice']};user.onboarding_status='in_progress';data.auth_flow.pending_registration_account_id=account.account_id;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true
            """)
            try await loadNotifications("native")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},root=box('.onboarding-notif-page'),icon=box('.notice-icon'),title=box('.notice-title'),copy=box('.notice-copy'),footer=box('.notice-footer'),primary=box('[data-interaction="obNotif.enableNotifs.click.1"]'),secondary=box('[data-interaction="obNotif.skipNotifs.click.1"]'),safes=[...document.querySelectorAll('.onboarding-notif-page>.safe-area')].map(element=>element.getBoundingClientRect().height);return {root,icon,title,copy,footer,primary,secondary,safes,text:{title:document.querySelector('.notice-title').textContent,copy:document.querySelector('.notice-copy').textContent,primary:document.querySelector('[data-interaction="obNotif.enableNotifs.click.1"]').textContent.trim(),secondary:document.querySelector('[data-interaction="obNotif.skipNotifs.click.1"]').textContent.trim()},interactions:[...document.querySelectorAll('[data-interaction]')].map(element=>element.dataset.interaction),note:!!document.querySelector('.notice-note')}
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root=metrics["root"] as! [String:Double],icon=metrics["icon"] as! [String:Double],title=metrics["title"] as! [String:Double],copy=metrics["copy"] as! [String:Double],primary=metrics["primary"] as! [String:Double],secondary=metrics["secondary"] as! [String:Double],safes=metrics["safes"] as! [Double],text=metrics["text"] as! [String:String],interactions=metrics["interactions"] as! [String],scale=root["width"]!/393
            XCTAssertEqual(safes[0],Double(host.view.safeAreaInsets.top),accuracy:1); XCTAssertEqual(safes[1],Double(host.view.safeAreaInsets.bottom),accuracy:1)
            XCTAssertEqual(icon["y"]!,safes[0]+132*scale,accuracy:2); XCTAssertEqual(icon["width"]!,92*scale,accuracy:1); XCTAssertEqual(icon["height"]!,92*scale,accuracy:1)
            XCTAssertEqual(title["y"]!-icon["bottom"]!,16*scale,accuracy:1); XCTAssertEqual(copy["y"]!-title["bottom"]!,16*scale,accuracy:1)
            XCTAssertEqual(primary["height"]!,60*scale,accuracy:1); XCTAssertEqual(secondary["height"]!,46*scale,accuracy:1); XCTAssertEqual(secondary["bottom"]!,root["height"]!-safes[1]-30*scale,accuracy:2)
            XCTAssertEqual(text["title"],"Stay in the loop"); XCTAssertEqual(text["copy"],"Get notified when someone accepts your introduction, when an Auto Match is ready, or when an event is about to start."); XCTAssertEqual(text["primary"],"Enable Notifications"); XCTAssertEqual(text["secondary"],"Not Now")
            XCTAssertEqual(interactions,["obNotif.enableNotifs.click.1","obNotif.skipNotifs.click.1"]); XCTAssertEqual(metrics["note"] as? Bool,false)
            let defaultShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); defaultShot.name="WKWebView Onboarding Notifications default"; defaultShot.lifetime = .keepAlways; add(defaultShot); print("CIMOA_ONBOARDING_NOTIF_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")

            stage = "permission boundary and return ownership"
            let beforeForward=try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as! String
            _ = try await script(host,"const action=document.querySelector('[data-interaction=\"obNotif.enableNotifs.click.1\"]');action.click();action.click();return true"); try await waitFor(host,".permission-notif-page")
            let stateAfterForward = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as? String
            XCTAssertEqual(stateAfterForward,beforeForward)
            _ = try await script(host,"history.back();return true"); try await waitFor(host,".onboarding-notif-page")
            let stateAfterBack = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as? String
            XCTAssertEqual(stateAfterBack,beforeForward)

            stage = "failure rollback and atomic skip"
            _ = try await script(host,"window.__notifBefore=localStorage.getItem('cimoa_app_state_v2');window.__notifOriginalSetItem=Storage.prototype.setItem;window.__restoreOnboardingNotifStorage=()=>{Storage.prototype.setItem=window.__notifOriginalSetItem;delete window.__notifOriginalSetItem};Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')throw new DOMException('Injected notification storage failure','QuotaExceededError');return window.__notifOriginalSetItem.call(this,key,value)};document.querySelector('[data-interaction=\"obNotif.skipNotifs.click.1\"]').click();return true"); try await waitFor(host,".loading"); try await waitFor(host,".onboarding-notif-page [role=alert]")
            let failed=try await script(host,"const result={message:document.querySelector('.onboarding-notif-page [role=alert]').textContent,state:localStorage.getItem('cimoa_app_state_v2'),complete:!!document.querySelector('.onboarding-complete-page')};window.__restoreOnboardingNotifStorage();return result") as! [String:Any]
            XCTAssertTrue((failed["message"] as? String)?.contains("Injected notification storage failure") == true); XCTAssertEqual(failed["state"] as? String,beforeForward); XCTAssertEqual(failed["complete"] as? Bool,false)
            let failureShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); failureShot.name="WKWebView Onboarding Notifications failure"; failureShot.lifetime = .keepAlways; add(failureShot)
            _ = try await script(host,"window.__notifWrites=0;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')window.__notifWrites++;return original.call(this,key,value)};const action=document.querySelector('[data-interaction=\"obNotif.skipNotifs.click.1\"]');action.click();action.click();return true"); try await waitFor(host,".loading")
            let unchangedDuringLoading = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')===window.__notifBefore") as? Bool
            XCTAssertEqual(unchangedDuringLoading,true); try await waitFor(host,".onboarding-complete-page")
            let committed=try await script(host,"const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,account=data.accounts.find(row=>row.account_id===data.session.account_id),settings=data.settings.find(row=>row.owner_user_id===data.session.current_user_id);return {step:account.onboarding.step,permission:account.onboarding.notification_permission,master:settings.notifications.master,writes:window.__notifWrites}") as! [String:Any]
            XCTAssertEqual(committed["step"] as? String,"complete"); XCTAssertEqual(committed["permission"] as? String,"skipped"); XCTAssertEqual(committed["master"] as? Bool,false); XCTAssertEqual(committed["writes"] as? Int,1)
            try await restore()
        } catch { XCTFail("Onboarding Notifications WKWebView stage \(stage) failed: \(error)"); _ = try? await script(host,"window.__restoreOnboardingNotifStorage?.();return true"); try? await restore(); throw error }
    }
    func testNotificationPermissionPixelRestoration() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?permissionNotif=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header,.onboarding-page,.welcome-page")
        }
        var stage = "prepare notification permission"
        do {
            _ = try await script(host, """
            const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),data=envelope.data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);account.status='active';account.auth_provider='local';account.local_verification={method:'fixed_code',status:'verified',verified_at:Date.now()};account.onboarding={step:'notif',completed_steps:['basic','uni','major','photos','about','interests','goal','ice']};user.onboarding_status='in_progress';data.auth_flow.pending_registration_account_id=account.account_id;localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true
            """)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?permissionNotif=native#/pages/permissions/notif")!)); try await waitFor(host,".permission-notif-page"); try await Task.sleep(nanoseconds:350_000_000)
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},root=box('.permission-notif-page'),icon=box('.notice-icon'),title=box('.notice-title'),copy=box('.notice-copy'),primary=box('[data-interaction="permNotif.allowNotifs.click.1"]'),secondary=box('[data-interaction="permNotif.denyNotifs.click.1"]'),safes=[...document.querySelectorAll('.permission-notif-page>.safe-area')].map(element=>element.getBoundingClientRect().height);return {root,icon,title,copy,primary,secondary,safes,text:{title:document.querySelector('.notice-title').textContent,copy:document.querySelector('.notice-copy').textContent,primary:document.querySelector('[data-interaction="permNotif.allowNotifs.click.1"]').textContent.trim(),secondary:document.querySelector('[data-interaction="permNotif.denyNotifs.click.1"]').textContent.trim()},interactions:[...document.querySelectorAll('[data-interaction]')].map(element=>element.dataset.interaction),note:!!document.querySelector('.notice-note'),card:!!document.querySelector('.permission-error')}
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds:100_000_000)
            }
            let root=metrics["root"] as! [String:Double],icon=metrics["icon"] as! [String:Double],title=metrics["title"] as! [String:Double],copy=metrics["copy"] as! [String:Double],primary=metrics["primary"] as! [String:Double],secondary=metrics["secondary"] as! [String:Double],safes=metrics["safes"] as! [Double],text=metrics["text"] as! [String:String],interactions=metrics["interactions"] as! [String],scale=root["width"]!/393
            XCTAssertEqual(safes[0],Double(host.view.safeAreaInsets.top),accuracy:1); XCTAssertEqual(safes[1],Double(host.view.safeAreaInsets.bottom),accuracy:1); XCTAssertEqual(icon["y"]!,safes[0]+128*scale,accuracy:2); XCTAssertEqual(icon["width"]!,92*scale,accuracy:1); XCTAssertEqual(icon["height"]!,92*scale,accuracy:1); XCTAssertEqual(title["y"]!-icon["bottom"]!,16*scale,accuracy:1); XCTAssertEqual(copy["y"]!-title["bottom"]!,16*scale,accuracy:1); XCTAssertEqual(primary["height"]!,60*scale,accuracy:1); XCTAssertEqual(secondary["height"]!,46*scale,accuracy:1); XCTAssertEqual(secondary["bottom"]!,root["height"]!-safes[1]-30*scale,accuracy:2)
            XCTAssertEqual(text["title"],"Turn on notifications"); XCTAssertEqual(text["copy"],"Introductions, Auto Match results, and event reminders. Nothing promotional."); XCTAssertEqual(text["primary"],"Allow Notifications"); XCTAssertEqual(text["secondary"],"Don’t Allow"); XCTAssertEqual(metrics["note"] as? Bool,false)
            XCTAssertTrue(interactions.contains("permNotif.allowNotifs.click.1")); XCTAssertTrue(interactions.contains("permNotif.denyNotifs.click.1")); if metrics["card"] as? Bool == false { XCTAssertEqual(interactions,["permNotif.allowNotifs.click.1","permNotif.denyNotifs.click.1"]) }
            let defaultShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); defaultShot.name="WKWebView Notification Permission default"; defaultShot.lifetime = .keepAlways; add(defaultShot); print("CIMOA_PERMISSION_NOTIF_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")

            stage = "atomic decline"
            let before = try await script(host,"window.__permissionBefore=localStorage.getItem('cimoa_app_state_v2');window.__permissionWrites=0;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')window.__permissionWrites++;return original.call(this,key,value)};const action=document.querySelector('[data-interaction=\"permNotif.denyNotifs.click.1\"]');action.click();action.click();return window.__permissionBefore") as! String
            try await waitFor(host,".loading"); let unchanged = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')===window.__permissionBefore") as? Bool; XCTAssertEqual(unchanged,true); try await waitFor(host,".onboarding-complete-page")
            let committed=try await script(host,"const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,account=data.accounts.find(row=>row.account_id===data.session.account_id),settings=data.settings.find(row=>row.owner_user_id===data.session.current_user_id);return {step:account.onboarding.step,permission:account.onboarding.notification_permission,master:settings.notifications.master,writes:window.__permissionWrites,state:window.__permissionBefore}") as! [String:Any]
            XCTAssertEqual(committed["state"] as? String,before); XCTAssertEqual(committed["step"] as? String,"complete"); XCTAssertTrue(["skipped","denied","unavailable"].contains(committed["permission"] as? String ?? "")); XCTAssertEqual(committed["master"] as? Bool,false); XCTAssertEqual(committed["writes"] as? Int,1)
            try await restore()
        } catch { XCTFail("Notification Permission WKWebView stage \(stage) failed: \(error)"); try? await restore(); throw error }
    }
    func testOnboardingCompletePixelRestoration() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingComplete=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header,.onboarding-page,.welcome-page")
        }
        do {
            _ = try await script(host, """
            const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),data=envelope.data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);account.status='active';account.auth_provider='local';account.local_verification={method:'fixed_code',status:'verified',verified_at:Date.now()};account.onboarding={step:'complete',completed_steps:['basic','uni','major','photos','about','interests','goal','ice','notif'],completed_at:Date.now()};user.onboarding_status='complete';localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true
            """)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?onboardingComplete=native#/pages/onboarding/complete")!)); try await waitFor(host,".onboarding-complete-page"); try await Task.sleep(nanoseconds:300_000_000)
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom}},root=box('.onboarding-complete-page'),icon=box('.notice-icon'),title=box('.notice-title'),copy=box('.notice-copy'),primary=box('[data-interaction="obComplete.enterApp.click.1"]'),safes=[...document.querySelectorAll('.onboarding-complete-page>.safe-area')].map(element=>element.getBoundingClientRect().height);return {root,icon,title,copy,primary,safes,text:{title:document.querySelector('.notice-title').textContent,copy:document.querySelector('.notice-copy').textContent,primary:document.querySelector('[data-interaction="obComplete.enterApp.click.1"]').textContent.trim()},interactions:[...document.querySelectorAll('[data-interaction]')].map(element=>element.dataset.interaction),recovery:!!document.querySelector('.complete-recovery')}
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds:100_000_000)
            }
            let root=metrics["root"] as! [String:Double],icon=metrics["icon"] as! [String:Double],title=metrics["title"] as! [String:Double],copy=metrics["copy"] as! [String:Double],primary=metrics["primary"] as! [String:Double],safes=metrics["safes"] as! [Double],text=metrics["text"] as! [String:String],scale=root["width"]!/393
            XCTAssertEqual(safes[0],Double(host.view.safeAreaInsets.top),accuracy:1); XCTAssertEqual(safes[1],Double(host.view.safeAreaInsets.bottom),accuracy:1); XCTAssertEqual(icon["y"]!,safes[0]+152*scale,accuracy:2); XCTAssertEqual(icon["width"]!,96*scale,accuracy:1); XCTAssertEqual(icon["height"]!,96*scale,accuracy:1); XCTAssertEqual(title["y"]!-icon["bottom"]!,16*scale,accuracy:1); XCTAssertEqual(copy["y"]!-title["bottom"]!,16*scale,accuracy:1); XCTAssertEqual(copy["width"]!,290*scale,accuracy:2); XCTAssertEqual(primary["height"]!,60*scale,accuracy:1); XCTAssertEqual(primary["bottom"]!,root["height"]!-safes[1]-34*scale,accuracy:2)
            XCTAssertEqual(text["title"],"Your profile is ready"); XCTAssertEqual(text["copy"],"Say hi to someone, join the matching pool, or find an event happening this week."); XCTAssertEqual(text["primary"],"Explore Cimoa"); XCTAssertEqual(metrics["interactions"] as? [String],["obComplete.enterApp.click.1"]); XCTAssertEqual(metrics["recovery"] as? Bool,false)
            let defaultShot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); defaultShot.name="WKWebView Onboarding Complete default"; defaultShot.lifetime = .keepAlways; add(defaultShot); print("CIMOA_ONBOARDING_COMPLETE_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")
            let before=try await script(host,"window.__completeBefore=localStorage.getItem('cimoa_app_state_v2');const action=document.querySelector('[data-interaction=\"obComplete.enterApp.click.1\"]');action.click();action.click();return window.__completeBefore") as! String; try await waitFor(host,".home-header")
            let after=try await script(host,"return {state:localStorage.getItem('cimoa_app_state_v2'),depth:document.querySelector('.main-tab-frame').dataset.pageDepth}") as! [String:Any]
            XCTAssertEqual(after["state"] as? String,before); XCTAssertEqual(after["depth"] as? String,"1")
            try await restore()
        } catch { try? await restore(); throw error }
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
            // Older persisted catalogs may gain additive people on hydration.
            // Verification must preserve every existing person's identity, media,
            // social fields and student status, as well as session and ledger.
            let verified = try await script(host, "await Promise.all(document.querySelector('.verification-success-page .page-transition').getAnimations().map(a=>a.finished));await document.fonts.ready;const a=JSON.parse(window.__verificationBefore).data,b=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;return {verified:b.accounts.find(a=>a.account_id===b.session.account_id).local_verification.status,users:a.users.every(previous=>{const current=b.users.find(user=>user.user_id===previous.user_id);return current&&['user_name','age','avatar_url','university','major','mbti','bio','photo_ids','goal_ids','interest_ids','icebreaker_ids','verification_status'].every(key=>JSON.stringify(previous[key])===JSON.stringify(current[key]))}),session:JSON.stringify(a.session)===JSON.stringify(b.session),coins:JSON.stringify(a.coin_transactions)===JSON.stringify(b.coin_transactions),caption:document.querySelector('.verification-success-heading').textContent}") as! [String: Any]
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
    func testResetEmailPixelRestoration() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')")
        if saved is NSNull {
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?resetEmail=fixture#/pages/auth/welcome")!)); try await waitFor(host, ".welcome-page"); try await signIn(host)
        }
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("if(snapshot===null)localStorage.removeItem('cimoa_app_state_v2');else localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?resetEmail=restored#/pages/auth/welcome")!)); try await waitFor(host, ".welcome-page")
        }
        do {
            _ = try await script(host, "const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),account=envelope.data.accounts.find(row=>row.status==='active');account.email='reset.native@campus.edu';envelope.data.session={account_id:null,current_user_id:null,expires_at:null};envelope.data.auth_flow.password_reset=null;envelope.data.auth_flow.email='';localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?resetEmail=native#/pages/auth/reset/email")!)); try await waitFor(host, ".reset-email-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,bottom:rect.bottom}},root=box('.reset-email-page'),header=box('.auth-header'),back=box('.auth-back'),heading=box('.auth-heading'),description=box('.auth-description'),field=box('.auth-field'),input=box('.auth-input-box'),primary=box('[data-interaction="fpEmail.goFpCode.click.1"]'),safes=[...document.querySelectorAll('.reset-email-page>.safe-area')].map(element=>element.getBoundingClientRect().height);return {root,header,back,heading,description,field,input,primary,safes,text:{header:document.querySelector('.auth-header-title').textContent,heading:document.querySelector('.auth-heading').textContent,description:document.querySelector('.auth-description').textContent,label:document.querySelector('.auth-label').textContent,primary:document.querySelector('[data-interaction="fpEmail.goFpCode.click.1"]').textContent.trim()},interactions:[...document.querySelectorAll('.reset-email-page [data-interaction]')].map(element=>element.dataset.interaction),extraNote:!!document.querySelector('.auth-local-note')}
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root=metrics["root"] as! [String:Double],header=metrics["header"] as! [String:Double],back=metrics["back"] as! [String:Double],heading=metrics["heading"] as! [String:Double],description=metrics["description"] as! [String:Double],field=metrics["field"] as! [String:Double],input=metrics["input"] as! [String:Double],primary=metrics["primary"] as! [String:Double],safes=metrics["safes"] as! [Double],text=metrics["text"] as! [String:String],interactions=metrics["interactions"] as! [String],scale=root["width"]!/393
            XCTAssertEqual(safes[0],Double(host.view.safeAreaInsets.top),accuracy:1); XCTAssertEqual(safes[1],Double(host.view.safeAreaInsets.bottom),accuracy:1); XCTAssertEqual(header["y"]!,safes[0]+4*scale,accuracy:1); XCTAssertEqual(back["width"]!,46*scale,accuracy:1); XCTAssertEqual(heading["y"]!,safes[0]+68*scale,accuracy:1.5); XCTAssertEqual(description["y"]!-heading["bottom"]!,10*scale,accuracy:1); XCTAssertEqual(field["y"]!-description["bottom"]!,14*scale,accuracy:1); XCTAssertEqual(input["height"]!,56*scale,accuracy:1); XCTAssertEqual(primary["height"]!,60*scale,accuracy:1); XCTAssertEqual(primary["bottom"]!,root["height"]!-safes[1]-34*scale,accuracy:2)
            XCTAssertEqual(text["header"],"Reset password"); XCTAssertEqual(text["heading"],"Reset your password"); XCTAssertEqual(text["description"],"Enter the email for an active account saved on this device. No email will be sent."); XCTAssertEqual(text["label"],"Email"); XCTAssertEqual(text["primary"],"Continue"); XCTAssertEqual(metrics["extraNote"] as? Bool,false); for id in ["fpEmail.goBack.click.1","fpEmail.onEmail.change.1","fpEmail.goFpCode.click.1"] { XCTAssertTrue(interactions.contains(id)) }
            let shot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); shot.name="WKWebView Reset Email default"; shot.lifetime = .keepAlways; add(shot); print("CIMOA_RESET_EMAIL_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")
            let before=try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as! String
            _ = try await script(host,"const input=document.querySelector('uni-input[aria-label=\"Reset email\"] input'),set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'invalid');input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-interaction=\"fpEmail.goFpCode.click.1\"]').click();return true"); try await waitFor(host,".reset-email-page [role=alert]")
            let invalidState = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as? String
            XCTAssertEqual(invalidState,before)
            _ = try await script(host,"const input=document.querySelector('uni-input[aria-label=\"Reset email\"] input'),set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'reset.native@campus.edu');input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,100));document.querySelector('[data-interaction=\"fpEmail.goFpCode.click.1\"]').click();return true"); try await waitFor(host,".loading")
            let stateDuringLoading = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as? String
            XCTAssertEqual(stateDuringLoading,before); try await waitFor(host,".reset-code-page")
            let created=try await script(host,"const reset=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.auth_flow.password_reset;return {email:reset.email,verified:reset.verified_at}") as! [String:Any]
            XCTAssertEqual(created["email"] as? String,"reset.native@campus.edu"); XCTAssertTrue(created["verified"] is NSNull)
            try await restore()
        } catch { try? await restore(); throw error }
    }
    func testLegalTermsPixelRestoration() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')")
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("if(snapshot===null)localStorage.removeItem('cimoa_app_state_v2');else localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?legalTerms=restored#/pages/auth/welcome")!)); try await waitFor(host, ".welcome-page")
        }
        do {
            _ = try await script(host, "localStorage.removeItem('cimoa_app_state_v2');return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?legalTerms=native#/pages/legal/terms")!)); try await waitFor(host, ".legal-terms-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,bottom:rect.bottom}},root=box('.legal-terms-page'),header=box('.event-page-header'),back=box('.event-page-round'),scroll=box('.secondary-page-scroll'),updated=box('.legal-document-updated'),intro=box('.legal-document-intro'),card=box('.legal-document-card'),heading=box('.legal-document-heading'),copy=box('.legal-document-copy'),safes=[...document.querySelectorAll('.legal-terms-page>.safe-area')].map(element=>element.getBoundingClientRect().height),scrolls=[...document.querySelectorAll('.legal-terms-page .secondary-page-scroll .uni-scroll-view')];return {root,header,back,scroll,updated,intro,card,heading,copy,safes,text:{title:document.querySelector('.event-page-header-title').textContent,updated:document.querySelector('.legal-document-updated').textContent,intro:document.querySelector('.legal-document-intro').textContent,firstHeading:document.querySelector('.legal-document-heading').textContent,footer:document.querySelector('.legal-document-footer').textContent},sections:document.querySelectorAll('.legal-document-section').length,interactions:[...document.querySelectorAll('.legal-terms-page [data-interaction]')].map(element=>element.dataset.interaction),scrollable:scrolls.some(element=>element.scrollHeight>element.clientHeight),overflow:document.querySelector('.legal-document-card').scrollWidth>document.querySelector('.legal-document-card').clientWidth}
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root=metrics["root"] as! [String:Double],header=metrics["header"] as! [String:Double],back=metrics["back"] as! [String:Double],scroll=metrics["scroll"] as! [String:Double],updated=metrics["updated"] as! [String:Double],intro=metrics["intro"] as! [String:Double],card=metrics["card"] as! [String:Double],heading=metrics["heading"] as! [String:Double],copy=metrics["copy"] as! [String:Double],safes=metrics["safes"] as! [Double],text=metrics["text"] as! [String:String],interactions=metrics["interactions"] as! [String],scale=root["width"]!/393
            XCTAssertEqual(safes[0],Double(host.view.safeAreaInsets.top),accuracy:1); XCTAssertEqual(safes[1],Double(host.view.safeAreaInsets.bottom),accuracy:1); XCTAssertEqual(back["y"]!,safes[0]+4*scale,accuracy:1); XCTAssertEqual(back["width"]!,46*scale,accuracy:1); XCTAssertEqual(header["height"]!,64*scale,accuracy:1); XCTAssertEqual(scroll["y"]!,safes[0]+64*scale,accuracy:1); XCTAssertEqual(updated["x"]!,20*scale,accuracy:1); XCTAssertEqual(intro["y"]!-updated["bottom"]!,12*scale,accuracy:1); XCTAssertEqual(card["y"]!-intro["bottom"]!,18*scale,accuracy:1); XCTAssertEqual(heading["x"]!,40*scale,accuracy:1); XCTAssertEqual(copy["y"]!-heading["bottom"]!,6*scale,accuracy:1)
            XCTAssertEqual(text["title"],"Terms of Use"); XCTAssertEqual(text["updated"],"Local draft · 14 October 2026"); XCTAssertTrue(text["intro"]?.contains("not published production terms") == true); XCTAssertEqual(text["firstHeading"],"1. Local build and eligibility"); XCTAssertTrue(text["footer"]?.contains("No production legal or support contact") == true); XCTAssertEqual(metrics["sections"] as? Int,8); XCTAssertEqual(interactions,["isLegalDoc.goBack.click.1"]); XCTAssertEqual(metrics["scrollable"] as? Bool,true); XCTAssertEqual(metrics["overflow"] as? Bool,false)
            let shot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); shot.name="WKWebView Terms of Service default"; shot.lifetime = .keepAlways; add(shot); print("CIMOA_LEGAL_TERMS_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")
            let before = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')")
            _ = try await script(host,"const rows=[...document.querySelectorAll('.legal-terms-page .secondary-page-scroll .uni-scroll-view')],scroll=rows.find(element=>element.scrollHeight>element.clientHeight);scroll.scrollTop=scroll.scrollHeight;return document.querySelector('.legal-document-footer').textContent"); let afterScroll = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')"); XCTAssertEqual(String(describing: afterScroll),String(describing: before))
            _ = try await script(host,"document.querySelector('[data-interaction=\"isLegalDoc.goBack.click.1\"]').click();return true"); try await waitFor(host,".welcome-page"); let afterBack = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')"); XCTAssertEqual(String(describing: afterBack),String(describing: before))
            try await restore()
        } catch { try? await restore(); throw error }
    }
    func testLegalPrivacyPixelRestoration() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')")
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("if(snapshot===null)localStorage.removeItem('cimoa_app_state_v2');else localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?legalPrivacy=restored#/pages/auth/welcome")!)); try await waitFor(host, ".welcome-page")
        }
        do {
            _ = try await script(host, "localStorage.removeItem('cimoa_app_state_v2');return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?legalPrivacy=native#/pages/legal/privacy")!)); try await waitFor(host, ".legal-privacy-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,bottom:rect.bottom}},root=box('.legal-privacy-page'),header=box('.event-page-header'),back=box('.event-page-round'),scroll=box('.secondary-page-scroll'),updated=box('.legal-document-updated'),intro=box('.legal-document-intro'),card=box('.legal-document-card'),heading=box('.legal-document-heading'),copy=box('.legal-document-copy'),safes=[...document.querySelectorAll('.legal-privacy-page>.safe-area')].map(element=>element.getBoundingClientRect().height),scrolls=[...document.querySelectorAll('.legal-privacy-page .secondary-page-scroll .uni-scroll-view')];return {root,header,back,scroll,updated,intro,card,heading,copy,safes,text:{title:document.querySelector('.event-page-header-title').textContent,updated:document.querySelector('.legal-document-updated').textContent,intro:document.querySelector('.legal-document-intro').textContent,firstHeading:document.querySelector('.legal-document-heading').textContent,footer:document.querySelector('.legal-document-footer').textContent},sections:document.querySelectorAll('.legal-document-section').length,interactions:[...document.querySelectorAll('.legal-privacy-page [data-interaction]')].map(element=>element.dataset.interaction),scrollable:scrolls.some(element=>element.scrollHeight>element.clientHeight),overflow:document.querySelector('.legal-document-card').scrollWidth>document.querySelector('.legal-document-card').clientWidth}
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root=metrics["root"] as! [String:Double],header=metrics["header"] as! [String:Double],back=metrics["back"] as! [String:Double],scroll=metrics["scroll"] as! [String:Double],updated=metrics["updated"] as! [String:Double],intro=metrics["intro"] as! [String:Double],card=metrics["card"] as! [String:Double],heading=metrics["heading"] as! [String:Double],copy=metrics["copy"] as! [String:Double],safes=metrics["safes"] as! [Double],text=metrics["text"] as! [String:String],interactions=metrics["interactions"] as! [String],scale=root["width"]!/393
            XCTAssertEqual(safes[0],Double(host.view.safeAreaInsets.top),accuracy:1); XCTAssertEqual(safes[1],Double(host.view.safeAreaInsets.bottom),accuracy:1); XCTAssertEqual(back["y"]!,safes[0]+4*scale,accuracy:1); XCTAssertEqual(back["width"]!,46*scale,accuracy:1); XCTAssertEqual(header["height"]!,64*scale,accuracy:1); XCTAssertEqual(scroll["y"]!,safes[0]+64*scale,accuracy:1); XCTAssertEqual(updated["x"]!,20*scale,accuracy:1); XCTAssertEqual(intro["y"]!-updated["bottom"]!,12*scale,accuracy:1); XCTAssertEqual(card["y"]!-intro["bottom"]!,18*scale,accuracy:1); XCTAssertEqual(heading["x"]!,40*scale,accuracy:1); XCTAssertEqual(copy["y"]!-heading["bottom"]!,6*scale,accuracy:1)
            XCTAssertEqual(text["title"],"Privacy Policy"); XCTAssertEqual(text["updated"],"Local draft · 14 October 2026"); XCTAssertTrue(text["intro"]?.contains("not a published production privacy policy") == true); XCTAssertEqual(text["firstHeading"],"1. Information stored locally"); XCTAssertTrue(text["footer"]?.contains("No production privacy or support contact") == true); XCTAssertEqual(metrics["sections"] as? Int,9); XCTAssertEqual(interactions,["isLegalDoc.goBack.click.1"]); XCTAssertEqual(metrics["scrollable"] as? Bool,true); XCTAssertEqual(metrics["overflow"] as? Bool,false)
            let shot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); shot.name="WKWebView Privacy Policy default"; shot.lifetime = .keepAlways; add(shot); print("CIMOA_LEGAL_PRIVACY_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")
            let before = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')")
            _ = try await script(host,"const rows=[...document.querySelectorAll('.legal-privacy-page .secondary-page-scroll .uni-scroll-view')],scroll=rows.find(element=>element.scrollHeight>element.clientHeight);scroll.scrollTop=scroll.scrollHeight;return document.querySelector('.legal-document-footer').textContent"); let afterScroll = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')"); XCTAssertEqual(String(describing: afterScroll),String(describing: before))
            _ = try await script(host,"document.querySelector('[data-interaction=\"isLegalDoc.goBack.click.1\"]').click();return true"); try await waitFor(host,".welcome-page"); let afterBack = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')"); XCTAssertEqual(String(describing: afterBack),String(describing: before))
            try await restore()
        } catch { try? await restore(); throw error }
    }
    func testCameraPermissionPixelRestoration() async throws {
        let host = try await rawHost()
        var saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')")
        if saved is NSNull {
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?cameraPermission=fixture#/pages/auth/welcome")!)); try await waitFor(host, ".welcome-page"); try await signIn(host)
            saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')")
        }
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("if(snapshot===null)localStorage.removeItem('cimoa_app_state_v2');else localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?cameraPermission=restored#/pages/auth/welcome")!)); try await waitFor(host, ".welcome-page")
        }
        do {
            _ = try await script(host, """
            const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),data=envelope.data,account=data.accounts.find(row=>row.account_id===data.session.account_id),user=data.users.find(row=>row.user_id===data.session.current_user_id);account.onboarding={step:'photos',completed_steps:['basic','uni','major']};user.onboarding_status='in_progress';user.photo_ids=[];user.avatar_url='';data.profile_photos=data.profile_photos.filter(row=>row.user_id!==user.user_id);localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true
            """)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?cameraPermission=native#/pages/permissions/camera")!)); try await waitFor(host, ".permission-camera-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,bottom:rect.bottom}},root=box('.permission-camera-page'),header=box('.permission-camera-page .secondary-page-header'),icon=box('.permission-camera-icon'),title=box('.permission-camera-title'),copy=box('.permission-camera-copy'),primary=box('[data-interaction="permCamera.allowPhotos.click.1"]'),secondary=box('[data-interaction="permCamera.denyPhotos.click.1"]'),safes=[...document.querySelectorAll('.permission-camera-page>.safe-area')].map(element=>element.getBoundingClientRect().height);return {root,header,icon,title,copy,primary,secondary,safes,text:{title:document.querySelector('.permission-camera-title').textContent,copy:document.querySelector('.permission-camera-copy').textContent,primary:document.querySelector('[data-interaction="permCamera.allowPhotos.click.1"]').textContent.trim(),secondary:document.querySelector('[data-interaction="permCamera.denyPhotos.click.1"]').textContent.trim()},interactions:[...document.querySelectorAll('.permission-camera-page [data-interaction]')].map(element=>element.dataset.interaction),card:!!document.querySelector('.permission-camera-error')}
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root=metrics["root"] as! [String:Double],header=metrics["header"] as! [String:Double],icon=metrics["icon"] as! [String:Double],title=metrics["title"] as! [String:Double],copy=metrics["copy"] as! [String:Double],primary=metrics["primary"] as! [String:Double],secondary=metrics["secondary"] as! [String:Double],safes=metrics["safes"] as! [Double],text=metrics["text"] as! [String:String],interactions=metrics["interactions"] as! [String],scale=root["width"]!/393
            XCTAssertEqual(safes[0],Double(host.view.safeAreaInsets.top),accuracy:1); XCTAssertEqual(safes[1],Double(host.view.safeAreaInsets.bottom),accuracy:1); XCTAssertEqual(header["height"]!,0,accuracy:1); XCTAssertEqual(icon["y"]!,safes[0]+118*scale,accuracy:1.5); XCTAssertEqual(icon["width"]!,92*scale,accuracy:1); XCTAssertEqual(icon["height"]!,92*scale,accuracy:1); XCTAssertEqual(title["y"]!-icon["bottom"]!,16*scale,accuracy:1); XCTAssertEqual(copy["y"]!-title["bottom"]!,16*scale,accuracy:1); XCTAssertEqual(primary["height"]!,60*scale,accuracy:1); XCTAssertEqual(secondary["height"]!,46*scale,accuracy:1); XCTAssertEqual(secondary["bottom"]!,root["height"]!-safes[1]-30*scale,accuracy:2)
            XCTAssertEqual(text["title"],"Take a profile photo"); XCTAssertEqual(text["copy"],"The camera is used only while you take a photo. Cimoa does not record in the background."); XCTAssertEqual(text["primary"],"Allow Camera"); XCTAssertEqual(text["secondary"],"Not Now"); XCTAssertEqual(interactions,["permCamera.allowPhotos.click.1","permCamera.denyPhotos.click.1"]); XCTAssertEqual(metrics["card"] as? Bool,false)
            let shot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); shot.name="WKWebView Camera permission default"; shot.lifetime = .keepAlways; add(shot); print("CIMOA_CAMERA_PERMISSION_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")
            let before=try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as! String
            _ = try await script(host,"const action=document.querySelector('[data-interaction=\"permCamera.denyPhotos.click.1\"]');action.click();action.click();return true"); try await waitFor(host,".permission-camera-error")
            let denied=try await script(host,"return {title:document.querySelector('.permission-camera-error-title').textContent,message:document.querySelector('[role=alert]').textContent,settings:document.querySelectorAll('[data-interaction=\"permCamera.openSettings.click.1\"]').length,state:localStorage.getItem('cimoa_app_state_v2')}") as! [String:Any]
            XCTAssertEqual(denied["title"] as? String,"Access is off"); XCTAssertTrue((denied["message"] as? String)?.contains("Without it you can’t add a photo") == true); XCTAssertEqual(denied["settings"] as? Int,1); XCTAssertEqual(denied["state"] as? String,before)
            _ = try await script(host,"window.__cameraOldDocument=true;return true"); host.webView.reload()
            var refreshed = false
            for _ in 0..<100 {
                if (try? await script(host,"return !window.__cameraOldDocument&&!!document.querySelector('.permission-camera-page')")) as? Bool == true { refreshed = true; break }
                try await Task.sleep(nanoseconds:100_000_000)
            }
            XCTAssertTrue(refreshed)
            XCTAssertFalse((Bundle.main.object(forInfoDictionaryKey: "NSCameraUsageDescription") as? String ?? "").isEmpty)
            let h5Root = Bundle.main.resourceURL!.appendingPathComponent("H5"), files = FileManager.default.enumerator(at: h5Root, includingPropertiesForKeys: nil)!.compactMap { $0 as? URL }.filter { $0.pathExtension == "js" }
            let bundledCapture = try files.contains { try String(contentsOf: $0, encoding: .utf8).contains("sourceType:[\"camera\"]") }
            XCTAssertTrue(bundledCapture, "The production H5 bundle must request a real camera-backed image input.")
            let restoredDefault=try await script(host,"return {label:document.querySelector('[data-interaction=\"permCamera.allowPhotos.click.1\"]').textContent.trim(),card:!!document.querySelector('.permission-camera-error')}")
            let afterReload = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as? String
            XCTAssertEqual((restoredDefault as? [String:Any])?["label"] as? String,"Allow Camera"); XCTAssertEqual((restoredDefault as? [String:Any])?["card"] as? Bool,false); XCTAssertEqual(afterReload,before)
            try await restore()
        } catch { try? await restore(); throw error }
    }
    func testResetCodePixelRestoration() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')")
        if saved is NSNull {
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?resetCode=fixture#/pages/auth/welcome")!)); try await waitFor(host, ".welcome-page"); try await signIn(host)
        }
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("if(snapshot===null)localStorage.removeItem('cimoa_app_state_v2');else localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?resetCode=restored#/pages/auth/welcome")!)); try await waitFor(host, ".welcome-page")
        }
        do {
            _ = try await script(host, "const envelope=JSON.parse(localStorage.getItem('cimoa_app_state_v2')),account=envelope.data.accounts.find(row=>row.email==='cimoa@gmail.com')||envelope.data.accounts.find(row=>row.status==='active');envelope.data.session={account_id:null,current_user_id:null,expires_at:null};envelope.data.auth_flow.password_reset={reset_id:'password_reset_native',account_id:account.account_id,email:account.email,created_at:Date.now(),verified_at:null};localStorage.setItem('cimoa_app_state_v2',JSON.stringify(envelope));return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?resetCode=native#/pages/auth/reset/code?reset_id=password_reset_native")!)); try await waitFor(host, ".reset-code-page")
            var metrics: [String: Any] = [:]
            for _ in 0..<50 {
                metrics = try await script(host, """
                await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,bottom:rect.bottom}},root=box('.reset-code-page'),header=box('.auth-header'),back=box('.auth-back'),heading=box('.auth-heading'),description=box('.auth-description'),input=box('.reset-code-box'),resend=box('.reset-resend'),primary=box('[data-interaction="fpCode.goFpNew.click.1"]'),safes=[...document.querySelectorAll('.reset-code-page>.safe-area')].map(element=>element.getBoundingClientRect().height);return {root,header,back,heading,description,input,resend,primary,safes,text:{header:document.querySelector('.auth-header-title').textContent,heading:document.querySelector('.auth-heading').textContent,description:document.querySelector('.auth-description').textContent,resend:document.querySelector('.reset-resend').textContent.trim(),primary:document.querySelector('[data-interaction="fpCode.goFpNew.click.1"]').textContent.trim()},interactions:[...document.querySelectorAll('.reset-code-page [data-interaction]')].map(element=>element.dataset.interaction),extraDisclosure:!!document.querySelector('.reset-code-disclosure'),extraLabel:!!document.querySelector('.auth-label')}
                """) as! [String: Any]
                let safes = metrics["safes"] as! [Double]
                if abs(safes[0] - Double(host.view.safeAreaInsets.top)) <= 1, abs(safes[1] - Double(host.view.safeAreaInsets.bottom)) <= 1 { break }
                host.publishSafeArea(); try await Task.sleep(nanoseconds: 100_000_000)
            }
            let root=metrics["root"] as! [String:Double],header=metrics["header"] as! [String:Double],back=metrics["back"] as! [String:Double],heading=metrics["heading"] as! [String:Double],description=metrics["description"] as! [String:Double],input=metrics["input"] as! [String:Double],resend=metrics["resend"] as! [String:Double],primary=metrics["primary"] as! [String:Double],safes=metrics["safes"] as! [Double],text=metrics["text"] as! [String:String],interactions=metrics["interactions"] as! [String],scale=root["width"]!/393
            XCTAssertEqual(safes[0],Double(host.view.safeAreaInsets.top),accuracy:1); XCTAssertEqual(safes[1],Double(host.view.safeAreaInsets.bottom),accuracy:1); XCTAssertEqual(header["y"]!,safes[0]+4*scale,accuracy:1); XCTAssertEqual(back["width"]!,46*scale,accuracy:1); XCTAssertEqual(heading["y"]!,safes[0]+68*scale,accuracy:1.5); XCTAssertEqual(description["y"]!-heading["bottom"]!,10*scale,accuracy:1); XCTAssertEqual(input["y"]!-description["bottom"]!,20*scale,accuracy:1); XCTAssertEqual(input["height"]!,72*scale,accuracy:1); XCTAssertEqual(resend["y"]!-input["bottom"]!,18*scale,accuracy:1); XCTAssertEqual(primary["height"]!,60*scale,accuracy:1); XCTAssertEqual(primary["bottom"]!,root["height"]!-safes[1]-34*scale,accuracy:2)
            XCTAssertEqual(text["header"],"Reset password"); XCTAssertEqual(text["heading"],"Enter reset code"); XCTAssertEqual(text["description"],"Enter the fixed code 009789. No email was sent and the code does not expire."); XCTAssertEqual(text["resend"],"Show code again"); XCTAssertEqual(text["primary"],"Continue"); XCTAssertEqual(metrics["extraDisclosure"] as? Bool,false); XCTAssertEqual(metrics["extraLabel"] as? Bool,false); for id in ["fpCode.goBack.click.1","fpCode.onCode.change.1","fpCode.resend.click.1","fpCode.goFpNew.click.1"] { XCTAssertTrue(interactions.contains(id)) }
            let shot=XCTAttachment(image:try await host.webView.takeSnapshot(configuration:nil)); shot.name="WKWebView Reset Code default"; shot.lifetime = .keepAlways; add(shot); print("CIMOA_RESET_CODE_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")
            let before=try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as! String
            _ = try await script(host,"const input=document.querySelector('uni-input[aria-label=\"Reset code\"] input'),set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'111111');input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,100));document.querySelector('[data-interaction=\"fpCode.goFpNew.click.1\"]').click();return true"); try await waitFor(host,".reset-code-page [role=alert]"); let wrongState = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as? String; XCTAssertEqual(wrongState,before)
            _ = try await script(host,"document.querySelector('[data-interaction=\"fpCode.resend.click.1\"]').click();return true"); try await waitFor(host,".reset-code-page [role=status]"); let resendState = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as? String; XCTAssertEqual(resendState,before)
            _ = try await script(host,"const input=document.querySelector('uni-input[aria-label=\"Reset code\"] input'),set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'009789');input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,100));document.querySelector('[data-interaction=\"fpCode.goFpNew.click.1\"]').click();return true"); try await waitFor(host,".loading"); let loadingState = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as? String; XCTAssertEqual(loadingState,before); try await waitFor(host,".reset-new-page")
            let verified = try await script(host,"return Number.isFinite(JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.auth_flow.password_reset.verified_at)") as? Bool; XCTAssertEqual(verified,true)
            _ = try await script(host,"document.querySelector('[data-interaction=\"fpNew.goBack.click.1\"]').click();return true"); try await waitFor(host,".reset-code-page"); _ = try await script(host,"document.querySelector('[data-interaction=\"fpCode.goBack.click.1\"]').click();return true"); try await waitFor(host,".reset-email-page")
            try await restore()
        } catch { try? await restore(); throw error }
    }
    func testLocalPasswordResetAndRelogin() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')")
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("if(snapshot===null)localStorage.removeItem('cimoa_app_state_v2');else localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?passwordReset=restored#/pages/auth/welcome")!))
            try await waitFor(host, ".welcome-page")
        }
        do {
            _ = try await script(host, "localStorage.removeItem('cimoa_app_state_v2');return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?passwordReset=fresh#/pages/auth/welcome")!)); try await waitFor(host, ".welcome-page")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?passwordReset=native#/pages/auth/login")!))
            try await waitFor(host, ".login-page")
            let arrived = try await script(host, """
            const delay=ms=>new Promise(r=>setTimeout(r,ms)),visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0),state=()=>{const raw=localStorage.getItem('cimoa_app_state_v2');return raw?JSON.parse(raw).data:null};
            const wait=async fn=>{for(let i=0;i<200;i++){const value=fn();if(value)return value;await delay(50)}throw Error('Password reset timeout: '+location.hash+' '+document.body.innerText)};
            const click=async id=>{const e=await wait(()=>visible('[data-interaction="'+id+'"]'));await delay(320);e.click();await delay(80)};
            const fill=async(label,value)=>{const e=await wait(()=>visible('uni-input[aria-label="'+label+'"] input'));const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));await delay(100)};
            window.__passwordReset={delay,visible,wait,click,fill};
            await click('login.goFpEmail.click.1');await wait(()=>visible('.reset-email-page'));await fill('Reset email','cimoa@gmail.com');await click('fpEmail.goFpCode.click.1');
            const emailLoading=!!visible('.loading')&&state()?.auth_flow?.password_reset==null;await wait(()=>visible('.reset-code-page'));const original=state();window.__passwordReset.users=JSON.stringify(original.users);window.__passwordReset.coins=JSON.stringify(original.coin_transactions);
            await fill('Reset code','111111');await click('fpCode.goFpNew.click.1');await wait(()=>visible('.reset-code-page [role=alert]'));const wrongUnchanged=state().auth_flow.password_reset.verified_at===null;
            await fill('Reset code','009789');await click('fpCode.goFpNew.click.1');const codeLoading=!!visible('.loading')&&state().auth_flow.password_reset.verified_at===null;await wait(()=>visible('.reset-new-page'));
            return {emailLoading,wrongUnchanged,codeLoading,code:document.body.innerText.includes('Choose a new password')}
            """) as! [String: Any]
            XCTAssertEqual(arrived["emailLoading"] as? Bool, true); XCTAssertEqual(arrived["wrongUnchanged"] as? Bool, true)
            XCTAssertEqual(arrived["codeLoading"] as? Bool, true); XCTAssertEqual(arrived["code"] as? Bool, true)
            let metrics = try await script(host, """
            await document.fonts.ready;for(const animation of document.getAnimations())animation.finish();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const box=target=>{const element=typeof target==='string'?document.querySelector(target):target,rect=element.getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,bottom:rect.bottom}},root=box('.reset-new-page'),header=box('.auth-header'),back=box('.auth-back'),heading=box('.auth-heading'),fields=[...document.querySelectorAll('.auth-field')],boxes=[...document.querySelectorAll('.auth-input-box')],hint=box('.reset-password-hint'),primary=box('[data-interaction="fpNew.finishReset.click.1"]'),safes=[...document.querySelectorAll('.reset-new-page>.safe-area')].map(element=>element.getBoundingClientRect().height),inputs=[...document.querySelectorAll('.auth-input')];return {root,header,back,heading,fields:fields.map(box),boxes:boxes.map(box),hint,primary,safes,text:{header:document.querySelector('.auth-header-title').textContent,heading:document.querySelector('.auth-heading').textContent,labels:[...document.querySelectorAll('.auth-label')].map(element=>element.textContent),placeholders:inputs.map(element=>element.querySelector('.uni-input-placeholder')?.textContent||element.getAttribute('placeholder')),hint:document.querySelector('.reset-password-hint').textContent,show:document.querySelector('.auth-show').textContent,primary:document.querySelector('[data-interaction="fpNew.finishReset.click.1"]').textContent.trim()},interactions:[...document.querySelectorAll('.reset-new-page [data-interaction]')].map(element=>element.dataset.interaction),extraDescription:!!document.querySelector('.auth-description'),extraNote:!!document.querySelector('.auth-local-note')}
            """) as! [String: Any]
            let root=metrics["root"] as! [String:Double],header=metrics["header"] as! [String:Double],back=metrics["back"] as! [String:Double],heading=metrics["heading"] as! [String:Double],fields=metrics["fields"] as! [[String:Double]],boxes=metrics["boxes"] as! [[String:Double]],hint=metrics["hint"] as! [String:Double],primary=metrics["primary"] as! [String:Double],safes=metrics["safes"] as! [Double],text=metrics["text"] as! [String:Any],interactions=metrics["interactions"] as! [String],scale=root["width"]!/393
            XCTAssertEqual(safes[0],Double(host.view.safeAreaInsets.top),accuracy:1); XCTAssertEqual(safes[1],Double(host.view.safeAreaInsets.bottom),accuracy:1); XCTAssertEqual(header["y"]!,safes[0]+4*scale,accuracy:1); XCTAssertEqual(back["width"]!,46*scale,accuracy:1); XCTAssertEqual(heading["y"]!,safes[0]+68*scale,accuracy:1.5); XCTAssertEqual(fields[0]["y"]!-heading["bottom"]!,14*scale,accuracy:1); XCTAssertEqual(boxes[0]["height"]!,56*scale,accuracy:1); XCTAssertEqual(hint["y"]!-boxes[0]["bottom"]!,6*scale,accuracy:1); XCTAssertEqual(fields[1]["y"]!-hint["bottom"]!,14*scale,accuracy:1); XCTAssertEqual(boxes[1]["height"]!,56*scale,accuracy:1); XCTAssertEqual(primary["height"]!,60*scale,accuracy:1); XCTAssertEqual(primary["bottom"]!,root["height"]!-safes[1]-34*scale,accuracy:2)
            XCTAssertEqual(text["header"] as? String,"Reset password"); XCTAssertEqual(text["heading"] as? String,"Choose a new password"); XCTAssertEqual(text["labels"] as? [String],["New password","Confirm new password"]); XCTAssertEqual(text["placeholders"] as? [String],["At least 8 characters","Repeat it"]); XCTAssertEqual(text["hint"] as? String,"At least 8 characters with a number"); XCTAssertEqual(text["show"] as? String,"Show"); XCTAssertEqual(text["primary"] as? String,"Update password"); XCTAssertEqual(metrics["extraDescription"] as? Bool,false); XCTAssertEqual(metrics["extraNote"] as? Bool,false); for id in ["fpNew.goBack.click.1","fpNew.onPw.change.1","fpNew.togglePw.click.1","fpNew.onPw2.change.1","fpNew.finishReset.click.1"] { XCTAssertTrue(interactions.contains(id)) }
            try await Task.sleep(nanoseconds: 250_000_000)
            let resetPage = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil))
            resetPage.name = "WKWebView Reset New Password default"; resetPage.lifetime = .keepAlways; add(resetPage); print("CIMOA_RESET_NEW_SAFE_AREA top=\(safes[0]) bottom=\(safes[1]) viewport=\(root["width"] ?? -1)x\(root["height"] ?? -1)")
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
        let host = try await rawHost()
        let saved = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String: Any]
        let existingMedia = try await script(host, "const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_media_v2',1);r.onupgradeneeded=()=>r.result.createObjectStore('blobs');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});const keys=await new Promise((resolve,reject)=>{const r=db.transaction('blobs').objectStore('blobs').getAllKeys();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();return keys") as! [String]
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("""
            const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_media_v2',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
            await new Promise((resolve,reject)=>{const t=db.transaction('blobs','readwrite'),s=t.objectStore('blobs'),r=s.getAllKeys();r.onsuccess=()=>r.result.filter(k=>!existing.includes(k)).forEach(k=>s.delete(k));t.oncomplete=resolve;t.onerror=()=>reject(t.error)});db.close();
            for(const [key,value] of [['cimoa_app_state_v2',snapshot.state],['cimoa_app_state',snapshot.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)};return true
            """, arguments: ["snapshot": saved, "existing": existingMedia], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?registration=restored#/pages/auth/splash")!))
            try await waitFor(host, ".home-header,.onboarding-page,.welcome-page")
        }
        do {
            _ = try await script(host, "localStorage.removeItem('cimoa_app_state_v2');localStorage.removeItem('cimoa_app_state');return true")
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?registration=fresh#/pages/auth/splash")!))
            try await waitFor(host, ".welcome-page")
            let setup = try await script(host, birthDatePickerDriver + """
            const delay=ms=>new Promise(r=>setTimeout(r,ms));
            const visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden');
            const wait=async fn=>{for(let i=0;i<200;i++){const value=fn();if(value)return value;await delay(50)}throw Error('Registration timeout: '+location.hash+' '+document.body.innerText)};
            const click=async id=>{const e=await wait(()=>visible('[data-interaction="'+id+'"]'));await delay(320);e.click();await delay(80)};
            const fill=async(label,value)=>{const e=await wait(()=>visible('uni-input[aria-label="'+label+'"] input,uni-textarea[aria-label="'+label+'"] textarea'));const proto=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));await delay(80)};
            const choose=async label=>{await delay(320);const e=[...document.querySelectorAll('[role=button],[role=checkbox]')].find(e=>(e.getAttribute('aria-label')===label||e.textContent.trim()===label)&&e.getBoundingClientRect().height>0);if(!e)throw Error('Missing '+label);e.click();await delay(80)};
            window.__registrationHelpers={delay,visible,wait,click,choose};
            await click('welcome.toggleAgreement.click.1');await click('welcome.goAge.click.1');await chooseBirthDate('2000-01-01');await click('age.goAgree.click.1');await wait(()=>visible('.community-page'));
            for(const key of ['terms','privacy','community']){await delay(100);document.querySelector('[data-agreement="'+key+'"]').click()}
            await click('agree.goSignup.click.1');await fill('University email','native.registration@campus.edu');await fill('Password','localpass123');await fill('Confirm password','localpass123');await click('signup.createAccount.click.1');
            await wait(()=>visible('.verification-email-page'));await click('verEmail.goVerCode.click.1');await wait(()=>visible('.verification-input input'));const code=document.querySelector('.verification-input input');code.value='009789';code.dispatchEvent(new Event('input',{bubbles:true}));await delay(80);await click('verCode.goVerSuccess.click.1');
            await wait(()=>visible('.verification-success-page'));await click('verSuccess.goObBasic.click.1');await fill('Display name','Native Morgan');await choose('Non-binary');await choose('they / them');await click('obBasic.goObUni.click.1');
            await fill('University','HKUST');await choose('Year 3');await fill('Field of study','Design');await click('obUni.goObMajor.click.1');await wait(()=>visible('.onboarding-major-page'));await choose('💻Computer Science');await click('obMajor.goObPhotos.click.1');
            await wait(()=>visible('.photo-slot-1'));await delay(350);document.querySelector('.photo-slot-1').click();await wait(()=>visible('.permission-photos-page'));
            // Feed real bundled images into WebKit's file input. This tests the
            // production decoding/IndexedDB path, not manual system-picker UI.
            const suppress=e=>{if(e.target.matches('input[type=file]'))e.preventDefault()};document.addEventListener('click',suppress,true);
            try{await click('permPhotos.allowPhotos.click.1');await wait(()=>document.querySelector('input[type=file]'));const files=new DataTransfer();for(const name of ['me','maya-card']){const b=await(await fetch('/static/assets/head/'+name+'.png')).blob();files.items.add(new File([b],name+'.png',{type:'image/png'}))}const input=[...document.querySelectorAll('input[type=file]')].at(-1);input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}))}finally{document.removeEventListener('click',suppress,true)}
            await wait(()=>document.querySelectorAll('.onboarding-photos-page .profile-photo[data-media-status=ready]').length===2);await click('obPhotos.goObAbout.click.1');await fill('About you','A local campus profile created in real WKWebView.');await click('obAbout.goObInterests.click.1');await wait(()=>visible('.onboarding-interests-page'));
            for(const label of ['📷Photography','☕Coffee','🎵Live Music'])await choose(label);await click('obInterests.goObGoal.click.1');await wait(()=>visible('.onboarding-goal-page'));await choose('🙋New Friends');await click('obGoal.goObIce.click.1');await wait(()=>visible('.onboarding-ice-page'));await click('obIce.browseQuestions.click.1');await delay(350);
            for(const e of [...document.querySelectorAll('.library-question')].slice(0,3)){e.click();await delay(80)}document.querySelector('.ice-library .event-dialog-mask').click();await wait(()=>!visible('.ice-library.event-dialog--open'));await delay(350);await click('obIce.goObNotif.click.1');await wait(()=>visible('.onboarding-notif-page'));await click('obNotif.skipNotifs.click.1');await wait(()=>visible('.onboarding-complete-page'));await delay(350);
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
        await click('welcome.toggleAgreement.click.1');await click('welcome.goLogin.click.1');await fill('Email','native.registration@campus.edu');await fill('Password','wrong-password');await click('login.loginNow.click.1');await wait(()=>visible('.login-page [role=alert]'));assert(state().session.account_id===null,'Wrong password logged in');
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
    func testAccountSettingsSafetyAndCoinRecovery() async throws {
        let host = try await rawHost()
        let snapshot = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String:Any]
        let originalScripts = host.webView.configuration.userContentController.userScripts
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let folder = root.appendingPathComponent("docs/evidence/account-flows")
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: folder.appendingPathComponent("native-fixture.json"))) as! [String:Any]
        let fixtureData = fixture["data"] as! [String:Any]
        let fixtureOwner = (fixtureData["session"] as! [String:Any])["current_user_id"] as! String
        let remainingBlocks = (fixtureData["blocked_users"] as! [[String:Any]]).filter { $0["owner_user_id"] as? String == fixtureOwner }.count - 1
        func resetScripts() {
            host.webView.configuration.userContentController.removeAllUserScripts()
            for item in originalScripts { host.webView.configuration.userContentController.addUserScript(item) }
        }
        func restore() async throws {
            resetScripts()
            let encoded = String(data: try JSONSerialization.data(withJSONObject: snapshot), encoding: .utf8)!
            host.webView.configuration.userContentController.addUserScript(WKUserScript(source: "const saved=\(encoded);for(const[k,v]of[['cimoa_app_state_v2',saved.state],['cimoa_app_state',saved.legacy]]){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)};", injectionTime: .atDocumentStart, forMainFrameOnly: true))
            try await loadFreshConnection(host, route: "/pages/auth/splash", selector: ".splash-page")
            resetScripts()
        }
        do {
            let encoded = String(data: try JSONSerialization.data(withJSONObject: fixture["data"]!), encoding: .utf8)!
            host.webView.configuration.userContentController.addUserScript(WKUserScript(source: "const fixture=\(encoded);fixture.session.expires_at=Date.now()+86400000;localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data:fixture}));", injectionTime: .atDocumentStart, forMainFrameOnly: true))
            try await loadFreshConnection(host, route: "/pages/profile/index", selector: ".profile-name")
            resetScripts(); host.publishSafeArea()
            let result = try await script(host, """
            const delay=ms=>new Promise(r=>setTimeout(r,ms)),state=()=>JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,visible=s=>[...document.querySelectorAll(s)].find(e=>e.closest('uni-page')===[...document.querySelectorAll('uni-page')].at(-1)&&e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden');
            const wait=async fn=>{for(let i=0;i<200;i++){const v=fn();if(v)return v;await delay(50)}throw Error('Account flow timeout '+location.hash+' '+document.body.innerText)};
            const open=async(route,selector)=>{location.hash='#'+route;await wait(()=>visible(selector));await delay(360)},click=async id=>{const e=await wait(()=>visible('[data-interaction="'+id+'"]'));e.scrollIntoView({block:'center'});await delay(280);e.click();await delay(60)};
            window.__accountChecks=[];const checks=window.__accountChecks,record=(name,pass)=>{if(!pass)throw Error(name);checks.push(name)};
            await open('/pages/profile/edit','.score-card');await click('editAll.eaOpenDegree.click.1');visible('.profile-field-sheet [aria-label="Business"]').click();await click('profileEdit.basic.click.1');await wait(()=>visible('.profile-basic-page input'));const major=visible('uni-input[aria-label="Field of study"] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(major,'Interdisciplinary Design');major.dispatchEvent(new Event('input',{bubbles:true}));await click('editBasic.saveBasic.click.1');await wait(()=>visible('.score-card'));await click('editAll.eaSave.click.1');await wait(()=>visible('.profile-name'));record('parent draft cannot overwrite a newer child profile save',state().users.find(u=>u.user_id===state().session.current_user_id).major==='Interdisciplinary Design');
            await open('/pages/settings/privacy','.settings-privacy-page');const before=localStorage.getItem('cimoa_app_state_v2'),sw=visible('[role=switch]'),checked=sw.getAttribute('aria-checked');sw.click();await delay(80);record('privacy pre-write Loading',!!visible('.loading')&&localStorage.getItem('cimoa_app_state_v2')===before);await wait(()=>!visible('.loading')&&sw.getAttribute('aria-checked')!==checked);record('privacy canonical save',localStorage.getItem('cimoa_app_state_v2')!==before);
            await open('/pages/settings/blocked','.settings-blocked-page');const block=state().blocked_users.find(b=>b.owner_user_id===state().session.current_user_id),balance=JSON.stringify(state().coin_transactions);await click('blockedList.b.unblock.click.1');await click('unblockOpen.confirmUnblock.click.1');await wait(()=>!state().blocked_users.some(b=>b.block_id===block.block_id));record('unblock does not restore old connection or chat',!state().relationships.some(r=>[r.from_user_id,r.to_user_id].includes(block.user_id)&&[r.from_user_id,r.to_user_id].includes(state().session.current_user_id))&&JSON.stringify(state().coin_transactions)===balance);
            await open('/pages/profile/prefs','.preferences-groups');record('twelve source preference groups',document.querySelectorAll('.preferences-groups [role=radiogroup]').length===12);const travel=[...document.querySelectorAll('[role=radio]')].find(e=>e.textContent.trim()==='Travel buddies');travel.click();await click('editPrefs.savePrefs.click.1');await wait(()=>state().match_preferences.find(p=>p.owner_user_id===state().session.current_user_id).goal_id==='travel'&&!visible('.loading')&&!visible('.preferences-groups'));await delay(360);record('preferences share matching entity',state().match_preferences.find(p=>p.owner_user_id===state().session.current_user_id).goal_id==='travel');
            await open('/pages/profile/verification','.verification-summary');record('verification masks email and fabricates no date',visible('.verification-details').textContent.includes('ci•••@gmail.com')&&visible('.verification-details').textContent.includes('Not recorded'));await click('verified.openReverify.click.1');await wait(()=>visible('.reverify-body'));const verifyBefore=localStorage.getItem('cimoa_app_state_v2');await click('reverify.goVerEmail.click.1');await wait(()=>visible('[role=alert]'));record('unconfigured student service fails without mutation',visible('[role=alert]').textContent.includes('not configured')&&localStorage.getItem('cimoa_app_state_v2')===verifyBefore);
            await open('/pages/coins/index','.coin-center-page');const coins=JSON.stringify(state().coin_transactions);await click('coinStore.continuePurchase.click.1');await wait(()=>visible('.coin-failed-page'));record('real native purchase failure does not credit coins',state().purchase_requests.at(-1).status==='failure'&&JSON.stringify(state().coin_transactions)===coins);
            return {checks,origin:location.origin,overflow:document.documentElement.scrollWidth>innerWidth,safe:[getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-top'),getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-bottom')]}
            """) as! [String:Any]
            XCTAssertEqual((result["checks"] as? [String])?.count, 9)
            XCTAssertEqual(result["origin"] as? String, BundleHTTPServer.origin)
            XCTAssertEqual(result["overflow"] as? Bool, false)
            try await loadFreshConnection(host, route: "/pages/coins/history", selector: ".coin-history-page")
            let refreshed = try await script(host, "const d=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;return {failed:d.purchase_requests.at(-1).status,credits:document.querySelector('.history-list')?.textContent||document.querySelector('.coin-history-page').textContent,groups:d.match_preferences.find(p=>p.owner_user_id===d.session.current_user_id).goal_id,blocks:d.blocked_users.filter(b=>b.owner_user_id===d.session.current_user_id).length}") as! [String:Any]
            XCTAssertEqual(refreshed["failed"] as? String, "failure"); XCTAssertEqual(refreshed["groups"] as? String, "travel"); XCTAssertEqual(refreshed["blocks"] as? Int, remainingBlocks)
            XCTAssertTrue((refreshed["credits"] as? String ?? "").contains("Coin credit"))
            _ = try await script(host, "await document.fonts.ready;for(const a of document.getAnimations())if(a.effect?.getComputedTiming().iterations!==Infinity)a.finish();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true")
            try await Task.sleep(nanoseconds: 250_000_000)
            let image = try await host.webView.takeSnapshot(configuration: nil)
            try image.pngData()!.write(to: folder.appendingPathComponent("actual-wkwebview-coins.png"))
            try JSONSerialization.data(withJSONObject: ["result":"passed","module":result,"refresh":refreshed,"scope":"real WKWebView DOM/bridge; not manual OS touch, microphone or payment success"], options: [.prettyPrinted,.sortedKeys]).write(to: folder.appendingPathComponent("native-module.json"))
            try await restore()
        } catch {
            if let failure = try? await script(host, "return {url:location.href,text:document.body.innerText,checks:window.__accountChecks||[]}") { try? JSONSerialization.data(withJSONObject: failure, options: [.prettyPrinted]).write(to: folder.appendingPathComponent("native-module-failure.json")) }
            try? await restore(); throw error
        }
    }
    func testOrganizerRecommendationBlockAndSettingsRecovery() async throws {
        let host = try await rawHost()
        let snapshot = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String:Any]
        let originalScripts = host.webView.configuration.userContentController.userScripts
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let folder = root.appendingPathComponent("docs/evidence/organizer-block")
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: folder.appendingPathComponent("native-fixture.json"))) as! [String:Any]
        func resetScripts() {
            host.webView.configuration.userContentController.removeAllUserScripts()
            for item in originalScripts { host.webView.configuration.userContentController.addUserScript(item) }
        }
        func restore() async throws {
            resetScripts()
            let encoded = String(data: try JSONSerialization.data(withJSONObject: snapshot), encoding: .utf8)!
            host.webView.configuration.userContentController.addUserScript(WKUserScript(source: "const saved=\(encoded);for(const[k,v]of[['cimoa_app_state_v2',saved.state],['cimoa_app_state',saved.legacy]]){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)};", injectionTime: .atDocumentStart, forMainFrameOnly: true))
            try await loadFreshConnection(host, route: "/pages/auth/splash", selector: ".splash-page")
            resetScripts()
        }
        let helpers = """
        const delay=ms=>new Promise(r=>setTimeout(r,ms)),state=()=>JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;
        const visible=s=>[...document.querySelectorAll(s)].find(e=>e.closest('uni-page')===[...document.querySelectorAll('uni-page')].at(-1)&&e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden');
        const wait=async fn=>{for(let i=0;i<200;i++){const value=fn();if(value)return value;await delay(50)}throw Error('Organizer timeout '+location.hash+' '+document.body.innerText)};
        const click=async id=>{const e=await wait(()=>visible('[data-interaction="'+id+'"]'));e.scrollIntoView({block:'center'});await delay(280);e.click();await delay(80)};
        const idle=async()=>{await wait(()=>!visible('.event-loading,.loading'));await delay(350)};
        const checks=[],record=(name,pass)=>{if(!pass)throw Error(name);checks.push(name)};
        """
        var checks = [String]()
        do {
            let encoded = String(data: try JSONSerialization.data(withJSONObject: fixture["data"]!), encoding: .utf8)!
            host.webView.configuration.userContentController.addUserScript(WKUserScript(source: "const data=\(encoded);data.session.expires_at=Date.now()+86400000;localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data}));", injectionTime: .atDocumentStart, forMainFrameOnly: true))
            try await loadFreshConnection(host, route: "/pages/events/detail?event_id=event_picnic", selector: ".event-detail-host-name")
            resetScripts(); host.publishSafeArea()
            checks += try await script(host, helpers + """
            const before=localStorage.getItem('cimoa_app_state_v2');await click('evDetail.openEventMore.click.1');await click('sheetEvMore.blockOrganizer.click.1');record('Institution-specific confirmation opens without writing',visible('[role=dialog]').getAttribute('aria-label')==='Block HKUST Student Union?'&&localStorage.getItem('cimoa_app_state_v2')===before);await click('sheetEvMore.closeSheet.click.2');await wait(()=>!visible('[role=dialog]'));record('Cancel keeps original event preferences',localStorage.getItem('cimoa_app_state_v2')===before);
            await click('evDetail.openEventMore.click.1');await click('sheetEvMore.blockOrganizer.click.1');await click('eventDetail.organizer.confirmBlock.click.1');visible('[data-interaction="eventDetail.organizer.confirmBlock.click.1"]').click();record('Block shows Loading before a single persisted write',!!visible('.event-loading')&&localStorage.getItem('cimoa_app_state_v2')===before);await idle();const prior=JSON.parse(before).data,current=state();record('Block is recommendation-only, with no personal block or attendance/chat mutation',JSON.stringify(current.event_preferences[0].blocked_organizer_ids)==='["organizer_hkust"]'&&current.revision===prior.revision+1&&['memberships','messages','conversations','relationships','coin_transactions','blocked_users','reports'].every(k=>JSON.stringify(current[k])===JSON.stringify(prior[k])));
            await click('evDetail.goBack.click.1');await wait(()=>visible('.events-header'));record('Return to Events filters only that organizer',!visible('.event-card[data-event-id="event_picnic"]')&&!!visible('.event-card[data-event-id="event_other"]'));await click('events.openMyEvents.click.1');await wait(()=>visible('.event-upcoming-featured'));record('My Events retains the joined event',visible('.event-upcoming-featured').dataset.eventId==='event_picnic');await click('evUpcoming.openGroupStop.click.1');await wait(()=>visible('.event-group-composer'));await idle();record('Existing joined group remains accessible with its original messages',visible('.event-group-messages').textContent.includes('I’ll bring fruit!'));return checks
            """) as! [String]
            let groupSnapshot = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
            try await loadFreshConnection(host, route: "/pages/events/group?event_id=event_picnic&conversation_id=group_picnic", selector: ".event-group-composer")
            _ = try await script(host, helpers + "await idle();return true")
            let groupRestored = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as? String
            XCTAssertEqual(groupRestored, groupSnapshot); checks.append("Fresh group document preserves membership and messages without recovery writes")
            try await loadFreshConnection(host, route: "/pages/settings/blocked", selector: ".blocked-organizer-card")
            _ = try await script(host, "await document.fonts.ready;for(const a of document.getAnimations())if(a.effect?.getComputedTiming().iterations!==Infinity)a.finish();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true")
            try await Task.sleep(nanoseconds: 250_000_000)
            try (try await host.webView.takeSnapshot(configuration: nil)).pngData()!.write(to: folder.appendingPathComponent("blocked-organizers-wkwebview.png"))
            checks += try await script(host, helpers + """
            record('Settings separates institutions from the original personal block',visible('.blocked-organizer-card').textContent.includes('HKUST Student Union')&&!!visible('[data-interaction="blockedList.b.unblock.click.1"]'));const before=localStorage.getItem('cimoa_app_state_v2');await click('blockedList.organizer.unblock.click.1');await click('unblockOpen.closeUnblock.click.2');await wait(()=>!visible('[role=dialog]'));record('Unblock cancellation is read-only',localStorage.getItem('cimoa_app_state_v2')===before);await click('blockedList.organizer.unblock.click.1');await click('unblockOpen.confirmUnblock.click.1');record('Unblock waits for custom Loading',!!visible('.loading')&&localStorage.getItem('cimoa_app_state_v2')===before);await idle();const prior=JSON.parse(before).data,current=state();record('Unblock restores eligibility without changing personal blocks or joined entities',current.event_preferences[0].blocked_organizer_ids.length===0&&!visible('.blocked-organizer-card')&&['memberships','messages','conversations','relationships','coin_transactions','blocked_users','reports'].every(k=>JSON.stringify(current[k])===JSON.stringify(prior[k])));return checks
            """) as! [String]
            try await loadFreshConnection(host, route: "/pages/events/index", selector: ".events-header")
            checks += try await script(host, helpers + """
            record('Refresh restores both organizer recommendations',!!visible('.event-card[data-event-id="event_picnic"]')&&!!visible('.event-card[data-event-id="event_other"]'));return checks
            """) as! [String]
            XCTAssertEqual(checks.count, 13)
            let metrics = try await script(host, "return {origin:location.origin,overflow:document.documentElement.scrollWidth>innerWidth,safe:[getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-top'),getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-bottom')]}") as! [String:Any]
            XCTAssertEqual(metrics["origin"] as? String, BundleHTTPServer.origin); XCTAssertEqual(metrics["overflow"] as? Bool, false)
            try await restore()
            let restored = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String:Any]
            XCTAssertEqual(restored as NSDictionary, snapshot as NSDictionary)
            try JSONSerialization.data(withJSONObject: ["result":"passed","checks":checks,"metrics":metrics,"original_storage_restored":true,"scope":"Organizer feature only, real WKWebView DOM and persisted state; not whole-app visual/production acceptance"], options: [.prettyPrinted,.sortedKeys]).write(to: folder.appendingPathComponent("native-acceptance.json"))
        } catch {
            if let debug = try? await script(host, "return {url:location.href,text:document.body.innerText}") { try? JSONSerialization.data(withJSONObject: debug, options: [.prettyPrinted]).write(to: folder.appendingPathComponent("native-failure.json")) }
            try? await restore(); throw error
        }
    }
    func testCrossPageSyncRefreshAndBlockFiltering() async throws {
        let host = try await rawHost()
        let snapshot = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String:Any]
        let originalScripts = host.webView.configuration.userContentController.userScripts
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let folder = root.appendingPathComponent("docs/evidence/sync-recovery")
        // Unique test-only Blob keys cannot overwrite a user's existing media.
        let nonce = UUID().uuidString
        let raw = try String(contentsOf: folder.appendingPathComponent("native-fixture.json"), encoding: .utf8)
        let encoded = raw.replacingOccurrences(of: "sync_audio", with: "native_sync_\(nonce)_audio").replacingOccurrences(of: "sync_image", with: "native_sync_\(nonce)_image")
        let fixture = try JSONSerialization.jsonObject(with: Data(encoded.utf8)) as! [String:Any]
        let mediaIDs = (fixture["media"] as! [[String:Any]]).map { $0["media_id"] as! String }
        let helpers = """
        const delay=ms=>new Promise(r=>setTimeout(r,ms)),state=()=>JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;
        const visible=s=>[...document.querySelectorAll(s)].find(e=>e.closest('uni-page')===[...document.querySelectorAll('uni-page')].at(-1)&&e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden');
        const wait=async fn=>{for(let i=0;i<200;i++){const value=fn();if(value)return value;await delay(50)}throw Error('Sync timeout '+location.hash+' '+document.body.innerText)};
        const click=async id=>{const e=await wait(()=>visible('[data-interaction="'+id+'"]'));e.scrollIntoView({block:'center'});await delay(280);e.click();await delay(60)};
        const idle=async()=>{await wait(()=>!visible('.event-loading,.loading'));await delay(80)};
        const checks=[],record=(name,pass)=>{if(!pass)throw Error(name);checks.push(name)};
        """
        func resetScripts() {
            host.webView.configuration.userContentController.removeAllUserScripts()
            for item in originalScripts { host.webView.configuration.userContentController.addUserScript(item) }
        }
        func restore() async throws {
            resetScripts()
            let saved = String(data: try JSONSerialization.data(withJSONObject: snapshot), encoding: .utf8)!
            host.webView.configuration.userContentController.addUserScript(WKUserScript(source: "const saved=\(saved);for(const[k,v]of[['cimoa_app_state_v2',saved.state],['cimoa_app_state',saved.legacy]]){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)};", injectionTime: .atDocumentStart, forMainFrameOnly: true))
            try await loadFreshConnection(host, route: "/pages/auth/splash", selector: ".splash-page")
            resetScripts()
            _ = try await host.webView.callAsyncJavaScript("const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_media_v2',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const t=db.transaction('blobs','readwrite');for(const id of ids)t.objectStore('blobs').delete(id);t.oncomplete=resolve;t.onerror=()=>reject(t.error)});db.close();return true", arguments: ["ids":mediaIDs], in: nil, contentWorld: .page)
        }
        var checks = [String]()
        do {
            host.webView.configuration.userContentController.addUserScript(WKUserScript(source: "const fixture=\(encoded);fixture.data.session.expires_at=Date.now()+86400000;localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data:fixture.data}));", injectionTime: .atDocumentStart, forMainFrameOnly: true))
            try await loadFreshConnection(host, route: "/pages/discover/profile?user_id=user_zane", selector: ".expanded-heading")
            resetScripts(); host.publishSafeArea()
            _ = try await host.webView.callAsyncJavaScript("""
            const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_media_v2',1);r.onupgradeneeded=()=>r.result.createObjectStore('blobs');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
            const files=await Promise.all(items.map(async row=>[row.media_id,row.base64?new Blob([Uint8Array.from(atob(row.base64),c=>c.charCodeAt(0))],{type:row.mime}):await(await fetch(row.source)).blob()]));
            await new Promise((resolve,reject)=>{const t=db.transaction('blobs','readwrite');for(const[id,blob]of files)t.objectStore('blobs').add(blob,id);t.oncomplete=resolve;t.onerror=()=>reject(t.error)});db.close();return true
            """, arguments: ["items":fixture["media"]!], in: nil, contentWorld: .page)
            checks += try await script(host, helpers + """
            await wait(()=>visible('.expanded-photo .profile-photo')?.dataset.mediaStatus==='ready');const before=localStorage.getItem('cimoa_app_state_v2');await click('expanded.nextPhoto.click.1');await click('expanded.openGallery.click.2');await wait(()=>visible('[role=dialog]')?.textContent.includes('Photo 2 of 3'));await click('expanded.gallery.close.click.1');record('Three-photo gallery remains canonical and read-only',localStorage.getItem('cimoa_app_state_v2')===before);return checks
            """) as! [String]
            try await loadFreshConnection(host, route: "/pages/messages/chat?conversation_id=conversation_chloe", selector: ".chat-composer")
            checks += try await script(host, helpers + """
            await idle();await wait(()=>visible('.chat-image .profile-photo')?.dataset.mediaStatus==='ready');await wait(()=>visible('.event-audio-button')?.getAttribute('aria-disabled')==='false');
            await click('chat.image.open.click.1');await wait(()=>visible('.chat-full-photo .profile-photo')?.dataset.mediaStatus==='ready');await click('chat.image.close.click.1');
            const audioMessage=state().messages.find(m=>m.message_id==='sync_private_audio'),db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_media_v2',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}),blob=await new Promise((resolve,reject)=>{const r=db.transaction('blobs').objectStore('blobs').get(audioMessage.media_id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();const decoder=new(window.AudioContext||window.webkitAudioContext)();let duration=0;try{duration=(await decoder.decodeAudioData(await blob.arrayBuffer())).duration}finally{await decoder.close()}record('IndexedDB image preview and encoded audio decode in WebKit without autoplay',Math.abs(duration-1)<.1);
            // A DOM .click() is not a trusted OS touch. Do not disable the host's
            // media policy or mislabel its real rejection as a playback success.
            await click('chat.media.play.click.1');await wait(()=>visible('.event-audio [role=alert]'));record('Untrusted playback is rejected with retry feedback, never fake playing state',visible('.event-audio [role=alert]').textContent==='Playback was blocked. Tap play to try again.'&&!visible('[aria-label="Pause voice message"]'));
            const field=visible('uni-input[aria-label="Message"] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'Native sync message');field.dispatchEvent(new Event('input',{bubbles:true}));await delay(60);const before=localStorage.getItem('cimoa_app_state_v2');await click('chat.send.click.1');visible('[data-interaction="chat.send.click.1"]').click();record('Custom Loading precedes a single message write',!!visible('.event-loading')&&localStorage.getItem('cimoa_app_state_v2')===before);await wait(()=>state().messages.some(m=>m.body==='Native sync message'));await idle();record('Repeated send creates one canonical message',state().messages.filter(m=>m.body==='Native sync message').length===1);
            await click('chat.viewProfile.click.1');await wait(()=>visible('.expanded-heading'));record('Connected profile uses Chat CTA',visible('[data-interaction="expanded.sayHi.click.1"]').textContent==='Chat');await click('expanded.sayHi.click.1');await wait(()=>visible('.chat-composer'));await delay(350);record('Chat CTA returns to the exact existing conversation',location.hash.includes('conversation_chloe'));return checks
            """) as! [String]
            let chatSnapshot = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
            try await loadFreshConnection(host, route: "/pages/messages/chat?conversation_id=conversation_chloe", selector: ".chat-composer")
            checks += try await script(host, helpers + """
            await idle();await wait(()=>visible('.chat-image .profile-photo')?.dataset.mediaStatus==='ready');await wait(()=>visible('.event-audio-button')?.getAttribute('aria-disabled')==='false');record('Fresh chat document restores media without duplicate messages',state().messages.filter(m=>m.body==='Native sync message').length===1&&!visible('.event-audio [role=alert]'));return checks
            """) as! [String]
            let restoredChat = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as? String
            XCTAssertEqual(restoredChat, chatSnapshot)
            try await loadFreshConnection(host, route: "/pages/home/index", selector: ".home-header")
            checks += try await script(host, helpers + """
            const card=await wait(()=>visible('#connection-user_chloe'));record('Home card targets the same private conversation',card.dataset.target==='/pages/messages/chat?conversation_id=conversation_chloe');card.click();await wait(()=>visible('.chat-composer'));await idle();record('Home opens the saved conversation and latest message',visible('.chat-messages').textContent.includes('Native sync message'));return checks
            """) as! [String]
            try await loadFreshConnection(host, route: "/pages/events/detail?event_id=event_picnic", selector: "[data-event-count]")
            checks += try await script(host, helpers + """
            record('Detail count uses privacy-filtered membership',visible('[data-event-count]').textContent==='3 of 20 going');await click('evDetail.openParticipantsList.click.1');await wait(()=>visible('.event-person'));record('Participants use exactly the same visibility count',[...document.querySelectorAll('.event-person')].filter(e=>e.closest('uni-page')===[...document.querySelectorAll('uni-page')].at(-1)).length===3);return checks
            """) as! [String]
            try await loadFreshConnection(host, route: "/pages/events/group?event_id=event_picnic&conversation_id=group_picnic", selector: ".event-group-composer")
            checks += try await script(host, helpers + """
            await idle();record('Group header shares the same visible participant count',visible('.event-group-heading').textContent.includes('3 participants'));await click('eventGroup.media.preview.click.1');await wait(()=>visible('.event-media-preview .profile-photo')?.dataset.mediaStatus==='ready');await click('eventGroup.media.close.click.2');await wait(()=>!visible('[role=dialog]'));await wait(()=>visible('.event-audio-button')?.getAttribute('aria-disabled')==='false');record('Group image and audio resolve from persisted binary media',!visible('.event-audio [role=alert]'));return checks
            """) as! [String]
            let groupSnapshot = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
            try await loadFreshConnection(host, route: "/pages/events/group?event_id=event_picnic&conversation_id=group_picnic", selector: ".event-group-composer")
            _ = try await script(host, helpers + "await idle();await wait(()=>visible('.event-message-image .profile-photo')?.dataset.mediaStatus==='ready');return true")
            let restoredGroup = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as? String
            XCTAssertEqual(restoredGroup, groupSnapshot)
            try await loadFreshConnection(host, route: "/pages/discover/profile?user_id=user_chloe", selector: ".expanded-heading")
            checks += try await script(host, helpers + """
            await click('expanded.openSafetyMini.click.1');await click('sheetSafetyMini.openBlock.click.1');const before=localStorage.getItem('cimoa_app_state_v2');await click('sheetBlock.confirmBlock.click.1');record('Block waits for Loading before shared state changes',!!visible('.event-loading')&&localStorage.getItem('cimoa_app_state_v2')===before);await wait(()=>visible('.discover-header'));record('Block removes private consent and conversation together',state().blocked_users.some(b=>b.user_id==='user_chloe')&&!state().conversations.some(c=>c.conversation_id==='conversation_chloe'));return checks
            """) as! [String]
            try await loadFreshConnection(host, route: "/pages/events/group?event_id=event_picnic&conversation_id=group_picnic", selector: ".event-group-composer")
            checks += try await script(host, helpers + """
            await idle();record('Refreshed group filters blocked text and media',visible('.event-group-heading').textContent.includes('2 participants')&&!visible('[data-message-id="group_message_0"],[data-message-id="sync_group_audio"],[data-message-id="sync_group_image"]')&&!visible('.event-audio-button'));record('Filtering does not cancel actual event membership',state().memberships.some(m=>m.user_id===state().session.current_user_id&&m.event_id==='event_picnic'&&m.status==='joined'));await document.fonts.ready;for(const a of document.getAnimations())if(a.effect?.getComputedTiming().iterations!==Infinity)a.finish();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return checks
            """) as! [String]
            try await Task.sleep(nanoseconds: 250_000_000)
            try (try await host.webView.takeSnapshot(configuration: nil)).pngData()!.write(to: folder.appendingPathComponent("group-blocked-wkwebview.png"))
            try await loadFreshConnection(host, route: "/pages/messages/chat?conversation_id=conversation_chloe", selector: ".chat-state")
            checks += try await script(host, helpers + "record('Old private URL fails closed after block and fresh document',!!visible('.chat-state[role=alert]')&&!visible('.chat-composer'));return checks") as! [String]
            try await loadFreshConnection(host, route: "/pages/settings/blocked", selector: ".settings-blocked-page")
            checks += try await script(host, helpers + """
            const card=[...document.querySelectorAll('.blocked-card')].find(e=>e.textContent.includes('Chloe Lin'));card.querySelector('[data-interaction="blockedList.b.unblock.click.1"]').click();await click('unblockOpen.confirmUnblock.click.1');await idle();record('Unblock restores visibility but not old private consent',!state().blocked_users.some(b=>b.user_id==='user_chloe')&&!state().conversations.some(c=>c.conversation_id==='conversation_chloe'));return checks
            """) as! [String]
            try await loadFreshConnection(host, route: "/pages/discover/profile?user_id=user_chloe", selector: ".expanded-heading")
            checks += try await script(host, helpers + """
            record('Unblocked refreshed profile cannot reuse old Chat CTA',visible('[data-interaction="expanded.sayHi.click.1"]').textContent==='Send shot');return checks
            """) as! [String]
            XCTAssertEqual(checks.count, 21)
            let metrics = try await script(host, "return {origin:location.origin,overflow:document.documentElement.scrollWidth>innerWidth,safe:[getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-top'),getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-bottom')]}") as! [String:Any]
            XCTAssertEqual(metrics["origin"] as? String, BundleHTTPServer.origin); XCTAssertEqual(metrics["overflow"] as? Bool, false)
            try await restore()
            let finalSnapshot = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String:Any]
            XCTAssertEqual(finalSnapshot as NSDictionary, snapshot as NSDictionary)
            try JSONSerialization.data(withJSONObject: ["result":"passed","checks":checks,"metrics":metrics,"original_storage_restored":true,"test_blob_keys_removed":mediaIDs,"scope":"Real WKWebView DOM/bridge and binary media; encoded test tone, not microphone recording, peer delivery or manual OS touch"], options: [.prettyPrinted,.sortedKeys]).write(to: folder.appendingPathComponent("native-cross-page.json"))
        } catch {
            if let failure = try? await script(host, "return {url:location.href,text:document.body.innerText}") { try? JSONSerialization.data(withJSONObject: failure, options: [.prettyPrinted]).write(to: folder.appendingPathComponent("native-cross-page-failure.json")) }
            try? await restore(); throw error
        }
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
    func testEventGroupSourceAndReadRecovery() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String:Any]
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let output = root.appendingPathComponent("docs/ui-restoration/event-group")
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: output.appendingPathComponent("native-fixture.json"))) as! [String:Any]
        let originalScripts = host.webView.configuration.userContentController.userScripts
        func resetScripts() {
            host.webView.configuration.userContentController.removeAllUserScripts()
            for item in originalScripts { host.webView.configuration.userContentController.addUserScript(item) }
        }
        func restore() async throws {
            resetScripts()
            let encoded = String(data: try JSONSerialization.data(withJSONObject: saved), encoding: .utf8)!
            host.webView.configuration.userContentController.addUserScript(WKUserScript(source: "const snapshot=\(encoded);for(const[key,value]of[['cimoa_app_state_v2',snapshot.state],['cimoa_app_state',snapshot.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)};", injectionTime: .atDocumentStart, forMainFrameOnly: true))
            try await loadFreshConnection(host, route: "/pages/auth/splash", selector: ".splash-page")
            resetScripts()
        }
        do {
            let encoded = String(data: try JSONSerialization.data(withJSONObject: fixture["data"]!), encoding: .utf8)!
            host.webView.configuration.userContentController.addUserScript(WKUserScript(source: "const fixture=\(encoded);fixture.session.expires_at=Date.now()+86400000;localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data:fixture}));", injectionTime: .atDocumentStart, forMainFrameOnly: true))
            try await loadFreshConnection(host, route: fixture["route"] as! String, selector: ".event-group-composer")
            resetScripts()
            _ = try await script(host, "const delay=ms=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<40;i++){if(!document.querySelector('.event-loading'))break;await delay(50)}await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));for(const a of document.getAnimations())if(a.effect?.getComputedTiming().iterations!==Infinity)a.finish();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true")
            let metrics = try await script(host, """
            const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
            const data=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;
            const messageStyles=['.event-group-messages','.event-message','.event-message-main','.event-message-bubble','.event-message-bubble uni-text'].map(selector=>{const e=document.querySelector(selector),c=getComputedStyle(e);return{selector,box:box(selector),font:c.font,width:c.width,maxWidth:c.maxWidth,flex:c.flex,whiteSpace:c.whiteSpace,wordBreak:c.wordBreak,overflowWrap:c.overflowWrap}});
            return {header:box('.event-group-header'),footer:box('.event-group-composer'),safeTop:box('.event-group-page > .safe-area').height,width:innerWidth,height:innerHeight,messageStyles,mineAvatars:document.querySelectorAll('.event-message--mine .event-message-avatar').length,read:data.messages.find(m=>m.message_id==='group_pixel_1').read_by,placeholder:document.querySelector('.event-group-composer .uni-input-placeholder').textContent,state:localStorage.getItem('cimoa_app_state_v2')}
            """) as! [String:Any]
            let footer = metrics["footer"] as! [String:Double], header = metrics["header"] as! [String:Double]
            XCTAssertEqual(header["height"]!, 80 * (metrics["width"] as! Double) / 393, accuracy: 1)
            XCTAssertEqual(metrics["safeTop"] as! Double, Double(host.view.safeAreaInsets.top), accuracy: 1)
            XCTAssertLessThanOrEqual(footer["bottom"]!, (metrics["height"] as! Double) - Double(host.view.safeAreaInsets.bottom) + 1)
            XCTAssertEqual(metrics["mineAvatars"] as? Int, 1)
            XCTAssertEqual(metrics["placeholder"] as? String, "Message the group")
            let messageStyles = metrics["messageStyles"] as! [[String:Any]]
            let firstBubble = messageStyles.first { $0["selector"] as? String == ".event-message-bubble" }!["box"] as! [String:Double]
            XCTAssertLessThan(firstBubble["height"]!, 60 * (metrics["width"] as! Double) / 393, "Short messages must not acquire an extra pre-wrap line in WebKit")
            XCTAssertTrue((metrics["read"] as! [String]).contains("user_cimoa"))
            let image = try await host.webView.takeSnapshot(configuration: nil)
            try image.pngData()!.write(to: output.appendingPathComponent("actual-wkwebview.png"))
            try JSONSerialization.data(withJSONObject: metrics.filter { $0.key != "state" }, options: [.prettyPrinted, .sortedKeys]).write(to: output.appendingPathComponent("wkwebview-metrics.json"))
            let attachment = XCTAttachment(image: image); attachment.name = "Events group source layout and native safe area"; attachment.lifetime = .keepAlways; add(attachment)
            try await loadFreshConnection(host, route: fixture["route"] as! String, selector: ".event-group-composer")
            try await Task.sleep(nanoseconds: 650_000_000)
            let recovered = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
            XCTAssertEqual(recovered, metrics["state"] as? String)
            let result = try await script(host, """
            const delay=ms=>new Promise(r=>setTimeout(r,ms)),visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0),wait=async fn=>{for(let i=0;i<120;i++){if(fn())return;await delay(50)}throw Error('Group regression timeout '+location.hash)},click=async id=>{await delay(350);visible('[data-interaction="'+id+'"]').click();await delay(60)};
            await click('evGroup.openGroupMenu.click.1');await click('eventGroup.menu.participants.click.1');await wait(()=>visible('.event-participants-page'));const count=document.querySelectorAll('.event-person').length;
            await click('evParticipants.goBack.click.1');await wait(()=>visible('.event-group-page'));await click('evGroup.openGroupMenu.click.1');await click('eventGroup.menu.report.click.1');await wait(()=>visible('.event-report-page'));
            const attendanceBefore=JSON.stringify(JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.memberships);[...document.querySelectorAll('[role=radio]')].find(e=>e.textContent.includes('Unsafe activity')).click();await click('evReport.submitEvReport.click.1');await wait(()=>visible('.event-report-saved'));
            const reported=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;if(attendanceBefore!==JSON.stringify(reported.memberships))throw Error('Report changed attendance');const reportTarget=reported.reports.at(-1)?.target_id;
            await click('evReport.goBack.click.2');await wait(()=>visible('.event-group-page'));await click('evGroup.openGroupMenu.click.1');await click('eventGroup.menu.manage.click.1');await click('sheetEvCancel.cancelAttendance.click.1');await wait(()=>visible('.event-group-page [role=alert]'));
            return {count,reportTarget,messages:document.querySelectorAll('.event-message').length,composer:!!visible('.event-group-composer')}
            """) as! [String:Any]
            XCTAssertEqual(result["count"] as? Int, 4); XCTAssertEqual(result["messages"] as? Int, 0); XCTAssertEqual(result["composer"] as? Bool, false); XCTAssertEqual(result["reportTarget"] as? String, "event_picnic")
            try await restore()
        } catch { try? await restore(); throw error }
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
    func testDirectChatRealMicrophoneAndCleanup() async throws {
        let host = try await rawHost()
        let saved = try await script(host, "return {state:localStorage.getItem('cimoa_app_state_v2'),legacy:localStorage.getItem('cimoa_app_state')}") as! [String:Any]
        let existing = try await script(host, "return JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.media_files.map(m=>m.media_id)") as! [String]
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("docs/ui-restoration/connection-chat/native-fixture.json"))) as! [String:Any]
        let originalScripts=host.webView.configuration.userContentController.userScripts
        func restoreScripts() { host.webView.configuration.userContentController.removeAllUserScripts();for item in originalScripts {host.webView.configuration.userContentController.addUserScript(item)} }
        func restore() async throws {
            restoreScripts()
            let ids = try await script(host, "return JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.media_files.map(m=>m.media_id)") as! [String]
            host.webView.load(URLRequest(url:URL(string:BundleHTTPServer.origin+"/index.html?directMicCleanup=\(UUID().uuidString)#/pages/auth/splash")!))
            for _ in 0..<60 { if !host.webView.isLoading {break};try await Task.sleep(nanoseconds:50_000_000) }
            _ = try await host.webView.callAsyncJavaScript("""
            const ids=created.filter(id=>!existing.includes(id));if(ids.length){const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cimoa_media_v2',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const t=db.transaction('blobs','readwrite');ids.forEach(id=>t.objectStore('blobs').delete(id));t.oncomplete=resolve;t.onerror=()=>reject(t.error)});db.close()}for(const[key,value]of[['cimoa_app_state_v2',saved.state],['cimoa_app_state',saved.legacy]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}return true
            """,arguments:["created":ids,"existing":existing,"saved":saved],in:nil,contentWorld:.page)
            host.webView.load(URLRequest(url:URL(string:BundleHTTPServer.origin+"/index.html?directMicRestored=\(UUID().uuidString)#/pages/auth/splash")!))
        }
        do {
            let encoded=String(data:try JSONSerialization.data(withJSONObject:fixture["data"]!),encoding:.utf8)!
            host.webView.configuration.userContentController.addUserScript(WKUserScript(source:"const data=\(encoded);data.session.expires_at=Date.now()+86400000;for(const m of data.messages)if(m.conversation_id==='conversation_chloe')m.read_by=['user_cimoa','user_chloe'];localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data}));",injectionTime:.atDocumentStart,forMainFrameOnly:true))
            try await loadFreshConnection(host,route:"/pages/messages/chat?conversation_id=conversation_chloe",selector:".chat-composer")
            restoreScripts()
            // User authorized a short microphone test; no captured bytes are exported.
            _ = try await script(host, "document.querySelector('[data-interaction=\"chat.sendVoiceMsg.click.1\"]').click();return true")
            try await Task.sleep(nanoseconds: 300_000_000)
            _ = try await script(host, "document.querySelector('[data-interaction=\"chat.media.record.click.1\"]').click();return true")
            var recording = false
            for _ in 0..<200 {
                if (try? await script(host, "return document.querySelector('[data-interaction=\"chat.media.record.click.1\"]')?.textContent.trim()==='Stop recording'")) as? Bool == true { recording = true; break }
                if (try? await script(host, "return !!document.querySelector('.event-dialog-error')?.textContent.trim()")) as? Bool == true { break }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            guard recording else { throw NSError(domain:"CimoaTests",code:41,userInfo:[NSLocalizedDescriptionKey:"Direct microphone did not start"]) }
            try await Task.sleep(nanoseconds: 2_000_000_000)
            _ = try await script(host, "document.querySelector('[data-interaction=\"chat.media.record.click.1\"]').click();return true")
            try await waitForPreparedAudio(host, selector:"[data-interaction=\"chat.media.preview.click.1\"]")
            _ = try await script(host, "document.querySelector('[data-interaction=\"chat.media.send.click.1\"]').click();return true")
            try await waitForPreparedAudio(host, selector:"[data-interaction=\"chat.media.play.click.1\"]")
            let voice = try await script(host, "const d=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data,m=d.messages.at(-1),file=d.media_files.find(f=>f.media_id===m.media_id);return {kind:m.kind,duration:file?.duration_ms,state:localStorage.getItem('cimoa_app_state_v2')}") as! [String:Any]
            XCTAssertEqual(voice["kind"] as? String,"audio"); XCTAssertGreaterThan(voice["duration"] as? Double ?? 0,1000)
            try await loadFreshConnection(host, route:"/pages/messages/chat?conversation_id=conversation_chloe", selector:".chat-composer")
            try await waitForPreparedAudio(host, selector:"[data-interaction=\"chat.media.play.click.1\"]")
            let playback = try await script(host, "document.querySelector('[data-interaction=\"chat.media.play.click.1\"]').click();for(let i=0;i<100;i++){if(document.querySelector('[aria-label=\"Pause voice message\"]'))return true;await new Promise(r=>setTimeout(r,30))}return false") as? Bool
            XCTAssertEqual(playback,true)
            let voiceRestored = try await script(host,"return localStorage.getItem('cimoa_app_state_v2')") as? String
            XCTAssertEqual(voiceRestored,voice["state"] as? String)

            try await restore()
            try JSONSerialization.data(withJSONObject:["result":"passed","duration_ms":voice["duration"]!,"playback_after_refresh":playback==true,"test_blob_removed":true,"snapshot_restored":true,"recording_bytes_exported":false],options:[.prettyPrinted,.sortedKeys]).write(to:root.appendingPathComponent("docs/ui-restoration/connection-chat/wkwebview-real-microphone.json"))
        } catch {
            let diagnostics = try? await script(host,"return {text:document.body.innerText,audio_inputs:(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput').length}")
            if let diagnostics {let details=diagnostics as? [String:Any];let blocked=(details?["audio_inputs"] as? Int)==0;try? JSONSerialization.data(withJSONObject:["result":blocked ? "blocked" : "failed","diagnostics":diagnostics],options:[.prettyPrinted,.sortedKeys]).write(to:root.appendingPathComponent("docs/ui-restoration/connection-chat/wkwebview-real-microphone.json"))}
            try? await restore();throw error
        }
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
            try await installConnectionChatFixture(host)
            try await loadFreshConnection(host, route: "/pages/messages/chat?conversation_id=conversation_chloe", selector: ".chat-composer")
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

            let imagePreview = try await script(host, """
            const delay=ms=>new Promise(r=>setTimeout(r,ms));document.querySelector('[data-interaction="chat.image.open.click.1"]').click();for(let i=0;i<100;i++){const photo=document.querySelector('.chat-full-photo .profile-photo[data-media-status="ready"]');if(photo){const contained=getComputedStyle(photo.querySelector('img')).objectFit==='contain';document.querySelector('.chat-full-photo').closest('[role="dialog"]').querySelector('[data-interaction="chat.image.close.click.1"]').click();return contained}await delay(30)}throw Error('Native full photo did not decode');
            """) as? Bool
            XCTAssertEqual(imagePreview,true)
            let safety = try await script(host, """
            const delay=ms=>new Promise(r=>setTimeout(r,ms)),visible=s=>[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().height>0),state=()=>JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;
            const wait=async fn=>{for(let i=0;i<200;i++){const v=fn();if(v)return v;await delay(50)}throw Error('Safety timeout '+location.hash+' '+document.body.innerText)};
            const click=async id=>{const e=await wait(()=>visible('[data-interaction="'+id+'"]'));await delay(320);e.click();await delay(80)};
            const beforeCall=localStorage.getItem('cimoa_app_state_v2');await click('chat.startCall.click.1');await wait(()=>visible('.waiting-call-page'));const waitingOnly=!!visible('.waiting-call-own')&&!document.querySelector('video');await click('callActive.endCall.click.1');await wait(()=>visible('.direct-chat-page'));const oldCallState=JSON.parse(beforeCall).data;const callUnchanged=JSON.stringify(state().messages)===JSON.stringify(oldCallState.messages)&&state().call_sessions.at(-1).ended_at!==null;
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
    func testConnectedProfileChatCTAInRealWebKit() async throws {
        let host = try await host()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?profileChat=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header")
        }
        do {
            try await installConnectionChatFixture(host)
            try await loadFreshConnection(host, route: "/pages/messages/chat?conversation_id=conversation_chloe", selector: ".chat-composer")
            try await waitFor(host, ".direct-chat-page")
            let result = try await script(host, """
            const delay=ms=>new Promise(r=>setTimeout(r,ms));
            const visible=s=>[...document.querySelectorAll(s)].find(e=>{const r=e.getBoundingClientRect(),style=getComputedStyle(e);return r.height>0&&style.display!=='none'&&style.visibility!=='hidden'});
            const wait=async fn=>{for(let i=0;i<200;i++){const value=fn();if(value)return value;await delay(50)}throw Error('Profile Chat timeout '+location.hash+' '+document.body.innerText)};
            const click=async id=>{const element=await wait(()=>visible('[data-interaction="'+id+'"]'));await delay(320);element.click();await delay(80)};
            const before=localStorage.getItem('cimoa_app_state_v2');
            await click('chat.viewProfile.click.1');const profile=await wait(()=>visible('.expanded-profile-page'));const profileDepth=profile.dataset.pageDepth,label=visible('[data-interaction="expanded.sayHi.click.1"]')?.textContent.trim();
            await click('expanded.sayHi.click.1');const chat=await wait(()=>visible('.direct-chat-page'));const chatDepth=chat.dataset.pageDepth;
            return {label,profileDepth,chatDepth,conversation:location.hash.includes('conversation_id=conversation_chloe'),unchanged:localStorage.getItem('cimoa_app_state_v2')===before};
            """) as! [String: Any]
            XCTAssertEqual(result["label"] as? String, "Chat")
            XCTAssertEqual(result["profileDepth"] as? String, "2"); XCTAssertEqual(result["chatDepth"] as? String, "1")
            XCTAssertEqual(result["conversation"] as? Bool, true); XCTAssertEqual(result["unchanged"] as? Bool, true)
            try await restore()
        } catch { try? await restore(); throw error }
    }
    func testDiscoverDeckProfilesAndBundledAudioInRealWebKit() async throws {
        let host = try await host()
        let saved = try await script(host, "return localStorage.getItem('cimoa_app_state_v2')") as! String
        func restore() async throws {
            _ = try await host.webView.callAsyncJavaScript("localStorage.setItem('cimoa_app_state_v2',snapshot);return true", arguments: ["snapshot": saved], in: nil, contentWorld: .page)
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?discoverDeck=restored#/pages/home/index")!))
            try await waitFor(host, ".home-header")
        }
        do {
            host.webView.load(URLRequest(url: URL(string: BundleHTTPServer.origin + "/index.html?discoverDeck=native#/pages/discover/index")!))
            try await waitFor(host, ".discover-photo-card--front")
            let result = try await script(host, """
            const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
            const visible=selector=>[...document.querySelectorAll(selector)].find(element=>element.getBoundingClientRect().height>0);
            const wait=async fn=>{for(let index=0;index<200;index++){const value=fn();if(value)return value;await delay(50)}throw Error('Discover timeout '+location.hash+' '+document.body.innerText)};
            await document.fonts.ready;await Promise.all([...document.querySelectorAll('.discover-photo-card img')].map(image=>image.decode()));
            const before=localStorage.getItem('cimoa_app_state_v2');
            const card=visible('.discover-photo-card--front'),viewport=visible('.main-tab-scroll'),info=card.querySelector('.discover-info');
            const cardRect=card.getBoundingClientRect(),viewportRect=viewport.getBoundingClientRect(),infoRect=info.getBoundingClientRect(),scale=innerWidth/393;
            const swipeCurrent=async()=>{const active=visible('.discover-photo-card--front'),rect=active.getBoundingClientRect(),startX=rect.x+rect.width/2,startY=rect.y+rect.height/2,endX=startX-rect.width*.42,dispatch=(type,x)=>active.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:51,pointerType:'touch',isPrimary:true,clientX:x,clientY:startY,button:0}));dispatch('pointerdown',startX);for(let step=1;step<=8;step++)dispatch('pointermove',startX+(endX-startX)*step/8);dispatch('pointerup',endX);await delay(420)};
            const total=JSON.parse(before).data.users.filter(row=>Number.isInteger(row.discover_order)).length,sourceIds=[];for(let index=0;index<6;index++){sourceIds.push(visible('.discover-photo-card--front')?.dataset.userId);await swipeCurrent()}for(let index=0;index<64&&visible('.discover-photo-card--front')?.dataset.userId!=='user_zane';index++)await swipeCurrent();await swipeCurrent();
            const swiped=visible('.discover-photo-card--front')?.dataset.userId,next=visible('.discover-photo-card--back')?.dataset.userId;
            visible('.discover-photo-card--front').click();await wait(()=>visible('.expanded-profile-page'));await delay(300);
            const photoSources=[];for(let index=0;index<3;index++){const image=await wait(()=>visible('.expanded-photo .profile-photo[data-media-status="ready"] img'));photoSources.push(image.getAttribute('src'));if(index<2){visible('.expanded-photo-hit--next').click();await delay(180)}}
            const transcript=visible('.profile-voice-transcript')?.textContent;
            const audioURL=visible('.profile-voice-intro')?.dataset.audioUrl;
            const range=await fetch(audioURL,{headers:{Range:'bytes=0-1023'}}),rangeBytes=(await range.arrayBuffer()).byteLength;
            const full=await fetch(audioURL),audioBlob=await full.blob();
            visible('[data-interaction="expanded.collapse.click.1"]').click();await wait(()=>visible('.discover-photo-card--front'));await delay(300);
            return {sourceIds,first:'user_zane',swiped,next,cardHeight:cardRect.height,maxHeight:542*scale,cardBottom:cardRect.bottom,viewportBottom:viewportRect.bottom,infoBottom:infoRect.bottom,scrollTop:viewport.querySelector('.uni-scroll-view-scrollbar-hidden')?.scrollTop||0,photos:photoSources.length,photoSources,transcript,rangeStatus:range.status,rangeBytes,contentRange:range.headers.get('content-range'),acceptRanges:range.headers.get('accept-ranges'),fullStatus:full.status,blobType:audioBlob.type,blobBytes:audioBlob.size,returned:visible('.discover-photo-card--front')?.dataset.userId,unchanged:before===localStorage.getItem('cimoa_app_state_v2'),forbidden:/本地数据|模拟数据/.test(document.body.innerText)};
            """) as! [String: Any]
            XCTAssertEqual(result["sourceIds"] as? [String], ["user_zane", "user_linden", "user_evan", "user_coco", "user_anna", "user_bella"])
            XCTAssertEqual(result["swiped"] as? String, "user_linden"); XCTAssertEqual(result["next"] as? String, "user_evan"); XCTAssertEqual(result["returned"] as? String, "user_linden")
            XCTAssertLessThanOrEqual(result["cardHeight"] as! Double, (result["maxHeight"] as! Double) + 1)
            XCTAssertLessThanOrEqual(result["cardBottom"] as! Double, (result["viewportBottom"] as! Double) + 1)
            XCTAssertLessThanOrEqual(result["infoBottom"] as! Double, (result["cardBottom"] as! Double) + 1); XCTAssertEqual(result["scrollTop"] as? Int, 0)
            XCTAssertEqual(result["photos"] as? Int, 3); XCTAssertTrue((result["photoSources"] as? [String] ?? []).contains { $0.contains("discover/linden/photo-3.jpg") })
            XCTAssertEqual(result["transcript"] as? String, "Hi, I'm Linden. I'm into photography, music, and slow walks around sunset. I can be a little quiet at first, but once I warm up, I always have plenty to say. What song have you had on repeat lately? Send it my way.")
            XCTAssertEqual(result["rangeStatus"] as? Int, 206); XCTAssertEqual(result["rangeBytes"] as? Int, 1024)
            XCTAssertTrue((result["contentRange"] as? String ?? "").hasPrefix("bytes 0-1023/")); XCTAssertEqual(result["acceptRanges"] as? String, "bytes")
            XCTAssertEqual(result["fullStatus"] as? Int, 200); XCTAssertEqual(result["blobType"] as? String, "audio/mpeg"); XCTAssertGreaterThan(result["blobBytes"] as? Int ?? 0, 80_000)
            let bundledAudio = Bundle.main.resourceURL!.appendingPathComponent("H5/static/assets/discover/linden/voice-intro.mp3")
            let nativeDuration = try await AVURLAsset(url: bundledAudio).load(.duration).seconds
            XCTAssertEqual(nativeDuration, 14.04, accuracy: 0.1)
            XCTAssertEqual(result["unchanged"] as? Bool, true); XCTAssertEqual(result["forbidden"] as? Bool, false)
            let attachment = XCTAttachment(image: try await host.webView.takeSnapshot(configuration: nil)); attachment.name = "WKWebView Discover swipe deck"; attachment.lifetime = .keepAlways; add(attachment)
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
            await open('#/pages/auto-match/index');const beforeMatch=state();visible('[data-interaction="amEntry.joinPool.click.1"]').click();await wait(()=>visible('[data-interaction="amSearching.pauseQueue.click.1"]'));const matchFailure=state()!==beforeMatch&&JSON.parse(state()).data.match_sessions.some(row=>row.engine==='device'&&row.status==='searching');
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
