# Events 与群聊来源锁定

- 原型：`CIRCA All Screens (interactive).html`
- SHA-256：`6c49411c6868b476ff46cedaa9828ee2ccbfe89d5eaa7ea1f739feb2c8018060`
- 日期：2026-10-17。只读解析内嵌模板；生产项目不加载原型。
- 顺序：Events → Detail（含报名/取消/More）→ Participants → Join Success → My Events → Group → Report。任一时刻仅一页 in_progress；各页专项本地提交，不推送。
- 数据依赖：Event、Organizer、EventMembership、kind=group 的 Conversation、Message、MediaFile。人物统一由 user_id 查询；加入不创建好友关系。座位数按完整成员计数，拉黑只过滤可见人物/消息。
- 注册登录、报名、发送、静音、已读均由 Store 事务处理。写入前自定义 500ms Loading。读取、搜索、返回不显示写入 Loading。

## 来源和审计
| 页面 | 模板行 | 固定/滚动与返回 | 已发现差异及处理 |
| --- | --- | --- | --- |
| Events | 517–605 | 主 Tab 固定 header/Tabbar，中部纵滚 + 横向 snap 卡片；详情返回此 Tab | 标题/人数应单行省略，日历描边1.9。保留真实空/错误/会话状态 |
| Detail | 1919–1996 | 固定返回/More 和 CTA，中间内容滚动；返回实际入口（Events/My Events/Group） | 主办方 SU 徽记/认证、单行日期地点、参与者链接、schedule 字重、Good to know 标签、按钮大小写与原型对齐；安全区与固定 header 属已批准技术适配 |
| Participants | 2017–2046 | 固定48px header，搜索与列表滚动；返回来源详情/群聊 | 去除无来源句号，姓名18/800，保持真实关系标签、搜索/拉黑与长文适配 |
| Join Success | 1999–2014 | 顶186px内容，底双 CTA；Open Event 回原详情，不重复入栈 | 成功 SVG、阴影、日期地点一行、Open Event 文案、底34px。仅真实已报名显示 |
| My Events | 2116–2164 | 固定 header，中间真实已报名/历史列表；返回实际入口 | 标题 My events、字重和日期/地点间距；无报名不得填充原型假卡片 |
| Group | 2049–2112 | 固定80px header，消息滚动，118px composer + 实际安全区；返回实际入口 | 删除无来源提示条；还原主办方通知、左右头像/时间顺序、placeholder、间距/阴影。新增真实媒体菜单为用户授权补齐，不伪造他人消息 |
| Report | 2167–2193 | 固定 header/Submit report，七项原因滚动；返回真实入口 | 原因按原型；提交保存事件举报、不擅自退出。真实未配置服务须明确说明 |

## 验收边界
- 浏览器隔离账号测试；服务记录 PID，finally 清理。普通浏览器无宿主时媒体能力实际检测并明确失败。
- WKWebView 使用打包本地 H5，检查返回、键盘、安全区、媒体刷新和后台恢复。
- 真实麦克风当前缺少系统输入设备；受控音频仅用于编解码测试，不能冒充真实录音通过。
- 原型 Block Organizer 仅 toast，没有机构拉黑模型；待用户决定机构屏蔽范围，未决定前保留明确失败，不假成功。
- 视觉未生成/检查独立原型参考、actual/overlay/diff 前 visual_acceptance 保持 pending；功能通过不等于像素级通过。所有依赖和生产验收完成前不标 verified。
