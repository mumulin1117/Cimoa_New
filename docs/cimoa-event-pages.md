# Cimoa 活动二级页面验收

本轮按原 HTML 还原活动详情、参与者、报名成功、我的活动与活动群聊。复用现有本地活动实体和报名规则；不改学生资格、不接入虚构主办方服务、不自动生成群友回复。当前仅活动详情进入 in_progress，其余页面等待逐页验收及本地提交。

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

其余页面待逐项执行。本轮仅本地专项提交，不推送；完整依赖未齐时保持 local/full 分段状态，不标记 verified。

## 待补依赖

参与者的他人详情、活动举报与主办方拉黑独立业务尚未还原；成功路径不计入本轮局部验收。新注册账号仍受现有学生资格限制。真实远端报名、群消息投递和主办方服务不在现有本地数据模式内，不以模拟回复冒充。
