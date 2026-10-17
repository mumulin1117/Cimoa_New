# 账号、人物与关系实体统一（2026-10-17）

本次用户要求：移除登录/注册 Apple 功能及 UI；继续固定验证码；导入头像人物并统一账号、会话、注册资料、请求、好友、匹配和拉黑。本记录说明本次用户覆盖的产品行为，两份开发约定未修改，其余 UI 和 Event 内容仍以原 HTML 为来源。

## 账号、会话与资料

- 固定验证码字符串 `009789`；不接受数字 9789、缺前导零、其他六位码或前后空格。只持久化本机验证，不发送邮件，不授予官方学生认证。
- 登录/注册删除 Apple 按钮、图标、分割线、事件及样式；原 HTML 和原始审计里的 Apple 条目只保留来源证据。
- `accounts.account_id → accounts.user_id → users.user_id` 是唯一身份关联。公开资料不复制邮箱或凭据；密码使用独立盐和 PBKDF2 摘要。
- `accountDefaults.js` 统一资料缺省字段、设置、活动/匹配偏好与 30 天会话，注册/引导/登录/升级共用。异步凭据计算期间退出或换账号，旧操作不能重建会话。
- 注册不自动登录、加币或生成好友。固定码与必需资料引导完成后进入 Home，使用同一资料实体，也可由本设备其他账号发现。
- 当前本机业务范围下，完成固定码和资料的账号可介绍、接受邀请、匹配及参与免费活动；学生认证字段仍为 pending，无官方认证徽章。明确过期/失效状态不能借此绕过限制。
- 登录清除上一入口的注册/重置上下文；退出保留账号和资料，私有草稿、设置、金币、举报等按 owner 隔离。

## 头像人物与 Event

26 张 JPG 按 SHA-256 去重为 23 张，原始字节复制到 `static/assets/people/`。来源文件、用户、大小和 hash 见 [资源清单](./cimoa-avatar-assets.json)。导入脚本可重入，不覆盖已变化文件。

新增 Noah、Sophie、Ella、Oliver、Grace、Lucas、Jack、Amelia、Lily、Mia、Isla、Henry、Theo、Finn、Leo、Ava、Archie、Ruby、Freya、Alice、Daisy、Oscar、Max 共 23 位虚构成年校园人物。学业、简介、MBTI、兴趣、目标和独立三个问题是产品测试资料，并非照片中真实人物身份/经历的认定；未知宗教等资料保留不愿披露。配置在 Store 模块 `peopleCatalog.js`，页面不读取业务 JSON。

原有六组 Zane、Linden、Evan、Coco、Anna、Bella 的三张照片、音频和文案完整保留，排在新增人物前。Discover 共 29 位来源人物，另加后续完成资料的账号。新增人物仅展示其一张来源照片，无音频时不补造介绍，不复制图片冒充相册。

保留原型 22 个活动及其封面、时间、内容，新增人物关联至这些活动的报名集合；详情、参与者和群聊按同一个 user_id 读取资料。原 Picnic 三成员及 Badminton 满员场景不变。人数/余位继续沿用可见成员/全部占位口径。

## 单一实体事实

- accounts：凭据、生日、账号状态、本机验证、引导进度；session：当前 account/user 与到期时间。
- users/profile_photos/icebreakers/media_files：公开资料、照片顺序、问题和 IndexedDB 媒体元数据；公开 getter 返回独立视图，修改数组不能间接写入 Store。
- requests：发送者、接收者、目标问题、文字/音频、pending/accepted/declined/cancelled；同一双方最多一条 pending。
- relationships：保留方向同意实体，双方方向齐备才派生好友；不另存好友数组或页面 connected 布尔值。
- match_sessions：owner/candidate、接受依据、状态与截止时间；本机搜索新增 engine=device、search_ready_at、search_remaining_ms、preference_snapshot。
- conversations/messages：同一双方唯一私聊；接受介绍时保留原发送人，将文字或原音频作为第一条消息。
- memberships/blocked_users/drafts/settings/match_quota/coin_transactions：继续按显式用户及 owner 范围持久化。

`relationship_state(user_id)` 派生 none/incoming_request/outgoing_request/matched/connected/blocked/unavailable 及对应 request/match/conversation ID。sent_requests、received_requests、friends、Home、详情、活动参与者和聊天读取同一组事实。

接受请求一次事务更新请求、双向关系、私聊和首条介绍。通过其他入口建立连接时结束同一双方的旧匹配/请求，避免已连接与等待同时出现。拉黑事务删除双方关系与私聊、取消请求并结束未完成匹配；双向过滤一致，解除不重建好友。

接收方只能从自己的请求上下文读取发送者音频，通用媒体编辑 getter 仍隔离账号。新增主键、归属、重复 pending、重复私聊和音频发送人校验；失败原子回滚。

## 本机匹配与双方同意

默认按保存的年龄、身高、学校、专业、性别、语言、兴趣、MBTI 和生活偏好选人，过滤已连接、pending、删除和拉黑人物；没有坐标时不虚构距离/在线人数。仍支持注入可信匹配适配器，明确不可用时保留失败路径。

入池与 UTC 配额原子提交：每日 3 次免费，其后 10 coins。9 秒搜索与 45 秒响应窗口保存绝对截止时间；暂停保存剩余时长，刷新或后台不重置。

Connect 只进入 waiting，不定时制造接受。若对方是同设备另一个账号，切换后 Home 显示同一 match_id 邀请；respond_to_match 校验当前人是 candidate，明确接受才提交双方同意与唯一私聊。头像人物不自动生成登录凭据，不自动回复或接受。

## 新入口契约

`home.openSentRequest.click.1`：点击 Home Sent；前置当前账号发出的 pending 且双方可见；立即打开 `/pages/connections/sent?request_id=…`，无导航 Loading、无写入；失效保留 Home 并报错；持久化来自 requests；同步 Home/详情/发送状态；验收发送后刷新再打开同一请求。

`home.openMatchInvitation.click.1`：点击候选账号 Home Invite；前置 candidate 身份、waiting、self_accepted；立即打开 `/pages/connections/received?match_id=…`，失败留 Home；无写入；同步 match_sessions/关系；验收真实切换对方账号、处理、返回与刷新。

接收/接受/拒绝沿用 reqReceived/reqAccepted/reqDeclined 入口，支持 request_id 或 match_id。匹配邀请展示匹配说明，不冒充破冰回答；错误实体显示可返回错误态。

## 验证

- social-entities.test.mjs 六组：23 图 hash/原六组媒体、getter 独立性、无损升级、双账号实际注册/引导/请求/活动/聊天/拉黑、匹配暂停恢复和对方接受、凭据竞态、接收方音频权限。
- social-entities-browser.test.mjs 三组跨账号 UI 已通过；见 [浏览器证据](./evidence/social-entities/browser-acceptance.json)。隔离浏览器与临时服务在 finally 关闭。
- 登录 5 项、注册 7 项浏览器专项通过；重新生成 393×852 reference/actual/overlay/diff，保留窄屏、安全区和键盘检查。
- 104 项单元测试全部通过；三项门禁按顺序通过，check:conventions 无 warning，H5 打包 369 个文件并同步 iOS 宿主。
- 完整注册到 Home 的浏览器 18 项检查通过，覆盖固定码、真实图片、资料恢复、账号切换、失败回滚、一次骨架与重登；见 [注册回归](./evidence/social-entities/registration-browser-acceptance.json)。
- iPhone 17 Pro / iOS 26.5 的 WKWebView 5/5 通过：Login、Signup、固定码恢复、Discover 牌堆与真实音频、介绍发送和匹配/系统状态入口；见 [原生报告](./evidence/social-entities/wkwebview-acceptance.json)。两份早期失败结果已定位为六人回环断言及旧目录迁移比较问题，修复后最新产物复测通过。
- 本轮仅完成本次范围的验收，不宣称全项目所有页面已重新完整验收。原有 10 张注册截图改动保持原样，不纳入本次提交。
