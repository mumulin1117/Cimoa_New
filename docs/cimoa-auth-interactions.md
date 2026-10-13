# Cimoa 认证入口逐页交互契约

Splash本页通过，恢复pending待Welcome和原生完整入口；当前无in_progress。每页依次补来源契约、实施、测试、三项校验、本地提交；完成本页后回pending待完整依赖，不并行留下半页。

## Splash

来源内层2499–2508行，原型挂载4855行1800ms自动跳转。路由/pages/auth/splash为默认入口，不应像旧清单一样有Welcome父页。TopSafeArea与BottomSafeArea唯一拥有安全区，中部品牌和150×4进度条；不绘制系统状态栏。品牌和尺寸按393基准换算。加载条只表达启动过渡，不表示业务写入。

| interaction_id | source_screen | trigger | preconditions | visible_feedback | success_result | failure_result | persistence | sync_scope | acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| splash.goWelcome.click.1 | Splash 2500 | 点击/键盘跳过 | hydration可读且无正在导航 | 立即replace，无导航Loading | 游客到Welcome；有效会话恢复Home | 留在启动页、英文错误和Retry；不重置旧存储 | none | 当前会话 | 双击和1800ms竞争仅导航一次；错误保留原数据 |
| splash.auto.complete（技术映射4855） | Splash | 1800ms到期 | 页面仍活动，未离开 | 源cPulse/cRise | 同上；恢复不准备三Tab骨架 | 同上 | none | 同上 | 卸载/隐藏取消计时，刷新不写账号 |
| splash.retry.click（错误补齐） | Splash error | Retry | 读取/导航失败 | 只重试读取与路由 | 原会话恢复或游客Welcome | 保持可返回的真实错误 | none | Store hydration | 损坏存储不会被seed覆盖；修复后可重试 |

Welcome尚未还原时，目标必须作为deferred显示明确错误，不能跳旧错误页冒充完成。补齐后重跑实际Splash→Welcome，才更新本页闭环证据。

本页浏览器4项通过：[报告](./evidence/auth/splash-browser.json)、[截图](./evidence/auth/splash.png)。默认源尺寸、自动计时/连点竞争、有效会话栈1且无骨架、损坏存储与修复重试均已执行；Welcome当前只计deferred失败边界。三项强制校验通过；临时PID81954由finally关闭。原生入口URL已改为Splash，原生完整入口待Welcome后回归，不冒称已测。
