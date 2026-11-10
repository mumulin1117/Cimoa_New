# event-detail 差异审计

来源、完整样式/文案/SVG 与 interaction IDs 见 source-contract.json。模块逐项发现与处理见 ../events/source-contract.md。

- 原型UI为来源；现有 Vue 页面不是来源证据。
- 真实账号、报名、人数、关系及消息均读取统一 Store；不照搬虚构原型人数/聊天状态。
- 本轮先校正已明确差异并执行功能回归。原型独立 reference/overlay/diff 尚未完成，因此视觉与完整验收保持 pending，不标 verified。

## 2026-10-19 主办方屏蔽专项

- 原型 4448 行存在 Block Organizer，当前实现仅提示机构未绑定个人账号，无法闭环。
- 用户已明确批准按机构停止推荐、保留已报名活动与群聊，并可从设置解除。机构 ID 不转换为个人用户 ID。
- 保留详情布局与 More 菜单来源文案；补充复用 EventConfirmDialog 的机构确认、500ms 写前 Loading、失败/取消和刷新恢复。完整十字段与增量数据字段见 ../../evidence/organizer-block/contract.json。
- 本次仅验收该增量，不将详情页其他已知视觉差异、全页面或全项目验收自动改为通过。

## 2026-10-22 More 直接举报（用户调整）

- 用户明确要求右上角 More 直接打开 Report event，不再显示 Share Event / Report Event / Block Organizer 三选项。此决定覆盖上面的旧 More 菜单验收，不修改原型来源快照或两份开发约定。
- 保留来源 interaction ID `evDetail.openEventMore.click.1`，目标改为当前 event_id 的既有举报路由；使用原有导航防重入、守卫、返回与举报提交闭环。
- 移除详情页旧菜单及其分享/机构屏蔽处理代码；不删除已经持久化的机构屏蔽、设置解除入口或 Store 规则，也不新增替代屏蔽入口。
- 原清单及 source-contract 中的旧菜单 IDs 仍是来源追溯，不再代表当前页面的可点击入口。历史 organizer-block 的详情菜单交互证据不适用于本次 UI；设置恢复和机构过滤的数据规则保留。
- 新回归入口：`scripts/event-cover-browser.test.mjs`、`scripts/lib/event-report-navigation.mjs`、`ios/cimoaNeapo/Tests/EventCoverTests.swift`。本次为入口专项，不改变全页面 visual_acceptance / verified 状态。
- 改动文件：`src/pages/events/detail.vue`；本目录 `interactions.json` 与本文件；`scripts/lib/event-report-navigation.mjs`、`scripts/event-cover-browser.test.mjs`、`scripts/event-pages-browser.test.mjs`、`scripts/settings-safety-browser.test.mjs`、`scripts/organizer-block-browser.test.mjs`；`ios/cimoaNeapo/Tests/EventCoverTests.swift`、`ios/cimoaNeapo/Tests/HostTests.swift`。旧机构屏蔽脚本改为从已有屏蔽场景验证过滤和设置恢复，不再依赖已删除菜单；这部分完整脚本本轮未执行。
- 本轮已执行：三项强制命令按顺序通过，约定检查无警告；活动实体测试 17/17；无服务器浏览器专项 13/13（两个活动 ID，各覆盖连点与 Enter）；iPhone 17 Pro / iOS 26.5 包内 WKWebView 专项通过，使用独立 non-persistent 数据，不清空既有账号。保留原有 AppIntents 工具链元数据提示及模拟器 WebKit/无障碍诊断，没有新增应用源码编译警告。
- 浏览器首轮在新增“另一活动”场景后，无效 ID 测试未重载同路径页面，因而超时；补充测试重载后全通过，产品代码未因此增加刷新或路由特例。证据位于忽略目录 `artifacts/event-more/`，H5 包内资源与 `artifacts/cimoaNeapo-ios.zip` 已同步。
