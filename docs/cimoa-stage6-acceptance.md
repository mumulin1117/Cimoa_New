# Cimoa 阶段六：整体验收记录

## 已完成的自动校验

- `corepack pnpm check:conventions`：通过。
- `git diff --check`：通过。
- `corepack pnpm build:h5`：通过，产物位于 `dist/build/h5`。

## H5 / WKWebView 宿主交付边界

本仓库按约定只交付 H5 和 `src/utils` 宿主桥接层，不加入 Swift/Objective-C 工程。iOS 宿主需要将 `dist/build/h5` 作为本地资源加载到 WKWebView，并向根页面注入安全区变量；内购回调通过 `CimoaPurchase` handler 发送给 `src/utils/iapBridge.js`。没有宿主时，内购请求会等待完整超时并保持原余额不变。

当前工作区没有 `.xcodeproj`、`.xcworkspace`，也没有配置 Git remote；因此未声明原生工程编译或 iPhone 17 Pro WKWebView 实机验收完成。
