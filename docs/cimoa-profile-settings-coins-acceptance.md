# Cimoa 个人资料设置安全与金币验收

2026-10-17。本轮完成四个模块的本页功能修正、来源锁定和普通浏览器回归；完整视觉与生产服务验收仍待完成，不将页面改成 verified。项目继续运行独立 Vue/uni-app 构建出的 H5，由 cimoaNeapo 的 WKWebView 加载，不运行原型 HTML。

## 功能与数据

- Profile 和资料编辑复用注册的 users、profile_photos、interests、goals、icebreakers；照片、简介、字体、兴趣、目标和破冰问题在编辑、预览、设置及同 ID 消费者同步。Save 前自定义 Loading，失败原子回滚，取消不保存。子页保存的新专业优先于父页旧专业草稿，其他未保存简介等草稿继续保留。
- 语音简介支持真实授权请求、录制、停止、试听、重录和删除，时长不超过30秒。Done 仅暂存，最终 Save 才同时发布本人媒体元数据与 IndexedDB Blob；刷新后可读取、播放。历史媒体不因替换简介而被误删。
- Profile 偏好恢复 HTML 的12组选择控件，映射到既有 Auto Match 数值/枚举字段，取消不写、不自行重置未选择的自定义范围。认证页展示本人大学、脱敏邮箱和真实记录；缺少认证日期不编造。固定码009789不等于官方学生认证。
- 设置包含通知、隐私、权限、语言、帮助、法律、账号退出及注销。异步授权返回前已离页时不再写入。没有实现的语言不伪切换；普通浏览器没有原生设置能力时明确失败。
- 举报与历史详情按本人记录和真实目标读取。拉黑同步过滤人物、请求、匹配、私聊、活动参与者和群消息；解除拉黑不复活旧关系与聊天。客服只能保存草稿，不产生假投递或工单。
- 注销验证密码，删除当前账号私有实体并清理其媒体；异步验证不能删除后来重新登录的会话。完成页仅属于 auth_flow.deleted_account_id 指向的本次已完成注销流程，不展示任意历史注销。
- 金币余额只读已完成账本；初始余额显示 Coin credit，不伪装 App Store 订单。详情通过 coin_ledger_detail 统一投影消费、返还、初始记录和经过验证的购买，页面不复制业务判断。
- 购买请求在导航前只派发一次；刷新使用同一 created_at + 8000ms 截止时间，不重新发起支付。隐藏页不写入或跳转，返回后消费同一回调。及时回调不因必需的500ms Loading 被误判超时。缺产品与收据服务时只有明确失败、超时或取消，不加币。
- 消费处理中恢复源74px渐变脉冲；失败页恢复无额外 Header、92px叹号、源标题和三项操作布局。离页取消、回来恢复、刷新重放均复用同一 operation_id，不重复扣币。
- Coin Center、History、详情、Help、Terms、Privacy 保留本人付费来源 draft ID；只允许命名应用路由，不接受任意 return URL。阅读、刷新与返回不写业务状态。
- 本轮受保护页面使用完整登录上下文，而不只比较 account_id；同账号退出再登录也不能复活旧页面或旧异步操作。

## 来源与视觉

HTML SHA256 为 `6c49411c6868b476ff46cedaa9828ee2ccbfe89d5eaa7ea1f739feb2c8018060`，本轮未修改。来源片段、文字、样式、SVG、事件与差异审计在 `docs/ui-restoration/account-*/`。

Profile、Settings、Verification、Reverify、Coin Center、Spend Failed 已生成独立源 AST 的393×852 reference、actual、overlay、diff；参考图不复用生产组件的 CSS。页面状态仍为 pending、local_acceptance passed、visual_acceptance pending、full_acceptance pending。截图通过生成检查不等于逐像素一致；真实安全区、本人数据、未配置服务的诚实文案属于已记录差异。

## 校验与证据

数据测试154项通过，0失败、0跳过。浏览器覆盖资料媒体保存/回滚、隐私与拉黑过滤、注销、购买边界、刷新与来源返回；逐项结果见 [机器验收清单](./evidence/account-flows/acceptance.json)。浏览器语音使用受控设备，经过生产 MediaRecorder、解码、播放器和 IndexedDB 路径，不冒称实体麦克风测试。

最终 AccountAcceptance-shared-draft-final.xcresult 在 iPhone 17 Pro、iOS26.5 完成5/5，0失败、0跳过，见[原生摘要](./evidence/account-flows/native-final-summary.json)。覆盖新增9项账号/安全/金币检查，以及全新注册到Home、真实照片存储与资料编辑/退出重登、三Tab单次骨架/返回、安全区和桥接失败边界。初期三个测试预期/时序问题及失败记录保留，修正后完整重跑，未降低业务断言。实测安全区顶部62、底部34，414份H5逐文件核对原生测试包一致。原生 DOM 导航/桥接测试不代替真实手指、系统相册弹窗、软键盘与硬件权限交互验收。

第13节三项强制命令最终按顺序通过，无约定警告；SDK升级提示不属于检查警告。源HTML和两份强制约定未修改。最终过程与文件哈希由机器验收清单记录；独立工程归档刷新至 artifacts/cimoaNeapo-ios.zip，XCTest素材仍需完整仓库，正常Command-R不依赖测试素材。

## 发布前仍需完成

完整视觉确认、系统触摸/键盘/权限及真实后台恢复的本轮专项验收仍 pending。当前 Mac 仅发现扬声器，没有麦克风输入。大学认证、客服投递、正式法律主体、StoreKit 产品与收据验证、正式签名均未配置，不能声明生产成功或全 App 还原完成。

仅本地 Git 专项提交，不 push。保留任务开始前已修改的10张 registration PNG，不纳入本轮提交。临时浏览器及预览服务在各测试 finally 中关闭；不停止其他项目或用户服务。两次无进程持有的空 Git index.lock 已移到临时备份目录，未删除用户代码或历史：

- `/tmp/cimoa-stale-git-lock.IlXwxF/index.lock`
- `/var/folders/pn/z20q73zd4h9fbf0k2jrylfvr0000gn/T/cimoa-stale-lock-u7fpyfk9/index.lock`

## 改动文件

页面位于 `src/pages/profile/`、`settings/`、`safety/`、`coins/`，协议返回适配位于 `src/pages/legal/`。共享实现包括 `ProfileBioConfirmDialog.vue`、`ProfileEditorFrame.vue`、`useAccountScope.js`、`useProfileEditor.js`、`useEventMedia.js`、`profileEditing.js`、`profilePreferences.js`、`coinSelectors.js`、`store.js`、`iapBridge.js`、`coinReturnContext.js`、`legalNavigation.js`、主题与动效配置。完整任务文件列表在机器验收清单中；构建产物为 `dist/build/h5/`，由打包脚本同步原生资源。
