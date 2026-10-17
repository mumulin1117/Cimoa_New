# 私聊、媒体与等待通话专项验收

## 来源锁定与差异审计
- 来源：CIRCA All Screens (interactive).html，SHA256 6c49411c6868b476ff46cedaa9828ee2ccbfe89d5eaa7ea1f739feb2c8018060。
- Chat：模板 isChat 第 1230–1277 行，保留既有 header/messages/composer 的几何、图标与文案；Connected 为已授权真实关系替代 Online。
- 通话：isCallActive 第 1315–1359 行的静态背景、返回、双方预览、渐变与挂断 SVG；用户确认仅等待接通，不实现假接通、通话计时、摄像头流或安全连接标识。
- 差异：图片不能全屏看；媒体保存过程中权限失效缺少即时清理；等待页只有单方头像、无来源的解释文案、错误无返回、后台/刷新重置计时。
- 顺序：Chat → Call Waiting。任何时候仅一个 in_progress；依赖未完成前不标 verified。

## 数据设计（阶段 2/3 补齐）
- Conversation/Connection/Message 继续为唯一实体，不复制页面业务数据，不增加自动回复、假已读或远端在线状态。
- 新增 call_sessions：call_id、owner_user_id、participant_id、conversation_id、connection_id、session_expires_at、started_at、expires_at、ended_at。
- 仅显式点击发起通话后经 500ms Loading 原子创建；同会话重复发起复用有效等待；绝对截止 8–12 秒，刷新/后台不延长。
- 超时状态由截止时间推导，无自动业务写入；主动挂断经 500ms Loading 写 ended_at。无 answered/connected 状态。
- 会话过期/换号、连接代际变化、隐私关闭时不得显示私密资料或发起通话。拉黑/注销清理关联 call_sessions。
- 图片/语音保存 IndexedDB，Message 引用 media_id；解码、SHA、持久化全部成功才发布。失败保留预览可重试、回滚临时 Blob；退出/失效停止媒体和撤销 object URL。

## 新增/修正交互契约
| interaction_id | 来源/触发 | 前置 | 输入 | Loading | 写入 | 成功 | 失败 | 返回 | 恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| chat.image.open.click.1 | 已授权补齐媒体；点图片 | 当前会话可访问 | message_id | 无 | 无 | 原图预览 | 显示不可用/重试 | 关闭仍本会话 | 从 media_id 读 Blob |
| chat.image.close.click.1 | 图片预览关闭 | 预览打开 | 无 | 无 | 无 | 关闭并释放资源 | 无 | 不改路由 | 刷新默认关闭 |
| chat.startCall.click.1 | Chat 原稿视频按钮 | 双向连接+双方视频隐私 | conversation_id | 500ms | call_sessions 原子创建/复用 | 跳等待页携 call_id | 留聊天并展示错误 | 同一会话 | 固定 deadline |
| callActive.endCall.click.1 | 原稿红色挂断 | 等待存在且属于当前登录 | call_id | 500ms | ended_at | 只返回一次 | 可重试，不假成功 | 精确 conversation_id | 已挂断不复活 |
| callActive.goBack.click.1 | 原稿 Back/错误态 | 页面可见 | call_id | 有效等待同挂断，否则无 | 同挂断/无 | 返回 | 留页错误 | 精确会话；无效 ID 回 Home | 不创建通话 |

## 验收状态
- status: in_progress（Chat）
- visual_acceptance: pending
- domain/browser/WKWebView: pending
- 本任务仅本地提交，不推送；保留原有 registration 截图改动。
