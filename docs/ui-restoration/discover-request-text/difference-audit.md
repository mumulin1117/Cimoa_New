# 文字回复差异审计

- 原稿头像/问题同卡、32 Write something real、23 输入字体、300 字计数、Continue 箭头、Switch to voice；旧实现通用题卡、1000 maxlength、额外说明和 Send Introduction 文案不符，均恢复。
- 免费决定仅改变后续事务：Continue 直接经 500ms Loading 发送免费请求，不走原型付费确认。
- 草稿在输入停顿 800ms 后启动 500ms 保存 Loading；Back/切换模式亦保存，失败保留输入，刷新恢复最后落盘内容，不声称强制关闭前未落盘的字已保存。取消/卸载清 timer 和待写任务。
- 回复/问题只从 introduction_context 读取；固定底部、安全区和 visualViewport 复用聊天的键盘测量。所有入口守卫 account/draft/target/question；发送仍由既有原子 action 负责。
