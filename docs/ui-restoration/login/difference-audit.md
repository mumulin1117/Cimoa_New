# Login 第一轮来源锁定与差异审计

## 结论

Login 首轮审计发现的 TEST STATES 缺失、interaction ID 缺失和动态 footer 文案均已按锁定来源修正；393×852 浏览器确定性截图、320×568 滚动/键盘适配和 iPhone 17 Pro WKWebView 专项均已通过。用户于 2026-10-15 确认截图，最终三项门禁通过，本页达到 `status: verified`、`visual_acceptance: passed`。

来源：HTML 内层 2659–2705 行；返回行为 5224；页面条件 5533；Age 入口 5561；登录与两种测试状态 5591–5593；忘记密码 5596；输入和密码切换 5606–5613；Apple 入口 5623。完整锁定值见 [source-contract.json](./source-contract.json)。历史实现截图仅作为差异证据：[393×852](../../evidence/auth/login.png)、[320×568](../../evidence/auth/login-small.png)。

## 对照结果

| ID | 项目 | 来源值 | 当前实现 | 结论 | 处理方式 | 涉及文件 |
| --- | --- | --- | --- | --- | --- | --- |
| LOG-001 | 根层/动效/背景 | absolute inset 0；cRise 240ms；来源渐变 | SecondaryPageFrame + PageTransition 240ms + 同主题渐变 | 一致 | 固定动画结束帧取证 | `login.vue`、`PageTransition.vue` |
| LOG-002 | Header 与安全区 | 源 top 58、left/right 20、height 48 | TopSafeArea 后 4px、46px 返回、48px header | 批准适配且几何一致 | 393 来源安全区和 WK 实测分别断言 | `AuthPageFrame.vue` |
| LOG-003 | 固定/滚动关系 | header 固定；scroll top 122、bottom 0、padding-bottom 210；footer overlay | 固定 header/footer，中部唯一 flex scroll，BottomSafeArea 独立 | 批准适配 | 验证内容可达、footer 不移动、键盘不遮挡 | `SecondaryPageFrame.vue`、`AuthPageFrame.vue` |
| LOG-004 | 返回按钮 | 46×46、23 圆角、来源 back SVG；`goBack` | 视觉/SVG/`login.goBack.click.1` 均一致 | 已修正并通过 | 保留来源热区 | `login.vue`、`AuthPageFrame.vue` |
| LOG-005 | Header/Heading 文案 | `Log in`；`Welcome back` | 完全一致 | 一致 | 保留大小写与字号 | `login.vue` |
| LOG-006 | Apple 按钮 | 56高、28圆角、来源 path、`Continue with Apple` | 视觉、资源、文案一致 | 视觉一致 | 无服务时继续明确失败，不假成功 | `login.vue`、`SourceIcon.vue` |
| LOG-007 | Apple 行为 | source ping 后进入 verEmail | 当前明确 `Apple sign-in is not configured...` 并留页 | 批准业务差异 | 纳入 reference 默认无错误态；点击后验证真实失败 | `login.vue` |
| LOG-008 | 分割线 | margin 18、gap 12、1px、`or` 14.5 | 参数一致 | 一致 | 保留 | `auth.css` |
| LOG-009 | Email | 来源标签、placeholder、56高输入框 | 视觉/文案/`login.onEmail.change.1` 一致 | 已修正并通过 | 保留 | `login.vue` |
| LOG-010 | Password | 来源标签/placeholder/Show-Hide | 视觉与 `login.onPw.change.1` 一致；真实隐藏并卸载清除 | 来源一致并保留批准安全增强 | 保留内存安全 | `login.vue` |
| LOG-011 | 错误卡 | 默认不显示；来源红色卡片参数及两条准确错误文案 | 同样式 token；真实登录错误文案由 Store 决定 | 默认、错密码、未验证缺上下文及持久化失败均通过 | 保留真实失败，不伪造账号或认证 | `login.vue`、`auth.css`、Store |
| LOG-012 | Forgot password | `Forgot password?`，16px/600，margin 16 | 文案和参数一致；当前真实本地重置路由已存在 | 一致 | 验证往返与固定码不越权 | `login.vue` |
| LOG-013 | TEST STATES | 默认可见标题及两个 40px chips | 原文案、顺序、尺寸和 interaction IDs 已恢复；只读检查真实本地状态 | 已修正并通过 | 保持零写入，不制造账号、会话或认证 | `login.vue`、`auth.css`、Store |
| LOG-014 | 本地模式说明 | 来源无此文案 | 新增 `Local accounts are stored...` | 已批准用户业务差异 | 保留准确文案，但放在完整来源控制组之后，不能取代 TEST STATES | `login.vue` |
| LOG-015 | Footer | 固定 bottom 30；`Log In`；`New here? Create an account` | 几何与固定文案一致；键盘打开时批准临时收起，关闭后恢复 | 已修正并通过 | 已有会话由路由守卫分流 | `login.vue`、`useEventViewport.js` |
| LOG-016 | 登录逻辑 | 原型直接 root Home | 当前真实本地账号验证、500ms Loading、成功后按验证/引导/Home 分流 | 必须保留的批准差异 | 验证写前 Loading、失败零写入、成功清栈与单次骨架 | `login.vue`、Store、`mainTabSkeleton.js` |
| LOG-017 | Create account | 来源进入 Age | 当前进入 Age | 一致 | 验证返回 Login/Welcome 归属 | `login.vue` |
| LOG-018 | 点击与键盘 | 来源 click | role/tabindex/Enter；Loading 时禁用；视觉视口缩小时保持聚焦输入可见 | 无默认视觉变化的可用性增强 | 浏览器与真实 iOS 软键盘均通过 | `login.vue`、`useEventViewport.js` |

## 默认可见控件和文案锁定

默认页面必须依次保留：返回按钮、`Log in`、`Welcome back`、Apple 按钮、`or`、Email、Password、`Show`、`Forgot password?`、`TEST STATES`、`Wrong password`、`Unverified account`、已批准的本地模式说明、`Log In`、`New here? Create an account`。不得删除测试状态控件、改写大小写、把本地说明当成来源替代文案或新增第三方入口。

## 本轮实施与验收结果

1. 已恢复来源 TEST STATES 标题与两枚 40px chip；Store 的只读测试状态使用真实 fixture 或当前 pending context，缺失时明确失败且不写存储。
2. 已补齐返回、邮箱、密码 interaction IDs，并将主按钮锁定为来源文案 `Log In`；本地模式说明仍位于完整来源控制组之后。
3. 浏览器确定性测试 5/5 通过：固定 393×852、cRise 结束帧、reference/actual/overlay/diff、320×568 唯一滚动区、62/34 安全区和键盘高度缩减。浏览器对比平均通道差 `0.8913229163`，大于 8 的像素为 `10594`；差异集中在浏览器文字抗锯齿/原生输入渲染，几何和文案断言一致。
4. 登录功能回归 14/14、Store 单元测试 10/10 通过：错误/取消零写入、500ms Loading 后才提交、刷新恢复、三 Tab 每页只消费一次骨架、连点不重复导航。
5. iPhone 17 Pro（iOS 26.5）WKWebView 专项 1/1 通过，实测视口 402×874、真实安全区 62/34；真实软键盘打开时密码框可见且 footer 临时收起，Done 后 footer 恢复。临时键盘测试模拟器已删除，端口与测试服务已清理。
6. 证据见 [acceptance.json](./acceptance.json)。用户确认后，三项强制校验与 H5 重构建通过；Login 随本地专项提交封版，随后按用户新增授权自动开始下一页来源锁定。
