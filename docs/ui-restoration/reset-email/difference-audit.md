# Reset Email 来源锁定与差异审计

## 当前结论

锁定 HTML 原型 2819–2839 行。已恢复来源标题 `Reset your password`，删除无来源的账号类型说明；本地认证范围导致的“不会发送邮件”和 `Continue` 是必须保留的真实性差异。浏览器 393×852、320×568、安全区探针和 iPhone 17 Pro WKWebView 均通过，当前 `status: verified`、`visual_acceptance: passed`。

| ID | 项目 | 来源 | 当前实现 | 处理 |
| --- | --- | --- | --- | --- |
| RSE-001 | Header/Back | y=58；46 圆形 Back；`Reset password` | AuthPageFrame 等尺寸 | 浏览器与 WKWebView 通过 |
| RSE-002 | 标题 | `Reset your password` | 已恢复来源原文 | 通过 |
| RSE-003 | 说明 | 声称发送验证码邮件 | 明确只查找设备内账号、不发送邮件 | 批准差异 |
| RSE-004 | Email field | 14px gap；56 高；18 圆角 | 复用 auth field token | 通过 |
| RSE-005 | CTA | `Send Reset Code` | `Continue` | 批准差异，禁止假发送 |
| RSE-006 | 额外说明 | 无 | 已删除原无来源 note | 已修正 |
| RSE-007 | 写入 | 来源为演示导航 | 500ms Loading 后创建 owned reset_id | 浏览器与 WKWebView 通过 |
| RSE-008 | 返回 | pop Login；直达 fallback Login | route transition 统一处理 | 通过，直达返回零写入 |
