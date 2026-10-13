# Cimoa Home 交互清单

来源是内层模板 214–357 行及绑定逻辑，不是旧 Vue 首页。当前为待实现契约，不能作为验收通过记录。这里补充该页的操作映射，不修改两份强制约定。

## 页面骨架与数据入口

- 路由 `/pages/home/index`，主 Tab 第一项；无虚构返回按钮。
- 固定区：TopSafeArea、品牌及左右功能入口、标题/副标题、CustomTabBar。原型整块滚动方式按开发约定第 15.1.2 节改为固定功能栏与单一内容滚动区。
- 顶部安全区由 TopSafeArea 唯一占位；底部由 CustomTabBar 唯一接管。业务留白不能重复计算安全区。
- 内容：联系人纵向列表、空状态、匹配状态卡。全部由同一 Store getter 派生；人数、连接标签、可聊天状态、每日配额和匹配倒计时不在页面重复保存。
- ConnectionGoalsPopover 常驻挂载，受控显示；点击目标标签不冒泡到联系人卡片；滚动或关闭后不残留遮罩。目标图标按开发约定第 15.2 节处理，禁止直接写 Emoji。
- 只有成功登录/注册后消费本 Tab 的单次骨架资格；hydration、刷新、切 Tab、二级页返回不重新准备。

## 入口与验收契约

同一行为的重复入口分别保留源码审计 ID；表中合并说明不合并实际 ID。所有导航失败均留在来源页并显示英文错误，业务实体不改变。

| interaction_id | source_screen | trigger | preconditions | visible_feedback | success_result | failure_result | persistence | sync_scope | acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home.openMe.click.1 | Home / People Met | 点击左上个人图标 | 当前会话有效 | 立即 iOS Stack Push，无导航 Loading | `/pages/profile/index` 展示当前用户 | 会话失效走统一守卫；失败恢复 Home | none | 当前用户、个人中心 | 点击→核对用户→返回→Home 仍可见且滚动不丢失 |
| home.startAutoMatch.click.1 | Home / Header | 点击右上闪电 | 会话有效；配额来自 Store | 立即 Push，不扣次数 | `/pages/auto-match/index` | 失败保留配额、余额和状态 | none | Home 配额、Auto Match | 点击→返回→配额和金币未变化 |
| home.startAutoMatch.click.2 | Home / Empty | 点击 Start Auto Match | 联系人列表为空 | 同上一入口 | 同一 Auto Match 入口 | 同上 | none | 同上 | 空列表下点击，不能额外创建假联系人 |
| home.exploreDiscover.click.1 | Home / Empty | 点击 Explore People | 会话有效 | replace_route | `/pages/discover/index`，选中 Discover | Home 保持可见 | none | 三个主 Tab | 空页切 Discover→Home，栈深不增加，无重复骨架 |
| home.openMaya.click.1 | Home / Connected Chloe | 点击 Chloe 卡片 | 两条有效方向关系、未拉黑、真实会话存在 | 立即 Push，无 Loading | `/pages/messages/chat?conversation_id=...`，参与者为 Chloe | 不允许私聊时不创建假会话，不改变关系 | none（已读由聊天页 action 管理） | Home、关系、DM | 进入→核对参与者→发送并刷新→返回；拉黑后入口消失 |
| home.openLiam.click.1 | Home / Auto Match Liam | 点击 Liam 卡片 | 有该候选对应 match_id，未拉黑 | 立即 Push | `/pages/auto-match/found?match_id=...`，候选为 Liam | 候选失效明确报错，不替换为 Chloe | none | Home、匹配、候选用户 | 进入 Liam→返回；不能把全局候选偷偷改为另一个人 |
| home.openJordan.click.1 | Home / Invite（原稿 Jordan，详情 Lina） | 点击 Lina 邀请卡片 | 存在来自 Lina 的待处理 request_id | 立即 Push | `/pages/connections/received?request_id=...`，全过程为详情中的 Lina | 失效请求不可接受，原状态不变 | none（接受由目标页 action 写入） | Home、邀请、关系、会话 | 进入→核对 Lina / HKU→接受/拒绝分别验证→刷新后 Home 同步；不能显示 Jordan 或接受结果 Chloe |
| home.popMaya.click.1 | Home / Chloe goals | 点击目标标签 | Chloe 可见 | Popover 入场，不打开 Chat | 展示 Chloe 详情实体中的全部目标；卡片预览前三项 | 无目标显示英文空状态，不借用别人目标 | none | 用户 goals getter | 点击→外部关闭→再次打开→不触发卡片导航；与 Expanded 详情目标一致 |
| home.popLiam.click.1 | Home / Liam goals | 点击目标标签 | Liam 可见 | 同上 | Activity Buddies / Music & Gigs / Food Explorers | 同上 | none | 同上 | 连续从 Chloe 切 Liam，内容只显示当前人 |
| home.popJordan.click.1 | Home / Lina goals（源码 ID 保留） | 点击目标标签 | Lina 可见 | 同上 | 展示 Lina 邀请详情实体中的全部目标，不再使用 Jordan 目标 | 同上 | none | 同上 | 长目标名正常换行、不超出视口；不能混用 Chloe/Jordan 的独立数据副本 |
| home.closeGoalPop.click.1 | Home / Goals mask | 点击弹层外部 | 有已打开 Popover | 完整离场 | 遮罩清除、Home 可点 | none | none | 仅瞬时 UI | 打开→点外部→点同卡片，导航正常 |
| home.stopTap.click.1 / .2 / .3 | Home / Goals panel | 点击面板内容 | Popover 打开 | 阻止冒泡，不伪装按钮 | 面板保留，不导航 | none | none | 仅瞬时 UI | 点击目标文字不能打开聊天或关闭自身 |
| home.amCardGo.click.1 | Home / Auto Match status | 点击状态卡 | 真实 match_session 为 searching/paused/found/waiting | 无导航 Loading | 分别进入 searching/paused/found/waiting 路由，传同一 match_id | 失效状态刷新 getter，不重启计时 | none | 匹配状态、配额、Home | 四态逐一进入/返回/刷新，结束时间不重置 |
| tab.home / tab.discover / tab.events | TabBar.dc.html | 点击三枚 Tab 图标 | 与当前路径不同；无未结束切换 | replace_route，重复点击锁定 | 只替换当前主页面，当前态准确 | 原 Tab 和内容仍可交互 | none | 主 Tab 与骨架消费集合 | Home→Discover→Events→Home 两轮；栈深不变、Tab 固定 |

## 必测状态

默认三卡、登录后一次骨架、空联系人、存储读取错误、缺头像、超长姓名/目标、可滚动长列表、Popover 遮罩/首次再次动画、四种匹配状态、配额 0 与非 0、二级页返回、刷新恢复、拉黑聚合过滤、Tab 固定和底部安全区。

可复现的测试输入必须在 Store 的测试场景中定义，不能在生产页加入 query 伪造关系或写页面假数组。故障测试应注入持久化适配器错误并断言状态完全不变。

## 完成门槛

用户已授权先验收 Home 本页，再逐页补齐依赖。验收分为两层，当前均为 pending：

- `local_acceptance`：布局与资源、三个卡片详情资料一致、Popover、固定骨架、安全区所有权、Tabbar、一次骨架消费、默认/空/错误/长内容、Store 状态恢复，以及每个入口传递的正确实体 ID。依赖页内容和返回链路不能借此判为通过。
- `full_acceptance`：Profile、Chat、Match Found、Received Request、Auto Match Entry 等目标页实现后，逐项执行上表完整 acceptance；补齐 WKWebView、安全区、手势、滚动、刷新和跨页同步证据。

本页验收通过后可暂回 pending（待依赖），然后按既定顺序推进下一页；任一时刻仅一个页面 in_progress。本页阶段仍执行三项强制检查、专项提交及获授权的 push。只有两层验收与提交推送全部通过，Home 及其专属组件才能标记 verified。静态页面、旧错误目标页或构建成功都不是完整验收。
