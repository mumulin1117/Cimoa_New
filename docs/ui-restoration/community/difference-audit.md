# Community Agreement 来源锁定与差异审计

## 2026-10-20 shared legal Sheet close increment (current)

User approved a fixed top-right X in place of the bottom Close text. The title and X stay outside the document scroll. Canonical document text and separate registration choices are unchanged. [Current contract](../welcome/eula-2026-10-20/source-contract.json) and [scoped evidence](../welcome/eula-2026-10-20/acceptance.json) supersede historical Close geometry below; no whole-page pixel or publication approval is inferred.

## 2026-10-19 协议统一专项（覆盖本轮验收状态）

用户要求 Community、Welcome、设置及金币帮助的协议内容一致，并完善社区规则。编码前审计确认：注册目录另存了简版 Terms/Privacy；Terms 完整页标题与目录不一致；社区详细规则只有六句摘要。现以 Welcome 使用的完整文档为唯一来源，保留六句首页摘要和既有控件/几何，只更新 Read 内容及共享渲染。差异、所有消费者、Apple 官方参考和发布缺项见 [本轮来源契约](./legal-unification-2026-10-19/source-contract.json)。

本轮专项通过 180 项单元、27 项浏览器检查及 2 项真实 WKWebView 测试。Privacy 全页与任务前截图零像素变化；Terms 正文零像素变化，仅标题统一为 Terms of Use。共享组件抽取导致的样式作用域回归已被截图测试捕获并修复，未放宽原有几何断言。旧来源叠图中的粗体栅格差异不是本轮引入，不能据此重认定全页像素验收。最新状态为 local_acceptance passed、status pending、visual/full acceptance pending；下方历史 verified 不覆盖本轮状态。真实内容过滤、举报响应服务、法律主体和公开联系方式缺失，不以新增文案冒充这些能力。详细证据与本轮文件清单见 [验收记录](./legal-unification-2026-10-19/acceptance.json)。

## 结论

Community Agreement 的来源锁定、首轮差异修正、浏览器/WKWebView 取证与最终门禁均已完成。默认、partial、ready、Agreement Sheet、320×568 长内容与 iPhone 17 Pro 真实安全区均通过；未勾选零写入、500ms Loading 后原子持久化、失败回滚、刷新和返回归属形成真实闭环。按用户授权的自动确认规则，本页现为 `status: verified`、`visual_acceptance: passed`。

来源：HTML 内层 2562–2604 行；默认状态 4688；返回 5224；Settings 复用入口 5441；页面条件 5531；Age/Signup 导航 5562–5563；勾选、动态颜色和启用条件 5637–5646。完整锁定值与哈希见 [source-contract.json](./source-contract.json)。历史截图 [community.png](../../evidence/registration/community.png) 含已持久化勾选、错误卡和无来源说明，只作为旧实现证据。

## 最终对照结果

| ID | 项目 | 锁定来源 | 最终实现 | 结论 | 验收证据 |
| --- | --- | --- | --- | --- | --- |
| COM-001 | 根层/背景/动效 | absolute inset 0；cRise 240ms；来源渐变 | SecondaryPageFrame + PageTransition + 同主题渐变 | 一致 | 393×852 固定结束帧 |
| COM-002 | Header/安全区 | source y=58；46 返回；48 header | TopSafeArea 替代系统占位，来源坐标不变 | 批准适配并通过 | 浏览器 54/0；WK 62/34 |
| COM-003 | 返回入口 | `goBack` | `agree.goBack.click.1`；普通 pop Age，直达 fallback Age | 已修正并通过 | 双端返回无写入 |
| COM-004 | 主标题 | `How CIRCA works`，33/800/-0.035em/1.1 | 仅按批准品牌差异改为 `How Cimoa works` | 批准差异并通过 | 准确文案/几何断言 |
| COM-005 | 六条规则 | 六条准确英文，顺序固定 | Store getter 单一数据源 | 一致 | 双端文案断言 |
| COM-006 | 规则卡几何 | margin 16、padding 18、gap 9、radius 24 | 对应 rpx/token 精确换算 | 一致 | 实测 17.9999/9.00022/24.0002px |
| COM-007 | 规则行高 | 继承 normal | 删除无来源 `line-height: 1.4` | 已修正并通过 | computed line-height `normal` |
| COM-008 | 协议行几何 | margin 10、padding 16/18、gap 14、radius 24 | 三行与来源坐标/换行一致 | 一致 | reference/actual 及 320×568 |
| COM-009 | 勾选初态/外观 | 新访客全 false；28/9/2；16 白勾 | 默认未选，已持久化草稿刷新恢复 | 批准恢复并通过 | default/partial/ready/refresh |
| COM-010 | 勾选交互标识 | `tTerms/tPrivacy/tGuides` | 三个稳定 interaction ID，点击/Enter/Space 只改内存 | 已修正并通过 | 双端 ID/状态断言 |
| COM-011 | Row 与 Read 热区 | 整行勾选，右侧显示 Read | 按批准交互扩展分成勾选与 Read 区，几何不变 | 批准差异并通过 | 三个 Read ID；不勾选/不写入 |
| COM-012 | 默认额外文案 | 无 | 删除无来源本地说明；限制只在 Read Sheet 内说明 | 已修正并通过 | default note=false |
| COM-013 | 错误态 | 来源无默认错误卡 | 只在真实校验/持久化失败显示 | 必要业务补齐并通过 | 默认隐藏；失败零导航 |
| COM-014 | Footer 位置 | left/right 20；bottom 34 | Community 专属 34px 设计留白，BottomSafeArea 唯一拥有物理安全区 | 已修正并通过 | button bottom=818.015625 at 852 |
| COM-015 | Continue 外观 | 60/30；未就绪灰色，就绪渐变 | 默认/partial/ready 与来源一致 | 一致 | 三态截图 |
| COM-016 | Continue 行为 | 来源 push Signup | 三项校验→500ms Loading→Store 原子保存→单次 Signup | 批准业务差异并通过 | 零写/成功/失败/刷新/连点 |
| COM-017 | Agreement Sheet | 原型只有可见 Read | 受控 Sheet 显示本地文档，遮罩/Close 均有 ID | 约定要求的批准扩展并通过 | 首次/再次/长文/关闭 |
| COM-018 | 滚动区 | source top122，padding 0 20 190 | 固定 header/footer + 唯一 flex scroll | 批准骨架适配并通过 | 320×568 滚动截图 |
| COM-019 | 页面资源 | 只有返回/check SVG；无媒体 | 清单已删除无关歌曲封面 | 已修正 | inventory media=[] |
| COM-020 | 视觉证据 | 新访客默认全未选 | 新建独立 reference/actual/overlay/diff | 已修正并通过 | 平均通道差 0.7559349950 |
| COM-021 | Settings 复用入口 | `openAgreeInfo` 复用 route agree | Settings 打开同一 Guidelines Sheet，不进注册 consent/Signup | 批准业务/返回归属差异 | 共享 Sheet 行为保持 |

## 本轮验收结果

1. 浏览器确定性测试 8/8 通过：393×852、cRise 结束帧、reference/actual/overlay/diff、partial、ready、Sheet、320×568 及 62/34 安全区。平均通道差 `0.7559349950`，大于 8 的像素 `11262`；几何、文案和交互 ID 断言一致，剩余差异为文字抗锯齿。
2. 注册 Store 10/10、Community 浏览器回归 3/3 通过；未勾选和 Read 均零写入，三项同意只在 Loading 后原子保存，注入存储失败时完整回滚且保留重试选择。
3. iPhone 17 Pro（iOS 26.5）WKWebView 专项 1/1 通过，实测视口 402×874、安全区 62/34；默认与 Sheet 原生证据已导出。
4. 证据见 [acceptance.json](./acceptance.json)。依据用户授权，本页已自动视觉确认；三项强制校验与 H5 重构建通过后进行本地专项提交，并自动开始 Signup 来源锁定。
