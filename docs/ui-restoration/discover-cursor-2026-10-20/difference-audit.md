# Discover 跨 Tab 卡片位置保留

## 根因与修复

主 Tab 使用统一 `switch_tab_route → redirectTo`，替换页面但不增长栈。旧 Discover 在组件内初始化 `ref(0)`，因此从 Home / Events 再进入时回到首张；这不是数据源应重新加载的理由。

现在由 `src/stores/discoverCursor.js` 管理当前会话的 UI 游标，保存 `auth_context / user_id / index`，置于 Pinia 的业务 `data` 之外。页面从 getter 解析位置，完成离场才记录下一人物，页面重建不重置游标。取消、未完成手势、Tab 中断仍清理 timer / RAF / pointer 状态。

资料、相册、关系和发送状态仍从统一实体派生。人物顺序改变时优先保留 ID；人物被过滤时选择有效替代并记录新 ID；空列表清空游标。成功退出或认证上下文变化后清理，失败退出不清理。未新增浏览记录、skip、请求、扣费、Loading 或 storage 写入。

## 范围

覆盖 Home / Events 的反复切换、Home 空态 Explore People、详情返回、Introduction sent 的 Done 清栈返回，以及拉黑后有效替代卡片的保留。保留发生在当前 app 运行期；整份文档刷新或 app 重启不承诺保留浏览位置，不改变已持久化业务数据恢复。

本轮不修改 HTML 原型、UI 文案/样式、安全区、路由栈模式或两份开发约定。单独的任务回归不等于整 App 重新验收。

## 验证

- `scripts/discover-cursor.test.mjs`：7 项位置/过滤/账号隔离/零写入测试，包含资料顺序变化、空列表、单卡、请求状态同步及失败退出。
- `scripts/discover-cursor-browser.test.mjs`：默认及 Home 空态两场景；临时 H5 服务仅用于测试，最终关闭浏览器及服务。
- `scripts/lib/discover-cursor-regression.mjs`：同一驱动在浏览器及真实宿主 WKWebView 执行，操作真实页面入口；测试发送实际写入一条请求及一笔 10 coins 支出，拉黑实际过滤当前人物。
- `HostTests.testDiscoverCursorAcrossHomeAndEvents`：iPhone 17 Pro、iOS 26.5，测试前备份两个业务 storage key，结束后恢复；不将宿主 DOM Pointer Events 测试称为物理设备帧率验收。
- 本轮截图仅记录交互完成状态；没有样式变更，不以截图声称新的零差像素验收。

最终实测数目、构建清单和检查结果见同目录 `acceptance.json`、`browser-acceptance.json`、`native-acceptance.json`。
