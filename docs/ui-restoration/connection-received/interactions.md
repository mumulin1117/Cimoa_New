# Request Detail 入口契约

source_screen：reqReceived 842–972；固定 Header、回答卡、底部操作；其余人物信息为唯一主滚动区。

- reqReceived.goBack.click.1：Back 点击；当前无提交；cRise 返回原来源/无栈 Home；无写入、无 Loading；失败留当前页并显示原因；覆盖默认/已处理/失效状态返回。
- reqReceived.openReqMenu.click.1：可见目标与接收方；打开来源 Safety Mini Sheet；不写入；取消关闭，失败留页；检查首次、再次、报告真实 sender/context、确认拉黑后 Home/Discover/私聊一致。
- reqReceived.otherSongPlay.click.1：该人物歌曲卡；缺音源明确报错且不开始播放；不持久化；原封面和资料保持；检查点击后无假计时。
- reqReceived.prevPhoto/nextPhoto.click.1：该人多张照片；即时切换当前照片索引、无 Loading；只读同一 user_id；缺图显示媒体错误、不换人；单张不显示翻页热区。
- reqReceived.openGallery.click.1：当前真实照片；打开本人的相册预览；不写入；关闭回原照片、无来源照片不伪造；覆盖单张/多张/缺失。
- reqReceived.togglePlay.click.1 / seekLiam.click.1：有效请求音频；真实解析、播放/暂停/定位；无资源报错，离开停止并释放；进度仅由媒体时间更新；刷新仍按同一 audio_id 读取，任何失败不处理请求/扣费。
- reqReceived.notNow.click.1：没有提交/弹层；即时清栈回 Home；pending 不变、无拒绝/Loading；Home Invite 与刷新仍显示同一 request_id。
- reqReceived.openDecline.click.1：补齐来源 decline 行为的菜单入口；当前接收方 pending；确认 → 500ms Loading → decline_request；成功同一 ID 进入 closed；取消/失败保持 pending，Home/资料/会话权限同步，不建立任何关系。
- reqReceived.accept.click.1：当前接收方 pending、双方允许连接；确认 → 500ms Loading → 同一 ID accept_request；成功请求/双向关系/唯一会话/首条介绍一起保存并进入 accepted；存储失败、取消/卸载、连点不部分写入；Home、详情 Chat、请求结果和私聊权限同步。

match_id 是另一入口类型：明确显示 Auto Match 而非伪造破冰问答，只有真实 candidate 可以处理。request_id 与 match_id 必须二选一。已处理/失效/越权/过期会话均显示可返回错误，不再次执行或暗中重建。
