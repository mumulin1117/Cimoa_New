# 无自动保存与请求状态专项

用户要求并确认：选题进入 Your answer 不弹 Saving；文字编辑不实时保存；标题 Introduction sent、底部 Done；Discover/他人资料的 pending 按钮灰色等待，接受后 Chat。

原实现两处触发写入：选题时 prepare_introduction 经 500ms Loading 持久化；输入停顿 800ms 后自动保存。现将 UI 表单放在 Pinia 的 introduction_forms（data 之外），选题、输入、返回及无录音的模式切换均不写磁盘，也不显示 Loading。不存在“隐藏 Loading 却继续后台写”的降级。

只有确认付费发送、进入充值以建立恢复上下文、或保存真实录音时，才通过正常 500ms Loading 发布草稿。计费、录音媒体、失败回滚、幂等及历史记录不改。未发布文字在刷新/退出后不保留；已明确保存的草稿仍恢复。会话变更清空临时表单，其他 Store 事务不会夹带保存输入。

现有 Introduction sent / Done 和 Waiting for reply / Chat 实现本来已符合文案要求，本轮不自主改文案/控件，而是补充实际跨账号 UI 接受和双入口聊天回归。临时发送端与接收端切换仅发生在隔离测试数据中，不在生产增加假接受、测试账号或自动回复。

布局、字体、主题、安全区和路由过渡不变。开发/交互约定未修改：按既有“临时 UI 选择不持久化、不加 Loading”与“真实写入先 Loading”分层执行。
