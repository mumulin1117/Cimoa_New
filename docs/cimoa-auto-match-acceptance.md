# Auto Match 本轮验收（2026-10-17）

## 结论与边界

本轮已完成 Auto Match 的独立 Vue 页面、Store 状态机与恢复机制，以及模块内浏览器和 WKWebView 回归。11页均 source_lock=locked、visual_acceptance=passed、local_acceptance=passed；全链路 full_acceptance 和 status 保持 pending，不带过尚未验收的金币依赖页。

依赖项：Coin Center（/pages/coins/index）、消费处理中（/pages/coins/processing）、消费失败（/pages/coins/spend-failed）的原稿逐页完整验收。StoreKit 商品与真实购买成功仍未配置；余额不足可以进入金币中心，刷新后返回同一搜索，不能购买假成功。本报告不宣称全 App 还原完成。

## 来源及用户决定

- 根目录 CIRCA HTML 是唯一 UI 来源，SHA-256：6c49411c6868b476ff46cedaa9828ee2ccbfe89d5eaa7ea1f739feb2c8018060。1460–1915 为11页正文，Sheet 单独锁定。
- 用户确认历史入口放在 Entry，右上 History 是明确授权的补充。
- Stay in Pool / Find Another Match 沿用本次入池资格，不再扣次数或金币。下一轮使用新 match_id，以 pool_id / retry_of_match_id 关联；旧结果保留，同一结果重复点击只返回同一后继。
- 明确离开/取消或建立连接结束资格，主动重新 Join 才是新资格。每日配额 UTC 零点重置；Priority 截止不因重试、暂停或刷新续期。
- 已授权保存大学/地区区域距离供筛选，不请求 GPS，不声称实时位置。
- 本地账号范围内使用同一数据层；waiting 不由 timer 自动连接。对方必须以其账号明确接受，才建立双向 consent 和唯一 Conversation。

## 本轮实测

- 数据/逻辑146/146通过：精确截止、UTC配额、入池/优先账本、失败回滚、重试幂等、账号隔离、拉黑、删除历史候选后的资格关联。
- 浏览器11/11来源对照：393×852、cRise结束帧、同一cPulse相位，无超过1 CSS px的几何差异。每页保留 reference、actual、overlay、diff、geometry。
- 浏览器6组跨页场景通过：真实搜索与暂停/刷新/恢复、Home状态卡、只读options、候选详情、等待、对方接受、双方同会话、旧URL恢复与History。
- 浏览器15组边界通过：11页会话过期不泄露/不写入、无效ID、损坏存储、320×568长资料滚动及固定CTA、余额不足后的充值来源刷新恢复。
- iPhone 17 Pro / iOS 26.5：12/12通过，11页截图加完整流程。真实切到Safari再返回宿主；同一匹配可继续暂停/恢复。两账号登录、对方接受、Home、资料Chat、会话和History一致。
- 原生安全区62/34逻辑点，视口402×874，无横向溢出。宿主加载打包的H5，不加载原HTML。
- 原生测试先 build-for-testing、显式安装当前.app，再 test-without-building。入口响应与安装包文件逐字节核对。此前旧包/旧文档诊断保留，不作成功证据。
- 没有使用麦克风、申请GPS或增加自动同意。原生测试结束恢复用户原有存储；本轮启动的Safari、临时H5服务和隔离浏览器已清理。

## 证据和复测

- [状态与字段契约](./cimoa-auto-match-state.md)
- [页面还原清单](./cimoa-page-inventory.json)
- [浏览器跨页流程](./evidence/auto-match/flow-browser.json)
- [浏览器边界](./evidence/auto-match/edge-browser.json)
- [原生完整流程](./evidence/auto-match/flow-wkwebview.json)
- [真实后台恢复](./evidence/auto-match/native-background.json)
- [原生测试摘要](./evidence/auto-match/native-tests.json)
- [本轮改动文件清单](./evidence/auto-match/changed-source-files.json)
- [构建、依赖与校验汇总](./evidence/auto-match/acceptance.json)

原始测试包：/tmp/cimoa-auto-match-releasecheck-20261017.xcresult。

浏览器脚本使用构建产物，执行 scripts/auto-match-browser.test.mjs --page=<name>；另有 auto-match-flow-browser.test.mjs、auto-match-edge-browser.test.mjs。配置可用的 Playwright 模块与Chrome。脚本自动启动有界临时服务并在 finally 关闭，不使用dev/watch。

原生完整恢复测试需同时启动一次性 scripts/auto-match-background.test.mjs：它等待唯一暂停检查点、切Safari并返回、写入同一token后立即退出。单页像素测试不依赖该脚本。完成后清理本轮启动的Safari。

实现遵循 Vue3 script setup、uni-app/rpx、单Store、语义主题变量、自定义确认、500ms Loading后写入、持久化截止时间、统一路由和单一安全区所有权。两份开发/交互约定未改动。仅本地提交，不推送；原有10张注册截图变更不暂存、不覆盖。
