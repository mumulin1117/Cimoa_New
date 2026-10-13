# Profile 本页交互契约

来源：HTML 静态解包模板 3293–3352 行，`route=profile`。二级路由 `/pages/profile/index`，Home / Discover / Events 均 push 进入，返回 pop 原实例；直接打开或刷新丢失历史时 replace Home，不建立假历史。五个原型入口全部保留，不把旧页的设置、充值、消息、退出混在本页。

## 骨架与数据（先于页面实现）

TopSafeArea → 固定 SecondaryPageHeader → 唯一纵向 scroll-view → BottomSafeArea，无 Tabbar、无主 Tab 骨架。源 cRise 240ms / 返回补充180ms。移除原型54高模拟状态栏，Header距真实安全区4，Header48，内容前间距12；内容左右20/内尾40，底部40设计留白单独保留，并由 BottomSafeArea 独占实际底部安全区。尺寸均为393源值，转rpx；不画系统栏。

120头像/3白边、27姓名、20认证图标、30标签、48渐变边编辑按钮、24圆角白卡、22节标题、Caveat27介绍、56兴趣图标、40金币与预览图标；源图分别为 `static/assets/head/me.png` 与 `static/assets/coins/home-coin-badge.png`。长姓名/标签/介绍允许扩展换行，不缩小到不可读。兴趣Emoji属于原型数据，不作为导航图标。

- 资料、年龄、大学、专业、MBTI、bio、认证、头像从 `current_user` 读取，空字段明确“not shared”，不硬编码原型年龄22/大学/认证状态；保持详情实体为准。
- 阶段2/3补齐 `current_interests` 只读getter：当前用户 `interest_ids` 有序关联 `interests`，返回克隆 `{item_id, emoji, label}`；空数组为空态，未登录/读取错误不泄漏seed。无需增加业务字段、存储键或迁移，旧有效快照不重置。
- 金币从 `coin_balance` 实际流水汇总，默认fixture260，不照搬原稿其他演示余额。导航、返回、只读hydrate与资源重试均不写入，不加400–600ms业务Loading。
- 本页复用媒体租约组件的肖像模式，loading/empty/error/Retry均不换人、不写元数据。没有播放、录音、相册或确认操作；这些留其真实首用页，不凭空添加。

## 十字段交互契约

| interaction_id | 来源 | 触发 | 前置条件 | Store/工具 action | 成功目标 | 失败表现 | 持久化 | 同步范围 | 验收步骤 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| profile.goBack.click.1 | 3297 | 返回 | 不在导航中 | PageTransition.navigate_back / 无历史navigate_replace | pop真实来源；根层replace Home | 保留本页并显示错误、恢复锁 | none | 原Tab筛选/滚动/骨架资格 | 三Tab进入返回、连点、刷新返回、失败恢复；原生手势pending |
| profile.openAppSettings.click.1 | 3300 | 设置图标 | 读取成功、有效会话 | profile_destination(settings) / readiness | /pages/settings/index | 目标尚未还原报错，不进入旧混合页 | none | 当前账号设置 | 目标参数/原页仍可操作/不写入；成功链路deferred |
| profile.openEditBasic.click.1 | 3316 | Edit Profile | 同上 | profile_destination(edit) / readiness | /pages/profile/edit | 同上 | none | current_user / current_interests | 校验无局部业务副本；编辑保存返回同步deferred |
| profile.openStore.click.1 | 3339 | 余额卡 | 同上 | profile_destination(coins) / readiness | /pages/coins/index | 同上，不伪造购买或扣费 | none | coin_transactions | 实际流水余额/刷新/零余额；充值返回同步deferred |
| profile.openProfilePreview.click.1 | 3345 | Preview my profile | 同上 | profile_destination(preview) / readiness | /pages/profile/preview | 同上 | none | 同一个current_user | 不传姓名、不创建另一个人；预览返回deferred |
| profile.retry.click.1 | 补充错误态 | Retry | 读取错误 | store.hydrate | 恢复合法存档 | 保留原存档、英文错误 | none | 全Store | 损坏→重试不覆盖→修复后重试 |
| profile.retryPhoto.click.1 | 补充资源错误态 | Retry photo | 原头像加载失败 | media_cache.acquire | 同一头像成功解码 | 原实体保留、可再重试 | none | 媒体租约 | 失败/超时/同资源重试/离开释放 |

本页无业务写入，不制造确认弹窗或全屏Loading。依赖 Settings、Edit Profile、Coin Store、Profile Preview 及已有 WKWebView 宿主未补齐前仅 local_acceptance，full_acceptance 保持 pending；明确失败不等于成功闭环。三Tab Profile入口解除readiness后须真实导航/返回回归。
