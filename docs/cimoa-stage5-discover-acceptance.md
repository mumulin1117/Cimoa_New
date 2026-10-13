# Discover 本页验收

Discover 已完成本页还原与浏览器验收，`local_acceptance: passed`，`full_acceptance: pending`。当前仍是唯一 in_progress 页面，待本地专项提交后恢复 pending（待依赖）。Discover、DiscoverHeroHeader、ProfilePhoto 不标记 verified；完整条件分支与原生宿主未测项见下文。

用户最新决定已登记到开发流程：分段验收适用于后续各页；后续只做本地 Git 提交，不执行 push。两份开发/交互约定和原始 HTML 未修改，其他技术与业务门槛保持。

## 已还原范围

- 对照 HTML 模板361–399行，移除旧人物列表、帖子流、内嵌假详情和假收费破冰区，改为顶部两个54圆形入口、单张353×542人物卡、源SVG验证/资料标签、固定60高 Send shot、原三Tab。按393宽设计值换算rpx，cRise260ms。
- 使用详情基准的 Chloe Lin / 21 / HKUST / Business / ENFP。资料只读 `discover_person`；照片由同一用户的 photo_ids / position 派生，默认原图 `maya-full.png` 与源包逐字节一致。无原型运行时依赖。
- 首次增加 DiscoverHeroHeader、ProfilePhoto；前者独占顶部安全区，不再叠加 TopSafeArea；后者通过现有媒体缓存解析本地资源或 IndexedDB Blob，支持真实加载/失败/10秒超时/重试，切换与卸载释放租约及定时器。
- MainTabFrame 增加固定footer插槽，PageTransition 接受来自统一 MOTION 的源时长；Home 默认行为不变。唯一滚动区与固定 Header / CTA / Tabbar 分离，底部安全区仍由 Tabbar 独占。
- 默认三个标签保持原型单行。较长资料允许换行和卡片增高，短屏滚动可读；不缩小字体或裁掉有效内容。原型54系统占位改实际安全区，姓名采用完整详情姓名，是已授权的技术/资料适配。
- Store 的统一资格 selector 同时供入口与 send_introduction 使用；已连接、已有请求、未验证、会话失效或不可见目标明确失败。默认 Chloe 已连接，点击 Send shot 不假造新请求；0金币未连接场景可生成正确破冰目标，不消耗余额。
- 所有纯导航/读取无业务写入，不加确认或写Loading；没有原生导航Loading。缺依赖由 readiness guard 明确报错，既不跳入旧错误页，也不宣称成功闭环。

## 实测结果

`node --test scripts/discover.test.mjs scripts/home.test.mjs scripts/data.test.mjs scripts/circa-source.test.mjs scripts/navigation.test.mjs`：38项通过。覆盖新 getter、照片所有权/顺序、字段隐私、双向屏蔽、账号失效、入口与提交资格一致、0余额导航无写入，以及既有数据/来源/路由回归。

三项强制校验依次通过：`corepack pnpm check:conventions` → `git diff --check` → `corepack pnpm build:h5`，无 conventions 警告。uni统计/托管输出为构建信息提示。构建产物位于 `dist/build/h5`，不含来源HTML或原型运行库。

一次性隔离 Chrome 验收：Discover **20项**、Home回归 **22项**，机器证据分别为 [Discover](./evidence/discover-browser.json) 和 [Home](./evidence/home-browser.json)。基础检查包括三Tab双向两轮、栈深1、固定底栏、重复点击、真实fixture登录后各Tab单次600ms骨架、刷新不重复骨架、真实IndexedDB保存/删除。Discover增加以下检查：

- 353×542人物卡、54顶部入口、60 CTA、源260ms过渡、三标签单行、照片50%22%定位。
- 默认已连接拒绝重复介绍；三入口目标参数及明确依赖错误；0金币未连接目标正确、重复点击不写请求/账本。
- 未验证和已有待处理请求的明确资格错误，空态/禁用CTA与刷新。
- 无照片、真实资源请求中断/重试、10秒慢请求超时、离页清理；同一Blob在刷新/Tab返回后重新解码，Blob丢失诚实失败。
- 屏蔽同步 Home/Discover、专业隐私、实际验证状态、不读损坏存储为假空态、Retry不覆盖原数据、过期会话不泄露人物。
- 长姓名/大学/专业、320×568窄屏、完整内容滚动可达、无横向溢出、Header/CTA/Tabbar固定。
- 浏览器注入54/0时卡top130、按钮top60；59/34时同侧安全区只计算一次。这不是iPhone 17 Pro或WKWebView实测。

截图人工检查：[来源几何](./evidence/discover-source-insets.png)、[默认](./evidence/discover-default.png)、[空态](./evidence/discover-empty.png)、[无照片](./evidence/discover-no-photo.png)、[照片错误](./evidence/discover-photo-error.png)、[读取错误](./evidence/discover-read-error.png)、[依赖错误](./evidence/discover-dependency-error.png)、[长内容](./evidence/discover-long.png)、[窄屏](./evidence/discover-narrow.png)、[安全区](./evidence/discover-safe-area.png)。视觉依据为静态源值/资源核对、独立H5截图及DOM几何断言；不宣称执行原型或逐像素diff。

所有预览仅服务独立H5构建目录，不服务原型；脚本记录PID并在finally关闭服务和测试浏览器。故障注入产生的两次 `net::ERR_FAILED` 是预期测试结果，不是运行时异常；无未处理浏览器异常。

## Deferred：不能计为完整通过

| 入口/范围 | 已覆盖 | 依赖补齐后的验收 |
| --- | --- | --- |
| photo.openMe.click.1 | 当前账号、/pages/profile/index 参数与显式失败 | 真实Profile、资料修改后同步、返回Discover |
| photo.openDiscoverFilters.click.1 | /pages/auto-match/preferences，按原型独立页而非Sheet | 真实偏好修改、保存/失败/取消、刷新与返回 |
| photo.expand.click.1 | 同一user_id、合法照片、屏蔽和失效拒绝 | Expanded、相册、多照片/歌曲、真实返回位置 |
| photo.sayHi.click.1 | 同一user_id、资格、0币入口、不重复请求/扣币 | Select/Text/Voice/Preview、问题实体、免费文字与10币真实音频、请求状态、跨页与刷新 |
| hasNotif.openNotif / dismissNotif | 无可信事件时不制造通知 | 通知实体/事件适配、真实目标、关闭/已读规则、首次再次动效；两条条件交互仍未实现 |
| Tab切换 | 实际replace和回退到主Tab、深度与骨架 | Events视觉/业务尚未还原，不计Events通过 |
| 原生宿主 | 浏览器safe-area桥接注入 | 已有WKWebView加载、触摸/回弹/安全区、系统返回/手势、媒体与持久化实测 |

四个目标页、通知条件分支和原生宿主均保持待完成；本次是本页里程碑，不是Discover所有入口已闭环。依赖齐备后重新进入唯一 in_progress，再完成 full_acceptance 才可标记 verified。

## 修改文件

- 页面与组件：`src/pages/discover/index.vue`、`src/components/DiscoverHeroHeader.vue`、`ProfilePhoto.vue`、`MainTabFrame.vue`、`PageTransition.vue`、`SourceIcon.vue`。
- 数据/工具/主题：`src/stores/store.js`、`selectors.js`、`scenarios.js`、`src/utils/discoverNavigation.js`、`src/config/navigation.js`、`theme.json`。
- 测试/生成：`scripts/discover.test.mjs`、`scripts/lib/discover-browser.mjs`、`scripts/h5-browser.test.mjs`、`scripts/circa-source.test.mjs`、`scripts/generate-cimoa-stage1.mjs`。
- 文档：开发流程、Discover交互及本验收、阶段1清单/JSON、阶段2字段、阶段3夹具、Home验收决策补记、阶段5总表、阶段6当前进度。
- 证据与产物：`docs/evidence/discover-*`、Home回归JSON和 `dist/build/h5`。静态资源原文件未修改；哈希改名的旧构建chunk由构建器替换，可从Git历史恢复。

本地提交SHA在后续状态登记提交记录，不改写自身历史；无需push。
