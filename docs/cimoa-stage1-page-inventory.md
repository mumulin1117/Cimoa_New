# Cimoa 阶段一原型核对与页面清单

最终 UI 和交互依据为 `CIRCA All Screens (interactive).html`；品牌采用 Cimoa。运行时仅使用独立 Vue / uni-app 组件、Store、样式和本地资源，不加载原 HTML。

**阶段状态：in_progress。** 人物资料、文字介绍费用、模拟通话和 Home 分段验收的选择已由用户确认，不再列为待答复。下列映射仍是规划，不是已实现的证明；其余入口契约和服务失败边界完成后，才能进入后续阶段。

原型 SHA-256：`6c49411c6868b476ff46cedaa9828ee2ccbfe89d5eaa7ea1f739feb2c8018060`。静态审计定位 154 个目录状态、104 个页面条件区块、539 个事件绑定、52 个包内资源和 356 处内联 SVG。事件绑定包括输入、遮罩关闭、冒泡控制，不等于 539 个业务按钮；154 个状态也不等于 154 个独立页面。

## 已确认的结构

- 主 Tab 仅 Home、Discover、Events。依据内层模板 `showTabs`（5193 行）和内嵌 `TabBar.dc.html`，不是按 MAIN LEVEL 分组名称猜测。
- Profile 从 Home 左上入口打开，是二级页；Discover / Profile / Expanded 也是二级资料页。
- Home 标题为 People you’ve met，源稿为 Chloe Lin、Liam Park、Jordan Ellis 三张纵向卡片，分别进入聊天、匹配预览、收到邀请。按用户最新决定，实际资料以对应详情为准：Chloe / HKUST、Liam / Stanford、Lina / HKU；第三张卡不能继续显示 Jordan 却打开 Lina。没有旧实现的横排推荐、活动区或绿色宣传卡。
- Home 三个 Connection Goals 为卡片锚定 Popover，不是底部 Sheet。匹配状态卡覆盖 searching、paused、found、waiting；空联系人有 Start Auto Match / Explore People 入口。
- 393 × 852 是原型参考视口。设计尺寸按 `750 / 393` 转成 rpx；不复制状态栏和 Home Indicator，安全区与固定骨架服从开发约定第 15 节。
- 原型 Tabbar 是白色圆角胶囊，三枚轮廓图标分别为房屋、搜索、日历；选中项为渐变圆形底。不显示文字标签，英文标签用于无障碍。
- 原型主渐变为青、蓝、紫、粉；背景为浅蓝到浅紫。旧深绿/荧光黄/米白主题不属于此原型。
- 原型没有帖子信息流；旧 Store 的 posts/comments 不能用来填补首页。

## 来源证据和资源

[静态审计](./circa-source-audit.json) 保存每个入口的条件、绑定函数源码、源码行号、导航边和资源清单，不被应用导入。行号均指从原包静态解出的内层模板，而不是外层压缩 HTML。

包内资源为 35 张图片、12 个 WOFF2 字体、2 个组件 HTML、3 个运行库脚本。35 张图片和 12 个字体现已全部提取至 `static/assets`，保留原有 29 张图片不变；清单记录 bundle_id、路径、字节数和 SHA-256。字体声明使用本地相对 URL，不依赖原 HTML 或在线字体服务。运行库及组件 HTML 不加入 H5 运行产物；后续仅提取组件的 SVG、样式和结构并重写为 Vue。原型内联 Emoji 不直接移植，按第 15.2 节使用已有源资源或语义匹配图标，并登记差异。

## 用户已确认的业务决定

2026 年 10 月 13 日确认：人物资料以详情页为准；文字介绍免费；通话只模拟等待接通；允许先验收 Home 本页，再逐页补齐依赖并完成完整验收。

| 决定 | 实现边界 | 回归要求 |
| --- | --- | --- |
| 详情页是人物资料唯一基准 | Chloe 使用 Expanded 详情；Liam 使用 `amWho === 'liam'` 匹配详情；收到邀请使用 reqReceived 中的 Lina。详情未提供的字段才沿用无冲突的原型资料，不凭空补值 | Home、详情、邀请结果、聊天通过同一个 user_id 查询；稳定源码 interaction_id 保留原名用于追溯，不作为显示姓名 |
| 文字介绍免费 | 文本发送成本固定为 0；不显示扣币确认或余额不足，不写消费流水；仍执行校验、重复提交锁、自定义发送 Loading 和持久化 | 零余额也可发有效文本；成功只新增介绍/请求，金币流水和余额不变；失败保留草稿且不创建请求 |
| 语音和优先匹配维持原型计费 | 语音介绍 10 coins、Priority Match 20 coins；仅有真实可用录音时允许发送语音 | 没有音频明确英文错误，不扣币、不伪造成功；同一次成功操作不重复扣费 |
| 通话沿用现有等待接通模拟 | 开发约定第 12.5 节优先；450ms 更新等待省略号，8–12 秒随机结束，手动/自动共用清理与返回 | 不显示真实接通、通话时长或假远端画面；离开后无定时器，无真实 WebRTC |
| Home 分段验收 | 将 Home 本页验收和完整闭环验收分开；本页通过不等于 verified | 本页通过后可将其恢复 pending（待依赖），再按主 Tab 顺序及入口依赖开始下一页，始终最多一页 in_progress；各阶段提交要求不取消 |

Home 邀请卡归一化为 Lina 是对“以详情页为准”的应用：源码 `openJordan` 指向 `reqReceived`，该详情明确显示 Lina, 21。安全/黑名单中的 Jordan 仍是独立人物，不全局替换成 Lina。头像、专业、目标等同样从对应详情实体读取，不能只改名字。

## 其余业务边界

| 项目 | 原型事实 | 处理状态 |
| --- | --- | --- |
| 同一用户大学不同 | Chloe 首页 Berkeley、其他页 HKUST；Liam 首页 Stanford、活动页 HKUST | 已确认以人物详情为准；首页和其他列表不保存资料副本 |
| 邀请串人 | Home 点 Jordan → reqReceived 写死 Lina → reqAccepted 写死 Chloe | 已确认以 reqReceived 的 Lina 为准；同一 request_id 的接受/拒绝/聊天均引用 Lina |
| 介绍费用矛盾 | `cost()` 文本 6 coins；`continueText` / `spend` 为 10 | 已确认文本免费；不移植任一文本扣费分支 |
| 配额和流水 | 每日免费 3 次，但无重置实现；初始余额 260 与演示流水不相等 | 需明确重置时区和有效流水规则，再设计字段 |
| 通话约定冲突 | 原型有来电/接通/结束；开发约定第 12.5 节仅等待接通模拟通话 | 已确认遵循现有约定；原型这三种状态仅保留为来源证据，不注册三种假接通产品状态 |
| 缺失交互 | 相册、客服、语音等多处只显示 next phase；歌曲只有封面和动画，无音频 | 用户已授权补齐方案；没有音频/服务时明确英文错误、不假成功 |
| 真实服务资料 | 原型验证任意六位码、Apple 登录直接跳转、客服仅 Toast | 不能声称真实校验/登录/提交成功；服务缺失路径需契约化 |
| 联系方式 | 协议中为 privacy@circa.app | 不能自动视为 Cimoa 真实客服地址 |
| 最终验收 | 普通浏览器非生产宿主 | 需要已有 iOS WKWebView 工程位置与可运行环境 |

## Home 开工门槛

[Home 交互清单](./cimoa-home-interactions.md) 固定全部入口及十字段契约。Home 尚未开始还原，仍为 pending。资料决策已关闭；阶段 1–4 的其余门槛通过后，才可成为唯一 in_progress 页面。

用户已允许两段验收：先完成 Home 结构、资源、局部交互、Store 派生、状态覆盖与导航参数检查，再逐页补齐 Profile、Chat、Match Found、Received Request、Auto Match Entry 等依赖并回归真实返回闭环。两段分别记录结果；旧错误目标页不计为依赖通过，Home 不能提前标记 verified。只有完整验收、强制校验、提交及获授权的推送完成后才能标记 verified。

## 全量画板映射

下表为计划路由，不表示已注册或已实现。所有必填字段、安全区所有者、来源行号、interaction_ids 见 [结构化清单](./cimoa-page-inventory.json)。

| source_screen | 原型定位参数 | page_level | 计划 route 或 component | status |
| --- | --- | --- | --- | --- |
| Launch / Splash / Default | route=splash | 二级/三级（随入口） | /pages/auth/splash | pending |
| Auth / Welcome / Default | route=welcome | 二级/三级（随入口） | /pages/auth/welcome | pending |
| Legal / Terms of Service / Default | route=legalTerms | 二级/三级（随入口） | /pages/legal/terms | pending |
| Legal / Privacy Policy / Default | route=legalPrivacy | 二级/三级（随入口） | /pages/legal/privacy | pending |
| Auth / Age Confirmation / Default | route=age | 二级/三级（随入口） | /pages/auth/age | pending |
| Auth / Community Agreement / Default | route=agree | 二级/三级（随入口） | /pages/auth/community | pending |
| Auth / Sign Up / Default | route=signup | 二级/三级（随入口） | /pages/auth/signup | pending |
| Auth / Log In / Default | route=login | 二级/三级（随入口） | /pages/auth/login | pending |
| Auth / Email Verification / Enter Email | route=verEmail | 二级/三级（随入口） | /pages/auth/verification/email | pending |
| Auth / Email Verification / Code | route=verCode | 二级/三级（随入口） | /pages/auth/verification/code | pending |
| Auth / Email Verification / Success | route=verSuccess | 二级/三级（随入口） | /pages/auth/verification/success | pending |
| Auth / Email Verification / Unsupported | route=verUnsupported | 二级/三级（随入口） | /pages/auth/verification/unsupported | pending |
| Auth / Forgot Password / Email | route=fpEmail | 二级/三级（随入口） | /pages/auth/reset/email | pending |
| Auth / Forgot Password / Code | route=fpCode | 二级/三级（随入口） | /pages/auth/reset/code | pending |
| Auth / Forgot Password / New Password | route=fpNew | 二级/三级（随入口） | /pages/auth/reset/new | pending |
| Onboarding / Basic Info / Default | route=obBasic | 二级/三级（随入口） | /pages/onboarding/basic | pending |
| Onboarding / University / Default | route=obUni | 二级/三级（随入口） | /pages/onboarding/uni | pending |
| Onboarding / Major / Default | route=obMajor | 二级/三级（随入口） | /pages/onboarding/major | pending |
| Onboarding / Photos / Empty | route=obPhotos&photos=0 | 二级/三级（随入口） | /pages/onboarding/photos | pending |
| Onboarding / Photos / Added | route=obPhotos&photos=3 | 二级/三级（随入口） | /pages/onboarding/photos | pending |
| Onboarding / About / Default | route=obAbout | 二级/三级（随入口） | /pages/onboarding/about | pending |
| Onboarding / Interests / Default | route=obInterests | 二级/三级（随入口） | /pages/onboarding/interests | pending |
| Onboarding / Connection Goal / Default | route=obGoal | 二级/三级（随入口） | /pages/onboarding/goal | pending |
| Onboarding / Icebreakers / Empty | route=obIce | 二级/三级（随入口） | /pages/onboarding/ice | pending |
| Onboarding / Icebreakers / Completed | route=obIce&ice=1 | 二级/三级（随入口） | /pages/onboarding/ice | pending |
| Onboarding / Notifications / Pre-Permission | route=obNotif | 二级/三级（随入口） | /pages/onboarding/notif | pending |
| Onboarding / Complete / Default | route=obComplete | 二级/三级（随入口） | /pages/onboarding/complete | pending |
| Home / People Met / Empty | route=home&newUser=1 | 主 Tab | /pages/home/index | pending |
| Permissions / Photos / Pre-Permission | route=permPhotos | 二级/三级（随入口） | /pages/permissions/photos | pending |
| Permissions / Camera / Pre-Permission | route=permCamera | 二级/三级（随入口） | /pages/permissions/camera | pending |
| Permissions / Microphone / Pre-Permission | route=permMic | 二级/三级（随入口） | /pages/permissions/mic | pending |
| Permissions / Notifications / Pre-Permission | route=permNotif | 二级/三级（随入口） | /pages/permissions/notif | pending |
| Home / People Met / Default | route=home | 主 Tab | /pages/home/index | pending |
| Discover / Profile / Photo | route=photo | 主 Tab | /pages/discover/index | pending |
| Discover / Profile / Expanded | route=expanded | 二级/三级（随入口） | /pages/discover/profile | pending |
| Events / Explore / Default | route=events | 主 Tab | /pages/events/index | pending |
| Discover / Icebreaker / Select Question | route=ibSelect | 二级/三级（随入口） | /pages/discover/icebreaker/select | pending |
| Discover / Icebreaker / Text Reply | route=ibText | 二级/三级（随入口） | /pages/discover/icebreaker/text | pending |
| Discover / Icebreaker Answer / Voice | route=ibVoice | 二级/三级（随入口） | /pages/discover/icebreaker/voice | pending |
| Discover / Icebreaker / Voice Preview | route=ibPreview | 二级/三级（随入口） | /pages/discover/icebreaker/preview | pending |
| Permissions / Microphone / Prompt | route=ibVoice&sheet=micPermission | Sheet | src/components/MicPermissionSheet.vue | pending |
| Connection / Request / Sent | route=reqSent | 二级/三级（随入口） | /pages/connections/sent | pending |
| Connections / Request Detail / Default | route=reqReceived | 二级/三级（随入口） | /pages/connections/received | pending |
| Connection / Request / Accepted | route=reqAccepted | 二级/三级（随入口） | /pages/connections/accepted | pending |
| Connection / Request / Declined | route=reqDeclined | 二级/三级（随入口） | /pages/connections/declined | pending |
| Auto Match / Entry / Default | route=amEntry | 二级/三级（随入口） | /pages/auto-match/index | pending |
| Auto Match / Preferences / Default | route=amPrefs | 二级/三级（随入口） | /pages/auto-match/preferences | pending |
| Auto Match / Queue / Searching | route=amSearching&am=searching | 二级/三级（随入口） | /pages/auto-match/searching | pending |
| Auto Match / Queue / Paused | route=amPaused&am=paused | 二级/三级（随入口） | /pages/auto-match/paused | pending |
| Auto Match / Queue / Leaving | route=amSearching&am=searching&sheet=amLeaving | 确认弹窗 | src/components/AmLeavingConfirmDialog.vue | pending |
| Auto Match / Found / Preview | route=amFound&am=found | 二级/三级（随入口） | /pages/auto-match/found | pending |
| Auto Match / Found / Accepting | route=amFound&am=found&sheet=amAccepting | 确认弹窗 | src/components/AmAcceptingConfirmDialog.vue | pending |
| Auto Match / Found / Waiting | route=amWaiting&am=waiting | 二级/三级（随入口） | /pages/auto-match/waiting | pending |
| Auto Match / Result / Connected | route=amConnected&am=connected | 二级/三级（随入口） | /pages/auto-match/connected | pending |
| Auto Match / Result / Passed | route=amPassed&am=passed | 二级/三级（随入口） | /pages/auto-match/passed | pending |
| Auto Match / Result / Expired | route=amExpired&am=expired | 二级/三级（随入口） | /pages/auto-match/expired | pending |
| Auto Match / Queue / No Match | route=amNoMatch&am=noMatch | 二级/三级（随入口） | /pages/auto-match/no-match | pending |
| Auto Match / History / Default | route=amHistory&am=connected | 二级/三级（随入口） | /pages/auto-match/history | pending |
| Auto Match / Boost / Confirmation | route=amSearching&am=searching&sheet=amBoost | 确认弹窗 | src/components/AmBoostConfirmDialog.vue | pending |
| Home / Auto Match / Searching | route=home&am=searching | 主 Tab | /pages/home/index | pending |
| Home / Auto Match / Match Found | route=home&am=found | 主 Tab | /pages/home/index | pending |
| Home / Auto Match / Waiting | route=home&am=waiting | 主 Tab | /pages/home/index | pending |
| Home / Auto Match / Connected | route=home&am=connected | 主 Tab | /pages/home/index | pending |
| Messages / Chat / Connected | route=chat | 二级/三级（随入口） | /pages/messages/chat | pending |
| Video Call / Incoming / Default | route=callIncoming | 二级/三级（随入口） | /pages/messages/call/incoming | pending |
| Video Call / Active / Default | route=callActive | 二级/三级（随入口） | /pages/messages/call/active | pending |
| Video Call / Ended / Default | route=callEnded | 二级/三级（随入口） | /pages/messages/call/ended | pending |
| Events / Explore / Default | route=events | 主 Tab | /pages/events/index | pending |
| Events / Detail / Available | route=evDetail | 二级/三级（随入口） | /pages/events/detail | pending |
| Events / Detail / Joined | route=evDetail&joined=1 | 二级/三级（随入口） | /pages/events/detail | pending |
| Events / Join / Confirmation | route=evDetail&sheet=evJoinConfirm | 确认弹窗 | src/components/EvJoinConfirmConfirmDialog.vue | pending |
| Events / Join / Success | route=evJoinSuccess&joined=1 | 二级/三级（随入口） | /pages/events/join-success | pending |
| Events / Participants / Default | route=evParticipants&joined=1 | 二级/三级（随入口） | /pages/events/participants | pending |
| Events / Group Chat / Default | route=evGroup&joined=1 | 二级/三级（随入口） | /pages/events/group | pending |
| Events / My Events / Upcoming | route=evUpcoming&joined=1 | 二级/三级（随入口） | /pages/events/upcoming | pending |
| Events / Attendance / Cancel | route=evDetail&joined=1&sheet=evCancel | 确认弹窗 | src/components/EvCancelConfirmDialog.vue | pending |
| Events / Report / Select Reason | route=evReport | 二级/三级（随入口） | /pages/events/report | pending |
| Wallet / Coin Center / Default | route=coinStore | 二级/三级（随入口） | /pages/coins/index | pending |
| Coins / Store / Purchasing | route=coinPurchasing&pkg=1 | 二级/三级（随入口） | /pages/coins/purchasing | pending |
| Coins / Purchase / Apple Confirmation | route=coinApple&pkg=1 | 二级/三级（随入口） | /pages/coins/purchasing | pending |
| Coins / Purchase / Success | route=coinSuccess&pkg=1&coins=200 | 二级/三级（随入口） | /pages/coins/success | pending |
| Coins / Purchase / Failed | route=coinFailed&pkg=1 | 二级/三级（随入口） | /pages/coins/failed | pending |
| Coins / Purchase / Cancelled | route=coinCancelled&pkg=1 | 二级/三级（随入口） | /pages/coins/cancelled | pending |
| Coins / Balance / Insufficient | route=ibPreview&sheet=coinInsufficient&coins=5&ctx=voice | Sheet | src/components/CoinInsufficientSheet.vue | pending |
| Coins / Spend / Voice Confirmation | route=ibPreview&sheet=coinVoice | Sheet | src/components/CoinVoiceSheet.vue | pending |
| Coins / Spend / Priority Match Confirmation | route=amSearching&am=searching&sheet=amBoost | 确认弹窗 | src/components/AmBoostConfirmDialog.vue | pending |
| Coins / Spend / Processing | route=coinProcessing | 二级/三级（随入口） | /pages/coins/processing | pending |
| Coins / Spend / Failed | route=coinSpendFailed | 二级/三级（随入口） | /pages/coins/spend-failed | pending |
| Coins / History / Default | route=coinHistory | 二级/三级（随入口） | /pages/coins/history | pending |
| Coins / History / Purchase Detail | route=coinPurchaseDetail | 二级/三级（随入口） | /pages/coins/purchase-detail | pending |
| Coins / History / Spending Detail | route=coinSpendDetail | 二级/三级（随入口） | /pages/coins/spend-detail | pending |
| Coins / Help / Default | route=coinHelp | 二级/三级（随入口） | /pages/coins/help | pending |
| Profile / Personal / Default | route=profile | 二级/三级（随入口） | /pages/profile/index | pending |
| Profile / Personal / Preview | route=profilePreview | 二级/三级（随入口） | /pages/profile/preview | pending |
| Profile / Edit / All | route=editAll | 二级/三级（随入口） | /pages/profile/edit | pending |
| Profile / Edit / Basic Info | route=editBasic | 二级/三级（随入口） | /pages/profile/basic | pending |
| Profile / Edit / Interests | route=editInterests | 二级/三级（随入口） | /pages/profile/interests | pending |
| Profile / Edit / Connection Goals | route=editGoals | 二级/三级（随入口） | /pages/profile/goals | pending |
| Profile / Edit / Preferences | route=editPrefs | 二级/三级（随入口） | /pages/profile/prefs | pending |
| Profile / Edit / Icebreakers | route=editIce | 二级/三级（随入口） | /pages/profile/ice | pending |
| Profile / Verification / Verified | route=verified | 二级/三级（随入口） | /pages/profile/verification | pending |
| Profile / Verification / Reverify | route=reverify | 二级/三级（随入口） | /pages/profile/reverify | pending |
| Settings / Main / Default | route=settings | 二级/三级（随入口） | /pages/settings/index | pending |
| Settings / Notifications / Default | route=setNotif | 二级/三级（随入口） | /pages/settings/notif | pending |
| Settings / Privacy / Default | route=setPrivacy | 二级/三级（随入口） | /pages/settings/privacy | pending |
| Settings / Permissions / Default | route=setPerm | 二级/三级（随入口） | /pages/settings/perm | pending |
| Settings / Language / Default | route=setLang | 二级/三级（随入口） | /pages/settings/lang | pending |
| Settings / Blocked Accounts / Default | route=blockedList | 二级/三级（随入口） | /pages/settings/blocked | pending |
| Settings / Blocked Accounts / Empty | route=blockedList&blocked=0 | 二级/三级（随入口） | /pages/settings/blocked | pending |
| Settings / Support / Default | route=setSupport | 二级/三级（随入口） | /pages/settings/support | pending |
| Settings / Legal / Default | route=setLegal | 二级/三级（随入口） | /pages/settings/legal | pending |
| Settings / Log Out / Confirmation | route=settings&sheet=logout | 确认弹窗 | src/components/LogoutConfirmDialog.vue | pending |
| Settings / Delete Account / Information | route=delInfo | 二级/三级（随入口） | /pages/settings/delete/info | pending |
| Settings / Delete Account / Reason | route=delReason | 二级/三级（随入口） | /pages/settings/delete/reason | pending |
| Settings / Delete Account / Final Confirmation | route=delFinal | 二级/三级（随入口） | /pages/settings/delete/final | pending |
| Settings / Delete Account / Success | route=delSuccess | 二级/三级（随入口） | /pages/settings/delete/success | pending |
| Safety / Reports / Submitted | route=reportsSubmitted | 二级/三级（随入口） | /pages/safety/reports | pending |
| Safety / Report Detail / Default | route=reportDetail | 二级/三级（随入口） | /pages/safety/report-detail | pending |
| Safety / User Actions / Default | route=chat&sheet=safetyActions | Sheet | src/components/SafetyActionsSheet.vue | pending |
| Safety / Report User / Select Reason | route=safetyReport | 二级/三级（随入口） | /pages/safety/report-user | pending |
| Safety / Block User / Confirmation | route=chat&sheet=safetyBlock | 确认弹窗 | src/components/SafetyBlockConfirmDialog.vue | pending |
| System / Loading / Default | route=sysLoading | 二级/三级（随入口） | /pages/system/loading | pending |
| System / Offline / Default | route=sysOffline | 二级/三级（随入口） | /pages/system/offline | pending |
| System / Error / Default | route=sysError | 二级/三级（随入口） | /pages/system/error | pending |
| System / Maintenance / Default | route=sysMaintenance | 二级/三级（随入口） | /pages/system/maintenance | pending |
| System / Empty / Generic | route=sysEmpty | 二级/三级（随入口） | /pages/system/empty | pending |
| System / Permission Denied / Default | route=sysPermDenied | 二级/三级（随入口） | /pages/system/perm-denied | pending |
| System / Session Expired / Default | route=sysSessionExpired | 二级/三级（随入口） | /pages/system/session-expired | pending |
| Home / Connection Goals / Chloe | route=home&pop=Chloe | Popover | src/components/ConnectionGoalsPopover.vue | pending |
| Home / Connection Goals / Liam | route=home&pop=Liam | Popover | src/components/ConnectionGoalsPopover.vue | pending |
| Home / Connection Goals / Jordan | route=home&pop=Jordan | Popover | src/components/ConnectionGoalsPopover.vue | pending |
| Coins / Spend / Text Confirmation | route=ibText&sheet=coinVoice&ctx=text | Sheet | src/components/CoinVoiceSheet.vue | pending |
| Coins / Deduction / Confirmation | route=ibPreview&sheet=coinConfirm | 确认弹窗 | src/components/CoinConfirmConfirmDialog.vue | pending |
| Discover / Icebreaker / Discard Recording | route=ibVoice&sheet=voiceDiscard | 确认弹窗 | src/components/VoiceDiscardConfirmDialog.vue | pending |
| Onboarding / Icebreakers / Library | route=obIce&sheet=iceLibrary | Sheet | src/components/IceLibrarySheet.vue | pending |
| Onboarding / Icebreakers / Write My Own | route=obIce&sheet=iceCustom | Sheet | src/components/IceCustomSheet.vue | pending |
| Safety / User Actions / Profile Menu | route=expanded&sheet=safetyActionsMini | Sheet | src/components/SafetyActionsMiniSheet.vue | pending |
| Auto Match / Help / Explanation | route=amSearching&am=searching&sheet=amHelp | Sheet | src/components/AmHelpSheet.vue | pending |
| Auto Match / Found / Leave | route=amFound&am=found&sheet=amFoundLeave | 确认弹窗 | src/components/AmFoundLeaveConfirmDialog.vue | pending |
| Auto Match / Preferences / University | route=amPrefs&sheet=uniPicker | Sheet | src/components/UniPickerSheet.vue | pending |
| Auto Match / Preferences / Interests | route=amPrefs&sheet=interestsPicker | Sheet | src/components/InterestsPickerSheet.vue | pending |
| Events / Explore / Filters | route=events&sheet=evFilterSheet | Sheet | src/components/EvFilterSheetSheet.vue | pending |
| Events / More / Menu | route=evDetail&sheet=evMore | Sheet | src/components/EvMoreSheet.vue | pending |
| Profile / Edit / Song Picker | route=editAll&ea=song | Sheet | src/components/ProfilePickerSheet.vue | pending |
| Profile / Edit / Bio · Text | route=editAll&ea=bio | Sheet | src/components/ProfilePickerSheet.vue | pending |
| Profile / Edit / Bio · Voice | route=editAll&ea=bio&bioTab=voice | Sheet | src/components/ProfilePickerSheet.vue | pending |
| Profile / Edit / Height | route=editAll&ea=height | Sheet | src/components/ProfilePickerSheet.vue | pending |
| Profile / Edit / Degree | route=editAll&ea=degree | Sheet | src/components/ProfilePickerSheet.vue | pending |
| Profile / Edit / Country | route=editAll&ea=country | Sheet | src/components/ProfilePickerSheet.vue | pending |
| Profile / Edit / Clubs | route=editAll&ea=clubs | Sheet | src/components/ProfilePickerSheet.vue | pending |
| Profile / Edit / MBTI | route=editAll&ea=mbti | Sheet | src/components/ProfilePickerSheet.vue | pending |
| Profile / Edit / Religion | route=editAll&ea=religion | Sheet | src/components/ProfilePickerSheet.vue | pending |
| Profile / Edit / Drinking | route=editAll&ea=drink | Sheet | src/components/ProfilePickerSheet.vue | pending |
| Profile / Edit / Smoking | route=editAll&ea=smoke | Sheet | src/components/ProfilePickerSheet.vue | pending |

生成方式：先运行 `node scripts/audit-circa-source.mjs`，再运行 `node scripts/generate-cimoa-stage1.mjs`。只做静态解析，不执行原型脚本。
