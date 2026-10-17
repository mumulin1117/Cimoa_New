# Discover 来源差异审计

- 结构/几何/文案：保留来源 54 圆入口、353×542 照片卡、31 姓名、36 三标签、60 Send shot 与三 Tab；六人资源、真实安全区和短屏卡片收缩是已批准适配。既有牌堆动画复用，不增加喜欢/跳过业务。
- DATA-01：底部旧入口遇到已 pending/connected 仅报错；改为 introduction_context 同源判定，打开准确原请求/聊天，不制造第二请求。
- DATA-02：其他人物过滤改变数组时 index 取模可能换人；保留当前 user_id 位置，仅当前不可见时落到下一有效卡；账号变化回首张。
- DATA-03：Store 只读聚合人物、真实问题/草稿、Connection/Request/Conversation/Match 和账本；未新增持久化关系表。缺会话明确失败。
- 回归：来源 reference/actual/overlay/diff、六人八尺寸/拖拽不写、详情返回、已有关系真实跳转、Tab/骨架/安全区、空/错/过期；依赖后再完整复核。
