# event-participants 差异审计

来源、完整样式/文案/SVG 与 interaction IDs 见 source-contract.json。模块逐项发现与处理见 ../events/source-contract.md。

- 原型UI为来源；现有 Vue 页面不是来源证据。
- 真实账号、报名、人数、关系及消息均读取统一 Store；不照搬虚构原型人数/聊天状态。
- 本轮先校正已明确差异并执行功能回归。原型独立 reference/overlay/diff 尚未完成，因此视觉与完整验收保持 pending，不标 verified。
