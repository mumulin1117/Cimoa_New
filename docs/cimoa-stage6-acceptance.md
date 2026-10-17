# Cimoa 整体验收状态

2026-10-17 Profile、设置、安全、金币增量：154项数据测试与本轮浏览器功能回归通过，H5继续由独立项目构建并打包到WKWebView；当前原生结果、资源校验和仍待验收项见[本轮记录](./cimoa-profile-settings-coins-acceptance.md)。未配置支付、大学认证和客服服务不会假成功。本轮不宣告完整视觉或全App验收通过；以下旧的阶段范围与数字仅用于历史追溯。

2026-10-17 Auto Match 增量：[本轮报告](./cimoa-auto-match-acceptance.md)。146项数据测试、11页浏览器来源对照、6组跨页、15组边界和原生12/12通过，含真实后台恢复与双账号明确接受。金币相关依赖页仍pending，Auto Match全量验收与全App完成不冒标verified。下文较早统计和服务范围均为历史记录。

2026-10-14增量：同一H5在普通浏览器完成本轮依赖页无宿主降级验证，并在iPhone 17 Pro Simulator（iOS 26.5）由`cimoaNeapo`包内HTTP origin加载，完整HostTests 11/11通过。新增覆盖免费文字连接请求、Profile偏好、认证/Auto Match真实失败边界、权限说明、金币失败与系统状态；既有套件继续覆盖安全区、键盘、三Tab、媒体刷新、持久化与桥接白名单。实体麦克风/相机、真实matching service和大学认证服务未配置，生产成功路径仍pending，不能声明全App还原完成。详见[阶段5依赖流程](./cimoa-stage5-dependency-flows.md)。

## 最新增量：活动二级页面（2026-10-14）

详情、参与者、报名成功、我的活动、群聊已完成本页还原和本地闭环验收；报名/取消同步人数、名额、当前报名、我的活动以及群访问权限。文字与媒体经真实持久化、失败补偿和刷新验证。详见[本轮范围、文件及边界](./cimoa-event-pages.md)。

87项非浏览器单元、10组活动链路Chrome、19组Events/主Tab回归通过。EventPagesFullRegression.xcresult在iPhone17Pro/iOS26.5完成8/8，无失败或跳过；活动新增用例含真实WKWebView路由、人数同步、图片Blob保存/刷新、安全区与取消后权限撤销。媒体测试不冒称手动系统相册、实体麦克风或软键盘触摸验收。

当前41条注册路由、38/103计划路由匹配、65条待补；五页local passed/full pending、无in_progress、verified仍0。只本地提交、不推送；活动举报、主办方拉黑、参与者的他人详情等依赖尚未完成。原HTML保持不变，不在运行包中。后续段落均为历史证据，不覆盖本次新增范围。

本轮[原生8项摘要](./evidence/event-pages/native-acceptance.json)、[最终原生截图](./evidence/event-pages/native-final/manifest.json)、[导出包核验](./evidence/event-pages/package.json)已留存。独立包195份H5与浏览器/测试App/正常App一致，正常版已在iPhone17Pro运行；临时预览已清理。约定检查、diff检查、H5构建依次通过，无约定警告。

## 最新增量：个人资料与账号闭环（2026-10-14）

本轮局部闭环通过，不是全App完成。80项单元、17组资料账号H5、完整注册18组、Profile20/Home22/Discover20/Events19回归通过。`ProfileAccountAcceptance-3.xcresult`在iPhone17Pro/iOS26.5最终7/7通过（0失败/跳过）：真实新注册账号复用注册数据，资料/照片/兴趣/目标/破冰、来源返回、退出取消/确认、错误密码/重登、单次骨架及刷新恢复。见[记录](./cimoa-profile-account-loop.md)、[原生摘要](./evidence/profile-account-native/acceptance.json)、[截图附件](./evidence/profile-account-native/manifest.json)。系统相册弹窗与硬件/键盘实际触摸未包含在自动通过项中。

最终三项强制命令通过、无约定警告。独立工程包215条目，182份H5与浏览器构建/原生测试/正常App逐文件相同，见[当前打包报告](./evidence/profile-account-native/package.json)。正常版已安装并运行在iPhone17Pro，保留原数据；临时测试服务与隔离浏览器已退出。仅本地提交，不push。

当前36条注册路由、33/103匹配、70条待补；无in_progress、verified=0。所有新增页local passed/full pending；Settings其他子页、Coins、学生认证、语音/歌曲成功路径等仍待补齐。HTML仅静态来源，未修改、嵌入或打包；普通浏览器仍不能直接打开原型，因此没有宣称原型运行时逐像素验收。以下均为历史结果，不覆盖本轮范围。

## 最新增量：注册UI与资料引导（2026-10-14）

首次启动到新账号Home已跑通，不代表整个App验收完成。74项单元、注册路径18组H5、验证码15/Login13/Welcome8/Home22/Discover20/Events19/Profile20回归通过。RegistrationAcceptance-2.xcresult在iPhone17Pro/iOS26.5原生7/7通过（0失败/跳过）；新增注册/真实媒体存储/通知跳过/完成/单次骨架/Profile同步/刷新。见[本轮记录与边界](./cimoa-registration-onboarding.md)、[原生摘要](./evidence/registration-native/acceptance.json)、[截图附件](./evidence/registration-native/manifest.json)。测试恢复原模拟器数据；系统照片选择和通知授权弹窗的手动点击未包含在自动通过项中。

当前29个注册路由、26/103匹配、77个未注册，无in_progress、verified=0。新增页面local passed/full pending；原HTML未改变、不嵌入或运行；独立H5共162文件，原生加载同一打包资源。正式发布、Apple、密码重置、真实推送/学生认证、主Tab剩余依赖仍未完成。仅本地提交、不push；下面所有“当前”及数字属于各历史版本，不覆盖本节。

最终三项强制命令通过无警告；导出工程195条目/162份H5与原生测试构建逐文件匹配，见[最新打包报告](./evidence/registration-native/package.json)。正常App另用RegistrationRunData构建，供模拟器查看；不会清除已有账号。

## 历史增量：固定本地验证码009789（2026-10-13）

Code/Success已按HTML结构与用户本地认证决定实现，结果只保存当前账号local_verification；不发送邮件、不把学生认证改成verified。62项单元、两页14项浏览器、Login13项回归通过；iPhone17Pro/iOS26.5全新构建FixedCodeAcceptance-2.xcresult完成6/6，0失败/跳过，含新增验证码及刷新用例。证据与文件范围见[本地验证码](./cimoa-local-verification.md)、[原生摘要](./evidence/fixed-code-native/acceptance.json)、[附件](./evidence/fixed-code-native/manifest.json)。

整体验收仍未通过，verified=0。两页local passed/full pending；Change email、资料设置、注册UI等依赖未齐，Login原型TEST STATES决定仍pending，当前无in_progress。当前13个注册路由中10个匹配103个计划路由，93个未注册。第13节三项通过，无约定警告；只本地提交，不推送。H5现122文件，包与原生实际测试资源哈希见[本轮导出报告](./evidence/fixed-code-native/package.json)。

以下认证入口及更早记录均为历史版本的证据，不覆盖本次用户验证码决定或当前产物统计。

## 历史增量：本地认证入口（2026-10-13）

整体验收仍未通过，0个verified。首次安装已从自动Home改为Splash→Welcome；真实本地登录可进入Home，旧合并auth页已替换为兼容跳转。本地注册数据层已完成，年龄/社区/注册UI未完成，验证码方案由用户另定。Login仍in_progress：源TEST STATES生产保留/移除待用户决策，不能擅自标记视觉还原完成；其余95条计划路由尚未注册。

当前证据：[Login检查与文件清单](./cimoa-stage5-login-acceptance.md)、[本轮原生结果](./evidence/ios-entry/acceptance.json)、[最终原生附件](./evidence/ios-entry/final/manifest.json)。59项单元、Welcome8/Login13、Home22/Discover20/Events19/Profile20浏览器项通过；EntryAcceptance-3.xcresult在iPhone17Pro/iOS26.5完成5/5原生局部项，0失败/跳过。真实新文档访客启动、Welcome滚动/固定footer、本地登录/单次骨架已追加覆盖；不能代替完整App或系统触摸/键盘验收。

H5构建当前117文件，自动同步到原生Resources/H5；不打包或实时加载原HTML。当前开发中导出包`artifacts/cimoaNeapo-ios.zip`含150条目，全部117文件哈希核验通过，见[当前包报告](./evidence/ios-entry/package.json)。最后三项强制命令通过、无约定警告，临时服务和隔离浏览器已退出。仅本地提交，不推送。以下101文件/4项测试/哈希及导出包说明属于此前宿主版本的历史证据，不代表当前增量产物。

## 当前状态：阶段五逐页推进；原生宿主交付准备（2026-10-13）

**整体验收仍未通过。** 阶段1–4的独立数据/主题/三Tab基础已落实；Home、Discover、Events、Profile均通过本页检查，完整验收待子页依赖，不标记verified。当前证据以 [阶段五总表](./cimoa-stage5-page-status.md)、[Home验收](./cimoa-stage5-home-acceptance.md)、[Discover验收](./cimoa-stage5-discover-acceptance.md)、[Events验收](./cimoa-stage5-events-acceptance.md) 和 [Profile验收](./cimoa-stage5-profile-acceptance.md) 为准。

用户允许页面分段验收、只做本地专项提交、不执行push；另行明确授权新建 `ios/cimoaNeapo` 并使用临时模拟器 Bundle Identifier `com.cimoa.neapo.dev`。现为独立Vue/uni-app → H5 → 新建UIKit/WKWebView宿主，已同步平台范围，不运行原HTML。宿主的局部原生测试不是全App阶段六通过。

本轮53项单元测试通过；Profile20项H5复测通过，临时服务PID76891与隔离浏览器已关闭。此前同轮Home22、Discover20、Events19项回归通过。三项强制命令按顺序通过，无约定警告。

## cimoaNeapo 原生交付范围

- 工程、运行及桥协议见 [宿主接入说明](./ios-wkwebview-host-integration.md)；`corepack pnpm build:h5` 自动打包同一份101文件H5与唯一主题；`corepack pnpm archive:ios` 输出 `artifacts/cimoaNeapo-ios.zip`，不包含原型、DerivedData或用户Xcode状态。
- Xcode26.6，iPhone17Pro模拟器，iOS26.5 / 23F77，设备ID `D9B138D2-1B08-4646-B8D0-8A2242AECD7D`。iOS部署目标17.0，不将“17Pro”误写成系统版本。
- 真实WKWebView测试：包内本地资源、标题与安全区；白名单JS请求/回复及非法版本/方法拒绝；未配置内购真实failure且不加币；三Tab与Profile真实DOM入口/栈返回；localStorage/IndexedDB Blob刷新保持及探针清理；静态适配器拒绝POST和未知文件。
- 初轮发现Network监听端口重复指定，已修复；首次导航的JS等待被新文档销毁、测试数据库删除未等待造成的测试时序问题已修正。没有跳过测试或降低断言。
- 实际触摸手势、键盘、系统相机/麦克风硬件、全部依赖页/服务成功路径、后台恢复和完整横屏仍待逐页验收。原生WKWebView侧滑已关闭，以免与H5返回竞争；DOM导航测试不冒称系统触摸验收。
- 正式Bundle ID/签名团队/App Store ID/IAP产品及验证服务均未提供，未注册、上传或伪造。用户原4173服务和旧iOS App保持不动；仅保留用户要求查看的新模拟器App。

### 原生通过证据

最终 `NativeAcceptance-5.xcresult`：4/4通过、0失败、0跳过；前一轮4/4亦通过。结果包保存在 `ios/cimoaNeapo/build/`（本地、不提交大型DerivedData）。[验收摘要](./evidence/ios-host/acceptance.json)、[WebView截图](./evidence/ios-host/2D08D8DD-4281-4261-ACA6-668C0BF152B1.png)、[系统安全区/网页布局原始数据](./evidence/ios-host/A12F0A19-388F-4428-81BE-E1316FDB76C1.txt)、[Xcode导出附件清单](./evidence/ios-host/manifest.json)随仓库留存。

系统实测顶部62、底部34逻辑点，与H5消费值逐项比较通过；viewport高874，Tabbar底边811.34375，没有侵入底部安全区。截图人工复核：Home人物图片、标题、渐变、胶囊Tabbar显示正常。WKWebView截图不包含系统状态栏；[最终模拟器整屏截图（Events）](./evidence/ios-host/simulator-events.png)来自独立正常App构建。

H5逐文件清单SHA256：`a0c76f26a0b6b1be4318c484905748fab3d364a5839ca192aca783282f912db6`。它对应测试构建中的101个文件；打包脚本只复制独立H5与主题，不包含原HTML。

导出包 `artifacts/cimoaNeapo-ios.zip` 已执行解压完整性测试，并将101个H5文件逐个与清单SHA256比较通过；共134个ZIP条目，包含共享scheme、Swift、配置和离线资源，不含原型、DerivedData、xcuserdata或Mac附属元数据。当前包SHA256：`21d74c4790f50d8f4214cc7108860d13d57883b5a4c16ddf282e31cc3a32041e`。另用独立RunDerivedData构建正常App（不注入XCTest）供模拟器查看。

预览进程清理：本轮记录的71175、71475、72006、72121、72518、72659、73038、76891及其子进程，最终精确PID/PPID检查均无残留。启动失败的诊断截图移至本地build目录保留，不作为通过证据。

正常App已安装并启动，PID78513；`lsof`确认只监听127.0.0.1:18765。实际HTTP入口SHA256与dist/build/h5/index.html均为 `c7aefb6ac07152d8755daae7e912ff41344aad6f2de2d1654c2204035a91bc3c`，不依赖用户原4173服务。

以下历史记录仅用于追溯，不覆盖本节当前进度。

## 历史记录：最初的来源审计阶段（不是当前进度）

以下保留当时的检查范围和失败门槛，旧的“尚不能进入阶段五”“等待push授权”不再表示当前阻塞。

**未通过整体验收。** 当前正按原 HTML 修正阶段 1；人物、免费文字介绍、等待接通模拟与 Home 分段验收已获用户确认。阶段 1–4 的其余门槛未关闭，尚不能进入阶段 5 或声明 Home 完成。三项命令通过只能证明代码可检查和构建，不是视觉、交互或 WKWebView 验收。

交付链路保持独立 uni-app 源码 → H5 构建 → 已有 iOS WKWebView 宿主加载。本仓库不加入 Swift / Objective-C 工程，也不运行原 HTML。当前已配置 Git remote，旧文档“没有 Git remote”的描述已更正。

| 验收类别 | 状态 |
| --- | --- |
| 原型 154 状态与入口审计 | 已生成静态证据；四项用户决策已同步，其余入口契约仍待完成 |
| 原型媒体本地化 | 35 张图片与 12 个 WOFF2 字体已提取，逐字节及 SHA-256 校验通过；不含原型 HTML/运行库 |
| 阶段 2 数据字段与阶段 3 全量数据 | pending |
| 主题与三个 Tab | 源值已核对，代码未修正 |
| Home 本页验收 / 完整验收 | pending / pending；本页可先验收，但不能提前标记 verified |
| H5 浏览器状态、返回、刷新、滚动 | 尚无本轮还原证据 |
| WKWebView 安全区、手势、媒体、桥接 | 未执行；需要已有宿主路径与可运行环境 |

本轮变更仅为源审计脚本和阶段记录；后续即便三项校验全部通过，也不能提升页面状态。

## 2026 年 10 月 13 日审计修正校验

- `node --test scripts/circa-source.test.mjs`：4/4 通过，覆盖原型哈希、539 个唯一事件 ID、154 状态完整性、三 Tab 层级及遗漏资源。
- `corepack pnpm check:conventions`：通过，未报告警告。
- `git diff --check`：通过；Git 提示原有开发约定和流程文件的 CRLF/LF 转换风险，这两个文件没有改动。
- `corepack pnpm build:h5`：通过；仅证明现有 H5 仍可构建，产物仍是旧 UI，不是还原后的首页。
- 未启动 dev server、watch 或其他后台服务；本次一次性命令已退出。

## 本轮修改文件

- `docs/cimoa-stage1-page-inventory.md`、`docs/cimoa-stage1-source-findings.md`、`docs/cimoa-page-inventory.json`、`docs/circa-source-audit.json`：来源审计及计划映射。
- `docs/cimoa-home-interactions.md`：Home 的逐入口契约及验收门槛。
- `docs/cimoa-stage2-data-fields.md`、`docs/cimoa-stage3-test-data.md`、`docs/cimoa-stage3-1-theme.md`、`docs/cimoa-stage4-tabbar.md`：撤销错误完成结论并列出纠正要求。
- `docs/cimoa-stage5-page-status.md`、本文件：撤销无证据的 verified 与整体完成声明。
- `scripts/lib/circa-source.mjs`、`scripts/audit-circa-source.mjs`、`scripts/generate-cimoa-stage1.mjs`、`scripts/circa-source.test.mjs`：只读原型的解析、审计、清单生成与回归测试。

未改原 HTML、两份开发/交互约定、应用页面或 Store；文档整理遵循 write-page 技能的“事实、限制与完成状态分开”要求，保存在本仓库，没有创建外部 Page。

## 用户决定和资源补齐校验

本次将四项决定同步至阶段 1、字段/种子要求、Home 交互及分段验收清单。源码事件 ID 保持稳定；`openJordan` 仍用于来源追溯，未来业务对象以邀请详情 Lina 为准。Home 仍是 pending，应用页面和 Store 尚未变更。

- `node --test scripts/circa-source.test.mjs`：6/6 通过。新增 47 个资源逐字节/哈希校验、本地字体 URL 校验、禁止导出原型运行库、Home 分段验收状态和模拟通话覆盖标记。
- `corepack pnpm check:conventions`：通过，无警告。
- `git diff --check`：通过，无警告。
- `corepack pnpm build:h5`：通过，无警告；构建资源已同步至 `dist/build/h5/static/assets`，仍不是还原后的 Home。
- 没有启动 dev server、watch 或后台服务。提取、审计、清单生成、测试和构建均使用一次性命令。
- 未改两份强制约定和用户原型；原 29 张图片未改动。没有运行、嵌入或通过其他地址加载原型 HTML。
- Git push 等待用户确认远端 `https://github.com/mumulin1117/Cimoa_New.git` 的上传授权，本次未重试推送。

本次修改文件：

- `docs/cimoa-stage1-source-findings.md`、`docs/cimoa-stage1-page-inventory.md`、`docs/cimoa-page-inventory.json`、`docs/cimoa-home-interactions.md`：已确认决定和验收边界。
- `docs/cimoa-stage2-data-fields.md`、`docs/cimoa-stage3-test-data.md`、`docs/cimoa-stage5-page-status.md`、本文件：字段/测试约束、Home 两段验收规则和真实进度。
- `scripts/extract-circa-assets.mjs`、`scripts/audit-circa-source.mjs`、`scripts/generate-cimoa-stage1.mjs`、`scripts/circa-source.test.mjs`：无覆盖提取、资源追溯、状态生成和自动测试。
- `docs/circa-source-audit.json`、`static/assets/manifest.json`：完整资源来源、路径、字节数和 SHA-256。
- `static/assets/coins/home-coin-badge.png`、`static/assets/coins/store-coin-hero.png`、`static/assets/head/participant-38b22b41.png`、`static/assets/head/participant-92ddcb8c.png`、`static/assets/head/participant-e8bd8155.jpg`、`static/assets/img/welcome-campus.png`：新增的六张源图片。
- `static/assets/fonts/`：12 个原包字体及本地化 `source-fonts.css`；上述资源对应的 H5 构建副本同步更新。
