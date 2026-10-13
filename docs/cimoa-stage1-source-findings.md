# Cimoa 阶段一原型核对与页面清单

最终 UI 和交互依据为 `CIRCA All Screens (interactive).html`；品牌采用 Cimoa。运行时仅使用独立 Vue / uni-app 组件、Store、样式和本地资源，不加载原 HTML。

**阶段状态：in_progress。** 旧清单中的四 Tab、伪路由和笼统交互已撤销。下列映射是规划，不是已实现的证明。阶段 1 的资料冲突、交互契约和服务边界未关闭前，不进入阶段 2–5。

原型 SHA-256：`6c49411c6868b476ff46cedaa9828ee2ccbfe89d5eaa7ea1f739feb2c8018060`。静态审计定位 154 个目录状态、104 个页面条件区块、539 个事件绑定、52 个包内资源和 356 处内联 SVG。事件绑定包括输入、遮罩关闭、冒泡控制，不等于 539 个业务按钮；154 个状态也不等于 154 个独立页面。

## 已确认的结构

- 主 Tab 仅 Home、Discover、Events。依据内层模板 `showTabs`（5193 行）和内嵌 `TabBar.dc.html`，不是按 MAIN LEVEL 分组名称猜测。
- Profile 从 Home 左上入口打开，是二级页；Discover / Profile / Expanded 也是二级资料页。
- Home 标题为 People you’ve met，默认 Chloe Lin、Liam Park、Jordan Ellis 三张纵向卡片，分别进入聊天、匹配预览、收到邀请。没有旧实现的横排推荐、活动区或绿色宣传卡。
- Home 三个 Connection Goals 为卡片锚定 Popover，不是底部 Sheet。匹配状态卡覆盖 searching、paused、found、waiting；空联系人有 Start Auto Match / Explore People 入口。
- 393 × 852 是原型参考视口。设计尺寸按 `750 / 393` 转成 rpx；不复制状态栏和 Home Indicator，安全区与固定骨架服从开发约定第 15 节。
- 原型 Tabbar 是白色圆角胶囊，三枚轮廓图标分别为房屋、搜索、日历；选中项为渐变圆形底。不显示文字标签，英文标签用于无障碍。
- 原型主渐变为青、蓝、紫、粉；背景为浅蓝到浅紫。旧深绿/荧光黄/米白主题不属于此原型。
- 原型没有帖子信息流；旧 Store 的 posts/comments 不能用来填补首页。

## 来源证据和资源

[静态审计](./circa-source-audit.json) 保存每个入口的条件、绑定函数源码、源码行号、导航边和资源清单，不被应用导入。行号均指从原包静态解出的内层模板，而不是外层压缩 HTML。

包内资源为 35 张图片、12 个 WOFF2 字体、2 个组件 HTML、3 个运行库脚本。原先只提取了 29 张命名图片；遗漏 6 张图片和全部字体。运行库及组件 HTML 不应加入 H5 运行产物；仅提取组件的 SVG、样式和结构并重写为 Vue。原型内联 Emoji 不直接移植，按第 15.2 节使用已有源资源或语义匹配图标，并登记差异。

## 待关闭的业务矛盾

| 项目 | 原型事实 | 处理状态 |
| --- | --- | --- |
| 同一用户大学不同 | Chloe 首页 Berkeley、其他页 HKUST；Liam 首页 Stanford、活动页 HKUST；Jordan 首页 UCLA、黑名单/活动页 HKUST | 统一资料来源已询问用户，待答复；不得保存页面级副本 |
| 邀请串人 | Home 点 Jordan → reqReceived 写死 Lina → reqAccepted 写死 Chloe | 需用 request_id / user_id 贯通；最终人物随统一资料决策 |
| 介绍费用矛盾 | `cost()` 文本 6 coins；`continueText` / `spend` 为 10；App 描述强调核心免费 | 需确认最终计费，不能默选某个演示分支 |
| 配额和流水 | 每日免费 3 次，但无重置实现；初始余额 260 与演示流水不相等 | 需明确重置时区和有效流水规则，再设计字段 |
| 通话约定冲突 | 原型有来电/接通/结束；开发约定第 12.5 节仅等待接通模拟通话 | 保留现有约定，还是另行修改约定，需用户选择；不得自行假接通 |
| 缺失交互 | 相册、客服、语音等多处只显示 next phase；歌曲只有封面和动画，无音频 | 用户已授权补齐方案；没有音频/服务时明确英文错误、不假成功 |
| 真实服务资料 | 原型验证任意六位码、Apple 登录直接跳转、客服仅 Toast | 不能声称真实校验/登录/提交成功；服务缺失路径需契约化 |
| 联系方式 | 协议中为 privacy@circa.app | 不能自动视为 Cimoa 真实客服地址 |
| 最终验收 | 普通浏览器非生产宿主 | 需要已有 iOS WKWebView 工程位置与可运行环境 |

## Home 开工门槛

[Home 交互清单](./cimoa-home-interactions.md) 固定全部入口及十字段契约。Home 尚未开始还原，仍为 pending。资料决策和全局阶段门槛通过后，才可成为唯一 in_progress 页面。

阶段 5 的 Home 验收必须检查真实目标页和返回，不以能跳到旧错误页面为通过。Profile、Chat、Match Found、Received Request、Auto Match Entry 目前均未按原型验收；若严格要求 Home 完整闭环后才能开始其他页，则这些依赖必须先有用户确认的执行顺序，不能同时将多页置为 in_progress。
