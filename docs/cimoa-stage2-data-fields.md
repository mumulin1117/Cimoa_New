# Cimoa 阶段二：数据字段与关系

所有字段由 Pinia Store 读取和写入；页面不维护业务副本。持久化字段通过 Store action 调用 `uni` storage，媒体地址使用 `static/assets` 稳定 URL。

| entity | field_name | type | required | source_screen | relation | persistence | write_action |
|---|---|---|---|---|---|---|---|
| session | is_authenticated | boolean | yes | Auth / Log In | current_user_id -> user | local_storage_metadata | login / logout |
| session | current_user_id | string | yes | Auth / Log In | user.user_id | local_storage_metadata | login / logout |
| user | user_id | string | yes | all profile screens | primary key | store_seed | derived |
| user | user_name | string | yes | Profile / Edit | current_user | local_storage_metadata | update_profile |
| user | avatar_url | media URL | no | Profile / Personal | current_user | store_seed | update_profile |
| user | major | string | no | Onboarding / Basic Info | current_user | local_storage_metadata | update_profile |
| relationship | relationship_id | string | yes | Connection / Request | primary key | store_seed | derived |
| relationship | from_user_id | string | yes | Connection | user.user_id | store_seed | derived |
| relationship | to_user_id | string | yes | Discover / Profile | user.user_id | store_seed | toggle_relationship |
| relationship | status | enum | yes | Connection | none/requested/mutual | local_storage_metadata | toggle_relationship |
| event | event_id | string | yes | Events / Explore | primary key | store_seed | derived |
| event | title | string | yes | Events / Detail | none | store_seed | derived |
| event | image_url | media URL | no | Events / Explore | static asset | store_seed | derived |
| event | joined | boolean | yes | Events / Join | current_user_id + event_id | local_storage_metadata | join_event / cancel_event |
| post | post_id | string | yes | Discover / Stories | primary key | store_seed | derived |
| post | liked | boolean | yes | Discover / Stories | current_user_id + post_id | local_storage_metadata | toggle_post_reaction |
| post | saved | boolean | yes | Discover / Stories | current_user_id + post_id | local_storage_metadata | toggle_post_reaction |
| post | comment_count | number | derived | Discover / Stories | comments.post_id | derived | derived |
| comment | comment_id | string | yes | Post / Comments | primary key | local_storage_metadata | add_comment |
| comment | post_id | string | yes | Post / Comments | post.post_id | local_storage_metadata | add_comment |
| conversation | conversation_id | string | yes | Messages / List | primary key | store_seed | derived |
| conversation | participant_id | string | yes | Messages / Chat | user.user_id | store_seed | derived |
| message | message_id | string | yes | Messages / Chat | conversation_id | local_storage_metadata | send_message |
| message | sender_id | string | yes | Messages / Chat | user.user_id | local_storage_metadata | send_message |
| message | body | string | yes | Messages / Chat | conversation_id | local_storage_metadata | send_message |
| coin_transaction | transaction_id | string | yes | Coins / History | primary key | local_storage_metadata | complete_purchase / spend_coins |
| coin_transaction | amount | number | yes | Coins / History | wallet.current_user_id | local_storage_metadata | complete_purchase / spend_coins |
| coin_transaction | balance_after | number | derived | Coins / History | ordered transaction list | derived | derived |
| wallet | coin_balance | number | yes | Wallet / Coin Center | current_user_id | derived | complete_purchase / spend_coins |
| match_queue | status | enum | yes | Auto Match | idle/searching/paused/connected/passed | local_storage_metadata | set_match_status |
| match_preference | distance | string | yes | Auto Match / Preferences | current_user_id | local_storage_metadata | update_match_preferences |
| blocked_user | user_id | string | yes | Safety / User Actions | user.user_id | local_storage_metadata | block_user / unblock_user |
| report | report_id | string | yes | Safety / Report User | primary key | local_storage_metadata | report_user |
| settings | notifications_enabled | boolean | yes | Settings / Notifications | current_user_id | local_storage_metadata | toggle_setting |
| settings | show_online_status | boolean | yes | Settings / Privacy | current_user_id | local_storage_metadata | toggle_setting |

关系方向统一为当前用户 -> 目标用户；`visible_people` 和 `current_conversations` 由 `blocked_user_ids` 派生，评论数量由实际 comments 数组派生，金币余额由成功交易 action 更新。
