# Cimoa 阶段四：主 Tabbar

主 Tab 已固定为四项，顺序与原型主层级一致：

| label | route | active asset | inactive behavior |
|---|---|---|---|
| Home | /pages/home/index | local avatar mark | route switch |
| Discover | /pages/discover/index | local connect mark | route switch |
| Events | /pages/events/index | local event mark | route switch |
| Profile | /pages/profile/index | local profile mark | route switch |

`CustomTabBar.vue` 负责唯一配置和切换，固定在底部安全区上方；主页面内容为唯一纵向 scroll-view，并预留 Tabbar 高度。原型中没有可直接复用的四枚 Tab 图标，因此使用已提取的本地图片资源作为稳定视觉标记，未使用 Unicode 或 CSS 绘制图标。
