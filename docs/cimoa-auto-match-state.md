# Auto Match 状态与恢复契约

本轮遵循独立 H5 → 包内 WKWebView、本地账号、UTC 配额与双方显式同意范围，不修改两份约定。原 HTML 1460–1915 为十一页来源；确认/选择 Sheet 随首用页锁定。当前页面不以旧通用 Flow UI 为设计依据。

## 字段与唯一状态

- `match_sessions.match_id/owner_user_id/candidate_id`：稳定关联；只由 Store action 创建/改变。`status` 保留 searching/paused/found/waiting/connected/passed/expired/no_match/left。
- `created_at/started_at/search_ready_at/search_remaining_ms/expires_at/paused_at/resolved_at/priority_until`：毫秒时间戳或明确 null；搜索暂停保存剩余毫秒，恢复同一 ID 不消耗第二次配额。优先截止时间不因暂停、刷新或后台而延长。
- `engine=device` 使用既有本机候选排序与持久化9秒搜索准备期；Priority 将剩余准备期最多缩至5秒。UI timer 只读时钟。到期可派生 found/no_match/expired，不产生对方同意。
- found 的45秒窗口从固定 search_ready_at/可信 found 事件时间计算。waiting 表示本人已显式邀请；原稿明确请求离屏仍有效，因此不把 found 的截止时间误用于 waiting，只有对方接受/拒绝或本人取消才结束等待。
- `preference_snapshot`：本轮实际使用偏好。未到候选展示的 searching/paused 保存偏好时原子重算候选、保留剩余期限；已经展示/发送的候选不被后台换人。旧记录缺快照按原字段兼容读取，不补造已发生事件。
- `search_revision/last_event_sequence`：可选增量版本；新会话记录版本，携带版本的服务事件必须匹配；旧可信适配器不含版本时仍受状态/账号/候选校验。
- match getter/Home/history/Discover 使用同一有效状态投影。每个状态都有唯一恢复路由；不匹配的旧 URL 只替换到当前结果，不重开会话、不重置时钟、不收费。

## 迁移与操作

searching → paused / found / no_match / left；paused → searching / left；found → waiting / passed / expired / left；waiting → connected / passed / left。connected 必须有双方 consent 和可访问会话。终态不可恢复为 searching；再次匹配从 Entry 明确费用后新建 ID。Not Now/返回 Home 不撤销等待，确认取消才 left。进入 See options 是只读视图，不修改真实 searching。

`start_match` 幂等提交会话、UTC日期配额或10币流水；`boost_match`/既有消费确认上下文原子提交20币与15分钟截止。失败回滚全部状态。异步服务事件验证完再次检查原账号、有效状态、版本/序号及候选；取消的任务不得落账。

偏好只保存源字段和兼容既有字段，合法区间/枚举/兴趣ID校验。原稿 Distance 的100+km视为无限制。用户于本轮授权生成区域距离数据：`match_distances` 保存大学间对称距离表、稳定ID和 `generated_campus_region` 来源；种子创建和旧数据迁移只补缺表、不覆盖已保存数据。相同大学为0，同地区按固定区域模型生成，跨区域按超出筛选范围处理。这些值仅供匹配筛选，不请求GPS、不展示为实时位置；未知大学仍明确失败并保留偏好。在线人数不照抄48，入池数据/队列信息来自同一引擎/可信事件，未知显示明确占位。

## 验收顺序

Entry → Preferences → Searching（首用离开/帮助/优先/不足 Sheet）→ Paused → Found（同意/跳过 Sheet）→ Waiting → Connected → Passed → Expired → No Match → History。任何时刻只允许一页 in_progress，各页本地专项提交；完整跨页及原生证据通过后才 verified。仅本地提交，不 push；保留原有注册截图改动。
