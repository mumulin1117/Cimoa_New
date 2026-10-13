# Cimoa 认证入口逐页交互契约

Splash本页已本地提交e1af81a，Welcome本页提交50d140c，同样pending待完整依赖；用户随后优先要求固定验证码009789，Login转pending，Code本页提交10c2154，再顺序实施Success。最新状态及十字段契约见[本地验证码](./cimoa-local-verification.md)。每页依次补来源契约、实施、测试、三项校验、本地提交；完成本页后回pending待完整依赖，不并行留下半页。

## Splash

来源内层2499–2508行，原型挂载4855行1800ms自动跳转。路由/pages/auth/splash为默认入口，不应像旧清单一样有Welcome父页。TopSafeArea与BottomSafeArea唯一拥有安全区，中部品牌和150×4进度条；不绘制系统状态栏。品牌和尺寸按393基准换算。加载条只表达启动过渡，不表示业务写入。

| interaction_id | source_screen | trigger | preconditions | visible_feedback | success_result | failure_result | persistence | sync_scope | acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| splash.goWelcome.click.1 | Splash 2500 | 点击/键盘跳过 | hydration可读且无正在导航 | 立即replace，无导航Loading | 普通游客到Welcome；本地未验证会话/待验证注册恢复Code；其他有效会话恢复Home | 留在启动页、英文错误和Retry；不重置旧存储 | none | 当前会话 | 双击和1800ms竞争仅导航一次；错误保留原数据 |
| splash.auto.complete（技术映射4855） | Splash | 1800ms到期 | 页面仍活动，未离开 | 源cPulse/cRise | 同上；恢复不准备三Tab骨架 | 同上 | none | 同上 | 卸载/隐藏取消计时，刷新不写账号 |
| splash.retry.click（错误补齐） | Splash error | Retry | 读取/导航失败 | 只重试读取与路由 | 原会话恢复或游客Welcome | 保持可返回的真实错误 | none | Store hydration | 损坏存储不会被seed覆盖；修复后可重试 |

Welcome首次未还原时以deferred显示明确错误；现在已由下方Welcome回归覆盖实际Splash→Welcome，不再跳旧错误页。

首次本页浏览器4项通过：[历史报告](./evidence/auth/splash-browser.json)、[截图](./evidence/auth/splash.png)。默认源尺寸、自动计时/连点竞争、有效会话栈1且无骨架、损坏存储与修复重试均已执行；实际进入Welcome已追加在Welcome报告。三项强制校验通过；临时PID81954由finally关闭。原生入口URL已改为Splash，原生完整入口待本轮回归，不冒称已测。

## Welcome

来源2512–2525行，/pages/auth/welcome为认证根页。TopSafeArea后是唯一scroll-view：源校园图片360高、上部30圆角与渐隐、38品牌/34主标题/16.5介绍；底部固定Create Account60、Log In56和协议文案，BottomSafeArea唯一占位。安全区替代原稿44高占位；小屏允许内容滚动，不覆盖按钮。

| interaction_id | source_screen | trigger | preconditions | visible_feedback | success_result | failure_result | persistence | sync_scope | acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| welcome.goAge.click.1 | Welcome2521 | Create Account | 目标页已还原 | push/cRise，无Loading | /pages/auth/age，保留Welcome实例 | 未还原明确错误，原数据不变 | none | auth_flow | 进入年龄确认→返回Welcome；本地阶段先记录deferred |
| welcome.goLogin.click.1 | Welcome2522 | Log In | 同上 | 同上 | /pages/auth/login | 同上 | none | session | 进入登录→返回；连点栈只增1 |
| welcome.openTerms.click.1 | Welcome2523 | Terms | 同上 | 同上 | /pages/legal/terms | 同上；不展示伪造上线条款 | none | legal | 正文可滚动关闭→原Welcome |
| welcome.openPrivacy.click.1 | Welcome2523 | Privacy Policy | 同上 | 同上 | /pages/legal/privacy | 同上 | none | legal | 不跳成Terms，不自动勾选协议 |
| welcome.media.retry（技术补齐） | Welcome image | Retry photo | 本地图片失败 | 内容区真实重载 | 显示相同校园图片 | 继续明确错误，不换图 | none | source resource | 注入404→重试、恢复资源→正确加载 |

Welcome 本页8项浏览器检查通过：[报告](./evidence/auth/welcome-browser.json)、[393默认](./evidence/auth/welcome.png)、[320小屏安全区](./evidence/auth/welcome-small.png)。已检查实际Splash自动进入Welcome、原图与360/60/56尺寸、四个依赖入口真实失败边界、图片404与重试、小屏唯一滚动/固定footer、有效会话与损坏快照恢复。PID83162的服务/隔离浏览器已关闭。local passed / full pending；协议和认证目标缺失不算闭环，原生尚待本轮回归，不标记verified。

## Login

来源2659–2705，/pages/auth/login；复用SecondaryPageFrame/routeTransition，源46返回、48标题栏、33 Welcome back、56 Apple/输入、60固定登录。返回前一认证页，直达fallback Welcome。密码只保留内存，隐藏/卸载清除。真实认证数据仅Store。固定本地验证码已单独实施，重置/Apple仍不可用；原型TEST STATES不是业务数据，是否在生产移除已询问用户，未决时不标完整验收。

| interaction_id | source_screen | trigger | preconditions | visible_feedback | success_result | failure_result | persistence | sync_scope | acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| login.goBack.click.1 | Login2662 | Back | 非提交 | cRise反向180ms | 来源页/直达Welcome | 原页错误 | none | navigation | 不黑屏、隐藏时取消未执行写入 |
| login.onEmail.change.1 / login.onPw.change.1 | Login2679/2685 | input | none | 字段变化 | 仅内存表单 | 不写业务状态 | none | none | 输入/刷新无明文存储 |
| login.togglePw.click.1 | Login2685 | Show/Hide | none | 真正切换password属性 | 可见状态切换不丢值 | none | none | none | 默认隐藏、切换后仍可提交 |
| login.loginNow.click.1 | Login2701 | Log In | 格式/非空/Store可读 | AuthActionLoading500ms后Store.login | 会话写入成功才prepare三个Tab资格；本地未验证账号reLaunch Code，其余Home；验证不额外prepare | 无会话写入、错误保留表单；离开取消 | session only | all tabs/profile | 错误凭据/存储失败/成功/刷新/连点/三Tab单次骨架 |
| login.appleAuth.click.1 | Login2669 | Apple | 未配置服务 | 明确英文不可用 | 不伪造授权 | 保持原页与数据 | none | none | 普通浏览器/宿主同样真实失败 |
| login.goFpEmail.click.1 | Login2691 | Forgot password | 目标需还原且服务未配置 | 导航或明确缺依赖 | 后续按真实重置结果 | 不发送邮件/不改密码 | none | account | 当前deferred；固定009789不授权重置他人密码 |
| login.goAge.click.1 | Login2702 | Create account | Age就绪 | 立即push，无Loading | 注册年龄流程 | 未还原明确错误 | none | auth_flow | Age补齐后验入口与返回 |
| login.loginWrong.click.1 / login.loginUnverified.click.1 | Login2695/2696 | 原型TEST STATES | 原型调试用途待确认 | 不编造认证结果 | 真实失败/未验证由Store数据测试覆盖 | 不强造已认证账号 | none | test only | 不将静态测试按钮算认证成功 |

运行检查已通过但不是页面完整验收：[Login检查记录](./cimoa-stage5-login-acceptance.md)。先前普通浏览器13项、Welcome更新回归8项、iPhone17Pro入口/宿主5项均通过。当前实现未显示源TEST STATES两个调试按钮；已向用户询问是否在正式App移除，未获答复前不将此差异自行定为完成。Login转pending，local/full pending；不把固定验证码的新决定理解为批准删除调试区。注册仅Store接口已实现，年龄/社区/注册UI尚未完成；固定验证码两页单独按新请求实施，不声称整个注册链已接通。
