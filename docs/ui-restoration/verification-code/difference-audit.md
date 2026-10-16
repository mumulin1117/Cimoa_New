# Verification Code 第一轮来源锁定与差异审计

## 结论

Verification Code 已完成来源锁定、差异修正、浏览器/WKWebView 取证与完整行为验收。返回 ID、六位数字清洗、来源学校 SVG 和真实键盘适配均已关闭；按用户授权的自动确认规则，本页现为 `status: verified`、`visual_acceptance: passed`。

## 最终对照结果

| ID | 项目 | 锁定来源 | 当前实现 | 首轮结论 | 后续处理 |
| --- | --- | --- | --- | --- | --- |
| VCD-001 | 根层/背景/动效 | absolute inset 0；cRise 240ms；来源渐变 | SecondaryPageFrame + PageTransition + 同主题渐变 | 结构一致 | 固定动画结束帧取证 |
| VCD-002 | Header/安全区 | source y=58；46 返回；16/600 灰标题 | AuthPageFrame + Code 专属紧凑标题 | 批准适配 | 浏览器 54/0 与 WK 62/34 分别断言 |
| VCD-003 | 返回入口 | `goBack` | 已传 `verCode.goBack.click.1`；真实来源 pop，直达 fallback Login | 已修正并通过 | 浏览器直达返回零写入 |
| VCD-004 | Header/标题/说明文案 | University verification / Check your email / 声称已发邮件 | Local verification / Enter your code / 明确本机验证和真实账号 email | 必要诚实差异 | 锁定批准文案，保持来源几何 |
| VCD-005 | Hero | 120 frame、86×94 shield、30 landmark、26 check | VerificationEmblem 的尺寸与路径对应来源 | 一致待截图 | 双端断言 SVG 和尺寸 |
| VCD-006 | 六格 | 6×44×60、gap10、radius16、26/800 | 尺寸换算一致 | 一致待截图 | 默认、部分、完整和长邮箱取证 |
| VCD-007 | 输入清洗 | `onCode` 只保留 ASCII 数字并截 6 位，清旧错误 | computed model 只保留 ASCII 数字前 6 位，保留前导零并清错误 | 已修正并通过 | 混合粘贴、全角数字、7 位与前导零 |
| VCD-008 | 错误卡 | margin14、padding14×16、radius16、15.5/600 | 共享 error 样式对应来源 | 一致待截图 | 格式错零 Loading；错码 Loading 后可重试 |
| VCD-009 | Resend 区 | resend 倒计时/假发送 | 固定码和“不发邮件”说明 | 必要诚实差异 | 保留来源槽位几何，不实现假倒计时/假发送 |
| VCD-010 | Change email | margin6、16/600、蓝色下划线 | 真实进入 Email correction | 一致待回归 | 同账号、零写入、返回链闭环 |
| VCD-011 | 信息卡 | 46 来源学校建筑图标、HKUST/学生认证承诺 | 已恢复来源 46×46 SVG；本地真实文案使用主题 token | 图标已修正、文案批准差异 | 双端 SVG/尺寸/文案断言 |
| VCD-012 | CTA | bottom34、60高、gap8、18箭头 | 来源几何及 Verify Code 文案 | 批准文案差异待截图 | 精确断言 bottom/高度/箭头 |
| VCD-013 | 持久化 | 原型任意六位直接进 Success | 精确 009789、500ms Loading、Store 原子写入 | 批准业务差异 | 覆盖错码、失败回滚、双击、离开取消、刷新恢复 |
| VCD-014 | Context/恢复 | 原型总显示 maskedEmail | 真实 context；缺失不泄露 email；已验证直达 Success | 约定要求差异 | 缺失/过期/已验证分别回归 |
| VCD-015 | 键盘 | 来源未登记系统键盘适配 | visualViewport 驱动 footer 折叠并保持六格可见 | 已修正并通过 | 浏览器缩窗 + iPhone 17 Pro 真实数字键盘 |
| VCD-016 | 视觉证据 | 流程测试和旧浏览器/WK 结果 | 已生成 hash-locked reference/actual/overlay/diff 与错误/小屏/键盘/WK 三态 | 已补齐并通过 | 像素专项 10/10；WK 1/1 |

## 本轮验收结果

1. 浏览器像素专项 10/10 通过：393×852、cRise 结束帧、reference/actual/overlay/diff、wrong code、320×568、62/34 安全区和键盘态。平均通道差 `3.0542900106`；关键几何、来源 SVG、批准文案与 interaction IDs 均为独立精确断言，剩余像素差来自 uni-app 文本节点字体/行盒渲染。
2. 原有固定码联合回归 15/15、Store 单测 10/10 通过；wrong code、持久化失败、离开取消均零半状态，正确码只写一次且不提升学生身份、不改会话/金币/关系。
3. iPhone 17 Pro（iOS 26.5）WKWebView 专项 1/1 通过，实测视口 402×874、安全区 62/34；默认、错误和真实数字键盘截图已导出，键盘态六格完整可见、footer 折叠。
4. 证据见 [acceptance.json](./acceptance.json)。依据用户授权，本页已自动视觉确认；最终三项门禁通过后进行本地专项提交，并立即开始 Verification Success 来源锁定。
