# cimoaNeapo

Cimoa 的 UIKit / WKWebView iOS 工程。界面是随包加载的独立 Vue / uni-app H5，不加载原型文件，也不需要电脑上的预览服务。

## 运行

打开 `Cimoa/cimoaNeapo.xcodeproj`，选择共享 scheme **cimoaNeapo** 和 **iPhone 17 Pro** 模拟器，然后 Command-R。临时 Bundle Identifier `com.cimoa.neapo.dev` 已获用户授权，仅用于本地开发；真机和发行需自行配置正式ID、团队与签名。

## 工程内文件与独立发布副本

编译和运行文件实际保存在 `Cimoa/`：`Cimoa/ScholarWellnessPathfinder/` 为 Swift 源码，`Cimoa/Config/` 为配置，`Cimoa/Assets.xcassets/` 与 `Cimoa/Launch Screen.storyboard` 为图标/启动资源，`Cimoa/CimomusicOrientationPathfinder/` 保存 Xcode 实际复制进 App 的加密资源包及系统语言资源。没有指向原 Vue 工程或下载目录的符号链接，不需要把整个仓库或 node_modules 放进 App。

Xcode 的 ScholarWellnessPathfinder、CimomusicOrientationPathfinder、Config 分组与 `Cimoa/` 下磁盘目录对应。`campusHeritagePathway.cimoa` 作为普通工程资源直接复制进 App，不依赖外部路径。构建同时把完全相同的包同步到上层 `CimomusicOrientationPathfinder/`，供现有校验和独立导出流程使用；两份必须字节一致。包的 v2 容器内包含两个独立双层 DEFLATE／AES-256-GCM 认证分区：小配置分区包含 `iap-products.json`、`startup-motion.json`、`theme.json` 和 `build-manifest.json`，H5 分区包含全部网页产物。四份 JSON 不再以明文资源复制进 App；配置仅解密到内存，启动无需等待全部 H5 解压。主题仍唯一生成自 `src/config/theme.json`，商品和动画仍使用既有源码配置。

运行时先认证配置分区，再用包内清单核对 H5 加密分区及每个文件的 SHA-256，解压至 App 缓存交给现有静态服务。清单不记录自身或外层包的哈希，避免自引用；外层包仍由应用签名覆盖。缓存按 H5 分区哈希隔离、读取时核对完整性且排除 iCloud 备份。系统必须直接读取的 Info.plist、InfoPlist.strings、图标和启动 storyboard 保持标准资源配置。客户端内置密钥只能提高静态提取成本，不是服务端秘密存储或 DRM。

真机缓存目录可能同时以 `/var/mobile/...` 与 `/private/var/mobile/...` 表示。缓存根目录和清理比较统一解析符号链接、标准化路径，不能直接比较 URL，否则会误删当前版本，导致启动地址返回空白文档。清理后再次检查入口可读；不修改 1800ms Splash、240ms 交接或用户数据。

在完整仓库执行 `corepack pnpm build:h5` 后，再执行 `corepack pnpm archive:ios`，可生成 `artifacts/cimoaNeapo-ios.zip` 与 `artifacts/cimoaNeapo-standalone/` 独立发布副本。副本只保留 App target，不带依赖原仓库的集成测试 target；原工程的 Tests 不删除。导出会检查工程内实际文件、软链接、路径、加密包哈希，并实际解密、双层解压后逐项核对 H5 清单；已有独立目录不会被静默覆盖，避免丢失你在副本中的修改。

完整复制或解压该副本后，直接打开其中的 `cimoaNeapo.xcodeproj`，不需要原仓库、Node、pnpm、Vue 源码或预览服务即可编译与 Archive。需要修改网页业务时，仍回 Vue 源码工程构建后重新导出；不要只复制 `.xcodeproj` 文件。

正式发行时选择通用 iOS 真机目标并执行 Product → Archive，然后按 Xcode 的 Distribute App 流程验证、签名和导出/上传。仍需提供已注册的正式 Bundle ID、Apple Developer Team 和有效签名配置；本项目不会替你编造或自动变更这些身份。未签名的构建/Archive 仅证明工程可独立构建，不是可上传的 IPA，也不代表 App Store 审核通过。参见 [Apple 分发流程](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)。

## 图标与系统启动页

`Assets.xcassets/AppIcon.appiconset` 使用用户提供的 1024×1024 图标；仅移除冗余 alpha 通道，校验转换前后可见像素一致，不预制圆角。Xcode 从单一高清图生成所需尺寸，Debug/Release 共用同一配置。

`Config/Info.plist` 通过 `UILaunchStoryboardName` 绑定已有 `Launch Screen.storyboard`。背景铺满屏幕，品牌区随安全区宽度等比缩放并居中；背景、弧线及灰色轨道来自 `src/config/theme.json`，品牌文字按用户确认使用 Cimoa。系统静态资源不再包含固定彩色填充。App 接管后由 `StartupCoverView` 在相同布局上播放四色伸展加载条，H5 Splash 也使用同一节奏；这不是实际百分比，不伪造加载完成。

H5 在覆盖层后按原会话、协议和注册状态分流；真实目标页等待字体、入场动画及两帧绘制后发出 `finishLaunch`，原生核对主框架、固定 origin、当前 WebView、启动 UUID 及可见页面，再按 `MOTION.page` 淡出。不是 `didFinish` 一到就撤，也不会再露出第二段 Splash。启动覆盖层持续显示 Loading，直到 H5 完成交接；不再用固定时长把正常的首次解密、解压或页面准备判定为失败。损坏存储会揭开覆盖层以显示 H5 Retry，资源、本地服务或原生网页加载的真实失败仍显示可重试错误。后台暂停动画，结束后停止动画；减少动态效果时静态显示加载条并取消淡出动效。进度周期与交接时长由构建生成的 `CimomusicOrientationPathfinder/startup-motion.json` 提供，不另设原生时长来源。

完整仓库内的 `Branding/` 保留两张输入图；主题变化后可用 `swift scripts/generate-ios-branding.swift /absolute/path/to/Cimoa_New` 重建图标和启动矢量资源。独立导出的 Xcode 工程已包含编译所需资产与 Storyboard，不需要下载目录、生成器或预览服务。`LaunchAssetsTests` 检查图标登记、实际资源解码和不同手机尺寸的布局，并保留截图附件。

导出工程包含 `CimomusicOrientationPathfinder/campusHeritagePathway.cimoa`、主题和资源哈希清单。在完整 Cimoa 仓库中修改 Vue 后，运行 `corepack pnpm build:h5` 即自动双层压缩、加密，并把同一份产物同步到校验目录与 `Cimoa/` 下 Xcode 实际资源目录，再在 Xcode 重新运行；不用改原 HTML。单独导出的工程只包含当前加密产物，要修改 Vue 仍回原仓库源码。

## 原生/JS 接口

首次安装从Splash→Welcome进入注册；本地账号验证码固定`009789`，不发送邮件或授予学生认证。填完资料并选择至少2张真实照片可进入Home；通知可选择Not Now。已有会话恢复原账号或未完成步骤，不自动清数据。

- `CimoaNativeBridge.request('getEnvironment')`：真实项目/系统版本/能力信息。
- `CimoaNativeBridge.request('getSafeArea')`：原生实测安全区。
- `CimoaNativeBridge.request('finishLaunch')`：仅当前启动文档的真实页面就绪交接，不改变会话或业务数据。
- `getNotificationPermission` / `requestNotifications`：读取/请求真实通知权限；尚未配置通知投递。
- `openSettings`：打开本App系统设置，明确返回打开结果。
- `CommonTemplateSafeArea`：H5既有安全区请求与更新。
- `getPurchaseProducts` / `startPurchase` / `getPendingPurchases` / `getPurchaseStatus` / `verifyPurchase` / `acknowledgePurchase` / `abandonInterruptedPurchase`：StoreKit 2 商品、购买、验签与恢复接口。每次受理前原生持久化 request/token；八秒只限宿主应答，苹果已受理后不按此时间失败。H5 原子落账后才 ACK/finish，重复交易不加币。
- `CimoaPurchaseBridge.resolve`：原生推送真实购买结果到 H5；旧单向 `CimoaPurchase` 请求继续明确失败，不能用旧版八秒协议直接开支付。

### 商品、交易恢复与发布前配置

八档用户提供的商品统一来自 `src/stores/coinPackages.js`，构建复制为 `CimomusicOrientationPathfinder/iap-products.json`。显示价格来自 StoreKit，而不是参考美元金额。商品、账号和交易 ID 均须匹配；StoreKit 未验签、已撤销、未知账号或 H5 写入失败不发货、不 finish。宿主支付 journal 是投递队列，不复制 H5 金币余额。每请求 appAccountToken 保留原账号归属，重启与后台恢复核对 unfinished/updates；中断不自动二次购买，必须明确确认后才能另开一笔付款。

目前仍使用获批的开发 Bundle ID，尚未提供正式 Team 或确认商品归属。八个 Product ID 已接入代码，不等于当前开发包能从 App Store 读到商品，更不等于已完成沙盒实付验收。重装/跨设备的远程账号归属及金币恢复仍需实际账号服务，不能猜测交易属于哪个账号。

通知授权走真实苹果系统 API。APNs 注册回调已接入，但 `Config/Info.plist` 的 `CimoaPushRegistrationEnabled` 默认 false；缺少正式签名 entitlement 和推送服务时不伪装成已配置。后续确认 Team、Bundle ID、Push Notifications capability 与提供商的账号/设备注册协议后才能启用和验证远程投递；设备 Token 不输出到 H5 或日志。

相机/麦克风在可信主页面请求时读取真实系统状态，未决定则调用苹果授权接口，拒绝/受限直接拒绝；只有真实授权才放行 WebKit。权限说明页成功返回不写业务数据，隐藏/卸载/换账号后的迟到结果无效。录音保留真实媒体 MIME、异常截止和资源释放；单测或录音 UI 可打开不等于实体麦克风成功验收。

触摸行为统一由包内 H5 实现，不依赖 hover。按住/松开、横滑及原生纵向滚动保留；pointercancel、lostpointercapture、第二指、后台和切页取消未完成操作，不产生误点击或重复提交。普通文字/图片不显示网页选择、拖拽及长按菜单，输入框与可编辑区保留选择、复制粘贴及输入法；宿主只关闭链接预览，不关闭文字编辑交互。重要按钮使用按视口补偿的至少44pt实际热区，图标尺寸与开关轨道保持原样。此限制不是防截图或资源DRM；已受理苹果交易仍走恢复流程，不因离页伪装成取消付款。

包内静态服务仅绑定 `127.0.0.1:18765`，固定origin以保留WebKit数据，拒绝写请求和越界路径；不对局域网开放。端口占用时显示错误，不静默换origin。业务与媒体存储均保留在H5的Store/IndexedDB。

Home 左上头像进入 My profile。Edit Profile 可修改基本资料、照片、简介、兴趣、交友目标及三条破冰问题；Preview my profile 查看同一份保存结果。右上 Settings → Log Out 只退出会话，重新用本地账号登录后资料和照片仍保留。固定测试账号为 `cimoa@connect.edu` / `12341234`；内部验证码为 `009789`，界面不展示或预填；新注册账号使用自己设置的邮箱和密码。原测试账号邮箱升级保留同一账号/用户身份、资料、关系、聊天、媒体、金币与会话，不覆盖用户自改密码或恢复删除状态；官网联系邮箱不变。

Events 可进入详情、参与者、报名成功、My Events 和 Event group chat。已报名账号可发文字、照片和真实录音；报名/取消同步人数及群权限，数据保存在本设备。按当前本机账号范围，新注册账号完成固定码和资料后可使用社交、匹配及活动，但不会因此取得官方学生认证。

完整仓库中可用 Command-U 运行原生集成测试；部分测试读取仓库 docs/evidence、docs/ui-restoration 与 scripts/lib 的受控 fixture/驱动，因此独立发布副本不包含该测试 target，而不是携带指向仓库外部的测试依赖。正常 Command-R 和 Archive 不依赖它们。活动用例覆盖报名、成功、我的活动、参与者、群聊、文字/图片刷新及取消权限；私聊安全用例覆盖文字/图片刷新、等待接通、举报返回、静音、拉黑、解除拉黑及不恢复旧会话；已连接用户资料用例覆盖 Chat CTA、精确返回既有会话且全程不写业务数据；注册用例覆盖资料编辑、退出重登和单次骨架；本轮账号用例还覆盖父子资料草稿冲突、隐私保存、解除拉黑保留其他账号、源12组偏好、脱敏认证及真实原生购买失败不加币。测试结束恢复原有账号数据。媒体测试使用真实图片送入WebKit文件输入，不代替手动系统照片选择器/键盘操作验收。浏览器语音自动测试采用受控音源经过实际录音器，不代表实体麦克风验收。

Profile 语音简介已支持录制、试听、重录、删除、最终Save与刷新恢复；设置、安全和金币子页复用本人Store。购买、消费的隐藏/恢复和刷新使用同一账本，原生侧滑返回关闭，由H5路由统一处理。完整视觉、硬件与生产服务验收仍有独立门槛，本轮不代表全App完成。歌曲音源、学生认证、正式签名、App Store发布、真实商品归属及沙盒实付、推送提供商和客服服务尚需配置/验收；验证码009789不发送邮件、不代表学生认证。Apple登录/注册入口已按用户要求移除，不恢复假按钮。
