# Cimoa 阶段二数据字段与状态契约

状态：completed（字段与 action 契约）。2026-10-13 用户已确认 UTC 零点重置。唯一业务调用链为页面 → Pinia Store → 持久化适配器；本阶段定义设计，阶段 3 的 seed/action 与测试通过后才能宣称数据层可用。以下同一行列出的字段共享来源、保存策略和 action，复合字段的子项在括号内展开。

## 持久化与公共字段

所有集合是 Store state；轻量记录持久化类型为 local_storage_metadata，默认枚举/选项为 store_seed；媒体二进制为 indexed_db_blob，getter/统计为 derived。schema_version 为整数，revision 为递增整数，updated_at 为毫秒时间戳；单次业务操作克隆 next state，验证后一次保存再发布，失败保持旧 revision。

每个记录必填唯一 ID 和必要 owner_user_id；created_at/updated_at 使用毫秒数。账号不能共享关系、草稿、账本、配额和安全记录。以下 nullable 字段没有有效资源/结果时为 null，不用假的成功值。

## 字段表

| entity | field_name | type / required / default | source_screen | relation | persistence | write_action |
| --- | --- | --- | --- | --- | --- | --- |
| accounts | account_id, user_id | string / 必填 / seed | login, profile | users.user_id | local_storage_metadata | create_account |
| accounts | email | string / 必填 / 唯一小写 | login, signup | none | local_storage_metadata | create_account |
| accounts | credential_hash | string / 必填 / 测试身份摘要 | login, delFinal | account_id | local_storage_metadata | create_account, reset_password |
| accounts | status | active/deleted / active | login, delSuccess | none | local_storage_metadata | delete_account |
| accounts | auth_provider | fixture/service / fixture | login, signup | none | store_seed | create_account |
| session | current_user_id, account_id | string/null / null | 全部受保护页面 | users, accounts | local_storage_metadata | login, logout |
| session | expires_at | number/null / null | sysSessionExpired | none | local_storage_metadata | login, logout |
| users | user_id, user_name | string / 必填 | profile, expanded, reqReceived, amFound | none | local_storage_metadata | update_profile |
| users | age, height_cm | number/null | 同上 | none | local_storage_metadata | update_profile |
| users | university, major, mbti, country, degree, year, graduation_year | string/null | 详情、onboarding、editAll | none | local_storage_metadata | update_profile |
| users | gender, pronouns, languages, clubs, religion, drinking, smoking, location | string/array/null | onboarding, editAll | none | local_storage_metadata | update_profile |
| users | bio, bio_font, bio_audio_id | string/string/nullable ID | editAll, expanded | media_files | local_storage_metadata | update_profile |
| users | avatar_url, photo_ids | string/ID[] / 本地资源与照片表 | profile, photo, editPhotos | profile_photos | local_storage_metadata | save_profile_photos |
| users | goal_ids, interest_ids, icebreaker_ids, song_id | ID[]/nullable ID | profile, expanded, ibSelect | 对应选项/问题/歌曲表 | local_storage_metadata | update_profile |
| users | verification_status | verified/required/expired/deleted | verified, reverify | accounts | local_storage_metadata | apply_verification |
| goals / interests | item_id, label, emoji | string / 必填 | 原型目标/兴趣标签 | users 的 ID 数组 | store_seed | derived |
| icebreakers | question_id, user_id, text, position | string/string/string/number | ibSelect, editIce | users | local_storage_metadata | save_icebreakers |
| profile_photos | photo_id, user_id, media_url, position | ID/ID/string/number | photo, editPhotos | users, media_files | local_storage_metadata | save_profile_photos |
| songs | song_id, title, artist, cover_url, audio_id | string/nullable audio_id | 歌曲卡/选择器 | media_files | store_seed | derived |
| media_files | media_id, owner_user_id, kind, media_url, mime, duration_ms, byte_size | string/string/image或audio/string/string/number/number | 头像、相册、语音 | IndexedDB 中同一 media_id | local_storage_metadata | save_media |
| media_blob | media_id, blob | string/Blob | 同上 | media_files | indexed_db_blob | save_media |
| relationships | relationship_id, from_user_id, to_user_id, created_at | ID/ID/ID/number / 有效方向边 | Home, Chat, reqAccepted | users | local_storage_metadata | accept_request, apply_match_event |
| requests | request_id, sender_id, recipient_id, question_id | string / 必填 | reqSent, reqReceived | users, icebreakers | local_storage_metadata | send_introduction |
| requests | kind, text, audio_id | text或voice/string/nullable ID | ibText, ibPreview | media_files | local_storage_metadata | send_introduction |
| requests | status, created_at, resolved_at | pending/accepted/declined/cancelled; number; nullable number | 请求各状态 | none | local_storage_metadata | accept_request, decline_request, cancel_request |
| match_sessions | match_id, owner_user_id, candidate_id | string/string/nullable ID | Home, amFound, amHistory | users | local_storage_metadata | start_match, apply_match_event |
| match_sessions | status | searching/paused/found/waiting/connected/passed/expired/no_match/left | Auto Match 全流程 | none | local_storage_metadata | transition_match |
| match_sessions | started_at, expires_at, paused_at, priority_until, created_at | number/nullable number | 倒计时、优先匹配 | none | local_storage_metadata | start_match, transition_match, boost_match |
| match_sessions | self_accepted, peer_accepted, queue_position | boolean/boolean/number | amWaiting, amConnected | candidate_id | local_storage_metadata | apply_match_event |
| match_preferences | owner_user_id, age_min, age_max, height_min, height_max, distance_max | string/number | amPrefs | users | local_storage_metadata | update_match_preferences |
| match_preferences | university, major, gender, religion, drinking, mbti, language, goal_id, interest_ids | string/ID[] | amPrefs | users, goals, interests | local_storage_metadata | update_match_preferences |
| match_quota | owner_user_id, date_key, used_count | string/YYYY-MM-DD/nonnegative integer | Home 配额, amEntry | users | local_storage_metadata | start_match |
| quota_policy | timezone, free_daily_limit, standard_cost | literal UTC; 3; 10 | amEntry | none | store_seed | derived |
| events | event_id, organizer_id, title, description, image_url | string / 必填 | events, evDetail | organizers | store_seed | derived |
| events | starts_at, ends_at, capacity, university, category, price | number/number/integer/string/string/number | 列表筛选、My Events | none | store_seed | derived |
| events | location, address, latitude, longitude, schedule, notes, accessibility, weather_plan | string/nullable number/array | evDetail, evLocation | none | store_seed | derived |
| organizers | organizer_id, name, avatar_url, description, update_text | string | evOrganizer, evDetail | events | store_seed | derived |
| memberships | membership_id, event_id, user_id, status, joined_at | ID/ID/ID/joined或left/number | evParticipants, evUpcoming | events, users | local_storage_metadata | join_event, leave_event |
| event_preferences | owner_user_id, filters, saved_event_ids, reminder_by_event | ID/object/ID[]/object | evFilterSheet, evReminder | events | local_storage_metadata | update_event_preferences |
| conversations | conversation_id, participant_ids, kind, event_id | ID/ID[]/direct或group/nullable ID | chat, evGroup | users, events | local_storage_metadata | accept_request, join_event |
| messages | message_id, conversation_id, sender_id, kind, body, media_id, sent_at, read_by | ID/ID/ID/text或image或audio/string/nullable ID/number/ID[] | chat, evGroup | conversations, users, media_files | local_storage_metadata | send_message, mark_read |
| coin_packages | package_id, coins, price, product_id, badge, image_url | string/integer/string/null/string/string | coinStore | product_id 待真实提供 | store_seed | derived |
| coin_transactions | transaction_id, owner_user_id, business_key, kind, amount, status, created_at, related_id | ID/ID/string/purchase或spend或refund/signed integer/completed或failed或cancelled/number/nullable ID | History / 余额 | requests/matches/purchases | local_storage_metadata | send_introduction, start_match, boost_match, settle_purchase |
| purchase_requests | request_id, owner_user_id, package_id, status, receipt_id, created_at | ID/ID/ID/pending或success或failure或cancelled或timeout/nullable ID/number | coinPurchasing 等 | coin_packages | local_storage_metadata | begin_purchase, settle_purchase |
| settings | owner_user_id, notifications, privacy, language | ID/object/object/en-US | setNotif, setPrivacy, setLang | users | local_storage_metadata | update_settings |
| permissions | owner_user_id, camera, microphone, photos, notifications, location | ID/unknown或granted或denied或unavailable | perm*, setPerm | 真实设备权限 | derived | refresh_permissions |
| blocked_users | block_id, owner_user_id, user_id, created_at | ID/ID/ID/number | blockedList, safety | users | local_storage_metadata | block_user, unblock_user |
| reports | report_id, owner_user_id, target_type, target_id, reason, description, status, created_at | ID/ID/user或event/ID/string/string/local_saved或submitted或resolved/number | safetyReport, evReport, reportsSubmitted | users/events | local_storage_metadata | submit_report |
| drafts | draft_id, owner_user_id, kind, target_id, payload, updated_at | ID/ID/string/nullable ID/object/number | editAll, ibText, support, onboarding | users/events | local_storage_metadata | save_draft, discard_draft |
| auth_flow | owner_user_id, step, email, verification_request_id, agreements, profile_draft | nullable ID/string/string/nullable ID/object/object | signup, ver*, fp*, ob* | accounts | local_storage_metadata | save_auth_draft, apply_verification |
| support_requests | support_id, owner_user_id, body, status, external_ticket_id | ID/ID/string/draft或submitted/nullable ID | setSupport | users | local_storage_metadata | submit_support |
| service_state | availability, error_code, retry_context | object/nullable string/nullable object | sys*, 服务失败 | none | derived | service adapter |
| call_session | conversation_id, started_at, ended_at, end_reason | ID/number/nullable number/nullable string | 模拟等待通话 | conversations | derived | begin/end waiting controller |
| legacy_archive | snapshot, captured_at | object/number / 仅迁移时存在 | 旧版存储 | 原样保留旧数据 | local_storage_metadata | hydrate migration |
| operation_receipts | owner_user_id, operation_id, fingerprint, result, created_at | ID/string/string/JSON/number / 同账号操作键唯一 | 介绍、消息、匹配、购买及退款 | 当前账号与对应操作 | local_storage_metadata | 对应事务 action |

## 唯一 getter

current_user、visible_people、home_connections、goals_for_user、request_by_id、match_by_id、active_match、free_matches_remaining、coin_balance、can_chat、current_conversations、messages_for_conversation、visible_events、event_participants、joined_count、my_events、blocked_accounts、current_reports。所有统计按有效记录派生，不额外持久化副本。

Home 关系卡优先由真实双方关系与会话派生，其次邀请和匹配记录，按用户去重；Lina 仅待接收，Liam 是匹配候选，不能为填充聊天列表同时设为朋友。Home 卡片持 user_id、request_id/match_id/conversation_id，不持姓名副本。

## 状态迁移与失败

- 请求：pending → accepted / declined / cancelled；仅接收者可接受/拒绝，仅发送者可撤销；已处理请求不重复写入。接受原子建立两个方向关系和一个会话。
- 匹配：searching ↔ paused；有效候选事件 → found；found → waiting / passed / expired；waiting 需双方确认事件才能 connected；离开 → left；无候选 → no_match。页面 timer 不创建对方接受。
- 配额：以 UTC 生成 YYYY-MM-DD 日期键，同日成功入池 action 递增；UTC 零点后使用新键，保留旧日记录；设备时区变化、刷新和往返导航不影响额度。只有成功原子提交入池时消费免费次数，三次后才扣 10 coins。
- 账本：保留源余额 260 的测试方案为 300 测试充值、20 优先匹配支出、10 语音支出、10 标准超额匹配支出；全部标识 fixture，不伪造商店收据。退款新增对应正数补偿且原扣款仍计入，确保只补一次。
- 报名：joined / left 以 event_id + user_id 唯一；满员/过期/重复加入不增加人数；离开释放名额并即时撤销群聊权限。
- 认证：固定测试账号用 fixture provider；真实验证码/Apple/学生认证未配置时返回 service_unavailable，不创建已认证用户。删除账号验证密码并保留必要的历史实体引用，账号不可再次登录。
- 写失败：保存 next state 失败时运行时仍为原状态，媒体元数据失败清理新 Blob；读取失败展示 error，不当空列表或自动覆盖磁盘。
- 旧版迁移：把旧快照完整保存在 legacy_archive，保留旧账号和用户原创内容；新标准资料只新增新 ID，不覆盖旧姓名/关系。新会话选择固定测试用户；不让旧 Hottix seed 继续充当原型当前人。

## Action 契约和账号隔离

| action 域 | 校验与成功结果 | 失败和重入 |
| --- | --- | --- |
| login / logout / delete_account | 固定 fixture 摘要校验；只有有效账号创建会话；退出清当前会话；删除验证本人密码 | 错误/过期/已删账号不登录；未配置真实服务不伪造成功 |
| update_profile / save_icebreakers / save_profile_photos | 当前账号白名单字段；年龄 18+，合法标签，3 个问题；照片引用已保存 Blob；所有读取同用户的页面同步 | 保留未提交草稿；不接受另一个账号的媒体或写入 ID |
| save_media / send_introduction / send_message | 校验真实 Blob 类型、大小、音频时长和可读性；先存 Blob，再一次提交元数据与业务/账本 | 元数据失败清新 Blob；文本免费；操作键阻止重复发送或扣币；媒体缺失不发空消息 |
| accept_request / decline_request / cancel_request | 校验发送/接收方向、pending、双方未屏蔽；接受一次建立两个方向边和一会话 | 已处理请求不重建关系；导航不创建关系 |
| start_match / transition_match / boost_match | 学生认证有效；同账号仅一个活动队列；UTC 免费额度或费用与队列一次提交；优先截止时间 now+900000 | 服务不可用不入池；接受对方事件须可信适配器；重复 operation_id 不重复消费；无页面计时假接受 |
| join_event / leave_event / update_event_preferences | 活动未结束、未满且未重复；报名与群聊权限同源；时间/容量从实体派生 | 失败人数不变；退出仅当前成员；低交互收藏仍处理写失败 |
| begin_purchase / settle_purchase / apply_refund | 请求绑定账号、套餐；仅可信回调确认 product_id/receipt_id 才增加一次；退款引用原有效扣款并补一次 | 缺 handler 等完整 8000ms；取消/失败/超时无金币；迟到/重复/错账号回调拒绝 |
| block_user / unblock_user / submit_report | 当前 owner 范围；举报真实实体，可选屏蔽同事务；本地状态只能 local_saved | 失败无半条举报/屏蔽；不造客服处理进度；解除不创建关系 |
| save_draft / save_auth_draft / update_settings | owner 与当前会话绑定；仅可读自己草稿/安全记录/账本；隐私 getter 按访问者过滤 | 切换账号不可显示旧账号内容；不保存密码、验证码或媒体本体 |
| create_account / reset_password / apply_verification / submit_support | 真实服务成功结果通过适配器返回；测试通过独立注入适配器覆盖 | 未配置明确 unavailable；无“邮件已发送/客服已接单”假反馈 |

## 迁移与恢复

v2 使用新存储键，原 v1 键不删除。首次读取保留完整 legacy_archive（所有旧用户、帖子、消息与未知字段），只在一次成功业务写入后连同 v2 一次落盘。首次 hydration 本身不写磁盘、不显示虚假加载流程。

旧模板默认值不覆盖详情基准。当前用户相对 v1 默认值的明确资料改动复制到同一固定测试账号（姓名、简介、大学、专业、头像）；旧账号邮箱不替换固定登录邮箱。新增旧账本交易按原金额转换为 migration 记录并保留原记录 ID，不伪造 IAP 收据；缺有效金额/余额不一致则拒绝迁移并保留旧存储，不能自行归零。非当前人的旧记录及被移除产品域保持在只读恢复 getter 中，不自动合并到 Chloe/Liam/Lina。

同账号可通过恢复 getter 读取完整归档；不能从别的账号读取。恢复导出包含旧业务数据，不含新版 credential_hash。后续用户主动选择导入时仍须验证目标实体，不隐式覆盖新资料。v2 同版本有效快照完整恢复；未知版本或损坏快照进入错误态，不自动重建覆盖。
