# iOS 图标与系统启动页配置

## 来源和范围

- 输入：用户提供的 `cimoalog.png`（1024×1024）及 `Launch ／ Splash ／ Default.png`（786×1598）。原图保留在 `ios/cimoaNeapo/Branding/`，哈希见同目录 `source-manifest.json`。
- 用户确认：启动页文字使用 **Cimoa**，保留设计图的背景、品牌弧线和居中布局，不沿用 CIRCA 字样。
- 本次只配置原生图标、静态启动页和工程导出。未修改 Vue 页面、会话分流、业务数据、权限、Store、两份开发约定或 Bundle Identifier。

## 改动文件

- `ios/cimoaNeapo/Assets.xcassets/Contents.json`
- `ios/cimoaNeapo/Assets.xcassets/AppIcon.appiconset/{Contents.json,AppIcon.png}`
- `ios/cimoaNeapo/Assets.xcassets/LaunchBackground.imageset/{Contents.json,LaunchBackground.pdf}`
- `ios/cimoaNeapo/Assets.xcassets/LaunchBrand.imageset/{Contents.json,LaunchBrand.pdf}`
- `ios/cimoaNeapo/Assets.xcassets/LaunchBackgroundColor.colorset/Contents.json`
- `ios/cimoaNeapo/Branding/{AppIcon-source.png,Launch-reference.png,source-manifest.json}`
- `ios/cimoaNeapo/Launch Screen.storyboard`：在已有文件及节点上补齐资源，背景约束至整屏，品牌区在真实安全区居中并随宽度等比缩放。
- `ios/cimoaNeapo/Config/Info.plist`：用 `UILaunchStoryboardName` 取代空的 `UILaunchScreen`。
- `ios/cimoaNeapo/Config/Local.xcconfig`：Debug/Release 共用 `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon`。
- `ios/cimoaNeapo/cimoaNeapo.xcodeproj/project.pbxproj`：保留用户既有工程调整，添加资源与新测试文件。
- `ios/cimoaNeapo/Tests/LaunchAssetsTests.swift`：图标登记、资源解码、6 种尺寸和真实模拟器安全区检查。
- `ios/cimoaNeapo/README.md`：配置与维护说明。
- `scripts/generate-ios-branding.swift`：从已保存源图和统一主题生成原生资产，移除冗余 alpha 后校验图标可见像素不变；弧线复用现有品牌 SVG 路径。
- `scripts/archive-ios.mjs`：修复原有导出清单遗漏启动 Storyboard、资产目录的问题，独立工程无需 Downloads 或生成器。
- 本文件。

## 技术边界

系统 Launch Screen 由 iOS 静态显示，不运行页面、动画或假进度计时器。图中的进度条为固定视觉状态，后续动画和启动分流仍由已有独立 H5 Splash 处理。矢量资源使用 `src/config/theme.json` 的颜色，不新增另一套原生主题。该配置不代表全 App 视觉或生产服务验收完成。

## 验证与证据

- 强制校验顺序：`corepack pnpm check:conventions` → `git diff --check` → `corepack pnpm build:h5`。
- H5 在真实目录副本中使用现有依赖构建，禁止自动重装依赖；避免覆盖工作区既有 H5 及 iOS 打包改动。
- 原生：scheme `cimoaNeapo`，iPhone 17 Pro / iOS 26.5，测试限定 `cimoaNeapoTests/LaunchAssetsTests`，不执行会清理账号的用例。
- 6 种尺寸：320×568、375×667、393×852、402×874、440×956、852×393；另检查当前模拟器实测安全区。
- 测试日志、结果包及截图位于忽略目录 `artifacts/ios-branding/`。截图为实际编译 Storyboard 的原生渲染，不冒称捕捉到了系统瞬时启动帧。
- Xcode 提示 `Metadata extraction skipped. No AppIntents.framework dependency found.`：现有工程未集成 AppIntents 的工具链提示，未通过添加无关框架或关闭诊断来掩盖。
- 独立输出：`artifacts/cimoaNeapo-ios.zip`，包含 AppIcon、启动资产、Storyboard 和现有包内 H5，不需要预览服务。

打开 `ios/cimoaNeapo/cimoaNeapo.xcodeproj`，选择 cimoaNeapo / iPhone 17 Pro 后运行即可。未配置正式签名、商店 ID 或上传发布。

## Apple 参考

- [Configuring your app icon](https://developer.apple.com/documentation/xcode/configuring-your-app-icon)
- [Specifying your app's launch screen](https://developer.apple.com/documentation/xcode/specifying-your-apps-launch-screen)
