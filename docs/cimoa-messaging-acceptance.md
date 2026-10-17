# 私聊、媒体与等待通话专项验收（2026-10-17）

## 当前结论
实现已补齐，浏览器及原生已完成部分验收；**完整验收尚未通过，不标记 verified**。
- Chat：status pending，visual_acceptance passed，full_acceptance pending。
- Waiting Call：status pending（依赖 Chat 的完整验收），visual_acceptance passed。
- 阻塞：WKWebView 真实麦克风采集未启动，15 秒后明确报错。macOS system_profiler 仅列出 Mac mini 扬声器，无实际音频输入设备；WebKit 仍枚举一个默认输入。不能把默认输入或浏览器受控音源当作真实录音成功。
- 请接入麦克风/带麦克风耳机后重跑 testDirectChatRealMicrophoneAndCleanup。该用例目前失败，而非跳过或假通过。键盘高度已做浏览器回归；本轮没有宣称重新完成原生系统键盘专项验收。

## 来源与审计
- HTML SHA256：6c49411c6868b476ff46cedaa9828ee2ccbfe89d5eaa7ea1f739feb2c8018060。
- Chat：isChat 1230–1277，保留 source header/messages/composer；Connected 是真实连接状态，不编造 Online。
- Call：isCallActive 1315–1359，恢复静态背景、渐变、返回/举报、双方资料照片、挂断 SVG。
- 用户确认的覆盖规则：只等待；450ms 省略号、8–12s 自动结束。没有 WebRTC、假接通、通话时长、摄像头流或安全连接标识。只有一个居中挂断，原来来电/接通/结束画板的控件不伪装成可用功能。
- 来源、逐项契约与 actual/reference/overlay/diff：
  - [Chat](./ui-restoration/connection-chat/source-contract.json)
  - [Waiting](./ui-restoration/call-waiting/source-contract.json)
  - [Chat interactions](./ui-restoration/connection-chat/interactions.json)
  - [Waiting interactions](./ui-restoration/call-waiting/interactions.json)

## 数据与交互
- Connection/Conversation/Message 继续为唯一来源；不生成自动回复、假已读、假在线或对方接通。
- call_sessions：call_id、owner_user_id、participant_id、conversation_id、connection_id、session_expires_at、started_at、expires_at、ended_at。
- 显式发起经 500ms Loading 后原子创建/复用等待，再导航携精确 ID。绝对截止不因刷新、后台或恢复延长。
- 超时只读派生；主动结束经 500ms Loading 写 ended_at。统一退出锁与定时器清理确保只返回一次；无记录/伪造 ID 显示可返回错误态。
- 退出结束本账号等待；拉黑、注销清关联行。账号/连接代际改变时，异步媒体发送不得发布。
- 图片与音频先真实解码、计算 SHA、写 Blob，元数据/Message 同一事务提交；失败补偿 Blob，保留当前可重试内容。
- 图片支持完整比例预览、关闭及缺失资源 Retry。图片布局完成后按末条消息 ID 定位。
- 麦克风可取消打开；15 秒无响应给出真实错误。取消/卸载取消等待，迟到的 stream 立即 stop，防止遗留录音。
- 隐私/会话失效时关闭媒体、撤销预览，不能暴露旧会话内容。
- 关键约定：Vue3 script setup、uni-app、rpx、theme token、Pinia/工具层唯一写入口、自定义 Loading、受控 ConfirmDialog、真实安全区、原型 cRise、独立 H5（不加载原 HTML）。

## 本轮验证
- 数据/工具层：117/117 通过。含绝对截止、重复点击、存储回滚、登录切换媒体竞态、退出不复活等待、超时/取消/迟到轨道清理。
- Chat 原稿浏览器检查 3/3；私聊/安全/媒体 21/21；Call 5/5。
- 共享组件回归：群聊媒体 3/3，Discover 语音 7/7。
- 基准 393×852；header/composer/44px 控件/104×142px 预览/64px 挂断关键几何误差 <1 CSS px，已检查 overlay；保留系统字体抗锯齿差异，不声称零像素差。
- iPhone 17 Pro，iOS26.5，真实 WKWebView viewport402×874、安全区62/34：
  - Chat 像素/资料 Chat CTA/语音 Message 刷新播放/文字图片与安全闭环：4/4 通过。
  - Waiting 刷新/实际后台前台/手动连点/超时/精确返回：1/1 通过。
  - 真实录音：1 项失败（采集超时），已记录而未绕过。
- [原生 Chat 测试汇总](./ui-restoration/call-waiting/native-chat-summary.json)
- [原生 Call 测试汇总](./ui-restoration/call-waiting/native-call-summary.json)
- [真实麦克风结果](./ui-restoration/connection-chat/wkwebview-real-microphone.json)
- [Call 浏览器](./ui-restoration/call-waiting/browser-acceptance.json)
- [Chat/媒体浏览器](./evidence/settings-safety/safety-actions-acceptance.json)
- 新增录音不导出音频文件，测试快照恢复，新增测试 Blob 在 finally/restore 中删除。所有临时 H5 服务和浏览器已关闭。

## 改动文件与共享影响
页面：src/pages/messages/chat.vue、src/pages/messages/call/waiting.vue。
组件：src/components/ChatImageConfirmDialog.vue、src/components/ProfilePhoto.vue。
状态：src/stores/waitingCalls.js、directMessaging.js、store.js、seed.js、selectors.js、migration.js、transactions.js。
工具：src/utils/waitingCall.js、mediaCapabilities.js；src/composables/useEventMedia.js。
主题：src/config/theme.json。文档：页面清单、阶段2字段表、本报告与两个页面来源/交互/截图证据。
测试：scripts/connection-core.test.mjs、data.test.mjs、settings-safety-browser.test.mjs、waiting-call-browser.test.mjs；ios/cimoaNeapo/Tests/HostTests.swift。
构建输出：dist/build/h5；iOS Resources/H5 由 package-ios 自动同步（忽略目录）。
共享 ProfilePhoto 保留默认 aspectFill，仅完整图片查看使用 aspectFit；useEventMedia 的其它消费者为活动群聊和 Discover 语音，已专项回归。

## 校验与提交
三项强制命令最终依次执行：check:conventions → git diff --check → build:h5。约定检查无 warning；uni-app 更新提示为工具信息，不升级依赖。
只做本地专项提交，不 push。原有10张 registration 截图不暂存、不覆盖。构建、通过的专项验证与未通过录音验收分开记录；不宣称全项目或本模块完整还原完成。
