# Cimoa Home 本页验收

Home 已完成本页还原与浏览器验收，`local_acceptance: passed`；`full_acceptance: pending`。页面保持唯一 `in_progress`：本轮向可信远端推送连接 GitHub 443 超时，未进入 Discover，未把任何页面或专属组件标为 verified。

## 本次实现

- Home 仅保留原型的品牌/功能栏、标题/副标题、纵向连接卡、空态与匹配状态卡。删除本页旧宣传卡、横排推荐、活动区和引言卡，其他页面的业务还原未开始。
- 卡片只从 Store 派生：Chloe Lin / 21 / HKUST，Liam Park / 22 / Stanford，Lina / 21 / HKU。头像、目标和关联 ID 使用详情实体；Connected、Auto Match、Invite 不在页面持有第二份状态。
- 首次使用的 ConnectionGoalsPopover 常驻挂载，锚定卡片，展示全部目标，预览前三项；首次/再次入场、面板阻止冒泡、外部点击、内容滚动和尺寸变化关闭均正常。长内容可读，不用 Sheet 替代。
- 参考393宽换算rpx；主题色、渐变、阴影都来自 theme.json；SVG 保留来源路径，图片与字体本地化。顶部功能栏/标题固定、内容唯一滚动、Tab 接管底部安全区；不绘制系统状态栏或 Home Indicator。
- Home 不执行收费、接受邀请或其他业务写入。纯导航不加 Loading；错误重试只读取 Store。首次认证骨架复用既有600ms单次消费逻辑。
- 补齐阶段2/3的队列可选字段与可信 queue 事件：服务未提供队列信息时明确等待更新，不能把示例人数或时间当成真实状态。waiting 使用实际候选姓名。

## 验收证据

专项命令 `node --test scripts/home.test.mjs scripts/data.test.mjs scripts/circa-source.test.mjs scripts/navigation.test.mjs`：33项通过。三项强制检查依次通过：`corepack pnpm check:conventions`、`git diff --check`、`corepack pnpm build:h5`。无 conventions 警告；uni统计输出为构建信息提示。

独立产物由 `scripts/h5-browser.test.mjs --home` 临时服务，只暴露 dist/build/h5；不加载、执行或嵌入原型。Chrome 隔离 profile 下22项检查通过，详见 [机器结果](./evidence/home-browser.json)。脚本结束时关闭服务与测试浏览器，不改变用户已有浏览器数据。

验证内容包含：三 Tab 两轮双向切换/栈深1/固定底栏、真实测试账号登录后的三次独立骨架消费、刷新不重复骨架、真实 IndexedDB Blob 读取/删除、78头像/353卡片/38标题源尺寸、三人资料、Popover全部目标/首次再次/冒泡/边缘约束、五个 deferred 入口参数与无写入、空态 Explore 实际切换、长姓名/目标/列表滚动、缺头像、Blob头像刷新解码、零免费配额、四种匹配状态和截止时间恢复、接受/拉黑测试场景聚合、损坏存储不覆盖、320×568窄屏、UTC零点徽标由金币变3、无运行时异常。

视觉依据为原型214–357行布局与已核对hash的资源，结合独立H5截图人工检查及浏览器尺寸断言，不宣称做过原型运行图逐像素diff。系统占位改成固定骨架与实际安全区是开发约定要求的适配。

截图：[默认](./evidence/home-default.png)、[目标弹层](./evidence/home-goals.png)、[空态](./evidence/home-empty.png)、[长内容](./evidence/home-long.png)、[读取错误](./evidence/home-error.png)、[窄屏](./evidence/home-narrow.png)、[安全区注入](./evidence/home-safe-area.png)。安全区59/34是**浏览器桥接测试值**，不是 iPhone 17 Pro 或 WKWebView 实测结果。

## 未完成依赖

入口保留并验证实体参数；尚未还原的目的地由统一 guard 返回明确英文错误，不跳进旧错误页面、不改变金币或关系，也不作为导航成功。删除 guard 前须完成对应页面及返回验收。

| interaction_id | 目标及参数 | 后续必须验证 |
| --- | --- | --- |
| home.openMe.click.1 | /pages/profile/index，当前会话用户 | 真实 Profile、返回、资料更新后 Home 同步 |
| home.startAutoMatch.click.1 / .2 | /pages/auto-match/index | 真实入口、资格/费用、无导航消费、返回 |
| home.openMaya.click.1 | /pages/messages/chat?conversation_id=conversation_chloe | Chloe 私聊、发送/已读/刷新、返回及拉黑同步 |
| home.openLiam.click.1 | /pages/auto-match/found?match_id=match_liam | Liam 候选、45秒过期、跳过/接受、返回与计时 |
| home.openJordan.click.1 | /pages/connections/received?request_id=request_lina | Lina 邀请、接受/拒绝结果、真实页面同步及返回 |
| home.amCardGo.click.1 | /pages/auto-match/searching、paused、found、waiting；同一 match_id | 四态真实页面、状态操作、返回、持久化倒计时 |
| home.exploreDiscover.click.1 / tab.* | Discover、Events 主路由 | 替换导航已通过；两个页面业务 UI/交互尚未还原 |

Home完整验收还需既有WKWebView宿主、安全区/触摸/手势/返回实测；浏览器检查不替代这些项目。阶段五其他页面若依赖未齐，必须先请求是否扩展分段例外，不能沿用 Home 授权自行绕过。

## 改动文件与发布状态

- 页面与组件：`src/pages/home/index.vue`、`src/components/CimoaBrand.vue`、`ConnectionGoalsPopover.vue`、`UserAvatar.vue`。
- 数据、主题、导航：`src/stores/seed.js`、`selectors.js`、`store.js`、`src/config/theme.json`、`src/utils/homeNavigation.js`。
- 测试：`scripts/home.test.mjs`、`scripts/lib/home-browser.mjs`、`scripts/h5-browser.test.mjs`。
- 记录与产物：本页验收、Home交互清单、阶段2字段、阶段5状态、页面清单、阶段1清单索引、`docs/evidence/home-*` 与 `dist/build/h5`。

本轮继续指令下的前置发布重试失败：`Failed to connect to github.com port 443 after 75021 ms`。仓库可信确认与推送授权已具备，不再重复索取授权；未换远端或通道绕过。安全的 Home 本页工作完成后停在发布门槛，专项本地提交不等于远端已发布。成功推送后才能将 Home 暂回 pending（待依赖）并进入 Discover。
