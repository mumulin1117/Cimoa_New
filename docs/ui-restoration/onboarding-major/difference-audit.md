# Onboarding Major 第一轮来源锁定与差异审计

## 当前结论

已锁定 HTML 原型 2990–3015 行。浏览器 393×852 与 iPhone 17 Pro WKWebView 的来源结构、确定性截图、持久化闭环、失败回滚、刷新恢复、返回归属和安全区均已通过，页面按用户授权自动确认并标记为 `verified`。

## 来源与实现差异

| ID | 项目 | 锁定来源 | 审计结论 | 处理 |
| --- | --- | --- | --- | --- |
| OBM-001 | 进度 | 39%，`3 / 9` | 原实现从十步 Store 派生为 30%，`3 / 10` | 已增加本页来源覆盖 |
| OBM-002 | 返回 | 46×46，来源 `goBack` | 外观存在但缺 interaction ID | 补 `obMajor.goBack.click.1`，返回 University |
| OBM-003 | 描述 | 标题下 8px | 共享样式为 10px | 本页覆盖回 8px |
| OBM-004 | 网格 | 3 列、12px gap、20px 上距 | 当前 rpx 换算一致 | 保留 |
| OBM-005 | 15 张卡片 | 22px 圆角、2px 边框、30px emoji、14.5px 标签 | 当前结构和视觉值一致 | 保留来源顺序与选中渐变 |
| OBM-006 | 冷启动 | 来源是内存态 | 原实现只在 setup 时读取 context | 改为按 account_id 一次性恢复，编辑中不被 Store 覆盖 |
| OBM-007 | Continue | 必须选择来源卡片后进入 Photos | 已有 Store 校验与 Loading | 补齐空态、双击、失败回滚、离页取消、刷新与返回验收 |

## 验收结论

- 浏览器专项 7/7 通过；注册阶段 Major 回归 8/8、Store 回归 10/10 通过。
- 393×852 来源完成帧对比：平均通道差 0.6076，超过 8 的像素为 7,197；差异集中于平台字体与 emoji 光栅化，无结构、文案、间距或控件漂移。
- iPhone 17 Pro（iOS 26.5）WKWebView 专项 1/1 通过；CSS 视口 402×874，安全区 top 62 / bottom 34。
- 默认态和持久化失败态截图已人工检查；失败时 Store 回滚、不跳转，重试草稿保留。
- 页面状态：`status: verified`、`visual_acceptance: passed`。
