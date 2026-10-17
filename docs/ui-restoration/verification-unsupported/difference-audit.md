# Verification Unsupported 第一轮来源锁定与差异审计

## 最终结论

已锁定 HTML 原型 2795–2816 行和对应行为。实现保持来源页头、状态图标、标题、三层底部动作与四个原始 `interaction_id`；浏览器与 iPhone 17 Pro WKWebView 的来源几何、失败闭环、返回归属、刷新、安全区与确认退出均通过，按用户授权自动确认为 `status: verified`、`visual_acceptance: passed`。

## 来源与实现差异

| ID | 项目 | 锁定来源 | 实现要求 | 审计结论 |
| --- | --- | --- | --- | --- |
| VUN-001 | 页面骨架 | absolute inset；cRise 240ms | 标准安全区 + 唯一滚动区 + 固定 footer | 双端通过 |
| VUN-002 | Header | y=58、46 圆形 Back、居中标题 | AuthPageFrame 同尺寸和来源 SVG | 双端通过 |
| VUN-003 | 状态组 | y=178、92 圆图标、16 gap | 结构与来源一致 | 双端通过 |
| VUN-004 | 标题 | `That university isn’t supported yet` | 文案和排版不改 | 双端通过 |
| VUN-005 | 说明 | 声称客服会记录学校并通知 | 只说明更换邮箱；明确客服递送未配置 | 必须差异，防止伪造服务承诺 |
| VUN-006 | 更换邮箱 | 进入 Verification Email | pop 恢复唯一来源实例；直达时 replace fallback | 真实导航、零写入 |
| VUN-007 | 联系支持 | 原型导航 Settings Support | 无客服服务时在当前页明确 unavailable；零写入 | 按约定实现失败闭环 |
| VUN-008 | 退出 | 原型直接 root Welcome | 共享确认 Sheet → 500ms Loading → Store logout → Welcome | 按强制确认/写入规范实现 |
| VUN-009 | 进入条件 | 非 edu/ac.xx/hkust 域名 | 仅 pending registration 套用来源规则；已验证测试账号不拦截 | 保留源交互且不扩大验证声明 |
| VUN-010 | 过期直达 | 来源无实体保护 | auth_flow_id、pending account 与当前邮箱状态必须一致 | 显式恢复且零写入 |

## 验收结果

1. 浏览器专项 9/9 通过：393×852 来源参考、actual、overlay、diff 均生成，固定 cRise 结束帧；平均通道差 `0.5645771363`，大于 8 的像素 `7673`。
2. 非校园域名真实入口、更换邮箱返回、客服明确失败、确认退出、双击/Loading/写失败、刷新与过期 `auth_flow_id` 均通过；失败不写入，退出只清认证入口状态并保留账号。
3. 320×568 + 62/34 安全区通过，三个来源动作固定，唯一中间区域可滚动且无横向溢出。
4. iPhone 17 Pro（iOS 26.5）WKWebView 专项 1/1 通过，默认/错误截图均为 1206×2622；来源缩放、安全区、客服失败、确认/取消与原子退出均通过。
5. 既有 Auth Store 单测 11/11 通过，固定测试账号不被学生域名规则误判为认证结果。
