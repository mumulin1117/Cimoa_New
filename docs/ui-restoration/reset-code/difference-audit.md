# Reset Code 来源锁定与差异审计

## 当前结论

锁定 HTML 原型 2840–2858 行。已恢复 `Reset password`、`Enter reset code`、72px 单一输入框、左对齐次级入口与 `Continue`；删除无来源的大型渐变验证码卡片。固定验证码与无邮件服务属于用户已明确的认证范围，故只在来源说明位置作真实性替换。浏览器 393×852、320×568、安全区探针和 iPhone 17 Pro WKWebView 均通过，当前 `status: verified`、`visual_acceptance: passed`。

| ID | 项目 | 来源 | 当前实现 | 处理 |
| --- | --- | --- | --- | --- |
| RSC-001 | Header/Back | y=58；46 圆形 Back；`Reset password` | AuthPageFrame 来源尺寸 | 浏览器与 WKWebView 通过 |
| RSC-002 | 标题 | `Enter reset code` | 已恢复来源原文 | 通过 |
| RSC-003 | 说明 | 六位且十分钟有效 | 明示固定 `009789`、不发邮件、不失效 | 批准差异，禁止假发送和假过期 |
| RSC-004 | Code field | 20px gap；72 高；20 圆角；无 label | 已恢复单一输入容器 | 通过 |
| RSC-005 | Disclosure card | 无 | 已删除原无来源渐变卡片 | 已修正 |
| RSC-006 | Resend | `Resend code` | `Show code again`，点击仅重复明示固定码 | 批准差异、零写入 |
| RSC-007 | CTA | `Continue` | 已恢复来源原文 | 通过 |
| RSC-008 | 验证写入 | 来源仅导航 | 500ms Loading 后写 owned reset verified_at | 浏览器与 WKWebView 通过 |
| RSC-009 | 返回/刷新 | 返回 Email；刷新不保留输入 | route owner + Store reset_id | 通过 |
