# Age Confirmation 第一轮来源锁定与差异审计

## 2026-10-19 日期选择器增量（下方旧结论仅为历史）

用户要求 DOB 点击显示年月日选择器并自动回填。修改前核对：当前控件为任意文本 input，会弹文字键盘；仓库无日期选择器可复用，但已有 EventConfirmDialog 与 uni-app picker-view。仅将输入交互改为受控三列日期弹层，保留原字段几何、placeholder、文案、页头/页脚、返回、18 岁校验和 Store 保存链路。选择/取消均不写业务状态；Done 回填草稿，Continue 才经过 500ms Loading 保存。年月日联动约束正确月长、闰年和今天上限，不加新的年龄上限。详见 [增量契约](./date-picker-2026-10-19/source-contract.json)。旧的文字键盘截图不作为新控件的验收依据；本轮先恢复 pending 状态，只有 Age 处于 in_progress。

本轮新控件浏览器 5 项、页面来源/年龄边界回归 7 项、Welcome→Age 注册入口回归 2 项均通过；19 个数据测试套件共 176 项通过。iPhone 17 Pro WKWebView 两个测试通过：三列实际展开、未满18零写入、成人 Loading 后保存、刷新恢复、取消保留和无文字键盘。默认页叠图已逐区查看，原字段 56px 与其他来源几何保持；新弹层是用户授权的交互增量，使用既有受控 Sheet，不宣称有不存在的原型选择器截图。首轮小屏失败为测试在 32ms 入场启动前取图所致，保留失败报告，等待 open 状态并固定结束帧后同一布局通过。全页 visual/full 仍按 pending 记录，不扩大为整 App 验收。

## 结论

Age Confirmation 的来源锁定、首轮差异修正、浏览器/WKWebView 取证与最终门禁均已完成。393×852 默认结构、Underage 卡片、320×568 滚动/安全区和 iPhone 17 Pro 真实软键盘均通过；无效日期、18 岁边界、Loading、存储失败、刷新和返回归属形成真实闭环。按用户授权的自动确认规则，本页现为 `status: verified`、`visual_acceptance: passed`。

来源：HTML 内层 2529–2559 行；返回 5224；页面条件 5530；Age/Community 导航 5561–5562；未满 18 状态 5600–5603；DOB 输入 5650–5651。完整值见 [source-contract.json](./source-contract.json)。历史截图 [默认](../../evidence/registration/age.png) 和 [320×568](../../evidence/registration/age-small.png) 包含已保存日期，只作为回归历史。

## 对照结果

| ID | 项目 | 来源值 | 当前实现 | 结论 | 处理方式 | 涉及文件 |
| --- | --- | --- | --- | --- | --- | --- |
| AGE-001 | 根层/背景/动效 | absolute inset 0；cRise 240ms；来源渐变 | SecondaryPageFrame + PageTransition 240ms + 同主题渐变 | 一致 | 固定动画结束帧取证 | `age.vue`、`PageTransition.vue` |
| AGE-002 | Header/安全区 | source y=58、46 返回、48 header、`Age check` | 视觉结构一致，真实 TopSafeArea 替代系统占位 | 批准适配 | 393 注入 54 与 WK 实测分别断言 | `AuthPageFrame.vue` |
| AGE-003 | 返回 interaction | `goBack` | 返回功能及 `age.goBack.click.1` 均一致 | 已修正并通过 | 保留来源热区 | `age.vue` |
| AGE-004 | 主标题 | `Are you 18 or older?`，33/800/-0.035em | 文案和参数一致 | 一致 | 保留 | `age.vue`、`auth.css` |
| AGE-005 | 说明 | CIRCA 文案；17px、10px 顶距、1.45 | 仅按批准决定替换 Cimoa；其他参数一致 | 批准品牌差异 | 锁定准确标点和破折号 | `age.vue` |
| AGE-006 | DOB 输入 | 14px 顶距；56高；18圆角；placeholder；`onObDob` | 视觉及 `age.onObDob.change.1` 一致 | 已修正并通过 | 输入时不持久化 | `age.vue` |
| AGE-007 | 无效日期错误 | 来源无独立分支 | 真实格式/日期错误卡 | 必要业务补齐 | 只在真实失败显示，默认 reference 隐藏 | `age.vue`、`localAuth.js` |
| AGE-008 | Underage 卡片容器 | margin 18、padding 20、radius 24、指定阴影 | 专属 padding 20px，其他参数一致 | 已修正并通过 | 浏览器与 WK 双端断言 | `age.vue`、`auth.css` |
| AGE-009 | Underage 标题 | 20/800/-0.025em；CIRCA 品牌 | 20/800/-0.025em 与批准 Cimoa 品牌一致 | 已修正并通过 | 保留准确文案 | `age.vue` |
| AGE-010 | Underage 正文 | 16px、8px 顶距、1.45 | 专属 16px/8px/1.45 变体一致 | 已修正并通过 | 不复用主说明字号 | `age.vue` |
| AGE-011 | Close | 50高、25圆角、14顶距、17/600、浅底；清状态回 Welcome | 几何一致；通过统一返回恢复 Welcome 实例 | 批准返回适配 | 验证普通入口与直达 fallback | `age.vue` |
| AGE-012 | Footer | Continue 60；under-18 46；bottom 30；gap 6 | 文案与几何一致 | 一致 | 保留；BottomSafeArea 由框架接管 | `age.vue`、`AuthPageFrame.vue` |
| AGE-013 | Continue 业务 | 来源直接进入 Community | 真实日期/18岁边界→500ms Loading→Store→Community | 批准业务差异 | 验证前零写、失败回滚、刷新恢复 | `age.vue`、Store |
| AGE-014 | 键盘 | 来源未登记系统键盘适配 | visualViewport 缩小时折叠 footer，DOB 保持可见 | 批准适配并通过 | 浏览器模拟与真实 iOS 软键盘双验收 | `age.vue`、`useEventViewport.js` |
| AGE-015 | 默认证据 | 空 DOB、无错误、无 underage 卡 | 新 reference/actual/overlay/diff 均使用空值 | 已修正并通过 | 历史截图只保留为回归证据 | `scripts/age-visual.test.mjs` |

## 本轮实施与验收结果

1. 已补齐返回与 DOB interaction ID，恢复 Underage 卡片 20px padding、标题字距及 16px/8px 正文参数；默认页面未新增无来源控件。
2. 浏览器确定性测试 7/7 通过：393×852 空 DOB、cRise 结束帧、reference/actual/overlay/diff、Underage、320×568、62/34 安全区与键盘高度缩减。平均通道差 `0.5446666428`，大于 8 的像素 `8015`；差异集中在文字抗锯齿与原生输入渲染，几何、文案和交互 ID 断言一致。
3. 注册 Store 10/10 与既有 Age 浏览器回归 2/2 通过；无效/未来/17 岁均零写入，18 岁边界只在自定义 Loading 后写入，注入存储失败原子回滚且保留重试值。
4. iPhone 17 Pro（iOS 26.5）WKWebView 专项 1/1 通过，实测视口 402×874、安全区 62/34；真实系统键盘打开后 visualViewport 明显缩小、DOB 可见、footer 折叠。默认、Underage、键盘三张原生证据均已导出。
5. 证据见 [acceptance.json](./acceptance.json)。依据用户授权，本页已自动视觉确认；三项强制校验与 H5 重构建通过后进行本地专项提交，并自动开始 Community 来源锁定。
