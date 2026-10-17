# 语音预览差异审计

- 恢复原稿题目大写眉题/18 问题、64 渐变播放圆/8 进度条、60 Delete/Re-record 图标圆、费用行和固定 Continue，不保留旧通用 EventAudio 文本按钮和自创 Continue · 10 Coins。
- 时长、进度和播放结果只来自有效媒体/播放器事件。路由 media_id 必须等于该 owner/target/draft 的已保存音频；刷新不靠临时 URL。
- Continue 只打开源 voice_confirmation 或 insufficient Sheet，不写入或扣款；Use 10 Coins and Send 才保存稳定操作上下文，既有 processing action 原子提交请求/10 coins。错误进入既有可重试失败页，不能假成功。
- 删除/重录先确认；取消保留原音频，确认后经 Loading 删除未发送草稿音频，再返回已有语音页。余额不足保留音频和问题，Get Coins 的来源上下文贯穿返回；StoreKit 未配置仍真实失败，不测试注入购买成功。
- 接受/拒绝、连接、会话依赖沿用上一轮已还原实体页，本轮补完整 Discover 链回归，不重复维护关系布尔值。
