# Home 聚合 getter 专项验收

日期：2026-10-17。本轮完成 Home 的统一读取模型与来源 UI/Popover 回归，不代表整个 App 已完成像素验收。

作用域是 Home 214–358 与共享 Tabbar/返回依赖。区块外全局条件通知层的原始绑定单独保留于清单 source_binding_ids，不宣称本次接通了推送/全局通知服务。

## 实现与逻辑

唯一入口是 `store.home_feed`，由 [homeFeed.js](../../src/stores/homeFeed.js) 只读组合 ConnectionRequest、Connection、Conversation、人物/目标、匹配与 UTC 配额。旧 `home_connections` / `home_match_card` 与 selectors 导出只转发，不保留第二套拼接逻辑。页面和导航共用这一份模型，不新增持久化 feed。

同一人物只保留有效 Connection → pending 请求 → 收到匹配邀请 → 自己候选中的最高优先级状态。同类取最新时间，稳定 ID 兜底；显示分组保留原稿 Connected → Auto Match → Invite，Sent 使用已有变体，组内按真实活动时间排序，不取数据库数组顺序。连接代际、会话、未读/最后消息与实际原子事务一致；读取 Home 不标已读、不创建好友/会话、不收费、不重启计时。

已接受请求自动合并为同一连接卡；拉黑双向过滤，解除不会复活关系。失效会话和读取错误不会显示私人卡片、配额或导航目标。连接确实存在但会话缺失时明确错误，不在 getter 偷建。匹配状态卡与目标路由使用相同 match_id/state；队列估时为 0 也不会被丢掉，无数据则明确等待更新。

顺带修复共享 `AutoMatchResultPage` 的 Home completion：原稿 returnHome 为 `root("home")`（6179 行），旧 replace 导致深度 2；现为 reLaunch。connected、passed、expired、no-match 四个消费者已回归，UI 不变、其他导航不变，不据此把这些页面标记为视觉完成。

## 视觉与交互

来源锁定 HTML SHA-256：`6c49411c6868b476ff46cedaa9828ee2ccbfe89d5eaa7ea1f739feb2c8018060`；解码模板 214–358 行和离线 TabBar。完整原始片段、字体/图片 hash、SVG 与批准差异见 [source-contract](./home/source-contract.json)。

保留品牌/左右入口、标题副标题、纵向三类卡、目标锚定 Popover、空态及三 Tab；没有加入原稿未出现的消息预览、未读徽标或统计区。default 的人物、大学、头像和全部目标按详情实体统一，不把原稿 Jordan/Chloe 冲突写死。原有固定 Header/单主滚动区、rpx 和系统安全区适配保留。

重点核对页头、38 标题、353 卡宽、78 头像、标签、卡片间距、渐变、Popover 定位/全部目标及 Tabbar。浏览器逐区几何断言均在 1 CSS px 内；default 和 goals 的 reference/actual/overlay/diff 已查看，不用整体差异百分比代替判断。移除状态卡 action 无来源的窄宽限制，恢复目标文本 pretty 换行；补齐键盘入口和卡片过期/账号切换后的 Popover 清理，不改可见控件。

证据：[浏览器默认](./home/actual-browser.png)、[来源叠图](./home/overlay.png)、[Popover 叠图](./home/goals/overlay.png)、[小屏](./home/actual-browser-small.png)、[原生截图](./home/actual-wkwebview.png)。

## 实测结果

- 131 项单元/Store/账号/媒体/导航/桥接测试全部通过，其中新 Home 专项 13 项。
- 浏览器 Home 15 项通过：来源几何、首次/再次 Popover、正确入口/返回、两个 Tab 周期、空/错误/长内容、接受/拉黑与刷新、四种匹配状态、UTC 零点、键盘目标入口、候选过期关闭、真实登录后每 Tab 单次骨架与返回/刷新不重复。
- 两账号文字/语音/匹配/接受拒绝/Not Now/拉黑集成 5 项全部通过。
- iPhone 17 Pro / iOS 26.5 的 WKWebView 专项 1/1，通过四类真实入口返回、Popover、两轮 Tab、Pass 回根、接受 Loading 前不写/后合并、拉黑及刷新。视口 402×874，顶部 62、底部约 34；三张头像解码完成且 opacity=1 后才截图。
- H5 378 文件；当前包与被测原生 App 的 build-manifest 完全一致，SHA-256 `1da684427e0275bef05b7f7c521d4fa5e2a8b995a5def8c97b4987312250661d`。不嵌入/执行原型 HTML，不依赖预览服务器。
- 三项强制校验依序通过，无 conventions warning。机器记录见 [acceptance.json](./home/acceptance.json)，原生结果 bundle 为 `/tmp/cimoa-home-aggregate-pixels.xcresult`，摘要已保存。

测试修正记录：Chat 合法已读操作与“纯导航不写”使用独立场景区分；跨 UTC 的测试时钟放独立浏览器 context；原生接受后排序变化按 user_id 定位，不把复用的 interaction_id 当人物身份；等待真实落盘再断言拉黑。早期原生截图捕捉过早的问题以图片/opacity/绘制帧断言解决，最终专项已完整重跑。

## 文件与提交

- 数据：`src/stores/homeFeed.js`、`store.js`、`selectors.js`、`src/utils/homeNavigation.js`。
- UI/依赖：`src/pages/home/index.vue`、`src/components/ConnectionGoalsPopover.vue`、`AutoMatchResultPage.vue`。
- 测试：`scripts/home-feed.test.mjs`、`home-feed-browser.test.mjs`、`ios/cimoaNeapo/Tests/HostTests.swift`。
- 文档/证据：`docs/cimoa-home-feed.md`、阶段 2/5 记录、Home 交互清单、页面清单、`docs/ui-restoration/home/`、本轮 social-entities 回归证据。
- 产物：`dist/build/h5`；原生 Resources 由既有打包脚本同步。两份约定未修改；原有 10 张注册截图改动不暂存。

完成门槛遵循既定流程：完整证据与三项门禁通过后先完成专项本地功能提交，再用仅含验收登记的提交标记 Home 及专属组件 verified。仅本地提交，不 push。其他页面状态不随本次专项自动改变。

本地功能提交已完成：`703c7085`。本次验收登记将 Home 九个来源变体及 Home 专属 Popover 使用范围标记为 `verified`；登记自身单独本地提交，不反复改写功能提交。共享 AutoMatchResultPage 仅登记返回依赖回归，不改变其消费者的独立视觉验收状态。
