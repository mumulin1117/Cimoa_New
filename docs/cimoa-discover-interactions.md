# Discover 本页交互契约

来源：原 HTML 解包模板361–399行，Discover / Profile / Photo，`route=photo`。独立路由 `/pages/discover/index`，主 Tab 替换切换、无 push 返回层。顶部由 DiscoverHeroHeader 接管一次物理安全区及固定功能栏；照片在唯一 scroll-view 中；Send shot 固定在 CustomTabBar 上方，Tabbar 独占底部安全区。cRise 260ms。

默认卡353×542、圆角28、顶部工具54、人物31、标签15、按钮60/21（393宽设计值统一换算rpx）。原系统54顶部占位不绘制，改实际安全区；无安全区时卡在76，注入54时卡在130。短屏允许照片区滚动，长姓名/标签换行且增高，不裁字。照片 `be199ee7-6704-4324-98d1-52394676c49a` 已提取为 `static/assets/head/maya-full.png`，复用实体首张照片；不硬编码此人或图片到页面。

## 十字段契约

| interaction_id | 来源 | 触发 | 前置条件 | Store/工具 action | 成功目标 | 失败表现 | 持久化 | 同步范围 | 验收步骤 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| photo.openMe.click.1 | 364 | 左上头像 | 有效会话 | discover_destination(profile) | /pages/profile/index，当前用户 | 明确英文错误，留原页 | none | 当前账号资料 | 参数/无写入；真实目标、编辑同步、返回 deferred |
| photo.openDiscoverFilters.click.1 | 365 / 5240 | 右上筛选 | 有效会话 | discover_destination(preferences) | /pages/auto-match/preferences | 明确英文错误，留原页 | none | 匹配偏好 Store | 原型是独立页面，不改 Sheet；偏好保存/刷新/返回 deferred |
| photo.expand.click.1 | 370 | 点照片卡 | 当前可见 user_id | discover_destination(detail, id) | /pages/discover/profile?user_id=同一人 | 失效/拉黑拒绝；未还原目标明确报错 | none | 同一人物/照片实体 | ID、阻止串人；真实详情/相册/返回位置 deferred |
| photo.sayHi.click.1 | 395 | Send shot | 有效会话、学生验证、目标可见，非已连接或待处理请求 | discover_destination(icebreaker, id) | /pages/discover/icebreaker/select?user_id=同一人 | 资格/重复请求或未还原错误；不扣币不建请求 | none | requests / relationships / coin账本 | 0余额入口、连接与请求防重；真实问题/免费文字/10金币语音流程 deferred |
| showTabs.selectTab.select.1 | TabBar.dc.html | Home/Discover/Events | 路由不同、无切换锁 | switch_tab_route | replace当前Tab；无原生Loading | 保留原页反馈 | none | 路由、认证骨架消费 | 两轮切换、重复点击、栈深1、首次600ms骨架与刷新不重复 |
| hasNotif.openNotif.click.1 | 全局4538 | 有真实通知时点通知 | 可信事件及合法实体、目标已还原 | 通知基础层，deferred | 对应真实目标 | 过期/服务未配置应报错 | 需通知实体设计，deferred | 全局通知/目标页 | 原型瞬时notif不得伪造为真实消息；此条件分支不计本页通过 |
| hasNotif.dismissNotif.click.1 | 全局4547 | 有真实通知时关闭 | 当前通知存在 | 通知基础层，deferred | 关闭当前通知、不改消息内容 | 原通知保留 | 是否已读按后续契约，deferred | 全局通知 | 常驻面板、事件ID、关闭和刷新待全局通知任务 |
| discover.retry | 错误扩展 | Retry | 读取失败 | store.hydrate | 从同一持久化源重新加载 | 保留损坏数据与错误 | none | 全局Store | 损坏数据不可覆盖、无假成功 |
| discover.retryPhoto | 媒体扩展 | Retry photo | 资源解码/读取失败 | media_cache.acquire | 加载原照片 | 可重试错误，绝不换成他人照片 | none | Blob缓存租约 | 网络失败后重试、缺失Blob、切页清租约 |

上述入口为纯导航或读取，无写入Loading/确认弹窗。当前依赖未还原时 readiness guard 只允许明确失败，不进入旧 mega-page。默认 Chloe 已连接，因此 Send shot 诚实提示已连接；未连接场景才生成破冰路由。文字价格不在此页决定，不调用消费 action。

页面仅读 Store 派生 `discover_person`；首位可发现、未删除、双方未拉黑且允许 Discover 显示的用户，照片按该人 photo_ids / position 取首张。原型 collapsed 卡无左右换人或照片箭头，不新增轮播；真正多照片浏览在详情任务完成。标签遵守隐私设置。测试场景只能经 fixture 注入，不暴露生产 URL 后门。

## 完整验收依赖

Profile、Match Preferences、Expanded、Icebreaker Select/Text/Voice/Preview、全局通知基础层及其目标页面、既有 WKWebView 宿主。依赖齐备后重开本页完整回归；只通过本页检查不得标记 verified。
