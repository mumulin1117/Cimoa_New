# Cimoa 阶段四 Tabbar 修正要求

**状态：pending，必须先完成阶段 1–3.1。** 源 HTML 的真实 Tab 配置如下；旧四 Tab 和头像/活动图片图标方案作废，当前代码还未替换。

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
