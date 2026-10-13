# Cimoa 阶段五页面还原状态

2026-10-13：按用户新增要求回到 HTML 启动入口逐页补齐。Splash 与 Welcome 本页已通过，恢复 pending（待依赖）；Profile 本页提交 `bc7bdfd` 同样待完整依赖。用户新指示固定验证码009789优先实施；Login恢复pending，其原型TEST STATES生产处理仍待决策，不宣告视觉验收完成。Code本页62项单元/9项浏览器检查通过，待Success/Email/资料依赖，不升级verified。当前无in_progress，Code提交后再顺序开始Success。首次安装已改为访客。先前五项iPhone17Pro测试覆盖新认证入口和宿主局部集成，不是全App验收，见[阶段六记录](./cimoa-stage6-acceptance.md)。

用户最新决定：**后续仅本地 Git 提交，不执行 push；各页允许分段验收，依赖补齐并完整回归后才 verified。** 已同步至 [流程阶段5](../模板项目开发流程.md#阶段-5一个页面一个页面还原)。两份强制约定中的旧 Home-only / 推送门槛由该用户决定覆盖，技术与业务要求不变。

| 顺序 | 页面 | status | local_acceptance | full_acceptance | 下一门槛 |
| --- | --- | --- | --- | --- | --- |
| 1 | Home | pending | passed | pending | Profile/Chat/Auto Match/Request真实入口返回与宿主回归 |
| 2 | Discover | pending | passed | pending | 已本地提交；Profile/Preferences/Expanded/Icebreaker/通知与宿主待补齐 |
| 3 | Events | pending | passed | pending | 已本地提交；详情/参与者/群聊/成功页/宿主后续补齐 |
| 4 | Profile | pending | passed | pending | 本地提交bc7bdfd；Settings/Edit/Coins/Preview依赖与完整原生验收 |
| 后续 | Messages、Auto Match、Connection、Auth、Settings、Coins、Safety、System | pending | pending | pending | 主Tab之后按入口依赖逐页推进 |
| 新入口优先 | Splash、Welcome | pending | passed | pending | 登录/注册/协议依赖、原生入口回归；见认证交互契约 |
| 入口待决策 | Login | pending | pending | pending | 功能13项H5通过；源调试区的生产处理待确认，注册/重置依赖未齐 |
| 最新用户优先 | Verification Code | pending | passed | pending | 本地固定009789；Success/Email/资料依赖；见本地验证码契约 |

完整映射以 [页面清单](./cimoa-page-inventory.json) 为准。主Tab顺序 Home → Discover → Events。Popover/Sheet/确认弹窗随首个使用页面完成，常驻挂载；专属组件不另开页面任务。任一时刻最多一个页面in_progress。

## 分段验收执行规则

1. 当前页成为唯一in_progress，核对来源和十字段交互契约，完成固定骨架、源UI/资源、Store派生及本页状态检查。
2. 缺依赖逐interaction_id登记目标/实体参数、未测步骤与完整回归要求。显式错误只证明失败路径，不证明成功闭环；不进入旧错误页、不提供空目标或Toast假成功。
3. 本页通过记录local passed、full pending；执行强制校验和本地专项提交，再恢复pending（待依赖）。不把“本页通过”写成verified。
4. 按顺序补齐依赖；齐备后重新将原页设为唯一in_progress，完成真实目标/返回、同步/刷新和WKWebView回归。
5. local/full均通过、强制检查与本地提交有证据，才能标记页面及专属组件verified。不因停止push降低任何功能验收要求。

## 已有证据

- Profile：[本页验收](./cimoa-stage5-profile-acceptance.md)、[交互契约](./cimoa-profile-interactions.md)。51项单元、Profile20项H5、Home22/Discover20/Events19项回归通过；三Tab进入Profile与返回已真实执行，不再是readiness拒绝。其余子页和原生完整验收仍pending。

- Home：[本页验收](./cimoa-stage5-home-acceptance.md)。功能提交 `cc59a36`、验收提交 `29c15f9` 已由用户推送；`origin/main` reflog 在2026-10-13T15:52:16+08:00记录 update by push。后续本地记录 `e839615` 不要求推送。本轮Home22项浏览器回归通过。
- Discover：[交互契约](./cimoa-discover-interactions.md)、[本页验收与deferred清单](./cimoa-stage5-discover-acceptance.md)。38项单元测试、20项H5检查通过。原型图片、卡片/按钮尺寸、长内容、空/错误、图片重试/Blob恢复、安全区注入均有证据；不是iOS模拟器实测。
- 首用组件：CimoaBrand、ConnectionGoalsPopover、UserAvatar随Home；DiscoverHeroHeader、ProfilePhoto随Discover。本页覆盖通过不提前赋予verified。
- Events：[交互契约](./cimoa-events-interactions.md)、[本页验收及完整文件清单](./cimoa-stage5-events-acceptance.md)。46项单元测试、19项Events H5检查通过；Home22项、Discover20项回归通过。EventConfirmDialog、EvJoinConfirmDialog、EvCancelConfirmDialog、EventActionLoading 首用覆盖通过。高级 Filter Sheet 缺原型UI/入口，仍pending，不计本页通过。
- Git：本轮功能/测试/产物本地提交 `bf902b0`（feat(discover): restore CIRCA photo page and verify local acceptance）；本记录随后另行本地提交，不执行push。
- Git：Events 功能/测试/产物本地提交 `36274d7`（feat(events): restore CIRCA carousel and verify local acceptance）；恢复待依赖状态及回归截图另作本地记录提交，不执行push。

阶段五整体未完成。三个主 Tab 与 Profile 已完成本页检查，但均待完整依赖验收；后续仍按入口依赖逐页推进。先按用户新增授权输出原生宿主并单独记录构建/冒烟，不能因此提升页面为verified。
