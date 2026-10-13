# iOS WKWebView 宿主接入说明

这是给现有原生宿主的接入边界，不是仓库内的 iOS 工程。

1. 执行 `corepack pnpm build:h5`，把 `dist/build/h5` 作为只读本地资源加入宿主。
2. 用 `WKWebView` 加载 `dist/build/h5/index.html`，保持同一份 H5 产物，不维护第二套页面或业务数据。
3. 宿主初始化后向网页注入 `--native-safe-area-top` 和 `--native-safe-area-bottom`；网页端通过已实现的 `src/utils/safeArea.js` 读取并刷新安全区。
4. 内购回调使用消息名 `CimoaPurchase`，回传 `request_id`、`status`（success/failed/cancelled）及错误信息；只有 success 才能调用 Store 的 purchase action。
5. 在已启动的 iPhone 17 Pro 模拟器中安装宿主后，验证安全区、滚动、页面返回、内购失败/取消/超时和媒体刷新恢复。
