# Discover 完整请求流程

本轮范围：photo → expanded → ibSelect → ibText / ibVoice → ibPreview → reqSent；对方账号从 Home 收到同一 request_id 后接受/拒绝，接受后从 Home/他人主页进入同一会话。不把发送成功等同双方连接。已有请求/聊天五页复用前轮还原，不再复制。

## 数据设计补充（阶段 2/3）

- `introduction_context(user_id, draft_id?)` 为只读派生，组合公开人物、本人草稿、目标当前问题、本人音频、余额与请求/连接/匹配；无独立存储。主卡和详情使用同一 primary 决策：连接→Chat，pending→对应 sent/received，匹配邀请→同一 match_id，否则 Send shot。
- `drafts.payload.question_id / mode / text / audio_id / operation_id / completed_request_id`：原 drafts 表、当前 owner + target；轻量元数据。文本限制 300，与源稿和发送 action 一致；音频只保存媒体 ID，Blob 在 IndexedDB。问题必须仍属于该目标。发送时 request.question_text 快照不随后续改题变化。
- 选择/打开页只读；继续选题通过专属 action 保存并复用未完成草稿，保留稳定 operation_id；文本编辑完成后经 500ms 自定义 Loading 保存，发送失败保留输入。刷新恢复已保存草稿，不假称未落盘输入已保存。
- 保存录音时媒体元数据与 introduction draft.audio_id 同事务；失败清理未发布 Blob。删除音频同时去除草稿引用；被请求/消息使用的音频不删除。切换模式不删除已保存文字/音频。
- 文字免费且零余额可发送，无零金额流水。语音先试听/确认 10 coins，再复用 complete_coin_spend 原子落请求与账本；余额不足保留 user/question/audio/draft 返回上下文，不伪造购买成功。
- 账号、拉黑、资格、问题、余额在提交时二次校验；取消与卸载结束任务，导航不写业务状态。解除拉黑不恢复请求/好友。

## 顺序和验收

每次仅一个页面 in_progress。按 Discover、他人主页、选题、文字、语音、预览依次锁定来源、差异审计、实现、浏览器/WKWebView 取证、三项校验和本地专项提交；依赖待回归时 pending，最终完整链路回归后才 verified。两份约定不修改，不 push。完整证据在 `docs/ui-restoration/discover-request-*`。
