# Signup 来源锁定与差异审计

## 结论

Signup 的来源锁定、首轮差异修正、浏览器/WKWebView 取证与最终门禁均已完成。默认、密码提示、重复邮箱、320×568 长内容与 iPhone 17 Pro 真实安全区/系统键盘均通过；Apple 明确失败、本地 PBKDF2 注册、Loading 前零写入、失败回滚、刷新恢复和返回归属形成真实闭环。按用户授权的自动确认规则，本页现为 `status: verified`、`visual_acceptance: passed`。

来源：HTML 内层 2606–2656 行；默认状态 4689；返回 5224；页面条件 5532；Community/Signup/Login 导航 5563–5564；输入、提示、启用态、重复邮箱和 Apple 行为 5605–5623。完整锁定值与哈希见 [source-contract.json](./source-contract.json)。历史截图 [signup.png](../../evidence/registration/signup.png) 含已填写账号/密码与启用 CTA，只作为旧实现回归证据。

## 最终对照结果

| ID | 项目 | 锁定来源 | 最终实现 | 结论 | 验收证据 |
| --- | --- | --- | --- | --- | --- |
| SUP-001 | 根层/背景/动效 | absolute inset 0；cRise 240ms；来源渐变 | SecondaryPageFrame + PageTransition + 同主题渐变 | 一致 | 393×852 固定结束帧 |
| SUP-002 | Header/安全区 | source y=58；46 返回；48 header | TopSafeArea 替代系统占位，来源坐标不变 | 批准适配并通过 | 浏览器 54/0；WK 62/34 |
| SUP-003 | 返回入口 | `goBack` | `signup.goBack.click.1`；普通 pop Community，直达 fallback Community | 已修正并通过 | 双端返回零写入 |
| SUP-004 | 标题/Apple/分割线 | 文案、边距、尺寸、颜色和 SVG 如契约 | 对应 rpx/token 精确换算 | 一致 | reference/actual 与原生截图 |
| SUP-005 | 输入框几何 | 14 margin、7 label gap、56 高、18 radius/padding、17 input | 三个真实 input 保持来源几何 | 一致 | 双端几何与 placeholder 断言 |
| SUP-006 | 输入 interaction IDs | `onEmail/onPw/onPw2` | 三个输入补齐稳定 ID；输入仅改内存 | 已修正并通过 | 双端八项 ID 断言 |
| SUP-007 | Show/Hide | `togglePw`、Show/Hide | pointer、Enter、Space 均切换两个真实 password 字段；Loading 禁用 | 已修正并通过 | 浏览器键盘操作与 WK 指针操作 |
| SUP-008 | 密码提示 | 默认、过短、来源长度达标三态 | 按批准安全规则新增 `Include at least one number`，数字满足才 `Strong enough` | 批准差异并通过 | short/missing-number/ready |
| SUP-009 | 不一致提示 | 非空 confirmation 不同时显示准确原文 | 文案、6px 间距、14px/600/红色一致 | 一致 | mismatch 截图与 DOM 断言 |
| SUP-010 | 错误卡行高/清除 | 来源 normal；email 输入清错误 | Signup 专属恢复 normal；三个字段修改均清旧错误 | 已修正并通过 | duplicate 后编辑立即清除 |
| SUP-011 | 默认说明文案 | 来源错误声称邮箱确认学生身份 | 最短真实本地账号说明，保留 15px/16px/normal 来源几何 | 必要诚实差异并通过 | default 精确文案和 computed style |
| SUP-012 | CTA 启用条件 | @ + 8 位 + 一致 | 真实注册还校验邮箱、数字、年龄和三项协议 | 批准业务差异并通过 | 默认禁用；完整前置才启用 |
| SUP-013 | Create Account | 原型只导航 Email Verification | 500ms Loading、PBKDF2、Store 原子创建、再进入 Email Verification | 批准业务差异并通过 | 零写、连点单次、失败回滚、无明文 |
| SUP-014 | Apple | 原型 toast 后进入 Email | 明确未配置；不创建账号、不导航 | 用户授权的真实失败 | 双端零写/零导航 |
| SUP-015 | 本地验证恢复 | 来源无恢复态 | 待验证账号刷新显示 Continue verification 和既有邮箱，密码保持空 | 批准恢复差异并通过 | 完整页面重载与继续验证 |
| SUP-016 | Footer/滚动 | source bottom30/gap6；content padding-bottom200 | 固定 footer + 唯一 flex scroll | 批准骨架适配并通过 | 320×568 滚动与 WK 安全区 |
| SUP-017 | 键盘 | 来源未登记系统键盘适配 | 复用 visualViewport；键盘打开时折叠 footer、保持焦点字段可见 | 已修正并通过 | iPhone 17 Pro 真实键盘测量与截图 |
| SUP-018 | 视觉证据 | 新访客空表单、默认提示、禁用 CTA | 独立 reference/actual/overlay/diff、short/mismatch/error/small 证据 | 已修正并通过 | 平均通道差 1.3619891529 |
| SUP-019 | 页面资源 | 只有返回/Apple SVG；无媒体 | 清单已删除无关歌曲封面 | 已修正 | inventory `media=[]` |

## 本轮验收结果

1. 浏览器确定性测试 7/7 通过：393×852、cRise 结束帧、reference/actual/overlay/diff、short、mismatch、duplicate error、320×568 及 62/34 安全区。平均通道差 `1.3619891529`，大于 8 的像素 `13936`；几何、文案、interaction IDs 和默认状态断言一致，剩余差异为文字抗锯齿。
2. 注册 Store 10/10、Signup 浏览器回归 3/3 通过；重复邮箱、Apple 和持久化失败均零半成品，成功只创建一个 salted PBKDF2 本地账号，不写明文密码、会话或学生认证。
3. iPhone 17 Pro（iOS 26.5）WKWebView 专项 1/1 通过，实测视口 402×874、安全区 62/34；默认、重复邮箱错误和真实键盘证据均已导出。
4. 证据见 [acceptance.json](./acceptance.json)。依据用户授权，本页已自动视觉确认；三项强制校验与 H5 重构建通过后进行本地专项提交，并自动开始 Email Verification 来源锁定。
