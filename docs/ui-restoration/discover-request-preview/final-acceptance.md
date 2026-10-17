# Discover 请求流程封版验收（2026-10-17）

范围仅为 Discover 卡片 → 他人主页 → 选题 → 免费文字/真实语音 → 语音预览与明确费用确认 → 请求 → 对方接受/拒绝 → 同一聊天会话；不声明全 App 或真实网络服务验收完成。

## 来源与视觉

六页分别保存 source-contract、difference-audit、reference、actual-browser、overlay、diff 和实际 WKWebView 截图。393×852 基准固定 cRise 结束帧；iPhone 17 Pro 使用真实 402×874 视口与原生安全区。麦克风、丢弃录音、语音确认、余额不足另存弹层叠图。来源 SHA256 为 6c49411c6868b476ff46cedaa9828ee2ccbfe89d5eaa7ea1f739feb2c8018060。

逐区检查结构、文案、原 SVG、字号、间距、照片裁切、固定区、滚动区与点击热区。保留用户批准的六人实体素材、免费文字、真实安全区与录音状态差异，不用原稿静态 00:12 或假波形冒充音频。修正全局抗锯齿继承、17/22 字号 rem 临界舍入、文字标题 top11、原 textarea 内边距/占位色、确认 Close 锚点和原丢弃 Sheet。已知未解决视觉差异：无。按用户授权自动视觉确认，实际本地实现提交后再写入 verified。

## 实测

- Store/权限/持久化/关系/媒体等一次性 Node 测试：140/140，零失败、零跳过。
- 六页浏览器专项：42 项通过，零 pageerror；八种 iPhone 尺寸的 Discover 卡片不做上下滚动。二级长内容可滚动、Tab 固定、返回真实来源、刷新草稿恢复、存储失败保留输入、损坏/过期存储失败关闭。
- 草稿破坏性边界补测：4 项通过（extra-browser-acceptance.json）。预览重录确认删除真实未发送 Blob/引用；语音菜单重录和删除；文字/语音双向切换保留两种内容；Keep Recording 和确认丢弃走不同结果，始终无额外请求或扣费。
- 跨账号集成：5 项通过；发出仍为 pending，对方显式接受才产生唯一 Connection/Conversation；Not Now 不等于拒绝；拒绝/拉黑不授予私聊。语音在收到请求、接受、聊天与刷新后保持同一媒体 ID。
- 金币依赖：中心/处理中/取消/失败/非法成功页共22项通过；无宿主超时、不匹配结果和取消都不加币。购买取消后刷新仍返回原问题/录音。未配置真实商品，不声明 IAP 成功。
- 共享弹层活动回归：4 项通过；报名/取消、重复提交、失败回滚和刷新人数同步。
- 最终原生套件：7/7，零失败、零跳过；结果位于 /tmp/cimoa-discover-request-sealed.xcresult，机器摘要见 wkwebview-test-summary.json。
- 经用户明确授权，WKWebView 真实麦克风录制约 2.13 秒。取消丢弃保留录音，保存并刷新后可播；测试 Blob 已删除、两个原账号存储键逐字恢复，录音字节不进入仓库或截图证据。
- 当前 H5 与原生 app 包内 manifest 完全相同：SHA256 2231a7f64d79327c8fb29a940dca6ad655ab9570281279e1051d88bc502399c4；独立项目代码运行，不加载原型。

## 关键约定与改动文件

Vue 3 script setup、uni-app API/rpx、主题变量；业务只读 getter/Store actions，写入前自定义500ms Loading；请求/扣费原子且幂等；取消清理；所有确认通过既有 ConfirmDialog 家族；三 Tab 与二级框架不另造栈。

主要实现：src/stores/discoverFlow.js、store.js；src/utils/discoverNavigation.js、coinReturnContext.js；src/pages/discover/index.vue、profile.vue、icebreaker/{select,text,voice,preview}.vue、icebreaker.css；src/components/Icebreaker{Header,Person,Icon,Audio}.vue、IntroductionConfirmDialog.vue、EventConfirmDialog.vue（可选 corner slot）；src/pages/coins/{index,purchasing,cancelled,failed,success}.vue；src/config/theme.json。

测试：scripts/discover-request{.test,-browser.test,-extra-browser.test,-contracts}.mjs、scripts/lib/discover-request-reference.mjs、discover-test-audio.mjs、scripts/social-entities-browser.test.mjs、ios/cimoaNeapo/Tests/HostTests.swift。构建产物为 dist/build/h5 与 iOS Resources/H5，文档为本模块清单与 docs/cimoa-discover-request-flow.md。每页 acceptance.json 的 verified_components 限定本轮已验收的专属组件/共享变体，不扩张为全 App 组件验收。

两份开发/交互约定未修改。仅本地提交，不 push。用户原有10张 registration 截图改动保留，不暂存、不回滚。临时浏览器/HTTP 测试服务均已在 finally 关闭；未启动 dev/watch/daemon。

## 提交门槛

逐页本地实现提交依次为：Discover 580bf6c4、他人主页 b460faf6、选题 e7e20448、文字 fdc3a004、语音 addf8035、预览与最终依赖修正 f8924a99。各页当时未完成的完整依赖验收保持 pending，没有提前 verified。

现在已确认上述实际提交和最终回归；本次独立记录提交才将六页及首用的麦克风、丢弃录音、语音费用确认、余额不足四个 Sheet 标记 verified。历史独立权限页、目录中的旧 coinConfirm 画板以及其他模块不随本轮提升状态。工作区只保留任务开始前已有的10张注册截图改动。
