# Cimoa 阶段三测试数据修正要求

**状态：completed（Store 与测试夹具层，非页面或真实服务验收）。** `src/stores/seed.js`、`store.js`、`selectors.js`、`transactions.js` 和 `migration.js` 已替换旧模板数据。所有来源状态可通过 `src/stores/scenarios.js` 构造数据和 UI 测试上下文；生产页面不读取原型 query 或测试场景。

新 seed 应保存于 Pinia Store 模块，不新增供页面读取的业务 JSON。必须覆盖：

本轮新增auth.test.mjs：首次安装游客与旧会话无写恢复；18岁生日边界/非法日期/邮箱/密码/协议；真实本地注册→错误密码无写→正确登录→刷新→删除后拒绝登录；并发同邮箱只创建一次、存储失败无半账号；不发邮件、不授予认证、不自动加币。主Tab浏览器回归显式注入测试会话，不能继续依赖生产首次安装自动登录。

- 用户最新测试账号 `cimoa@gmail.com` / `12341234`、正常/删除账号、成功/失败/重复邮箱、有效和过期会话。
- Home 默认三卡、空列表、长姓名/目标、单条/多条滚动、头像缺失；人物使用已确认的详情基准 Chloe / HKUST、Liam / Stanford、Lina / HKU。
- connected、auto-match、invite 分别引用真实关系/匹配/请求实体，不在 Home 保存独立状态标签。
- 审核账号与三个互相关注用户各有 3–6 条真实种子聊天；不能为满足此要求，把 Home 尚未接受邀请的 Lina 或匹配候选 Liam 同时标成朋友。需独立覆盖关系场景并验证一致性。
- 原型的全部 onboarding、profile picker、settings、event、coins、safety、permission 和错误状态；每个场景均有唯一 ID、有效关联、媒体可解析、合法枚举。
- 相册/录音的成功、取消、权限拒绝、媒体解析失败；无歌曲音频和无客服/验证服务时返回真实错误，不生成成功记录。
- 充值成功/失败/取消/超时/重复回调、消费及退款；余额由流水计算，不能复制原型不相等的演示总额。
- 零金币发送有效文字介绍成功，重复点击只创建一条请求；发送前后流水及余额完全相同。空文本、拉黑目标、失效会话和存储失败不创建请求，保留可重试草稿。
- 通话仅等待接通模拟；测试 8 秒、12 秒边界、450ms 省略号、手动挂断和自动结束竞争，以及卸载清理，不提供假接通场景。
- 持久化失败前后数据一致；版本迁移不删除或覆盖用户新增数据；旧缓存不能覆盖新 seed 全部字段。

## 实测证据

Profile 本轮测试：默认/空资料/长姓名与所有兴趣/无认证/过期会话/损坏存档/真实头像失败、超时和Blob刷新；三主Tab进入、返回原位置与筛选、根路由刷新回Home、导航失败恢复。51项单元测试与20项Profile浏览器检查通过，夹具仅在独立测试中注入，生产页面无测试query后门；详见 [Profile本页验收](./cimoa-stage5-profile-acceptance.md)。

Events 补充夹具（2026-10-13）：从源活动转写新实体的本地图片及校园时区具体日期，保留真实三位 Picnic 成员，不伪造原稿显示的 12 人。专项脚本固定时钟为 2026-10-13 09:00 香港，覆盖日期/周边界、同校园、账号隔离、默认旧存档、容量/结束/验证/付费不可用、加入取消、群权限、失败回滚。H5 测试独立注入默认、长文、空、写失败、读损坏、资源失败/重试、窄屏安全区，不新增生产 query 后门。证据以本轮 [Events 验收记录](./cimoa-stage5-events-acceptance.md) 为准，未完成的成功页/详情/群聊导航不计通过。

Discover 补充夹具（2026-10-13）：`discover_empty`、`discover_long`、`discover_no_photo`、`discover_unconnected`（0金币）、`discover_unverified`、`discover_private`。沿用默认已连接 Chloe，不为了让按钮显得成功篡改种子关系；未连接入口另用夹具验证。照片真实请求失败/重试、IndexedDB 原图刷新/丢失、过期会话、拉黑、长内容和损坏存储由独立浏览器测试注入，不暴露到生产页面参数。专项测试见 `scripts/discover.test.mjs` 与 `scripts/lib/discover-browser.mjs`。

`node --test scripts/data.test.mjs scripts/circa-source.test.mjs` 验证全部 154 个来源状态的实体关联、人物详情基准、测试账号、过期/删除、文字零消费、请求方向、匹配状态机、UTC 零点、账本和退款幂等、事件容量/群聊权限、拉黑过滤、迁移及失败回滚。媒体通过注入适配器测试保存/恢复、元数据失败补偿、解码失败和 URL 引用释放；浏览器 IndexedDB 实际运行检查随公共骨架集成另记。

`corepack pnpm check:conventions`、`git diff --check`、`corepack pnpm build:h5` 已依次通过。构建只使用独立源码，未导入原型。旧页面仅作基础数据接线和错误反馈修复，视觉仍待阶段 5；不据此标记页面 verified。

真实邮件、学生认证、客服、匹配服务、合法歌曲音频及 StoreKit 商品仍未配置：默认明确失败。可信购买/匹配/退款成功事件只在测试适配器注入，不由生产 timer 或查询参数触发。模拟通话只验证等待与退出，不含假接通。
