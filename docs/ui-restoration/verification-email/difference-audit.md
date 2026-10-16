# Email Verification 第一轮来源锁定与差异审计

## 结论

Email Verification 已完成来源锁定、差异修正、浏览器/WKWebView 取证与完整行为验收。返回/输入 interaction ID、输入后错误清理、来源 bottom 34 和真实键盘适配均已关闭；按用户授权的自动确认规则，本页现为 `status: verified`、`visual_acceptance: passed`。

来源：默认 email 状态 4689；返回 5224；页面条件 5534；页面入口/继续 5565–5566；未验证登录入口 5592；email getter/input 5605–5606；注册与 Apple 入口 5620/5623；Code Change Email 5633。完整锁定值与哈希见 [source-contract.json](./source-contract.json)。历史截图 [verification-email.png](../../evidence/registration/verification-email.png) 和 [email-browser.json](../../evidence/registration/email-browser.json) 只证明旧本地流程，不代替本次像素验收。

## 最终对照结果

| ID | 项目 | 锁定来源 | 当前实现 | 首轮结论 | 后续处理 | 涉及文件 |
| --- | --- | --- | --- | --- | --- | --- |
| VEM-001 | 根层/背景/动效 | absolute inset 0；cRise 240ms；来源渐变 | SecondaryPageFrame + PageTransition + 同主题渐变 | 结构一致 | 固定动画结束帧取证 | `email.vue`、`PageTransition.vue` |
| VEM-002 | Header/安全区 | source y=58；46 返回；48 header | AuthPageFrame 使用同一来源骨架，TopSafeArea 替代系统占位 | 批准适配 | 浏览器注入来源安全区、WK 实测分别断言 | `AuthPageFrame.vue` |
| VEM-003 | 返回入口 | `goBack` | 已传 `verEmail.goBack.click.1`；普通 pop 真实来源，直达 fallback Signup | 已修正并通过 | 浏览器直达返回零写入 | `email.vue` |
| VEM-004 | Header 文案 | `University verification` | `Local verification` | 必要真实差异 | 锁定批准本地文案，保持 21/700/居中几何 | `email.vue` |
| VEM-005 | 标题/说明 | `Verify your university`；声称发送邮件并确认学生身份 | `Confirm your email`；明确固定码、不发邮件、不认证学生 | 必要真实差异 | 保留当前最小真实文案并锁定 33/17、10px、1.45 来源几何 | `email.vue`、`auth.css` |
| VEM-006 | Email 输入几何 | 14 margin、7 label gap、56 高、18 radius/padding、17 input | 共享 auth 参数与来源换算一致 | 一致待截图 | normal、长邮箱、键盘态取证 | `auth.css` |
| VEM-007 | 输入 interaction ID/错误清理 | `onEmail` 修改 email 并清旧错误 | 已补 `verEmail.onEmail.change.1`；输入仅改内存并清旧错误 | 已修正并通过 | invalid 后编辑立即清除 | `email.vue` |
| VEM-008 | Email 来源/恢复 | source 复用 Signup email；standalone 可为空 | Store getter 只允许真实 pending/同账号 context；正常流程预填，缺 context 显错 | 批准实体完整性差异 | 分开验证正常预填、刷新恢复和缺 context，不造假账号 | `email.vue`、Store |
| VEM-009 | 隐私卡 | source 声称一次验证且不营销；18 padding/22 radius/15.5/1.5 | 本地设备账号说明，几何参数对应来源 | 必要真实差异待截图 | 保留最短真实本地说明，锁定来源容器几何 | `email.vue` |
| VEM-010 | Example | 准确原文、14px margin、14.5px | 文案和样式换算一致 | 一致待截图 | 双端精确断言 | `email.vue` |
| VEM-011 | Footer 位置 | left/right 20；bottom 34 | Email 专属恢复 34px 设计留白，物理 BottomSafeArea 仍唯一拥有 | 已修正并通过 | 双端几何断言 | `email.vue`、`AuthPageFrame.vue` |
| VEM-012 | CTA 文案/外观 | `Send Verification Code`；60/30/渐变 | `Continue to Local Code`；共享渐变几何 | 必要真实差异 | 锁定批准文案并保持来源 60/30/34 bottom | `email.vue` |
| VEM-013 | 正常继续 | source 校验 @/域名、设 resend=42、进 Code | 合法同邮箱直接进 Code；改邮箱先 500ms Loading 原子更新 | 批准业务差异但需完整回归 | 覆盖 unchanged 零写、changed Loading、重复/存储失败回滚、连点单次 | `email.vue`、Store |
| VEM-014 | Unsupported 分支 | 非 edu/ac.xx/hkust 进 Unsupported | 本地模式接受任意合法唯一邮箱 | 用户授权的本地差异 | 不把域名当学生证明；契约中明确退役该分支 | `email.vue`、Store |
| VEM-015 | 缺/过期 context | source 仍显示输入与 CTA | 明确错误和 Log In，不创建账号 | 约定要求的真实失败 | 锁定 error/Log In 独立状态，零写入并返回可恢复页面 | `email.vue` |
| VEM-016 | 已验证 context | source 无 | 当前 email disabled，CTA 继续 Success | 批准恢复差异待验证 | 不重复验证、不改 email；真实上下文才可继续 | `email.vue` |
| VEM-017 | 键盘 | 来源未登记系统键盘适配 | visualViewport 驱动 footer 折叠；真实 iOS 键盘下输入可见 | 已修正并通过 | 浏览器缩窗 + iPhone 17 Pro 真实软键盘 | `email.vue`、`useEventViewport.js` |
| VEM-018 | 视觉证据 | 来源结构与批准本地文案 | 已生成 reference/actual/overlay/diff、error/conflict/missing-context/small 与 WK 三态证据 | 已补齐并通过 | 浏览器 9/9；WK 1/1 | `scripts/verification-email-visual.test.mjs` |
| VEM-019 | 页面资源 | 只有返回 SVG；无媒体 | 清单已删除无关歌曲封面 | 已修正 | inventory `media=[]` | `cimoa-page-inventory.json` |

## 锁定后的正常可见内容

正常页只允许出现：返回按钮、`Local verification`、`Confirm your email`、固定码/不发邮件/不认证学生的真实说明、一个预填真实账号 email 的输入框、本地隐私卡、来源 Example 和 `Continue to Local Code`。不得出现“邮件已发送”、营销承诺、学生已认证、测试切换器、伪造成功或无来源媒体。

## 本轮验收结果

1. 浏览器确定性测试 9/9 通过：393×852、cRise 结束帧、reference/actual/overlay/diff、invalid、conflict、missing context、verified recovery、320×568 与 62/34 安全区。平均通道差 `0.7841271548`，大于 8 的像素 `12744`；几何、批准文案和 interaction IDs 均精确断言。
2. unchanged email 零写直达；changed email 500ms Loading 后原子更新且连点只写一次；重复邮箱与存储失败完整回滚；缺 context 不暴露输入、不造账号并进入真实 Login。
3. iPhone 17 Pro（iOS 26.5）WKWebView 专项 1/1 通过，实测视口 402×874、安全区 62/34；默认、错误与真实软键盘截图已导出，键盘状态 footer 折叠且输入保持可见。
4. 证据见 [acceptance.json](./acceptance.json)。依据用户授权，本页已自动视觉确认；最终三项门禁通过后进行本地专项提交，并立即开始 Verification Code 来源锁定。
