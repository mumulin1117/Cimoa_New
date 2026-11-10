# Event 详情页封面贴顶修正

## 本次范围

用户要求活动详情封面从页面顶部开始。原型 evDetail 的封面本来就在页面顶端，按钮叠放于封面；现有实现将封面放在顶部安全区及独立 Header 下方，产生空白。

本次恢复贴顶结构，并按实际设备安全区适配，不改变活动、报名、群聊、举报或导航的数据逻辑。Toast 和首次骨架屏策略仍待确认，不在本次修改范围。两份开发/交互约定未修改。

## 改动文件

- `src/components/SecondaryPageFrame.vue`：新增可选 `overlayHeader`，默认关闭；启用时移除顶部安全区占位，Header 通过 padding 单独接管安全区，空白区域不截断封面手势。其他二级页保持原布局。
- `src/pages/events/detail.vue`：启用覆盖式 Header；封面填满原安全区及 Header 占位，保留原正文起始位置；错误状态留足 Header 空间，返回按钮仍可用。
- `docs/cimoa-page-inventory.json`：只更新 Available / Joined 两个详情状态的顶部安全区所有者及固定区说明，不改变页面完成/验收状态。
- `scripts/lib/event-cover-layout.mjs`：浏览器及 WebKit 共用几何审计，不写业务数据。
- `scripts/event-cover-browser.test.mjs`：多尺寸、安全区、滚动、更多菜单、返回、无效活动检查；通过浏览器请求拦截加载构建文件，不启动预览服务。
- `ios/cimoaNeapo/Tests/EventCoverTests.swift`：使用独立 non-persistent WKWebView 和原生实测安全区，既有账号数据不被注入、清空或替换。
- `ios/cimoaNeapo/cimoaNeapo.xcodeproj/project.pbxproj`：在已有工程修改上添加新专项测试引用。
- 本文件，以及重新生成的 H5/iOS 包内资源与导出包。

## 验证结果

- `corepack pnpm check:conventions`、`git diff --check`、`corepack pnpm build:h5` 按顺序通过；约定检查无警告。
- Events 及 Event pages 的 17 项实体测试通过。
- 浏览器 12 项专项检查通过，覆盖 320×568、393×852、402×874、440×956、852×393，以及 0/0 和 59/34 安全区组合。
- 检查封面从 (0,0) 开始、按钮命中、Header 中间区域手势穿透、底部 CTA 固定、菜单与返回、无效 ID 错误及导航无业务写入。
- iPhone 17 Pro / iOS 26.5：WKWebView 专项测试通过，视口 402×874，安全区顶部 62、底部 34；封面 x/y 均为 0，宽 402，按钮在顶部安全区之下，Footer 底部为 840。
- 原生首轮内容就绪等待超时，加入诊断后重跑通过；两份结果保留。未将浏览器通过作为原生通过。工具链存在未使用 AppIntents 的元数据提示及模拟器 WebKit/无障碍诊断信息，没有新增应用编译警告。

## 构建与证据

所有证据位于忽略目录 `artifacts/event-cover/`：

- `browser-393x852.png`、`browser-report.json`
- `wkwebview.png`、`wkwebview-metrics.json`
- `Native.xcresult` / `native-test.log`：首轮超时
- `Native-diagnostic.xcresult` / `native-diagnostic.log`：通过
- `previous-h5/`、`previous-ios-resources/`：构建前产物备份，不包含对源码的重置

包内 H5 已同步更新；不依赖原型 HTML、下载目录或开发预览服务。本次为布局专项验证，不代表全 App 完整验收。
