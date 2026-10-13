# Profile 本页验收

2026-10-13：本页还原与 H5 本地检查通过，专项本地提交 `bc7bdfd`；完整验收待依赖。local_acceptance: passed / full_acceptance: pending，现恢复 status: pending，不标记 verified。

## 已还原与实测范围

- 原型3293–3352行：固定46圆形返回/设置、21标题、120头像、27姓名/认证、大学/专业/MBTI标签、渐变描边编辑、Caveat介绍、兴趣、实际金币与预览卡。原型未有的旧版消息/设置/购买/退出混合内容移除；五个源入口仍完整保留。
- TopSafeArea、SecondaryPageFrame、PageTransition、唯一纵向scroll-view、BottomSafeArea；普通二级页无Tabbar、无登录后主Tab骨架。源240ms入场/180ms返回；入场CSS临时阻止点击穿透，修复主Tab连点个人入口误点新页返回的实际问题，不增加导航Loading。
- current_user/current_interests/coin_balance唯一读源；人物详情实体、真实流水260、不硬编码22岁或认证。没有业务写操作、不增加虚假Loading/确认。Store字段缺口先登记阶段2/3后新增只读兴趣getter；有效存档不重置。
- 三Tab→Profile→各自原Tab真实push/pop，两轮连点均为栈2→1；Home滚动、Events筛选与数据、骨架消费保持。直接打开/刷新失去原实例时replace Home，未伪造来源。
- 缺资料、空兴趣、无头像、无认证、0金币、长姓名/介绍/17兴趣、320×568、安全区59/34注入、实际图片404/超时/重试、IndexedDB头像刷新及Blob丢失、过期会话、损坏快照修复重试均已验证。安全区注入不是iOS实测。
- 截图人工复核：默认布局、Caveat字形、兴趣标签不拆单词、长内容滚动到底仍能触达预览入口；没有画原型状态栏或HomeIndicator。

## 测试证据

- `node --test scripts/profile.test.mjs scripts/home.test.mjs scripts/discover.test.mjs scripts/events.test.mjs scripts/data.test.mjs scripts/circa-source.test.mjs scripts/navigation.test.mjs`：51/51通过。
- Profile浏览器20项：[报告](./evidence/profile-browser.json)、[默认](./evidence/profile-default.png)、[窄屏长内容](./evidence/profile-long-safe-area.png)、[空资料](./evidence/profile-empty.png)、[安全区注入](./evidence/profile-safe-area.png)、[缺依赖](./evidence/profile-dependency-error.png)、[图片失败](./evidence/profile-photo-error.png)、[图片加载](./evidence/profile-photo-loading.png)、[读取失败](./evidence/profile-read-error.png)。图片404/ERR_FAILED仅来自主动故障注入，最终无运行时异常。
- Home22项、Discover20项、Events19项本轮回归通过，报告对应入口已改为真实Profile进入/返回，不再把readiness错误当该入口成功。
- 按顺序执行 `corepack pnpm check:conventions` → `git diff --check` → `corepack pnpm build:h5`：全部通过，无约定warning。
- 临时预览服务每次均记录PID，finally关闭服务与浏览器；仅测试dist/build/h5，未运行/嵌入原型。

## 仍待完整验收

| interaction_id | 目标 | 后续必须实测 |
| --- | --- | --- |
| profile.openAppSettings.click.1 | /pages/settings/index | 进入/返回原位置、当前账号设置持久化/同步 |
| profile.openEditBasic.click.1 | /pages/profile/edit | 编辑保存/失败/取消、头像/字段/兴趣刷新同步 |
| profile.openStore.click.1 | /pages/coins/index | 余额同账本、真实购买回调/失败/取消/超时、返回同步 |
| profile.openProfilePreview.click.1 | /pages/profile/preview | 同实体资料与媒体、返回、编辑联动 |
| profile.goBack.click.1 | 实际来源Tab | WKWebView点击/系统返回策略/恢复、无黑屏 |

四个下级页现在仅验证目标校验和明确失败，不计成功闭环。资料保存同步由Store单元测试覆盖，不冒称已在未还原的编辑页操作。完整原生/服务验收仍待后续。

## 本次页面任务文件

- `src/pages/profile/index.vue`、新增 `src/components/SecondaryPageFrame.vue`、`src/utils/profileNavigation.js`。
- `src/components/PageTransition.vue`（无历史replace与入场防穿透）、`ProfilePhoto.vue`（头像模式/同源重试）、`SourceIcon.vue`（源设置/编辑路径与精确描边）。
- `src/stores/store.js`、`src/config/theme.json`、`src/utils/homeNavigation.js`、`discoverNavigation.js`、`eventsNavigation.js`。
- `scripts/profile.test.mjs`、`scripts/lib/profile-browser.mjs`、`scripts/h5-browser.test.mjs`、`scripts/home.test.mjs`、三份Tab浏览器回归脚本。
- [交互契约](./cimoa-profile-interactions.md)、阶段2/3/3.1与页面状态/映射、以上截图报告；`dist/build/h5`重新生成的哈希资源和入口。

用户随后授权的新cimoaNeapo宿主与平台范围修订属于下一独立任务提交，不混入本页专项提交；仍不push。
