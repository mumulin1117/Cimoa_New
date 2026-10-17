# Reset New Password 来源锁定与差异审计

## 当前结论

锁定 HTML 原型 2859–2888 行。已恢复 `Reset password`、来源两组字段与 `Repeat it`，删除无来源的页面说明和底部 note。来源 CTA `Save and Log In` 与已确定的安全本地流程冲突：完成后必须保持登出并回 Login，故保留真实的 `Update password`。浏览器 393×852、320×568、安全区探针和 iPhone 17 Pro WKWebView 全流程均通过，当前 `status: verified`、`visual_acceptance: passed`。

| ID | 项目 | 来源 | 当前实现 | 处理 |
| --- | --- | --- | --- | --- |
| RSN-001 | Header/Back | y=58；46 圆形 Back；`Reset password` | 已恢复来源标题 | 浏览器与 WKWebView 通过 |
| RSN-002 | 标题 | `Choose a new password` | 来源原文 | 通过 |
| RSN-003 | 额外说明 | 无 | 已删除 description 与 local note | 已修正 |
| RSN-004 | Password | 14px gap；56 高；Show/Hide；6px hint | 复用 auth field token | 通过 |
| RSN-005 | Confirmation | `Repeat it`；不匹配提示 | 已恢复来源文案 | 通过 |
| RSN-006 | CTA | `Save and Log In` | `Update password` | 批准差异，禁止假登录 |
| RSN-007 | 写入 | 原型只回 Login | 500ms Loading 后改凭据、清 reset、保持登出 | 浏览器与 WKWebView 通过 |
| RSN-008 | 密钥/刷新 | 未定义 | 密码不持久化，刷新清空；旧密码失效 | 通过 |
| RSN-009 | 返回 | 返回 Code | route owner 保留 reset_id | 通过 |
