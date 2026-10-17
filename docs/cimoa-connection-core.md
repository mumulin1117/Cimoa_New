# ConnectionRequest、Connection、Conversation

## 数据边界

ConnectionRequest 持久化在 `requests`：双方 ID、问题 ID、发送时的 `question_text` 快照、文字或原音频 ID、创建/处理时间、pending / accepted / declined / cancelled。问题修改不改写历史邀请；旧记录 hydration 时仅补缺少的快照，不写磁盘、不覆盖用户内容。发送文字免费，语音仍为 10 coins。

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

当前记录仅说明设计与实施范围，不作为视觉或全项目验收通过证明。
