# Onboarding Connection Goal 第一轮来源锁定与差异审计

## 当前结论

已锁定 HTML 原型 3109–3136 行及目标初始值、路由、15 个选项和按钮状态行为。`/pages/onboarding/goal` 是 Interests 的后继页、Icebreakers 的来源页；浏览器与 iPhone 17 Pro `WKWebView` 均已通过验收，当前为 `status: verified`、`visual_acceptance: passed`。

## 来源与实现差异

| ID | 项目 | 锁定来源 | 审计结论 | 处理 |
| --- | --- | --- | --- | --- |
| OBG-001 | 进度 | 72%，`6 / 8` | 原实现按十步 Store 显示 `7 / 10`、70% | 页面覆盖来源分子、总数和 72% 进度 |
| OBG-002 | 返回 | 46×46 来源返回按钮 | 外观存在但缺 interaction ID | 增加 `obGoal.goBack.click.1`，返回 Interests |
| OBG-003 | 文案 | 标题、说明及 Continue | 实现文案一致 | 保留并做精确断言 |
| OBG-004 | 选项 | 15 个目标，顺序、emoji 和标签固定 | Store catalog 已按来源顺序定义；共享实体中部分旧标签大小写不一致 | 页面只从 getter 读取；Store 写入时按来源目录规范化已存在及缺失目标实体，Profile 同步读取同一实体 |
| OBG-005 | 默认来源帧 | 无选中项，按钮禁用 | 实现初始用户目标为空 | 验收禁用态零 Loading、零写入、零导航 |
| OBG-006 | 选择反馈 | 选中渐变/白字，未选白底/深色字 | 当前低交互 toggle 符合约定且无持久化 | 保留；验收多选、取消、重选和至少一项目标门槛 |
| OBG-007 | 写入闭环 | 来源仅切页 | 项目约定要求 Loading 后 Store 原子持久化 | 验收 Loading 前零写入、双击单次提交、失败回滚和刷新恢复 |
| OBG-008 | 滚动与安全区 | 393×852 固定 footer、15 个 chips 在唯一滚动区；footer bottom 30px | 通用骨架为单一 scroll-view，但默认 footer bottom 34px、内容尾部留白不足 | Goal 页面按来源覆盖 150px 内容尾部与 30px footer，并验收短屏最后一项可达 |

## 验收结果

- 393×852 来源空态已生成 reference、actual、overlay、diff，平均绝对通道差为 `0.7623933806400746`。
- 空态禁用、一项可继续、15 项全选、取消/重选及共享目标实体规范化全部通过。
- Loading 前零写入；双击一次原子写入；持久化失败保留重试选择；离页取消延迟写入与隐藏导航。
- 刷新恢复同一用户实体；Back 回 Interests；成功进入 Icebreakers；注册链路回归 13/13、Store 回归 10/10。
- 浏览器无宿主、320×568 短屏与 iPhone 17 Pro `WKWebView` 均验证了唯一滚动区、固定 footer、真实安全区和失败态。
