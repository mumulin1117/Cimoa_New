# Cimoa 活动二级页面验收

本轮按原 HTML 还原活动详情、参与者、报名成功、我的活动与活动群聊。五页本地闭环通过，依赖未齐所以保持 local passed / full pending，不标记 verified。复用现有本地活动实体和报名规则；不改学生资格、不接入虚构主办方服务、不自动生成群友回复。

## 来源与页面顺序

原型源码来源：Detail 1919–1996、Join Success 1999–2014、Participants 2017–2046、Group 2049–2112、My Events 2116–2164。按用户顺序推进详情、参与者、成功页、我的活动、群聊。原型作为静态来源，不进入运行产物。

所有入口使用页面清单中的 interaction_ids。默认、加载、空、错误、长内容、返回和刷新均要检查；本轮通过前不预填结果。详情封面由原型整页滚动适配为固定安全区/Header 加滚动封面和内容；CTA 固定，底部安全区由页面框架统一接管，弹层不再预留主 Tab 高度。

## 十字段交互契约

表内简写均指页面清单同前缀的完整 interaction_id；触发默认为点击，输入另列。共同前提为已完成 hydration、有效且未切换的当前账号、真实 event_id。纯导航不写入、不显示 Loading，返回弹出真实来源实例，无历史回 Events；群聊返回保留 event_id 的活动详情。业务写入在校验及必要确认后显示 EventActionLoading 500ms，失败不部分写入；卸载取消未提交任务。

| interaction_id | source_screen | trigger | preconditions | visible_feedback | success_result | failure_result | persistence | sync_scope | acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| evDetail.goBack/openParticipantsList/openGroup | Detail 1919 | click | 目标已还原；群聊须报名 | 页面过渡 | 正确实体与返回来源 | 留在来源并说明依赖或权限 | none | 真实 event/conversation | 进入、返回、刷新、越权 |
| evDetail.askJoin、sheetEvJoin.* | Detail/Join Sheet | click/confirm | 学生资格、免费、未满、未结束、未重复 | 确认及500ms Loading | 一条报名，新增或复用活动群，进入成功页 | 原人数/名额/余额保持不变 | memberships/conversations | 主列表/详情/参与者/我的活动/群权限 | 取消、连点、存储失败、刷新 |
| evDetail.manageAttendance、sheetEvCancel.* | Detail/Cancel Sheet | click/confirm | 当前有效报名 | 确认及500ms Loading | 释放本人名额并撤销群聊访问 | 取消/失败保持报名 | memberships | 同上，不改好友关系 | 成功/失败/取消/重新报名 |
| evDetail.openEventMore、sheetEvMore.* | Detail/More Sheet | click | 同一活动 | 来源Sheet；Share打开真实活动摘要，Copy真实剪贴板结果 | 分享文本仅含当前活动资料 | 举报与主办方拉黑缺依赖明确失败；不写安全记录 | none | none | 首次/再次、关闭、错误 |
| eventDetail.location.* | Detail 地点技术补齐 | click | 活动地址可读 | 位置详情Sheet | 展示实际地址、校区；有坐标才请求地图 | 缺坐标/地图能力明确错误，地址保留 | none | none | 非虚构坐标、关闭 |
| evParticipants.goBack/onSearch/p.go | Participants 2017 | click/input | 合法活动；过滤被拉黑者 | 实时搜索、关系标签 | 本人打开现有Profile；他人携user_id | 他人详情未还原明确错误，不建立关系 | none | users/memberships/relationships | 搜索、空/长内容、拉黑、本人返回 |
| evJoinSuccess.openJoined/openMyEvents | Join Success 1999 | click | 本人仍已报名 | 实际活动信息 | 返回已有详情或进入详情/我的活动；不再报名 | 已取消时不显示旧成功 | none | memberships | 成功/刷新/返回/无效ID |
| evUpcoming.goBack/openJoined/openGroupStop/manageStop | My Events 2116 | click/confirm | 本人真实报名 | 时间分组；管理确认 | 正确活动/群；取消后移除当前报名 | 不凭原型静态卡伪造报名 | memberships仅管理 | 活动列表/详情/群聊 | Upcoming/Past、跨账号、取消同步 |
| evGroup.goBack/openGroupMenu | Group 2049 | click | event_id与conversation_id一致，当前仍报名 | 正确群信息/菜单 | 返回来源；菜单查看详情/参与者/管理 | 权限失效隐藏内容且保留可返回错误态 | none | memberships | 参数伪造、退出后访问、层层返回 |
| eventGroup.menu.mute | Group 菜单技术补齐 | click | 同一账号仍有效报名，群与活动匹配 | 500ms Loading，真实Muted标签 | 当前账号群偏好切换并可恢复 | 写失败原偏好不变 | event_preferences.group_muted_event_ids | 当前群/刷新，非真实推送服务 | 静音/恢复、刷新、退出后拒绝 |
| evGroup.onGroupDraft/sendGroup | Group 2049 | input/click | 非空≤2000字、报名有效 | 500ms Loading | 原子保存消息，清草稿，定位消息ID | 保留草稿，可重试，不重复消息 | messages/operation_receipts | 同活动群和刷新 | 空、长、连点、失败、取消权限 |
| evGroup.sendPhoto/recordGroupVoice、eventGroup.media.* | Group 2049/技术补齐媒体面板 | click/system media | 真实图片或麦克风授权；Blob可解码、≤20MB | 预览/录音/试听/重录；发送确认及500ms | Blob与消息元数据原子发布 | 取消释放轨道/URL；失败补偿新Blob，无假音频 | IndexedDB/media_files/messages | 同活动群刷新 | 真实媒体、权限拒绝、失败回滚、离场清理 |

## 数据和组件约定

沿用 events、organizers、memberships、conversations、messages、media_files、users、blocked_users。详情、人数、剩余名额、个人报名、群权限、Upcoming/Past、时间格式和消息展示从 Store getter 派生，不在页面复制业务数组。可见人数按既有拉黑过滤口径；名额仍扣除全部真实报名，拉黑不释放别人的名额。

新增字段仅在有来源时加入 seed；旧持久化缺失的简介、议程或主办方通知显示空态，不用另一活动内容填充。相册和录音复用媒体适配器；Blob与消息一起成功才公布，元数据失败清理本次新Blob。消息与图片只在本机保存，不宣称远端已读或送达。

复用 PageTransition、TopSafeArea/BottomSafeArea、UserAvatar/ProfilePhoto、EventConfirmDialog、EvJoinConfirmDialog、EvCancelConfirmDialog 和 EventActionLoading。主 Tab 样式与骨架资格不变。主题只从 theme.json 消费。

## 验收结果

详情 local_acceptance 已通过：浏览器 4 组回归、活动数据 9 项测试；默认/已报名/小屏/长内容截图保存在 docs/evidence/event-pages。报名及取消前 Loading、取消保持、持久化失败回滚、刷新计数、完整/过期/无资格/错误 ID 均已检查。来源图为静态 HTML 分析，不宣称完成原型运行态像素对比。三项强制检查通过且无约定警告。

参与者 local_acceptance 已通过：累积浏览器 5 组、数据测试 10 项；真实搜索、空态、长名字、返回详情与持久化拉黑过滤通过。他人详情继续保留待补依赖，不把同群关系当作好友。

报名成功 local_acceptance 已通过：累积浏览器 6 组；刷新不再报名，从详情进入成功再 Open event 返回原详情（深度 2），未报名或取消后不显示假成功。My Events 在其本页验收前仍明确待补。三项强制校验无错误、无约定警告。

我的活动 local_acceptance 已通过：累积浏览器 7 组、活动专项数据 11 项；成功页进入、详情往返、取消/刷新/Tab 人数和名额同步、Past 真正时间分组通过。只显示当前账号真实报名，空态不补原型虚拟卡片。

群聊 local_acceptance 已通过：文字/图片/语音、空态、消息失败草稿保留、相片确认/预览、刷新恢复、静音、参与者往返、取消后隐藏消息与编辑器、伪造 event/conversation 参数拒绝。图片经真实浏览器文件选择送入生产解码路径；语音采用受控音源经过真实 MediaRecorder/解码/试听/发送/IndexedDB/重载播放，另测拒绝麦克风权限。受控音源不是实体麦克风实测。

本轮最终活动链路 Chrome 10 组、既有 Events/主 Tab 回归 19 组通过，浏览器异常为空；全部非浏览器单元测试 87/87 通过。第 13 节三项命令依次通过且无约定警告。全量 WKWebView 测试 EventPagesFullRegression.xcresult 在 iPhone 17 Pro / iOS 26.5 为 8/8、无失败或跳过；新增活动用例覆盖报名→成功→我的活动→详情→参与者→群聊、文字及真实包内图片解码/保存/刷新、计数、安全区、静音与取消权限撤销。原生测试恢复原账号快照并删除本次新增媒体。

新增 EventPageHeader、EventAudio 及群聊媒体面板随使用页面完成本页验收；EvJoin/EvCancel/EventConfirm/PageTransition/SecondaryPageFrame 复用回归通过，不提前标记完整 verified。临时预览和隔离浏览器均已关闭。只做本地提交、不推送。

最终原生稳定帧见 [截图附件](./evidence/event-pages/native-final/manifest.json)，专项 EventPagesFinalEvidence.xcresult 1/1 再次通过；首轮过早截图已移到本地 build/EventPagesEarlySnapshot 留档，不进入最终验收证据。独立 iOS 工程包 artifacts/cimoaNeapo-ios.zip 的 195 份 H5 与浏览器 dist、原生测试 App、正常模拟器 App 逐文件 SHA256 一致，见 [包核验报告](./evidence/event-pages/package.json)。正常版已安装并在 iPhone 17 Pro 启动，保留原有账号数据。

## 文件与使用入口

- 页面：src/pages/events/detail.vue、participants.vue、join-success.vue、upcoming.vue、group.vue；共同样式 event-pages.css；主入口 index.vue 与 src/pages.json。
- 数据：src/stores/eventSelectors.js、eventMessaging.js、store.js、selectors.js。新增可选 group_muted_event_ids 在旧存档缺失时读为空，不覆盖旧数据。
- 复用和组件：src/components/EventPageHeader.vue、EventAudio.vue、EventConfirmDialog.vue、SecondaryPageFrame.vue、SourceIcon.vue。
- 交互层：src/composables/useEventPage.js、useEventMedia.js、useEventViewport.js；src/utils/eventsNavigation.js、eventCapabilities.js、mediaCapabilities.js。
- 样式入口与主题：src/App.vue、src/config/theme.json。仍用 rpx、主题变量、固定安全区/Header/CTA、单滚动区及自定义 Loading；群聊额外消费真实 visualViewport 高度并清理监听。
- 测试：scripts/event-pages.test.mjs、event-pages-browser.test.mjs、lib/events-browser.mjs、ios/cimoaNeapo/Tests/HostTests.swift；截图与报告见 docs/evidence/event-pages。
- 浏览入口：Events → 活动封面；My Events；报名确认后成功页。已报名详情或我的活动可进入 Group chat。

详情、参与者、成功、我的活动各有独立本地提交：1265abd、648ea6f、360eb8a、7259245；群聊和最终验收另作本地专项提交。独立 H5 由现有 WKWebView 加载，不改动、不嵌入、不运行原 HTML。

## 待补依赖

参与者的他人详情、活动举报与主办方拉黑独立业务尚未还原；成功路径不计入本轮局部验收。新注册账号仍受现有学生资格限制。真实远端报名、群消息投递和主办方服务不在现有本地数据模式内，不以模拟回复冒充。系统照片选择器手动点击、实体麦克风/扬声器和软键盘实际触摸、完整横屏/后台切换仍未包含在自动通过项中；位置缺坐标明确错误。原生快照等待图片及过渡合成完成后另行导出，首轮过早快照不作最终视觉证据。
