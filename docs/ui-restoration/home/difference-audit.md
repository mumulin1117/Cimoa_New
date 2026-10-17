# Home 来源锁定与差异审计

来源：解码 HTML 214–358 行及离线 TabBar 组件，完整片段、SHA、样式/SVG/资源见 source-contract.json。开工时没有其他 in_progress 页面。

- DATA-01：旧 home_cards 分别拼接 conversations/matches/requests，没有统一消费 Connection 代际和 ConnectionRequest；改为只读 home_feed，不新增持久化表。
- DATA-02：同一人多条记录依赖数组顺序，卡片状态与跳转分处计算；明确优先级、时间/稳定 ID 去重，路由与卡片同源。
- DATA-03：统一空/错误/会话/配额/统计口径；读取失败不得当空成功。
- UI-01：保留 Connected/Auto Match/Invite 卡与现有 Sent 动态变体，不新增无来源的预览或未读徽标。
- UI-02：固定 Header 是既有技术适配；需重新生成 reference/actual/overlay/diff 并逐区核对，不沿用旧截图结论。
- UI-03：目标 Popover 仍锚定卡片；账号、拉黑或过期导致卡片消失时清除遮罩；补齐键盘入口但不改变控件外观。
- COPY-01：等待状态不虚称已发通知；缺队列数据明确等待更新；人物资料遵循详情实体。
- NAV-01：浏览器实测 found → Pass → Return Home 留下 depth 2，原稿 returnHome 是 root("home")（6179 行）。修正共享 AutoMatchResultPage 的 Home completion 为 reLaunch；消费者为 connected、passed、expired、no-match，四者都回归返回，其他导航方式与 UI 不变，不把这些页面另标视觉 verified。

开工状态：source_lock locked；visual/local/full pending。新浏览器和 WKWebView 证据完成前不标记 verified。

## 本轮关闭结果

DATA-01/02/03、UI-01/02/03、COPY-01、NAV-01 均已完成。本轮 default/goals 来源叠图逐区查看，默认 profile/title/card/avatar/status 几何均在 1 CSS px 内；原生三张头像解码完成、opacity=1、两绘制帧后重新截图。实测 131 单元、15 Home 浏览器、5 两账号集成和原生 Home 专项全部通过；详见 acceptance.json。功能提交 `703c7085` 已完成，随后以仅含验收登记的本地提交标记 Home 作用域 verified。

原型全局条件通知层位于 Home 区块外（4535 起），其来源 ID 保留在页面清单 source_binding_ids 追溯，不作为本次 getter/UI 作用域已实现的推送服务或全局通知声明；其他页面也不随本轮自动完成。
