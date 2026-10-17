# Connected 来源差异审计

HTML1795–1817。旧共享Flow结果页包含源稿没有的信息卡与history，头像/标题/按钮尺寸不符。本页独立提取原双92头像（520ms cRise结束帧）、32字号You both connected、17字号说明、14来源文案、60/56底部按钮及原Header。

仅显示真实connected且双方consent/Conversation有效实体；Chat读取conversation_id，纯导航不创建关系或会话。Profile使用当前candidate_id，返回保持来源页。缺少会话明确失败，不伪造聊天。共享Flow组件暂不改，余下消费者按页逐项替换。
