# Cimoa 阶段四 Tabbar 修正要求

**状态：completed（H5 共用基础验收）。** 阶段 1–3.1 基础已补齐，旧四 Tab 已替换为以下单一配置。这里只验收共用骨架，三个页面业务内容仍须阶段 5 逐页还原。

| 顺序 | 英文无障碍标签 | 源 route | uni-app 目标路径 | 源图标 |
| --- | --- | --- | --- | --- |
| 1 | Home | home | pages/home/index | 房屋轮廓 SVG |
| 2 | Discover | photo | pages/discover/index | 搜索轮廓 SVG |
| 3 | Events | events | pages/events/index | 日历轮廓 SVG |

来源为包内 `TabBar.dc.html`，三枚图标均存在。白色胶囊半径 31、设计高 62、左右边距 20；选中圆形为 52 × 52，图标 26 × 26，均为 393 宽参考设计的 px，落地必须换算 rpx。原型无可见文字标签；不能自行加上第四项 Profile。

阶段 4 只改共用导航和主页面骨架，不提前还原三个页面业务内容。实施要求：

1. 单一静态 Tab 配置保存不带开头斜杠的路径，CustomTabBar 用 replace_route 切换；同页和切换期间重复点击直接返回。
2. 不配置原生 tabBar；Profile 与 Expanded 保持二级页，不挂主 Tabbar。
3. 提取源 SVG，分别生成主题匹配的选中/默认颜色，不使用头像、Emoji 或 CSS 几何图形代替。
4. CustomTabBar 接管底部安全区，统一 `--app-main-tab-bar-height`、内容高度和主 Tab Sheet 偏移；胶囊留白与系统安全区分别计算。
5. MainTabSkeleton 每个静态 Tab 仅消费登录/注册成功准备的一次资格，500–700ms；刷新、普通恢复和来回切换不重新准备。
6. 验证两轮双向切换、当前态、同页点击、防重复、栈深、固定位置、底部不遮挡和安全区；记录实测证据后才允许 Home in_progress。

## 本轮证据（2026-10-13）

`node --test scripts/data.test.mjs scripts/circa-source.test.mjs scripts/navigation.test.mjs`：19 项数据、7 项来源、2 项导航专项通过。真实 H5 浏览器脚本为 `scripts/h5-browser.test.mjs`，使用独立 Chrome profile，不运行原型 HTML。

- 393 × 852：胶囊 x=20、y=762、宽353、高62；内容止于 y=750，底部28为设计留白，物理安全区另加一次。
- Home→Discover→Events→Discover→Home 两轮，真实 uni-app 栈深恒为1；同页连点不导航；当前选中态按真实路由。
- Events 主内容滚到底，Tab 坐标不变；Header 与主滚动区分开。
- 注入 top=59/bottom=34 的**浏览器桥接测试值**后，顶部占位59，底栏只上移34。不是 iPhone 实测，不能替代 WKWebView 验收。
- 测试账号真实登录写入后，每个主 Tab 分别消费600ms骨架；往返、刷新不再出现。页面跳转不显示原生 Loading。
- 原生浏览器 IndexedDB Blob 写入→刷新→读取→删除通过，媒体缓存/语音及异常补偿另有数据层测试。
- 无页面运行时异常。临时预览 PID 40202 与本次 Chrome 子进程已正常关闭，测试未留下服务。

机器结果：[stage4-browser.json](./evidence/stage4-browser.json)；骨架截图：[stage4-foundation.png](./evidence/stage4-foundation.png)。截图中的旧 Home 业务内容不属于本阶段验收，也不代表目标首页。三项强制检查通过，无 conventions 警告；构建仅有 uni统计信息提示。

## 提交与发布门槛

基础修正已提交：`adb4e92`。用户明确确认 `mumulin1117/Cimoa_New` 可信并授权推送，授权项已解决。

本轮两次 `git push origin main`（第二次只对同一远端重试）均失败：`Failed to connect to github.com port 443`，分别在75183ms、75032ms后退出。中间同仓库 HTTPS 网页只读检查返回200，但不能据此声称 Git 传输成功。未换远端、协议或工具通道绕过，未强推。

本地检查通过不等于发布通过；阶段五 Home 尚未开始，待 Git 连接恢复并成功推送后继续。所有本次预览、Chrome 测试及 Git 推送进程均已退出。
