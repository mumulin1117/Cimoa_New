# Home 聚合读取模型

唯一入口 home_feed，derived，不持久化、不写入、不启动计时器。页面与导航读取同一模型；旧 home_connections/home_match_card 仅保留转发兼容，不保留第二套拼接规则。

数据来源：ConnectionRequest 的请求快照与权限、Connection 的双向同意/代际、Conversation 的最后消息/预览/未读、用户详情/目标、匹配状态与 UTC 每日配额。所有关联用 ID；媒体只返回现有元数据引用，不复制 Blob。

每人最多一卡，优先级为有效 Connection → pending 请求 → 收到匹配邀请 → 自己的候选；同类取最新记录，时间相同以稳定 ID 决定，绝不由 backing array 次序决定。展示分组沿原稿 Connected → Auto Match → Invite，Sent 作为既有变体；组内按 activity_at 降序、user_id 兜底。归组由实体状态决定，不写死三个人，也不强制补三张卡。

cards：user_id、user、goals（完整目标）、kind/status_label、connection_id、conversation_id、request_id、match_id、activity_at、preview、last_message、unread_count、destination/unavailable_reason。资料/目标从详情实体读；连接缺会话时明确不可用，不在 getter 补建。

counts：total/connected/incoming_requests/outgoing_requests/match_candidates/match_invitations/unread_messages，全部派生；不为这些字段新增原稿没有的统计 UI。

match_card：同一个最新有效非 fixture 活跃匹配的 match_id/status/title/subtitle/action/destination 与截止字段。派生过期时移除，不写状态、不重启计时；不把历史邀请当新候选。

quota：UTC date_key、remaining、daily_limit、is_paid；只读账本/当日配额，不导航扣费。status：loading/error/session_expired/empty/ready；失败、游客、过期账号不暴露卡片、统计、配额或导航目标。

失败与取消：getter 无写入故不需要写 Loading；目标页面仍执行既有确认/500ms Loading/action。拉黑双向过滤，解除不恢复连接；资料/问题/消息/已读/账号切换/刷新即取新投影，无页面级业务副本。

视觉契约与差异审计位于 docs/ui-restoration/home；来源锁定不代表验收通过。本轮只施工 Home 与其专属聚合/导航/Popover，不并行修改其他页面。

## 字段契约与默认策略

以下所有字段均为 derived，不落盘，write_action 为 derived。实际写入仍由来源实体的既有 action 完成。

- status：string 枚举 loading/error/session_expired/empty/ready，由 hydration 与认证决定；error_message 为 string，默认空，来源是受控错误。
- owner_user_id：nullable user ID，仅有效当前账号返回；destinations 为只读 object，profile/match/discover 是注册路由 string，不可用时为空对象。
- cards：array，默认空。user_id/source_id/kind/status_label 为 string；source_id 是实际连接/请求/匹配 ID，不是姓名。
- cards.connection_id/conversation_id/request_id/match_id：nullable string，仅当前状态的真实关联赋值，其余 null；缺会话不补建。
- cards.user：详情只读 object；goals 为按详情 goal_ids 解析的 object array，默认空，不借其他人的字段。
- cards.activity_at：number，来自最后消息/本轮连接时间或请求/匹配创建时间；不改来源时间。preview：string 默认空；last_message：nullable object；unread_count：nonnegative integer 默认 0，仅由真实 Conversation 派生。
- cards.destination/unavailable_reason：string 默认空，来自本条实体 ID/状态；合法连接缺会话返回说明，不创建路由。
- counts：object，各值为 nonnegative integer 默认 0，按最终可见去重 cards 分类累加，被覆盖旧记录不重复计数。
- match_card：nullable object 默认 null。match_id/status/candidate_id/created_at 来自同一个匹配；candidate_id、expires_at、search_ready_at 可 null；title/subtitle/action/destination 为 string，不捏造截止时间。
- quota：nullable object，不可读时 null；date_key 为 UTC YYYY-MM-DD，remaining/daily_limit 为 nonnegative integer，is_paid 为 boolean，来源 match_quota + quota_policy，只读不消耗。

共享返回修正：AutoMatchResultPage 的 connected/passed/expired/no-match 仅将 Home completion 改为原稿 root("home") 对应的 reLaunch，四消费者已回归；不并行重做其 UI。

本轮证据与结果：[Home 聚合专项验收](./ui-restoration/home-aggregate-acceptance.md)。
