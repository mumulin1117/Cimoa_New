# Verification Success 第一轮来源锁定与差异审计

## 最终结论

Verification Success 已锁定 HTML 原型 2778–2791 行，并完成浏览器确定性像素证据、异常/刷新/并发/取消行为与 iPhone 17 Pro WKWebView 验收。所有差异均有批准来源且无未决项；按用户授权自动确认为 `status: verified`、`visual_acceptance: passed`。

## 来源与实现差异

| ID | 项目 | 锁定来源 | 当前实现 | 审计结论 | 处理 |
| --- | --- | --- | --- | --- | --- |
| VSU-001 | 根层与入场 | absolute inset 0；cRise 240ms | SecondaryPageFrame + PageTransition | 通过 | 固定动画结束帧截图 |
| VSU-002 | 状态组位置 | y=196；左右 20；16px gap | TopSafeArea 54 + scroll padding-top 142；16px gap | 通过 | 精确几何断言 |
| VSU-003 | 成功图标 | 96 圆、44 check、来源渐变和 shadow | 尺寸、SVG path、主题 token 一致 | 通过 | 双端截图与尺寸断言 |
| VSU-004 | 标题 | `You’re verified` | `Local verification complete` | 批准差异通过 | 不声称邮箱或学生身份已认证；只替换文案 |
| VSU-005 | 状态 pill | 42 高、21 圆角、18 badge、`HKUST · verified student` | 几何、颜色、badge 一致；`Local account · This device` | 批准差异通过 | 锁定批准文案，不改变来源样式 |
| VSU-006 | CTA | bottom 34、左右 20、60 高、`Continue Profile Setup`、`goObBasic` | 几何、文案与 ID 一致 | 通过 | 默认、安全区和小屏断言 |
| VSU-007 | 正常继续 | 导航 Basic | pending registration 先 Loading 再由 Store 原子建立 session/onboarding/basic | 通过 | Loading 前零写、双击单写、失败回滚已覆盖 |
| VSU-008 | 刷新/恢复 | 原型只含演示内存路由 | 从 Store 恢复真实 verified account；已有 onboarding 恢复原 step，完成态 Home | 通过 | 刷新零写、恢复与 completed 分支已覆盖 |
| VSU-009 | 缺失/未验证 context | 来源无失败状态 | 明确错误并进入真实 Code/Login | 通过 | 不显示成功 UI、不写 Store、不造账号 |
| VSU-010 | Loading 离页 | 来源无异步写入 | `onHide`/unmount 取消并增加 active guard | 通过 | 离页 650ms 后仍零写、无隐藏页导航 |
| VSU-011 | 安全区/长内容 | 来源固定 393×852 | 唯一中间 scroll-view；BottomSafeArea 独占物理安全区 | 通过 | 320×568 + 62/34 与 iOS 62/34 实测 |

## 本页允许的可见内容

正常状态只允许出现来源成功圆、批准后的本地验证标题和状态 pill，以及来源 `Continue Profile Setup` CTA。不得出现邮件已验证、HKUST 已认证、verified student、测试入口、无来源返回按钮或伪造成功。

## 验收结果

1. 浏览器像素专项 9/9 通过：393×852 来源参考、actual、overlay、diff，cRise 结束帧与来源几何精确命中；平均通道差 `0.6999210061`，大于 8 的像素 `5163`。
2. 既有 Verification 联合回归 15/15、Store 10/10、注册入口回归 2/2 通过；覆盖直达、刷新、小屏、安全区、双击、Storage 失败、恢复与离页取消。
3. iPhone 17 Pro（iOS 26.5）WKWebView 专项 1/1 通过，默认/错误截图均为 1206×2622，安全区实测 62/34。
4. 最终证据见 [acceptance.json](./acceptance.json)；三项强制校验通过后完成本地专项提交。
