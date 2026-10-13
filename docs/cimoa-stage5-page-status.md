# Cimoa 阶段五页面还原状态

2026-10-13：Discover 本页检查通过，仍为唯一 `in_progress`，待完成本地专项提交后恢复 pending（待依赖）。不标记任何新页面/专属组件 verified。

用户最新决定：**后续仅本地 Git 提交，不执行 push；各页允许分段验收，依赖补齐并完整回归后才 verified。** 已同步至 [流程阶段5](../模板项目开发流程.md#阶段-5一个页面一个页面还原)。两份强制约定中的旧 Home-only / 推送门槛由该用户决定覆盖，技术与业务要求不变。

| 顺序 | 页面 | status | local_acceptance | full_acceptance | 下一门槛 |
| --- | --- | --- | --- | --- | --- |
| 1 | Home | pending | passed | pending | Profile/Chat/Auto Match/Request真实入口返回与宿主回归 |
| 2 | Discover | in_progress | passed | pending | 本地专项提交后暂回pending；Profile/Preferences/Expanded/Icebreaker/通知与宿主待补齐 |
| 3 | Events | pending | pending | pending | Discover本页提交后成为下一页；尚未施工 |
| 后续 | Profile、Messages、Auto Match、Connection、Auth、Settings、Coins、Safety、System | pending | pending | pending | 主Tab之后按入口依赖逐页推进 |

完整映射以 [页面清单](./cimoa-page-inventory.json) 为准。主Tab顺序 Home → Discover → Events。Popover/Sheet/确认弹窗随首个使用页面完成，常驻挂载；专属组件不另开页面任务。任一时刻最多一个页面in_progress。

## 分段验收执行规则

1. 当前页成为唯一in_progress，核对来源和十字段交互契约，完成固定骨架、源UI/资源、Store派生及本页状态检查。
2. 缺依赖逐interaction_id登记目标/实体参数、未测步骤与完整回归要求。显式错误只证明失败路径，不证明成功闭环；不进入旧错误页、不提供空目标或Toast假成功。
3. 本页通过记录local passed、full pending；执行强制校验和本地专项提交，再恢复pending（待依赖）。不把“本页通过”写成verified。
4. 按顺序补齐依赖；齐备后重新将原页设为唯一in_progress，完成真实目标/返回、同步/刷新和WKWebView回归。
5. local/full均通过、强制检查与本地提交有证据，才能标记页面及专属组件verified。不因停止push降低任何功能验收要求。

## 已有证据

- Home：[本页验收](./cimoa-stage5-home-acceptance.md)。功能提交 `cc59a36`、验收提交 `29c15f9` 已由用户推送；`origin/main` reflog 在2026-10-13T15:52:16+08:00记录 update by push。后续本地记录 `e839615` 不要求推送。本轮Home22项浏览器回归通过。
- Discover：[交互契约](./cimoa-discover-interactions.md)、[本页验收与deferred清单](./cimoa-stage5-discover-acceptance.md)。38项单元测试、20项H5检查通过。原型图片、卡片/按钮尺寸、长内容、空/错误、图片重试/Blob恢复、安全区注入均有证据；不是iOS模拟器实测。
- 首用组件：CimoaBrand、ConnectionGoalsPopover、UserAvatar随Home；DiscoverHeroHeader、ProfilePhoto随Discover。本页覆盖通过不提前赋予verified。
- Git：本轮只做本地提交，SHA在提交后的状态登记中记录，不执行push。

阶段五整体未完成。下一页为Events；目前尚未进入Events施工。
