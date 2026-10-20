# Welcome 来源锁定、差异审计与待确认结果

## 2026-10-20 首屏文案裁切修复（最新轮次）

用户再次提供与上轮 SHA 相同的 PNG，指出 Create Account 上方说明未显示。检查确认文案节点存在，但 360px 固定图高加 44px 间距使说明超出中部滚动区；真实 62/34 安全区下被裁切。上轮“滚到底后可见”不能满足本轮“首屏完整可见”。本轮不改文案、字号或主题，只将文案放在按钮区前的固定布局中，图片消费剩余空间；来源、允许差异及回归范围见 [本轮来源契约](./copy-visibility-2026-10-20/source-contract.json)。

11 项浏览器检查通过，含 9 组 iPhone 尺寸/安全区；三段文字均检查首屏实际命中、滚动祖先裁切和按钮重叠。393×852 来源参考下文案组 y=447.547（目标 448，误差小于 1px）、说明 bottom=599.422、Create top=603.422。iPhone 17 Pro WKWebView 两个测试通过，实测安全区 62/34、初始 scrollTop=0，说明 bottom=583.234、Create top=587.313。180 项单元测试通过；原有协议勾选、返回、刷新和媒体重试均保留。截图、overlay/diff 与 [本轮验收记录](./copy-visibility-2026-10-20/acceptance.json) 单独存放，不覆盖旧轮次。本轮专项 local_acceptance passed；整页 PNG 字体/栅格与完整验收不自动继承，下方历史 verified 不代表当前 status；页面仍 pending。

## 2026-10-19 新稿增量（以下旧验收结论仅为历史记录）

用户提供新版 Welcome PNG，要求在 Log In 下方增加统一协议勾选，并在勾选前阻止登录/注册。新稿及十字段契约见 [本次来源锁定](./consent-2026-10-19/source-contract.json)。修改前已核对：现有页面没有复选框，两个认证按钮无条件导航；四个原有入口仅改动两个认证入口的前置条件，不给协议阅读加门槛。新增行按 393 宽设计：24×24 方框、2 圆角、12 图文间距、13/1.4 文案；沿用现有 12 间距与 20/30 footer 留白。复用主题 deep/welcome_copy/title/inverse 和 SourceIcon 的 check，不重做原图片、品牌、按钮和下方法律文案。

状态为瞬时页面选择，不新增持久化“同意”记录、不预选、不改注册最终协议校验。返回保留当前实例选择，刷新重新勾选。原 PNG 的系统装饰、EUL 和底部画板标题不进入应用。当前视觉与完整验收重置为 pending，旧截图不作为本次通过证据。

PNG 字体没有可编辑标注。首轮叠图发现新增文案按 13px 呈现时比新稿长约 14px；直接测量原 PNG 的新增标签文字边界为 x=57..278.5、y=751..762.5（393 宽），据此将当前平台字体的新行调整至 12.25px，其他原有文字不改。该修正仅用于匹配新稿新增行，不将来源不明的整屏字体差异宣称为已通过。

本次新增行最终加 -0.005em 字距，当前文字墨迹边界为 x=57、y=751、width=221、height=11，对照 PNG 的 width=221.5、height=11.5，各边界差不超过 0.5 CSS px；方框 24×24、图文距 12、与 Log In 相距 12 均通过。新证据保存于 consent-2026-10-19，不覆盖旧轮次截图。浏览器 10 项 Welcome 检查、14 项认证回归、2 项年龄入口检查及 WKWebView 2 个测试均通过。页面 local_acceptance=passed；新稿的整屏字体/像素一致性未宣称完成，status/full/visual 保持 pending。本轮没有开始下一页。

## 结论

Welcome 来源锁定、唯一差异修正和浏览器/WKWebView 确定性取证均已完成。用户已于 2026-10-15 确认截图，最终三项门禁与 H5 重构建通过；本页达到 `status: verified`、`visual_acceptance: passed`。当前实现保留 HTML 的文案、几何、颜色、按钮、原始校园图片和四个真实入口，没有增加无来源控件。

来源：HTML 内层 2512–2525 行；页面条件 5529 行；Age/Login 行为 5561、5564 行；Terms/Privacy 行为 6016–6017 行。完整锁定值见 [source-contract.json](./source-contract.json)。当前历史实现图为 [393×852 截图](../../evidence/auth/welcome.png)。

## 对照结果

| ID | 项目 | 来源值 | 当前实现 | 结论 | 后续处理 |
| --- | --- | --- | --- | --- | --- |
| WEL-001 | 页面背景 | 168deg，`#e4f4fb → #eaf0fd 44% → #f2ecfb` | `SecondaryPageFrame` 使用同一主题渐变 | 一致 | 保留主题 token |
| WEL-002 | 页面骨架 | absolute inset 0；393×852 默认不滚动 | TopSafeArea、唯一中部 scroll、固定 footer、BottomSafeArea | 批准适配 | 393×852 不应产生可见位移；小屏只滚中部 |
| WEL-003 | 顶部系统区 | 原型 StatusBar 54px，图片从 y=44 开始 | 图片紧跟真实 TopSafeArea | 批准适配 | 浏览器注入 44px 与 WKWebView 真实安全区分别取证 |
| WEL-004 | 图片框 | left/right 4px、height 360px | margin 4px、height 360px | 一致 | 保留 |
| WEL-005 | 图片裁切锚点 | `object-fit: cover; object-position: center top` | 页面与 uni-app H5 内层 `img` 均显式锁定；实际计算值 `50% 0%` | 已修正 | 浏览器和 WKWebView 均通过 |
| WEL-006 | 图片圆角/遮罩 | 上圆角 30px；70% 后渐隐 | 30px 上圆角；相同主题遮罩 | 一致 | 保留 |
| WEL-007 | 图片资源 | bundle `d947...` | 本地 `welcome-campus.png` | 一致 | SHA-256 `c4350a2b…0896` 已核对 |
| WEL-008 | 文案组位置 | top 448px、left/right 24px | 图片 360px 后 margin-top 44px，即去除源 44px 系统区后 y=404 | 与安全区适配一致 | 注入 44px 时应恢复源 y=448 |
| WEL-009 | 品牌 | `CIRCA`，38px/500/0.08em | `Cimoa`，相同字体参数与颜色 | 批准差异 | 只允许品牌替换，不改字号、间距或大小写 |
| WEL-010 | 标题 | `Meet your campus`，34px/800，margin-top 22px | 文案和参数一致 | 一致 | 保留原文案 |
| WEL-011 | 描述 | 原文，16.5px，290px，margin-top 10px，1.4 | 文案和参数一致 | 一致 | 保留原文案和换行策略 |
| WEL-012 | footer 框 | left/right 20px、bottom 30px、gap 12px | padding 20px/30px、gap 12px，另接 BottomSafeArea | 一致并有批准适配 | 验证 footer 在安全区上方固定 |
| WEL-013 | Create Account | 60px、30px 圆角、19px/700、8px gap、18px 源箭头 | 尺寸、渐变、阴影、箭头 path 一致 | 一致 | 保留原文案与图标 |
| WEL-014 | Log In | 56px、28px 圆角、18px/600、白底/源阴影 | 参数一致 | 一致 | 保留 |
| WEL-015 | 法律文案 | 14.5px、2px 顶距、原文与下划线链接 | 参数、文案和链接一致 | 一致 | Terms/Privacy 返回 Welcome 时验证实例归属 |
| WEL-016 | 入场动效 | cRise 240ms ease、Y 14px | PageTransition 240ms ease、Y 14px | 一致 | 截图固定结束帧 |
| WEL-017 | 图片 Loading/Error | 来源默认状态无分支 | 真实加载、404、Retry photo | 必要补齐 | 只在真实状态显示，不进入默认 reference |
| WEL-018 | 四个入口 | Age、Login、legalTerms、legalPrivacy | 四个独立 Vue 路由，失败显示真实错误 | 一致且形成闭环 | 回归连点、返回、无存储写入 |
| WEL-019 | 键盘可达性 | 来源仅 click | button role、tabindex、Enter | 无视觉影响的增强 | 保留；不得改变热区和默认样式 |

## 控件与文案清单

- 默认可见内容只允许：校园图、`Cimoa`、`Meet your campus`、来源描述、`Create Account`、`Log In` 和来源法律文案。
- 不允许自主增加副标题、跳过入口、第三方登录、页头或返回按钮。
- 默认页面不写账号、会话、验证或协议状态；四个入口只负责真实导航。
- 图片 Loading、图片失败和导航错误只能在真实对应状态出现，不得伪造成功或占据默认截图。

## 本轮实施与验收结果

1. 校园图片实际 H5 内层节点已固定为 `center top`；393×852 来源值恢复为图片 `4/44/385/360`、文案 y=448、按钮 `60/56`、法律文案 bottom=822。
2. 确定性浏览器验收 6/6 通过：锁定来源 hash、cRise 结束帧、reference/actual/overlay/diff、62/34 安全区滚动、四个入口及返回、连点防重、404/Retry、320×568 与刷新零写入。一次性服务和隔离浏览器均已关闭。
3. 62/34 安全区会减少中部可视高度；页面按约定保留来源尺寸并由唯一中部滚动区承载，初始态和滚到底状态分别取证。滚动后完整说明文字位于固定 Create Account 上方，footer 坐标不变，不增加无来源留白。
4. iPhone 17 Pro（iOS 26.5）WKWebView 实测 402×874、上 62 / 下 34；`HostTests.testWelcomePixelRestoration` 1 test / 0 failures。已验证按 393 来源比例缩放、真实安全区、图片裁切、完整滚动、Age/Login/Terms/Privacy 返回归属、连点只进一层、游客刷新不写存储。
5. 用户确认后，三项最终门禁与 H5 重构建均通过；本页随 Welcome 本地专项提交封版，随后才允许将 Login 切换为唯一 `in_progress`。
