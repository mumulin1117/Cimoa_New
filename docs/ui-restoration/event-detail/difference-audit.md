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
