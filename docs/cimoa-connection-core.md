# ConnectionRequest、Connection、Conversation

## 数据边界

ConnectionRequest 持久化在 `requests`：双方 ID、问题 ID、发送时的 `question_text` 快照、文字或原音频 ID、创建/处理时间、pending / accepted / declined / cancelled。问题修改不改写历史邀请；旧记录 hydration 时仅补缺少的快照，不写磁盘、不覆盖用户内容。2026-10-20 用户授权后，新文字与语音介绍均为 10 coins；历史免费请求不补扣。当前规则见[介绍专项契约](./ui-restoration/introduction-payment-2026-10-20/source-contract.json)，以下旧轮次视觉/验收记载不自动升级为本次证据。

Connection 是 `relationships` 两条方向同意记录的只读聚合，不增设第二份可漂移的好友表。稳定 `connection_id` 来自本轮双方同意记录 ID；包含双方、建立时间、来源请求/匹配、唯一会话、真实共同兴趣。拉黑删除同意后旧 ID 永久失效；再次连接获得新一代 ID，旧接受结果不能打开新会话。

Conversation 持久化双方唯一私聊及 messages；读取模型派生 connection_id、创建/最后消息时间、文字/照片/语音预览、未读数和日期。未读只计其他人发出且当前人未读的消息。群聊仍以活动报名为权限依据，不混入私聊 Connection。

## 事务与权限

- 发送、接受、拒绝、撤销始终检查真实账号、目标与动作归属；pending 双方最多一条，不能交叉重发。
- 接受一次事务处理请求、两条同意、唯一会话与原发送者的首条介绍；不生成自动回复。持久化失败全部保持原样。
- resolve 支持稳定 operation_id 的同操作重放；相反决定、错误账号及失效连接不能借重放产生关系。未传 operation_id 的旧调用仍明确拒绝重复处理。
- 拉黑统一隐藏请求/资料/会话，删除双方关系和私聊消息、终止未完成匹配；解除不恢复好友。来源记录与当前连接代际分开。
- 消息必须来自会话实际参与人；read_by 不能越权或重复；图片/音频类型、媒体所有人与发送人一致。
- 公开 getter 都返回独立投影；页面不直接改业务数组、不读写 storage。

## 页面还原范围与批准差异

来源：根 HTML SHA-256 `6c49411c6868b476ff46cedaa9828ee2ccbfe89d5eaa7ea1f739feb2c8018060`，reqSent 801–839、reqReceived 842–972、reqAccepted 975–1014、reqDeclined 1017–1031、chat 1230–1277。

依次还原 sent → received（含首用菜单/回答播放器）→ accepted → declined → chat，每次仅一页施工。页面证据与未解决项放 `docs/ui-restoration/connection-*`。

允许差异：用户实体替代写死人物；只展示真实学生徽章；共同兴趣取交集、无交集显示明确空态；无音频/歌曲显示错误、不造 18 秒音频；Connected 替代无依据 Online；日期来自消息时间；系统安全区与固定滚动骨架；文字免费；固定 Loading 与确认；拒绝文案不能声称已送达的介绍“未分享”。这些均为既有数据/安全约定，不改两份约定。

## 补充字段与消费者

- requests.question_text：发送时的非空文字快照；轻量元数据持久化；send_introduction / complete_coin_spend 写，sent/received 读；迁移只补缺失值。
- relationships.source_request_id / source_match_id：本轮双方同意的来源 ID（二选一或旧资料未提供）；接受事务写；Connection 与 accepted 结果页读。单向旧同意经本次双方明确同意后更新时间与来源，不推断其他请求已获接受。
- Connection.connection_id：双方同意记录 ID 的排序组合，derived；connection_by_user / connection_by_id / connections 读取。source_request_id、source_match_id 在旧数据无法唯一判定时为 null，不随意认领旧接受结果。
- Connection.shared_interests：双方 interest_ids 交集，derived；accepted 的 YOU BOTH LIKE 消费。无交集显示实际空态，不复制对方全部兴趣。
- ConnectionRequest.direction、can_accept/can_decline/can_cancel、connection_id、conversation_id：当前账号权限/状态投影；request_detail、请求页和跨页回归消费；无独立持久化布尔值。
- Conversation.connection_id、created_at、updated_at、last_message、preview、unread_count：关系与消息派生；当前会话列表、聊天、Home/详情入口和未读状态消费。kind=group 保持原活动成员授权模型。
- Conversation.can_call / call_blocker：双方现有 allow_video 设置派生；聊天入口与等待页共同守卫，任一方关闭都不启动等待计时，但保留合法文字会话。

方向同意、请求与媒体新增归属/来源校验；私聊 read_by 必须属于双方，不能重复。认证过期禁止新连接但允许拒绝和既有会话。异步媒体读取、语音消费及 Blob 保存消费页面取消 token，离开不继续发送/扣费；已写入但未发布的 Blob 被补偿删除。

## 验收边界

实施提交、逐页来源图、浏览器叠图、iPhone 17 Pro 的真实 WKWebView 截图均保留。最终专项结果见 [专项验收记录](./cimoa-connection-core-acceptance.md)，以本轮报告为准。报告只覆盖三类实体与本次关联五页、既有入口依赖回归，不表示全 App 其他页面像素验收或真实支付/实时音视频服务已经完成。
