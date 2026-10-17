# 三核心实体专项验收

日期：2026-10-17。范围：ConnectionRequest、Connection、Conversation，以及 sent → received → accepted → declined → chat 五页。本记录不等于整个 App 完整还原完成。

## 已完成的闭环

- 请求保留发送时的问题快照与原始文字/音频；文字免费，语音只扣费一次。身份、目标、重复 pending 和操作重放都有校验。
- Not Now 仅返回 Home，邀请仍为 pending；明确接受/拒绝经过自定义确认和 500ms Loading。存储失败无半条请求、关系或消息，原页可重试。
- 接受在一个事务内创建双向同意、唯一私聊和原发送者的介绍消息。Connection 是方向同意的只读聚合，不另存一张可能漂移的好友表。
- 每一代连接有稳定 ID；拉黑使旧代失效并清理私聊、请求/匹配入口。解除拉黑不会恢复好友，旧 accepted 页不能误开后来建立的新会话。
- Home、资料页、请求结果和聊天共同读取相同实体；已经连接的资料入口为 Chat，打开同一 Conversation。聊天文字、照片、语音、未读和静音均支持持久化；会话与媒体访问按真实参与人授权。
- 任一方关闭视频权限时不启动通话等待；已有文字会话保留。通话仍遵循既定等待模拟，不假接通、不产生远端视频。

## 来源与视觉证据

锁定原型 SHA-256：`6c49411c6868b476ff46cedaa9828ee2ccbfe89d5eaa7ea1f739feb2c8018060`。

来源区间是解码后的 HTML 行号：reqSent 801–839、reqReceived 842–972、reqAccepted 975–1014、reqDeclined 1017–1031、chat 1230–1277。原型仅离线解析为参考，不嵌入 App、不运行原型脚本；项目运行独立 Vue/JS/本地资源。

五页证据目录分别为 [sent](./ui-restoration/connection-sent/acceptance.json)、[received](./ui-restoration/connection-received/acceptance.json)、[accepted](./ui-restoration/connection-accepted/acceptance.json)、[declined](./ui-restoration/connection-declined/acceptance.json)、[chat](./ui-restoration/connection-chat/acceptance.json)。每页保留 source-contract、十字段 interactions、reference、actual-browser、overlay、diff、actual-wkwebview 与几何记录。

逐区核对了页头、人物照片/徽章、成功/关闭图标、文字层级、问答卡、真实共同兴趣、渐变按钮、聊天气泡和输入栏。请求照片墙回到来源结构；长名字不挤掉操作，长回答在卡内滚动；相册覆盖完整视口而非被正文裁剪。语音暂停双竖条按原稿 4×14、间距 3（393 基准）换算为 rpx，并有播放态尺寸断言。

既有约定允许的差异单独保留：实体数据替代写死人物，真实共同兴趣取交集，只显示真实徽章；安全区来自系统；Connected 不虚称 Online；日期取消息时间；真实音频时长不写死 0:18；缺歌曲/音频明确报错；拒绝不谎称已经送达的介绍“从未分享”。没有扩展第二套原生业务 UI。

## 本轮实测

- 单元/Store/迁移/权限/导航/桥接/媒体测试：118/118，0 失败、0 跳过。
- 五页浏览器来源与状态检查：15 项通过；393×852 默认对照、320×568 小屏、长回答/错误、320×360 键盘缩高预算均保留截图。
- 两账号真实交互链：5 项通过，覆盖免费文字、真实编码语音、单次消费、接受/拒绝、Not Now、资料 Chat、匹配邀请和拉黑。
- 私聊/安全扩展：19 项通过，覆盖媒体草稿确认、拒绝麦克风、存储回滚、长历史、错误实体访问、等待通话和正确返回。
- iPhone 17 Pro / iOS 26.5 / WKWebView：10/10，通过五页原生截图、请求语音播放→接受→原介绍进入私聊→刷新再播放、资料 Chat、聊天媒体/拉黑、主 Tab/返回及活动群聊回归。
- 原生视口 402×874、安全区 62/34，包内 H5 经 `http://127.0.0.1:18765` 加载。原生测试使用独立 fixture，结束恢复测试前的账号元数据；不清空用户存储。
- 原型提取资源 47 项 SHA-256 全通过。H5 打包 378 文件，原生 App 包与当前构建 manifest 逐字节一致。manifest SHA-256：`354aef527aae60289868af0c853b7bafe5159b6d51f1832a449dc19264c23e74`。
- 三项强制门禁依序通过，无 convention warning。详情见 [机器可读结果](./evidence/connection-core/final-acceptance.json) 与 [原生测试摘要](./evidence/connection-core/native-test-summary.json)。本轮原生 result bundle：`/tmp/cimoa-connection-core-pause-final.xcresult`（临时路径，摘要与截图已入仓库）。

录音边界：浏览器通过受控实际 MediaStream 走生产录音/编码链；原生使用可解码 PCM fixture 验证实际音频时钟和刷新。没有将这些测试冒充真机麦克风、系统照片选择器/权限弹窗或手动原生软键盘验收。浏览器短音频首次整秒采样曾超时，改为真实波形进度采样并延长录音后完整 5 项重跑通过；原生最终 10 项也已重跑通过。

## 改动文件

实体与事务：`src/stores/connectionEntities.js`、`directMessaging.js`、`store.js`、`transactions.js`、`selectors.js`、`migration.js`、`seed.js`、`scenarios.js`。

五页与首用组件：`src/pages/connections/{sent,received,accepted,declined}.vue`、`connections.css`、`src/pages/messages/chat.vue`；`src/components/{ConnectionIcon,ConnectionPageHeader,ConnectionRequestProfile,RequestAudioPlayer,EventAudio,SafetyActionsMiniSheet,SecondaryPageFrame}.vue`；`src/config/theme.json`。

关联调用：`src/pages/discover/icebreaker/{text,voice}.vue`、`src/pages/coins/processing.vue`、`src/pages/messages/call/waiting.vue`、`src/utils/audioPlayback.js`。异步媒体任务传取消 token；H5/WKWebView 播放适配器保留 play Promise 的拒绝语义、预备资源但不自动播放，离页释放。

宿主与测试：`ios/cimoaNeapo/Sources/WebViewController.swift`、`Tests/HostTests.swift`；`scripts/{connection-core.test,connection-pages.test,connection-native-fixture,social-entities-browser.test,settings-safety-browser.test,audio-playback.test}.mjs`。宿主入口按包 manifest 版本加载，避免重构后仍命中旧 HTML shell 缓存，origin 与用户数据保持不变。

文档/产物：`docs/cimoa-connection-core.md`、本记录、页面清单、五页来源/验收与截图、`docs/evidence/connection-core`、关联 social-entities/settings-safety 证据；`dist/build/h5`。两份开发/交互约定未修改。原有 10 张 registration 截图改动保留、不暂存。

## 提交与范围

本任务已按实体底座及逐页产生专项本地提交：`d06726bd`、`59a0d29f`、`6b0cab17`、`70f438cc`、`42c0a8f4`、`d4f999ee`、`5931adb6`、`889c1a8e`。最终媒体/回归修正与证据提交为 `a3fbed70`；随后以仅含验收登记的专项提交将本轮五页及专属组件标记 verified，不 push、不改写历史。

功能仅在用户确定的设备内账号范围运行，不声称服务端送达/在线状态，不自动代替对方接受，不包含真实支付和实时视频通话。其他页面保持各自的清单状态，不随本次专项一起标记完成。
