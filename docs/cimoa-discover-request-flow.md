# Discover 完整请求流程

本轮范围：photo → expanded → ibSelect → ibText / ibVoice → ibPreview → reqSent；对方账号从 Home 收到同一 request_id 后接受/拒绝，接受后从 Home/他人主页进入同一会话。不把发送成功等同双方连接。已有请求/聊天五页复用前轮还原，不再复制。

2026-10-20 用户授权覆盖本文件旧免费/可点击 pending 规则：[专项契约与证据](./ui-restoration/introduction-payment-2026-10-20/source-contract.json)。文字与语音均明确确认 10 coins，复用 complete_coin_spend；pending 发送 CTA 为灰色禁用 Waiting for reply，Home 仍可查看请求；录音页明确 Review voice introduction 后进入独立 Voice preview。下文旧轮次证据按生成时规则保留，不作为本次计费证明。

## 数据设计补充（阶段 2/3）

- `introduction_context(user_id, draft_id?)` 为只读派生，组合公开人物、本人草稿、目标当前问题、本人音频、余额与请求/连接/匹配；无独立存储。主卡和详情使用同一 primary 决策：连接→Chat，pending→对应 sent/received，匹配邀请→同一 match_id，否则 Send shot。
- `drafts.payload.question_id / mode / text / audio_id / operation_id / completed_request_id`：原 drafts 表、当前 owner + target；轻量元数据。文本限制 300，与源稿和发送 action 一致；音频只保存媒体 ID，Blob 在 IndexedDB。问题必须仍属于该目标。发送时 request.question_text 快照不随后续改题变化。
- 选择/打开页只读；继续选题通过 prepare_introduction 保存并复用未完成草稿，保留稳定 operation_id；文本输入停顿 800ms 后经 500ms 自定义 Loading 调用 update_introduction_draft，返回/切换模式也保存，发送失败保留输入。刷新恢复已保存草稿，不假称未落盘输入已保存。
- 保存录音时媒体元数据与 introduction draft.audio_id 同事务；失败清理未发布 Blob。删除音频同时去除草稿引用；被请求/消息使用的音频不删除。切换模式不删除已保存文字/音频。
- 文字与语音各 10 coins，文字确认/语音试听确认后复用 complete_coin_spend 原子落请求与账本；余额不足保留 user/question/text/audio/draft 返回上下文，不伪造购买成功。历史免费请求不补扣。
- 账号、拉黑、资格、问题、余额在提交时二次校验；取消与卸载结束任务，导航不写业务状态。解除拉黑不恢复请求/好友。
- prepare_voice_introduction_spend 再校验本人草稿/目标/问题/音频与余额，仅建立稳定 coin_spend 上下文，不先扣款。payload.draft_audio_id 绑定本次已确认音频，complete_coin_spend 在事务内拒绝已换录音或跨草稿上下文；旧没有此可选字段的记录保留兼容，但仍验证同一 owner/target/question。
- purchase_requests.return_context_id 为可选、当前账号 introduction 草稿引用，begin_purchase 写入并验证。金币中心、购买处理中/失败重试/取消/已验证结果依同一引用返回中心/预览，刷新不丢目标、问题和音频。成功页面只按原有真实收据规则显示，不因新增返回引用放宽支付验证。
- 共享 EventConfirmDialog 只新增可选 corner slot，用来把确认页的 Close 放在面板角而非可裁切滚动内容里；未提供该 slot 的消费者默认 DOM/样式不变。消费者包括 events detail/group、settings blocked、connections received、auto-match searching、messages index/chat、Discover profile，以及 EvJoin/EvCancel/Onboarding/Agreement/Safety Sheet 组件，纳入既有集成及专项回归。
- 六页根节点继承源模板第 42 行字体抗锯齿，而不改变其他模块全局样式。17/22 设计字号换算向下保留三位 rpx，避免 uni-app 转 rem 后跨越系统字体的光学字号边界；参考视口差异小于 0.001 设计像素。文字输入保留原 textarea 默认 2 设计像素内边距与占位色，丢弃录音恢复原底部 Sheet 的两颗纵向按钮和 Keep Recording 文案。

## 顺序和验收

每次仅一个页面 in_progress。按 Discover、他人主页、选题、文字、语音、预览依次锁定来源、差异审计、实现、浏览器/WKWebView 取证、三项校验和本地专项提交；依赖待回归时 pending，最终完整链路回归后才 verified。两份约定不修改，不 push。完整证据在 `docs/ui-restoration/discover-request-*`。
