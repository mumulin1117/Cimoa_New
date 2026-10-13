# Events 本页交互契约

来源：HTML 静态解包模板 517–605、4555–4593 行，`route=events`。独立路由 `/pages/events/index`，主 Tab replace，不 push。TopSafeArea → 固定工具栏/标题/三个筛选 → 唯一纵向 scroll-view 内横向吸附卡片 → CustomTabBar；底部安全区仅 Tabbar 接管，Sheet 消费完整 Tabbar 高度。页面 cRise 260ms、Sheet 底部进出 240ms，常驻挂载，提交锁定，遮罩层至少 1200。

源设计 393 宽：工具54/My Events48，标题38，筛选52，卡片309宽/圆角26/图片214，卡内边距14/16/16、标题23、时间地点17、头像36、统计15、按钮52/19。统一换算 rpx；长内容换行，不沿用原型单行截断。资源来自已提取本地文件，不运行原型。

## 阶段2/3补齐后使用的数据口径

- `events.time_zone`：新 HKUST fixture 为 Asia/Hong_Kong；旧实体缺失时只读回退 UTC，不改存档时间或重置数据。Today 按活动时区当日；This week 按活动时区周一至周日且未结束；My campus 按当前用户真实 university，仍排除已结束。这是可重复的真实筛选，不沿用原型 Today 中混入 Tomorrow 的演示数组。
- `events.featured_tab`、`feed_order`：源编排顺序，仅在满足真实筛选后排序，不能把不符合日期的活动强塞回结果。新 fixture 的 Today 为 Picnic/Open Mic/Yoga；周、校园首推 Film/Market。
- 图片填入 events.image_url；只用于新 fixture，不覆盖旧有效存档的空图片或自定义内容。缺图/失败显示真实空态/重试。源字段之外日期为 fixture 时钟派生的具体时间，不宣称真实线下活动。
- 统计/头像来自 Store memberships 与用户实体，不保留假 `12 going`。可见人数与头像遵循双方拉黑/删除过滤；余位按全部有效报名计算，隐藏某人不能释放其座位。详情、My Events、群聊使用同一 event_id，取消同步移除群聊访问权。
- 新偏好字段 `event_preferences.active_tab`，合法枚举来自 Store；缺失只读回退 Today。切换先自定义 Loading 500ms，再原子持久化，失败不改变选中项。旧 filters、收藏、提醒不被覆盖。本页只消费 active_tab；未实装的 Filter Sheet 高级选项不假称生效。
- 原型 catalog 的 `route=events&sheet=evFilterSheet` 有状态/handler，但模板没有对应 `sc-if`、筛选面板或 openFilters 入口。保持 pending，记录源稿缺失，不能凭空添加本页入口或标记通过。

## 十字段交互契约

| interaction_id | 来源 | 触发 | 前置条件 | Store/工具 action | 成功目标 | 失败表现 | 持久化 | 同步范围 | 验收步骤 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| events.openMe.click.1 | 522 | 左上个人按钮 | 有效会话 | events_destination(profile) | /pages/profile/index | readiness 明确失败，留原页 | none | 当前用户 | 参数/无写入；真实返回 deferred |
| events.openMyEvents.click.1 | 523 | My Events | 有效会话 | events_destination(upcoming) | /pages/events/upcoming | 目标未还原报错；不自动报名 | none | my_events | 点击不改 memberships；完整返回 deferred |
| events.chipToday.click.1 | 535 | Today | 有效会话、无提交 | select_event_tab(Today) | 当日未结束活动 | 原选项/原数据保留、英文错误 | active_tab | 全 Events 消费者/刷新 | 500ms前不写入、日期边界、空、失败、刷新 |
| events.chipWeek.click.1 | 536 | This week | 同上 | select_event_tab(This week) | 本周未结束活动 | 同上 | active_tab | 同上 | 周边界、排序、防重复、刷新 |
| events.chipCampus.click.1 | 537 | My campus | 同上 | select_event_tab(My campus) | 同大学未结束活动 | 同上 | active_tab | 当前用户大学 | 不同大学/空大学、切账号隔离 |
| events.openEvent.click.1 / .2 | 542/544 | 首卡封面/标题 | event_id 有效 | events_destination(detail,id) | /pages/events/detail?event_id | 失效或目标未还原报错 | none | 同一活动 | ID不串、两入口一致；详情返回 deferred |
| events.m.open.click.1 | 575 | 其余卡片 | 同上 | 同上 | 同上 | 同上 | none | 同上 | 横向吸附/长内容；详情 deferred |
| events.openParticipants.click.1 | 553 | 首卡参与者行 | event_id 有效 | events_destination(participants,id) | /pages/events/participants?event_id | 明确错误 | none | 真实 memberships | 统计与头像一致；目标页 deferred |
| events.evJoinTap.click.1 / events.m.join.click.1 | 562/597 | Join event / Joined | 会话、验证、未满、未结束 | event_join_blocker；开启 EvJoinConfirmDialog；已加入走 detail | 当前 event_id 的确认面板 | 资格错误、不写入 | none | 选定活动 | 不冒泡、重复点击、选错活动防护、关闭无写入 |
| sheetEvJoin.closeSheet.click.1 / .2 | 4557/4577 | 遮罩 / Not now | 非提交 | 关闭面板 | 原筛选和位置 | 提交中忽略关闭 | none | 无业务变更 | 首次/再次入场、退出动画、背景锁 |
| sheetEvJoin.confirmJoin.click.1 | 4576 | Confirm join | 重新检查会话/容量/验证/同一账号 | Loading 500ms → join_event(id) | 原子报名和真实群组；随后 /pages/events/join-success?event_id | 写入失败保留面板供重试；成功页未还原明确说明“报名已保存、确认页待还原” | memberships/conversations | 卡片/人数/余位/my_events/群权限 | 400ms前无写入、一次写入、防重、刷新；真实成功页 deferred |
| events.openGroup.click.1 | 567 | Event group chat | 当前账号已报名、真实群 ID | events_destination(group,id) | /pages/events/group?event_id&conversation_id | 未报名拒绝、目标未还原报错 | none | 群权限 | 加入后参数、取消后拒绝；群聊发送/返回 deferred |
| events.manageAttendance.click.1 | 569 | Manage | 已报名 | 打开 EvCancelConfirmDialog | 当前活动取消确认 | 报名失效错误 | none | 当前活动 | 不串活动、不提前取消 |
| sheetEvCancel.closeSheet.click.1 / sheetEvCancel.keepSpot.click.1 | 4584/4589 | 遮罩 / Keep my spot | 非提交 | 关闭确认 | 保持报名 | 提交中锁定 | none | 无业务变更 | 再开动画/返回原位 |
| sheetEvCancel.cancelAttendance.click.1 | 4590 | Cancel attendance | 同一账号且仍已报名 | Loading500ms → leave_event(id) | 留 Events，恢复余位、撤销群访问 | 存储失败保留原报名/面板 | memberships.status=left | 全部统计/my_events/群权限 | 重复、失败回滚、刷新、退出取消定时器 |
| showTabs.selectTab.select.1 | TabBar | 三Tab | 无切换锁 | switch_tab_route | 替换Tab | 留原页 | none | 骨架一次消费 | 多轮固定栏/栈1/返回刷新 |
| hasNotif.openNotif.click.1 / hasNotif.dismissNotif.click.1 | 全局 | 通知入口/关闭 | 真实通知实体 | 待全局通知任务 | 真实目标 | 不伪造通知 | deferred | 全局通知 | 全部 deferred |

扩展错误入口：Retry 只读 hydrate；Retry photo 只读 media_cache。页面、卡片、确认弹窗均只读 Store getter，页面仅保留选中实体 ID、弹窗类型、Loading 和反馈等瞬态状态。关闭/隐藏/卸载取消尚未执行的写入，账号切换不得把延迟操作写到新账号。

完整验收依赖：Profile、Event Detail、Upcoming、Participants、Group、Join Success、全局通知、已有 WKWebView 宿主。源缺失的高级 Filter Sheet 需要补稿或后续单独确认，当前不计本页通过。所有 readiness 错误只证明失败分支，不等于成功导航或完整验收。
