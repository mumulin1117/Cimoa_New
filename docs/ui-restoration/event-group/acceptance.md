# Event Group 本轮验收（2026-10-17）

- 来源模板 2049–2112；源 fragment、全部样式、SVG、交互契约见同目录 JSON。
- UI：删除无来源横幅，恢复 80px header、118px composer、Message the group、消息左右头像及时间顺序、真实主办方通知结构、媒体完整预览。Safari 消息气泡恢复原型 white-space:normal / text-wrap:pretty，并保持消息列 max-width:74%；原有额外 pre-wrap 在 WebKit 造成短消息多一行，已增加原生高度断言防止回归；长内容仍限宽换行。
- 数据：唯一群聊；每次报名独立 admission_id；认证 flow / 报名上下文发生变化后拒绝旧异步媒体提交；失败清理本次新建 Blob，不触碰其他媒体。
- 已读：只标记当前可见群消息自己的 read_by；500ms Loading 在写入前，刷新不重复消费。
- 浏览器：既有群聊文字/图片/受控录音/刷新/静音/取消报名三个闭环通过；新增独立原稿 reference、actual、overlay、diff、已读 Loading 及小屏安全区回归通过（详见 JSON）。
- 数据测试：全模块回归 137/137 通过。
- WKWebView：iPhone 17 Pro / iOS 26.5 第一轮 2/2 通过；完整报名→群聊媒体刷新→退出，以及新增已读/返回/安全区回归。最终源修正构建2/2再次通过，短消息高度49.59、宽197.16 CSS px，不再额外换行；原生与当前H5构建清单一致。
- 未通过项：真实麦克风成功路径（系统没有可用输入设备）；手动系统权限/键盘操作（Mac 锁屏，自动解锁失败）；其他 Events 页独立像素叠加证据仍未完成。
- 状态：local_acceptance=passed，visual_acceptance=pending，full_acceptance=pending，status=pending；不标 verified，不声明整模块像素级验收完成。
