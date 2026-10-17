# Events 与群聊实现 / 验收记录

日期：2026-10-17。品牌 Cimoa；独立 Vue 3 / uni-app H5，经 cimoaNeapo WKWebView 加载打包资源，不嵌入原型。仅本地 Git 提交，不推送。未修改 DEVELOPMENT_CONVENTIONS.md / INTERACTION_CONVENTIONS.md。

## 本轮实现

1. Events 横滑卡片保留原稿尺寸与 snap；标题/人数按原稿省略，日历描边还原。真实日期/校园筛选、报名确认、取消确认与存储失败回滚已回归。
2. 活动详情恢复主办方 SU 徽记、日期地点信息层级、按钮大小写、日程字重与 Good to know 原稿标签；不强行补造未知主办方认证或更新内容。
3. Participants 使用统一用户资料、真实关系标签与搜索/拉黑过滤；点击进入对应人物主页并正确返回，参加活动不会创建好友。
4. Join Success 恢复成功 SVG、顶部间距、原稿日期/地点和 Open Event；My events 恢复文案、字重和卡片结构，仅展示真实报名记录。
5. 群聊恢复80px header、118px composer、原稿 placeholder、左右头像和时间顺序；删除无来源横幅。完整图片预览不裁切，真实媒体失败可重试，草稿与录音在离开时清理。
6. Membership 新增兼容旧数据的 admission_id；唯一 Event Group；媒体异步解码/持久化跨重新报名、重新登录时拒绝旧发送并补偿新 Blob。原有媒体、其他账号和关系不变。
7. 群聊 unread_count 从可见消息派生，进入后先500ms自定义 Loading 再仅更新自己的已读，刷新不重复消费。
8. Report 原因来自 Store；选中/禁用状态接近原稿；保留实际设备保存范围说明，不声称送达审核服务。群聊来源参数经校验，并在举报页刷新后恢复正确返回目标。
9. WebKit 实测定位并修复无来源 pre-wrap 导致短消息额外换行；恢复原稿 white-space:normal / text-wrap:pretty，并增加原生短消息高度断言。

## 主要改动文件

- 页面：src/pages/events/index.vue、detail.vue、participants.vue、join-success.vue、upcoming.vue、group.vue、report.vue。
- 数据与路由：src/stores/eventSelectors.js、eventMessaging.js、selectors.js、store.js；src/utils/eventsNavigation.js；src/composables/useEventPage.js。
- 主题：src/config/theme.json；只新增/使用语义 CSS token。
- 数据设计：docs/cimoa-stage2-data-fields.md；页面清单 docs/cimoa-page-inventory.json。
- 测试：scripts/events.test.mjs、event-pages.test.mjs、event-pages-browser.test.mjs、settings-safety-browser.test.mjs；新增 scripts/event-group-source-browser.test.mjs；ios/cimoaNeapo/Tests/HostTests.swift。
- 来源与证据：docs/ui-restoration/events、event-detail、event-participants、event-success、event-upcoming、event-group、event-report；docs/evidence/events-*、event-pages、settings-safety/event-report-*。
- 生成物：dist/build/h5、ios/cimoaNeapo/Resources/H5 及构建清单。

## 已执行验证

- 数据与跨模块回归：137/137；补测同一时钟下退出/重登、退群/重新报名、重复 group、损坏 admission_id、已读刷新与举报 origin。
- Events 主 Tab 浏览器：19项；全部二级页综合浏览器回归：10项；举报：5项；群聊独立源码参考/已读/安全区：3项，均通过。
- 群聊图像证据：固定393×852，reference.png 只从原型 AST 样式/SVG 和同一组规范数据生成；actual-browser.png / overlay.png / diff.png 已产生并检查。像素数值不冒充零差异：mean absolute channel delta 约0.57/255，仍保留最终视觉验收 pending。
- iPhone17Pro/iOS26.5 WKWebView 已跑报名、群聊文字和图片、刷新、静音、参与者返回、举报保存返回、取消报名撤权与真实安全区。最终源修正包的2项原生测试全部通过，含新增短消息高度断言；详见 event-group/native-acceptance.json。
- 强制命令依次执行：corepack pnpm check:conventions、git diff --check、corepack pnpm build:h5。约定检查无警告；构建输出的 SDK 更新提示不作为业务验收结果。
- 所有浏览器服务记录PID并在finally结束。仅保留原有10张注册证据图未提交改动；不清理其他项目或用户已有进程。

## 尚未达到 verified 的条件

- Mac已锁屏，系统自动解锁失败；无法手动操作系统相册/麦克风授权、键盘与后台恢复。自动化 DOM/文件输入不冒充这些系统操作。
- 缺少真实音频输入设备；受控音频验证录制/解码/保存/重播，不算真实麦克风成功验收。
- 原型 Block Organizer 只有假 toast，机构未关联个人账号；已向用户询问独立机构屏蔽规则，未答复前保留明确不可用错误，不假成功。
- Events 其余页面仍需逐页独立 reference/overlay/diff 和最终视觉确认；旧功能通过不是像素级通过。
- 地图坐标与远端审核服务未配置，已有真实地址/复制及明确失败路径，不伪造坐标或审核投递。
- 清单维持 status=pending、local_acceptance=passed、visual_acceptance=pending、full_acceptance=pending；本轮不声明整模块或整项目还原验收完成。
