# Cimoa 阶段二数据字段修正要求

**状态：pending，等待阶段 1 完成。** 旧字段表基于错误的页面结构和伪关系，不能用于本次还原。以下是重新设计时必须关闭的差异，不代表 Store 已重构。

| 当前错误 | 原型及约定要求 | 完成证据 |
| --- | --- | --- |
| Home 从 visible_people 任取三人 | 由联系人、真实关系、邀请和匹配实体派生，不混同 Discover 候选列表 | 每张卡可追溯 user_id、request_id 或 match_id |
| relationship.status 保存 mutual | 两条定向关系派生互相关注，记录 follower_user_id / following_user_id | 每条 DM 会话可验证双方方向关系 |
| 无统一 user_accounts | 登录、当前用户和个人资料均引用同一账号/用户集合 | 固定账号成功、错误密码、删除账号、注册冲突均有状态定义 |
| coin_balance / balance_after 随 action 累加 | 余额与流水后余额按有效交易派生 | 充值在前、消费在后，退款和重复回调不破坏总额 |
| events.joined 和 participant_count | 当前用户参与关系、活动容量、人数从统一成员实体派生 | 重复加入不重复计数、取消后释放名额、群聊权限同步 |
| posts/comments 为原型新增内容 | 本 HTML 没有帖子信息流，不作为 Home / Discover 实体 | 旧持久化数据迁移保留用户创建内容，不静默删除 |
| 单个全局 match 和候选 | 匹配会话含 owner、candidate、状态、基准时间、配额和历史 | Home / Found / Waiting 使用同一 match_id，刷新不重启计时 |
| blocked_user_ids 无所有者 | 拉黑记录按 owner_user_id / user_id 隔离 | 统一过滤资料、邀请、消息、活动参与者与匹配 |
| 页面 query 决定业务真假状态 | query 只传 ID 和返回归属；状态从 Store 派生 | 无 query 伪造连接、余额、参加状态 |
| 无真正媒体引用 | 静态资源本地化；上传媒体 Blob 在 IndexedDB，Store 保存稳定地址 | 头像、语音、歌曲、图片刷新后可解析，缺失明确错误 |

下一步逐字段补齐 `entity / field_name / type / required / source_screen / relation / persistence / write_action`；`persistence` 仅允许规定的四种值。资料和计费决策已确认，字段表完成前仍不得进入全量 seed。

## 已确认的数据约束

- 人物资料唯一基准是对应详情：Chloe / HKUST、Liam / Stanford、Lina / HKU。Home 第三个入口沿用源码 `home.openJordan.click.1` 审计编号，但业务实体是 Lina；Jordan 保留为独立安全/历史人物。
- Home 只持有用户、邀请、匹配和会话引用；名字、年龄、大学、头像、目标从同一用户 getter 派生。接受邀请不复制另一人的资料，不新建页面级用户。
- `introduction_cost('text')` 为派生的 0，任何发送路径都不能新增文本扣币流水；语音 10、优先匹配 20。文本仍需要合法正文和目标用户，不因为免费跳过 Loading、持久化和失败回滚。
- 模拟通话只需要参与者引用、等待开始/结束和结束原因。省略号是临时 UI；不创建“已接通”的虚假远端会话、时长或媒体数据。
- Home 本页验收状态仅属于开发验收清单，不属于业务 Store，不得作为绕过互相关注、余额、媒体存在或请求有效性的运行时开关。

用户信息以当前要求为准：品牌与标题 Cimoa，副标题 Cimoa: Campus Life & New Meet，固定测试账号 `cimoa@gmail.com` / `12341234`。App ID 未提供，不能将 `__UNI__CIMOA` 当作正式 iOS Bundle ID。当前代码尚未应用这些数据修正。
