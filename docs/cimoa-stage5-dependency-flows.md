# 阶段 5：破冰、Auto Match、权限、金币、认证与系统状态

本轮按 `CIRCA All Screens (interactive).html` 恢复指定页面。独立 Vue / uni-app H5 已打包进 `ios/cimoaNeapo`，没有嵌入或运行原型 HTML。业务数据只来自 Pinia Store/IndexedDB；普通浏览器与 iPhone 17 Pro `WKWebView` 使用同一构建产物。

## 页面和真实能力边界

| 流程 | 已实现范围 | 不能伪造的边界 |
| --- | --- | --- |
| 破冰与连接 | 人物详情 → 问题 → 免费文字或真实录音 → 预览 → 原子发送 → sent/received → 接受或拒绝 → 连接与聊天 | 浏览器没有麦克风设备时明确报错；实体麦克风成功路径仍需具备输入设备实测 |
| Auto Match | 偏好、入池、搜索、暂停、结果、等待、历史、超时、无结果、通过与连接状态 | 未配置 matching service；生产入池明确失败，结果只接受校验通过的 service event |
| 权限 | 相机/麦克风使用说明、真实状态、真实系统请求、设置入口 | 不把浏览器或模拟器无设备当作授权成功 |
| 金币消费 | 语音 10 coins、Priority Match 20 coins 的处理中/失败页；账本与业务结果单事务、幂等重试 | StoreKit/匹配服务/媒体缺失时余额不变，不假成功 |
| Profile | 匹配偏好、学生认证状态、重新认证说明与失败边界 | 固定码 `009789` 只验证本地账号；大学认证服务未配置 |
| 系统状态 | Loading、Offline、Error、Maintenance、Empty、Permission Denied、Session Expired | 离线不提交；会话失效真实清会话并回 Welcome |

## interaction_ids 十字段契约

每行包含 ID、来源、触发、前置、可见反馈、成功、失败、持久化、同步范围和可复现验收。

| interaction_id / source_screen | trigger / preconditions | visible_feedback / success_result | failure_result | persistence / sync_scope / acceptance |
| --- | --- | --- | --- | --- |
| `expanded.sayHi.click.1`, `ibSelect.q.pick.click.1`, `ibSelect.answerGo.click.1` / Profile、Icebreaker Select | 点击；已登录且目标可见；已有双向关系与可用 direct conversation 时底部 CTA 显示 Chat，否则显示 Send shot 并继续校验学生状态及 pending request | Chat 只按 Store 中既有 `conversation_id` 进入聊天且不写数据；Send shot 进入问题选择，后续 400–600ms Loading 后以 `user_id/question_id/mode/operation_id` 保存 Store draft | 会话失效不创建替代会话；无介绍资格、实体过期或写失败留在原页且无请求/扣币 | conversation/request local metadata；Profile/Chat/Discover；从聊天打开资料时 Chat 返回原会话而不重复堆栈，其他来源进入同一聊天详情 |
| `ibText.continueText.click.1` / Text Reply | 点击；草稿归当前账号、回答非空 | Loading 先显示；免费原子创建 pending request，进入 Sent | 取消、存储失败、重复请求时保留草稿且账本不变 | draft + request + operation receipt；Home/Connections；刷新或导航失败可由 `completed_request_id` 恢复结果 |
| `ibText.switchToVoice.click.1`, `ibVoice.toggleRecording.click.1`, `ibVoice.reviewVoice.click.1` / Voice | 点击；真实 microphone、当前草稿 | 系统权限/录音状态；停止后真实 Blob 写 IndexedDB，元数据进 Store，再进入 Preview | denied/no-device/encode/storage 失败明确报错，不创建媒体元数据或扣币 | IndexedDB Blob + metadata；Preview/Sent；离页停止 tracks/timer，刷新从稳定 media_id 读取 |
| `ibPreview.continueVoice.click.1`, `ibPreview.deleteVoice.click.1` / Voice Preview | 点击；可播放的 owned audio、余额至少 10 | 确认/Loading；创建稳定 coin context 或删除未引用 Blob | 不足、媒体丢失、写失败保留原状态 | draft/media；Coins/Requests；删除补偿、重复提交幂等 |
| `coinSpend.processing.callback.1`, `coinSpendFailed.retrySpend.click.1` / Coin Processing/Failed | 页面 ready 或点击；owned coin context | 400–600ms Loading；语音请求与 -10 或 priority 与 -20 同事务，成功去业务结果页 | 任一步失败余额/请求/priority 全不变；失败页保留真实草稿并可重试 | ledger + request/match + operation receipt；Profile balance/History/源流程；刷新不会二次扣币 |
| `reqReceived.acceptInvite.click.1`, `reqReceived.declineInvite.click.1` / Request Detail | 点击/确认；请求仍 pending 且当前账号是收件人 | 自定义确认、Loading；接受创建双向关系与私聊，拒绝进入 Declined | 取消、过期、存储失败保持 pending | request/relationship/conversation；Home/Chat/Profile；刷新后相同状态且重复操作失败 |
| `amEntry.openPrefs.click.1`, `amPrefs.savePrefs.click.1`, `editPrefs.savePrefs.click.1` / Auto Match/Profile Preferences | 点击；当前账号有效、范围合法 | 编辑态；Loading 后保存同一 `match_preferences` | 验证/存储失败原值不变 | local metadata；Auto Match/Profile；浏览器重开与 Store rehydrate 值一致 |
| `amEntry.joinPool.click.1` / Auto Match Entry | 点击；学生资格、隐私允许、无 active match | Loading；仅 service configured 时创建 session 并消费 UTC 日配额/超额 10 coins | 当前无服务显示 `not configured`，不创建 session、不扣次数/金币 | match/quota/ledger；Home/History；本地失败与测试可信事件分别覆盖 |
| `amSearching.pauseQueue.click.1`, `amPaused.resumeQueue.click.1`, `amSearching.askLeave.click.1` / Searching/Paused | 点击/确认；session 状态仍匹配 | Loading；合法 searching↔paused 或 left | 过期、连点、写失败维持旧状态 | match session；Home status/History；返回和刷新显示同一状态 |
| `amFound.connectAsk.click.1`, `amFound.passMatch.click.1`, `amWaiting.cancelRequest.click.1` / Found/Waiting | 点击/确认；可信 found、未过 45 秒 | Loading；self accept 后等待可信 peer event，或 passed/left | 无法本地伪造 connected；过期/事件不可信不建关系 | match/relationship/conversation；Home/Chat/History；状态机与可信事件测试覆盖 |
| `amSearching.openBoost.click.1` / Priority confirmation | 点击/确认；searching/paused、尚无有效 priority、余额至少 20 | 自定义确认 → Coins Processing；成功设置精确 15 分钟 priority | 余额/服务/状态/写入失败不扣币 | match + ledger + receipt；Searching/Home/History；重复 operation 不二次扣币 |
| `permCamera.allowPhotos.click.1`, `permMic.allowMic.click.1` / Pre-Permission | 点击；安全上下文且系统 API/宿主可用 | 真实系统请求；granted 后返回原页面，轨道立即释放 | denied/no-device/unavailable 显示原始分类与 Settings 入口 | none；Profile/Voice；浏览器无设备和 WK bridge 状态分别验证 |
| `verified.openReverify.click.1`, `reverify.goVerEmail.click.1` / Verification/Reverify | 点击；当前账号有效 | 展示学生状态与本地码区别；联系服务时 Loading | 服务未配置明确失败，用户 verification_status 不变 | none（当前失败）；Discover/Auto Match/新请求权限；前后 Store 深度一致 |
| `sysOffline.goBack.click.1`, `sysError.goBack.click.1` / Offline/Error | 点击；失败上下文存在 | 在线时只重试/返回原目标；离线仍在原页提示 | 不重复业务写入，不假网络成功 | none；来源流程；在线/离线分支与回退路由验证 |
| `sysPermDenied.goBack.click.1`, `sysSessionExpired.goLoginFresh.click.1` / Permission/Session | 点击；真实系统状态或会话已失效 | Settings 由宿主打开；Session 显示 Loading 后清会话并 relaunch Welcome | 宿主不可用明确报错；清会话失败不跳转 | session only；所有受保护页；不泄露上一账号私有页面 |

## 验收结果（2026-10-14）

- 非浏览器自动化：100/100 通过。覆盖免费文字零账本、语音/优先匹配原子扣币、幂等、可信匹配事件、偏好迁移、权限轨道释放、认证服务失败无写入。
- 普通浏览器：固定账号登录、Auto Match 无服务失败、偏好保存刷新、免费文字请求到 Sent、收到请求拒绝、拉黑跨页过滤、相机/麦克风无设备、Profile 偏好/认证、金币缺失上下文、Offline/Maintenance/Session Expired 均实测。同一环境无麦克风设备时显示 `No microphone was found.`，没有扣币。
- iPhone 17 Pro Simulator（iOS 26.5）：`cimoaNeapo` 完整 `HostTests` 11/11 通过；新增用例覆盖文字请求、偏好、认证/匹配失败边界、权限说明、金币失败和系统状态，完整套件继续覆盖安全区、三 Tab、键盘输入、媒体刷新、后台文档重载与原生桥接。
- 强制校验：`check:conventions`、`git diff --check`、`build:h5` 通过；H5 316 个文件已重新打包进 iOS Resources。

## 尚不能标记 verified 的依赖

- 真实 Auto Match 服务与可信事件通道未配置，所以搜索→结果→双方接受的生产成功路径只完成本地状态机和测试事件验收。
- 大学认证服务未配置；重新认证只完成真实失败路径。
- 当前浏览器测试环境没有麦克风设备；实体麦克风的系统授权、录音及后台中断仍需在有输入设备的运行环境补测。相机同理保留实体设备拍摄验收。
- 以上页面登记为 `local_acceptance: passed`、`full_acceptance: pending`，不冒充 `verified`。免费文字、Store 状态机和包内 WKWebView 已完成，但所属完整依赖组仍等待这些生产能力。
