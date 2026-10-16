# Onboarding Icebreakers 第一轮来源锁定与差异审计

## 当前结论

已锁定 HTML 原型 3137–3177、4468–4496 行及 4686、5224、5586、5588、5727–5766 行相关行为。`/pages/onboarding/ice` 是 Goal 的后继页、Notifications 的来源页；主页面、题库 Sheet 和自定义问题 Sheet 已完成浏览器与 iPhone 17 Pro `WKWebView` 双端验收，当前为 `status: verified`、`visual_acceptance: passed`。

## 来源与实现差异

| ID | 项目 | 锁定来源 | 审计结论 | 处理 |
| --- | --- | --- | --- | --- |
| OBI-001 | 进度 | `Profile setup · 6 of 7`、82% | 原实现按十步 Store 显示 8/10、80%，进度条垂直位置偏低 | 页面覆盖来源分子、总数、82%；进度条恢复为标题下 10px |
| OBI-002 | 返回 | 46×46 返回按钮，`obIce.goBack.click.1` | 外观存在但缺 interaction ID | 补齐 ID；返回 Goal，零写入 |
| OBI-003 | 内容与 footer | scroll top 146、bottom padding 150；footer bottom 34；Continue 带箭头 | 通用骨架缺少来源 150px 尾部和箭头 | Ice 页面专项覆盖，保留唯一滚动区与真实安全区 |
| OBI-004 | 题库 Sheet | top 120；六项；只能点击遮罩关闭 | 原实现 top 130 且增加了无来源 Done 按钮 | 修正 top；删除 Done；interaction ID 移到遮罩 |
| OBI-005 | 自定义 Sheet | 来源文案、Add Question；只能点击遮罩关闭 | 原实现自主修改说明，并增加 Update/Cancel | 恢复来源文案和唯一 Add；删除无来源 Cancel/Update |
| OBI-006 | 编辑 | 来源先移除当前问题，再打开题库 | 原实现对自定义问题打开编辑 Sheet | 恢复来源行为；关闭题库后保留移除结果 |
| OBI-007 | 自定义新增 | 来源成功后清空输入并显示 ping，不自动关 Sheet | 原实现新增后自动关闭 | 保持 Sheet，显示来源成功状态，遮罩关闭 |
| OBI-008 | 持久化 | 来源只切页 | 约定要求 Loading 后 Store 原子写入 | 验收三题门槛、Loading 前零写入、双击单次提交、失败回滚和刷新恢复 |

## 验收结果

- 393×852 已生成 Empty 来源 reference、actual、overlay、diff，平均绝对通道差为 `0.6628588323836146`；Completed、Library、Write My Own 与失败态均有独立实图。
- 六项题库、三题上限、选择/取消、自定义空值与安全校验、成功清空、编辑先移除、遮罩关闭均与来源行为一致；未保留无来源 Done、Cancel 或自动关闭。
- Loading 前零写入；双击一次原子写入；持久化失败保留三题草稿；离页取消延迟写入与隐藏导航；刷新恢复同一用户实体。
- Back 回 Connection Goal；成功进入 Notifications；注册链路回归 14/14、Store 回归 10/10。
- 320×568 短屏验证唯一页面滚动区、题库内部滚动和固定 footer；iPhone 17 Pro `WKWebView` 实测 402×874、真实安全区 62/34，专项 1/1 通过。
