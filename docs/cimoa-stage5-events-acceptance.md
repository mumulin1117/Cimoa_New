# Events 阶段五本页验收

2026-10-13：**local_acceptance: passed，full_acceptance: pending，status: pending（待依赖）**。本轮只还原 Events 及首次使用的确认弹窗，不标记 verified。功能/测试/构建产物已本地提交 `36274d7`；状态与补充回归截图随后单独本地提交，不 push。

## 已通过的范围

1. 按 HTML 517–605 行重建固定工具栏/标题/三个筛选、横向吸附活动卡片和固定 Tabbar，移除旧纵向列表与内嵌详情 mega-page。实际 393 宽卡片309、封面214高、筛选52高，页面 cRise260ms。照片为原文件字节一致的本地资源，运行独立 Vue/uni-app 源码，不加载原 HTML。
2. 活动资料、头像、人数、容量、报名状态、当前筛选全从 Store 派生。Today / This week / My campus 是真实日期/校园筛选，不把原型演示数组当筛选结果。香港活动日期使用 Asia/Hong_Kong，免费匹配额度仍按 UTC 零点，不混用规则。
3. 两个常驻确认组件覆盖第一次/再次开启、取消、遮罩、退出动画、提交锁。加入/取消/保存筛选在500ms自定义 Loading后写 Store，失败回滚，重复报名不新增成员；隐藏/卸载取消未执行的写入。取消后余位恢复、My Events同源移除、群消息权限撤销。
4. 报名成功真实持久化，但 Join Success 依赖尚未还原，明确提示“place is saved… confirmation page… not restored”，不假称完整成功页已验收。纯导航不改数据，不进入旧错误页面。详细逐 ID 及目标参数见 [交互契约](./cimoa-events-interactions.md)。
5. 照片空态、请求失败和重试使用同一实体，不替换成他人/别的活动；旧有效 v2 存档完整保留。损坏读取可重试，不自动重建；写失败保留确认面板及旧筛选。默认 Picnic 三名真实参与者，加入后四名；不虚构原图12名。
6. 长标题/地址换行、320×640滚动、安全区注入59/34、首次认证骨架、Tab双向多轮切换、刷新恢复均通过。截图复核发现过长弹窗内部溢出，已修复为真实有界滚动；测试现在验证末尾 Not now 按钮滚动后完全位于面板内，不能只测外框。

## 校验证据

- `node --test scripts/events.test.mjs scripts/data.test.mjs scripts/discover.test.mjs scripts/home.test.mjs scripts/circa-source.test.mjs scripts/navigation.test.mjs`：46/46通过，其中 Events 专项8项。
- [Events H5报告](./evidence/events-browser.json)：19/19通过；固定独立 fixture 时钟2026-10-13 09:00香港，浏览器393×852及320×640。包括真实持久化、500ms前无写入、图片失败重试、损坏存储修复重读、长弹窗底部可达、卸载取消写入；没有浏览器运行时异常。
- 共享组件回归：[Home](./evidence/home-browser.json)22/22、[Discover](./evidence/discover-browser.json)20/20通过。Home 截图仍相同；Discover 保留原人物图与22%取景位置，Events 单独居中取景。
- 顺序强制检查：`corepack pnpm check:conventions` → `git diff --check` → `corepack pnpm build:h5` 均通过，无 warning。媒体失败夹具故意产生404/请求中断，并非构建警告或默认页面错误。
- 所有测试服务为一次性 isolated profile，仅提供 `dist/build/h5`，`finally` 关闭服务/浏览器；各报告有 PID 和 `cleaned_up: true`。本轮根 PID64839、64961、65303、65516、66162、66320、66643、66951及当时父子关联检查均已退出，不停止用户原服务。
- `dist/build/h5` 按仓库原有跟踪策略更新哈希资源，没有删除源代码或原型；旧构建分块由本轮构建替换，可通过 Git 恢复。manifest 保留原型名称仅作来源元数据，应用 JS 不导入原型脚本。

## 视觉证据

- [默认页面](./evidence/events-default.png)、[加入确认](./evidence/events-join-confirm.png)、[加入后](./evidence/events-joined.png)、[取消确认](./evidence/events-cancel-confirm.png)。
- [窄屏长内容及安全区](./evidence/events-long-safe-area.png)、[长弹窗滚动到底部](./evidence/events-long-confirm.png)。
- [空状态](./evidence/events-empty.png)、[写失败](./evidence/events-write-error.png)、[读失败](./evidence/events-read-error.png)、[图片失败](./evidence/events-photo-error.png)、[最终默认](./evidence/events-final.png)。

所有安全区证据是浏览器桥注入，不是 iPhone 模拟器或原生 WKWebView 实测。本轮没有生成或声称验收 iOS 工程。

## 仍需完整验收的依赖

| 入口 | 目标/欠缺 | 依赖完成后的复验 |
| --- | --- | --- |
| openMe / openMyEvents | Profile / Events Upcoming | 真实进入、返回原筛选和位置；My Events 不自动报名 |
| openEvent / m.open / 已报名按钮 | Event Detail | 同一 event_id 的资料、日期、人数、余位、加入/取消、返回 |
| openParticipants | Participants | 真成员与隐私/拉黑过滤、成员详情及返回 |
| confirmJoin | Join Success | 同一活动成功页、Done/群聊入口和完整返回栈 |
| openGroup | Event Group | 实际群会话读取、发送/刷新、取消报名权限失效与返回 |
| hasNotif.* | 全局通知 | 真实通知源、实体目标、关闭及刷新 |
| evFilterSheet | 原型只有catalog和逻辑，缺模板UI及入口 | 补充来源稿或明确新设计授权后另行实现；未列为本页通过 |
| WKWebView | 仓库未找到现有宿主工程 | 实机/模拟器本地H5加载、真实安全区、页面返回、媒体权限等 |

报名后的非首张卡复用相同 Manage / Group 入口以支持本页真实取消闭环；具体详情页仍 deferred。源 Today/周的同名活动演示日期和人数有冲突，以单一实体及已声明 fixture 时钟为准；不复制多份同名业务数据。羽毛球保留既有两座满员反例，其他新活动容量按源详情 lookup 转写。原有高级 filters 暂不与本页 active_tab 混用。

## 本轮文件清单

- 页面：`src/pages/events/index.vue`。
- 首用组件：`src/components/EventConfirmDialog.vue`、`EvJoinConfirmDialog.vue`、`EvCancelConfirmDialog.vue`、`EventActionLoading.vue`；共享复用调整：同目录 `MainTabFrame.vue`、`ProfilePhoto.vue`、`SourceIcon.vue`。
- 数据/路由：`src/stores/eventSelectors.js`、`seed.js`、`selectors.js`、`store.js`；`src/utils/eventsNavigation.js`；`src/config/navigation.js`、`theme.json`。
- 计划/契约：`scripts/lib/page-contracts.mjs`、`scripts/generate-cimoa-stage1.mjs`；`docs/cimoa-page-inventory.json`、`cimoa-interaction-owners.json`、`cimoa-stage1-page-inventory.md`、`cimoa-stage2-data-fields.md`、`cimoa-stage3-test-data.md`、`cimoa-events-interactions.md`、本记录与 `cimoa-stage5-page-status.md`。
- 测试：`scripts/events.test.mjs`、`scripts/lib/events-browser.mjs`、`scripts/h5-browser.test.mjs`；`docs/evidence/events-*.png` 与 Events/Home/Discover 三份浏览器报告；回归重录的 `docs/evidence/discover-default.png`、`discover-dependency-error.png`、`discover-source-insets.png`。
- 构建：`dist/build/h5/index.html` 及本轮生成/替换的 `dist/build/h5/assets/*` 分块。

未改 `DEVELOPMENT_CONVENTIONS.md`、`INTERACTION_CONVENTIONS.md`、原 HTML、用户存档、仓库远端配置；没有 push，也不把本页通过升级成 verified。验收记录按文档技能将已验证事实、源缺口和后续依赖分开。
