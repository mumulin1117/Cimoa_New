# Cimoa 阶段三：全量测试数据

Pinia seed 已覆盖原型默认、空、长列表、关系、聊天、事件、金币和安全状态。

- Apple review account: `Hottix@gmail.com` / `123456` / display name `Hottix`.
- 4 个其他用户：Maya、Jordan、Liam、Chloe；Hottix 与前三人互相关注，Chloe 为无关系候选。
- 3 个会话，每个会话 3 条消息，且参与者与 Hottix 互相关注。
- 4 个事件，包含已参加、未参加、多类别和图片资源。
- 2 个帖子与 3 条评论；每个帖子的 `comment_count` 与实际 comments 数量一致。
- 金币流水先充值 300，再消费 20 和 10，余额为 270；后续成功充值/消费均由 Store action 更新 `balance_after`。
- 被拉黑、举报、离线、权限拒绝、会话过期等状态由页面路由和 Store 字段覆盖，未创建页面级业务数组。
- 所有头像、事件图片、歌曲封面和金币图为 `static/assets` 中的稳定本地资源。
