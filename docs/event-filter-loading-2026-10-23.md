# Events 分类切换 Loading 专项验收

## 范围与设计

按用户要求参考首页最新“相遇光轨”，将 Events 的 Today / This week / My campus 分类切换反馈改为内容区轻量浮层：半透明浅色圆角卡片、青蓝紫粉渐变细边、双光点交错流动、标题 Updating events 与目标分类副标题、短时柔和入退场。不是顶部品牌 Logo，也不再使用报名操作的全屏遮罩。

旧活动卡片保持挂载且不位移；原分类在持久化成功前保持选中，目标分类仅显示 pending 细边。浮层通过零高度 sticky 锚点保持在内容视口内，小屏滚动后仍可见，Header / Tabbar 不被遮挡。完成、离页、账号变化及后台状态不残留运动；减动效模式显示静态光点。

保留 Store 唯一业务数据源、既有约 500ms 写前 Loading、事务回滚、防连点与取消代际检查。没有修改 Events 数据、报名/取消流程、Discover 牌序或两份约定。

## 本次源码文件

- `src/components/EventFilterLoading.vue`：专属浮层、无布局位移吸附与入退场。
- `src/components/BrandRefresh.vue`：增加可选 label / copy slot；首页默认调用与图形原样保留。
- `src/pages/events/index.vue`：瞬态 pending 分类、失败和离页清理，分类/报名 Loading 分流。
- `src/config/theme.json`、`src/config/navigation.js`：语义主题 token 与集中动效时长。
- `scripts/event-filter-loading.test.mjs`：7项静态/配置回归。
- `scripts/event-filter-loading-browser.test.mjs`、`scripts/lib/event-filter-loading-regression.mjs`：隔离浏览器与 WKWebView 共用的分类回归。
- `scripts/lib/events-browser.mjs`：原业务回归区分分类浮层与报名全屏 Loading。
- `ios/cimoaNeapo/Tests/EventCoverTests.swift`：独立 non-persistent WKWebView 分类专项与两次独立原生调用的光点位移采样。
- 本文及构建生成的 H5 / iOS Resources、工程导出包。

## 验证

- 单元测试274项通过，其中新增分类7项；约定检查无警告。
- 分类浏览器18项检查通过：原卡片保留、先 Loading 后写入、只提交一个分类事务、失败回滚与重试、刷新恢复、连点、离页取消、减动效、后台动效清理等。无运行错误或浏览器警告。
- 320×568、393×852、440×956及注入59/34安全区均通过。小屏先滚到底再切换仍显示完整提示，无水平溢出，不遮固定导航。
- 首页真实触屏刷新6组、原 Events 业务13组回归通过；原报名/取消仍显示其专属 Loading。
- iPhone 17 Pro / iOS 26.5：4个 WKWebView 专项测试最终均通过，覆盖首页骨架/刷新、活动数据与报名、分类 Loading、安全区与活动详情/举报/Toast。分类共享13项检查通过；原生两次独立调用间隔90ms观测到同一光点真实位移，生产500ms未延长。
- 原生首轮分类和详情两项在脚本初始化时超时，保留失败结果；未修改断言、代码或生产时长，单独重跑这两项通过。工具链有既有 AppIntents 元数据提示、模拟器 WebKit/无障碍诊断，没有新增应用编译警告。
- 浏览器通过请求拦截直接读取构建目录，未启动预览服务器；原生使用已打包 H5。测试账号与媒体均在隔离会话中，不清空或替换用户现有 App 数据。

## 证据与交付

`artifacts/event-filter-loading/` 保存三尺寸实际忙碌态截图、browser-report.json、wkwebview-report.json、wkwebview-motion.json、unit-test.log、首轮及重跑 xcresult/log、changed-files.json。

修改后按顺序执行 `corepack pnpm check:conventions`、`git diff --check`、`corepack pnpm build:h5`，同步 iOS 包内资源并导出 `artifacts/cimoaNeapo-ios.zip`。本次只验收分类反馈及其关联回归，不代表整个 App 重新完成全量验收。
