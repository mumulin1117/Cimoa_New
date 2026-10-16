# Cimoa 认证入口逐页交互契约

Splash 像素专项已由本地提交 `745bd7d2` 封版，Welcome 已由本地提交 `491eb25d` 封版，Login 已由本地提交 `3c011d15` 封版，Age Confirmation 已由本地提交 `9e6b318f` 封版，Community Agreement 已由本地提交 `047e4c1d` 封版。Signup 的来源差异、浏览器/WKWebView 证据和完整注册闭环均已通过，已按用户授权自动确认为 `verified / passed`；专项本地提交完成后立即锁定 Email Verification。固定验证码仍为 `009789`，完整认证状态见[本地验证码](./cimoa-local-verification.md)。后续页面继续在全部证据通过且无未决差异时自动视觉确认并进入下一页，不再逐页等待人工回复。

## Splash

来源内层2499–2508行，原型挂载4855行1800ms自动跳转。路由/pages/auth/splash为默认入口，不应像旧清单一样有Welcome父页。TopSafeArea与BottomSafeArea唯一拥有安全区，中部品牌和150×4进度条；不绘制系统状态栏。品牌和尺寸按393基准换算。加载条只表达启动过渡，不表示业务写入。

| interaction_id | source_screen | trigger | preconditions | visible_feedback | success_result | failure_result | persistence | sync_scope | acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| splash.goWelcome.click.1 | Splash 2500 | 点击/键盘跳过 | hydration可读且无正在导航 | 立即replace，无导航Loading | 普通游客到Welcome；本地未验证会话/待验证注册恢复Code；其他有效会话恢复Home | 留在启动页、英文错误和Retry；不重置旧存储 | none | 当前会话 | 双击和1800ms竞争仅导航一次；错误保留原数据 |
| splash.auto.complete（技术映射4855） | Splash | 1800ms到期 | 页面仍活动，未离开 | 源cPulse/cRise | 同上；恢复不准备三Tab骨架 | 同上 | none | 同上 | 卸载/隐藏取消计时，刷新不写账号 |
| splash.retry.click（错误补齐） | Splash error | Retry | 读取/导航失败 | 只重试读取与路由 | 原会话恢复或游客Welcome | 保持可返回的真实错误 | none | Store hydration | 损坏存储不会被seed覆盖；修复后可重试 |

Welcome首次未还原时以deferred显示明确错误；现在已由下方Welcome回归覆盖实际Splash→Welcome，不再跳旧错误页。

像素专项已完成实现与双端取证：[来源契约](./ui-restoration/splash/source-contract.json)、[差异审计](./ui-restoration/splash/difference-audit.md)、[验收摘要](./ui-restoration/splash/acceptance.json)。浏览器固定393×852、cRise结束帧与cPulse 750ms，已输出reference/actual/overlay/diff；iPhone 17 Pro WKWebView实测402×874、真实安全区62/34。两端均通过游客到Welcome、有效会话到Home、损坏存储Retry、连点/定时器只导航一次和安全区居中。用户已于2026-10-15确认视觉验收，最终状态为`status: verified`、`visual_acceptance: passed`。

## Welcome

来源2512–2525行，/pages/auth/welcome为认证根页。TopSafeArea后是唯一scroll-view：源校园图片360高、上部30圆角与渐隐、38品牌/34主标题/16.5介绍；底部固定Create Account60、Log In56和协议文案，BottomSafeArea唯一占位。安全区替代原稿44高占位；小屏允许内容滚动，不覆盖按钮。

| interaction_id | source_screen | trigger | preconditions | visible_feedback | success_result | failure_result | persistence | sync_scope | acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| welcome.goAge.click.1 | Welcome2521 | Create Account | 目标页已还原 | push/cRise，无Loading | /pages/auth/age，保留Welcome实例 | 未还原明确错误，原数据不变 | none | auth_flow | 进入年龄确认→返回Welcome；本地阶段先记录deferred |
| welcome.goLogin.click.1 | Welcome2522 | Log In | 同上 | 同上 | /pages/auth/login | 同上 | none | session | 进入登录→返回；连点栈只增1 |
| welcome.openTerms.click.1 | Welcome2523 | Terms | 同上 | 同上 | /pages/legal/terms | 同上；不展示伪造上线条款 | none | legal | 正文可滚动关闭→原Welcome |
| welcome.openPrivacy.click.1 | Welcome2523 | Privacy Policy | 同上 | 同上 | /pages/legal/privacy | 同上 | none | legal | 不跳成Terms，不自动勾选协议 |
| welcome.media.retry（技术补齐） | Welcome image | Retry photo | 本地图片失败 | 内容区真实重载 | 显示相同校园图片 | 继续明确错误，不换图 | none | source resource | 注入404→重试、恢复资源→正确加载 |

Welcome 本轮像素专项已完成并获用户视觉确认：[来源契约](./ui-restoration/welcome/source-contract.json)、[差异审计](./ui-restoration/welcome/difference-audit.md)、[验收摘要](./ui-restoration/welcome/acceptance.json)。浏览器 6/6 通过，固定 393×852 与 cRise 结束帧，输出 reference/actual/overlay/diff；62/34 安全区及 320×568 验证唯一滚动区和固定 footer。iPhone 17 Pro WKWebView 实测 402×874、真实安全区 62/34，专项 1/1 通过。四个入口、返回归属、连点只进一层、图片真实失败/恢复和刷新零写入均通过。三项最终门禁与 H5 重构建通过，最终状态为 `status: verified`、`visual_acceptance: passed`。

## Login

来源2659–2705，/pages/auth/login；复用SecondaryPageFrame/routeTransition，源46返回、48标题栏、33 Welcome back、56 Apple/输入、60固定登录。返回前一认证页，直达fallback Welcome。密码只保留内存，隐藏/卸载清除。真实认证数据仅Store。固定本地验证码已单独实施，重置/Apple仍不可用；原型 TEST STATES 按来源保留，但只读检查真实本地状态，不创建账号、会话或认证结果。

| interaction_id | source_screen | trigger | preconditions | visible_feedback | success_result | failure_result | persistence | sync_scope | acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| login.goBack.click.1 | Login2662 | Back | 非提交 | cRise反向180ms | 来源页/直达Welcome | 原页错误 | none | navigation | 不黑屏、隐藏时取消未执行写入 |
| login.onEmail.change.1 / login.onPw.change.1 | Login2679/2685 | input | none | 字段变化 | 仅内存表单 | 不写业务状态 | none | none | 输入/刷新无明文存储 |
| login.togglePw.click.1 | Login2685 | Show/Hide | none | 真正切换password属性 | 可见状态切换不丢值 | none | none | none | 默认隐藏、切换后仍可提交 |
| login.loginNow.click.1 | Login2701 | Log In | 格式/非空/Store可读 | AuthActionLoading500ms后Store.login | 会话写入成功才prepare三个Tab资格；本地未验证账号reLaunch Code，其余Home；验证不额外prepare | 无会话写入、错误保留表单；离开取消 | session only | all tabs/profile | 错误凭据/存储失败/成功/刷新/连点/三Tab单次骨架 |
| login.appleAuth.click.1 | Login2669 | Apple | 未配置服务 | 明确英文不可用 | 不伪造授权 | 保持原页与数据 | none | none | 普通浏览器/宿主同样真实失败 |
| login.goFpEmail.click.1 | Login2691 | Forgot password | 目标需还原且服务未配置 | 导航或明确缺依赖 | 后续按真实重置结果 | 不发送邮件/不改密码 | none | account | 当前deferred；固定009789不授权重置他人密码 |
| login.goAge.click.1 | Login2702 | Create account | Age就绪 | 立即push，无Loading | 注册年龄流程 | 未还原明确错误 | none | auth_flow | Age补齐后验入口与返回 |
| login.loginWrong.click.1 / login.loginUnverified.click.1 | Login2695/2696 | 原型TEST STATES | 只读检查现有 fixture 凭据失配 / 当前未验证本地账号 | none | 展示来源错误；未验证状态仅在真实 pending context 存在时进入验证页 | 不创建账号、不写 session、不强造认证状态 | none | test only | fresh fixture、真实 pending、本地状态缺失三路回归 |

本轮来源锁定证据见 [Login 来源契约](./ui-restoration/login/source-contract.json)、[差异审计](./ui-restoration/login/difference-audit.md) 与 [验收摘要](./ui-restoration/login/acceptance.json)。393×852 浏览器确定性测试 5/5、登录功能回归 14/14、Store 单元测试 10/10、iPhone 17 Pro WKWebView 专项 1/1 均通过；真实软键盘下密码框可见、footer 临时收起并在 Done 后恢复。用户于 2026-10-15 确认截图，三项最终门禁与本地专项提交完成。注册页面是否完成仍按各自页面清单逐页验收，不能由 Login 结果代替。

## Community Agreement

来源内层 2562–2604 行，`/pages/auth/community`；仅允许 Age 进入，普通返回恢复 Age 实例，直达时 fallback Age。页面保留六条原文规则、三条同意项和底部 Continue；仅执行已批准的 CIRCA→Cimoa 品牌替换。Read 打开受控本地 Agreement Sheet，不会自动同意或持久化。

| interaction_id | source_screen | trigger | preconditions | visible_feedback | success_result | failure_result | persistence | sync_scope | acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| agree.goBack.click.1 | Community2566 | Back | 非保存中 | 反向过渡 | 恢复 Age；直达 fallback Age | 保留当前页错误 | none | navigation | 不写游客状态、不黑屏 |
| agree.tTerms.click.1 / agree.tPrivacy.click.1 / agree.tGuides.click.1 | Community2581/2588/2595 | 点击、Enter 或 Space | 非保存中 | 来源 checkbox 三态变化 | 仅更新内存表单 | none | none | current form | 单项、partial、ready 的外观和 Continue 启用条件一致 |
| agree.readTerms.click.1 / agree.readPrivacy.click.1 / agree.readGuides.click.1 | Community2581/2588/2595 | Read | 非保存中 | 打开对应受控 Sheet | 首次和重复打开均显示正确本地文档 | 缺少生产法务信息在正文明确说明 | none | legal display | Read/Close/遮罩都不改同意项、不写 storage |
| sheetAgreement.closeSheet.click.1 / sheetAgreement.closeSheet.click.2 | Agreement Sheet | 遮罩或 Close | Sheet 已打开 | 源 Sheet 退场 | 回 Community 原状态 | none | none | current page | 首次/再次动画均可用，长文可滚动 |
| agree.goSignup.click.1 | Community2603 | Continue | 三项都明确同意 | AuthActionLoading 500ms | 通过 Store 原子写入完整 agreements，只进入一个 Signup | 未勾选零写入；持久化失败保留三项可重试选择 | auth_flow.agreements | registration flow | Loading 前零写、连点单次、刷新恢复、失败不进 Signup |

证据见 [来源契约](./ui-restoration/community/source-contract.json)、[差异审计](./ui-restoration/community/difference-audit.md) 与 [验收摘要](./ui-restoration/community/acceptance.json)。浏览器 8/8，固定 393×852 并输出 reference/actual/overlay/diff；iPhone 17 Pro WKWebView 专项 1/1，实测视口 402×874、安全区 62/34。默认/partial/ready、Sheet 首次/再次、320×568 滚动、原子写入、失败回滚、刷新和返回归属均通过。依据用户授权，本页已自动确认为 `verified / passed`。

## Signup

来源内层 2606–2656 行，`/pages/auth/signup`；只允许 Community 进入，普通返回恢复 Community 实例，直达时 fallback Community。页面精确保留来源标题、Apple 按钮、分割线、三个输入框、密码提示、固定 footer 和禁用/启用外观；来源错误声称邮箱用于学生认证，按批准差异替换为最短真实本地账号说明。

| interaction_id | source_screen | trigger | preconditions | visible_feedback | success_result | failure_result | persistence | sync_scope | acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| signup.goBack.click.1 | Signup2610 | Back | 非保存中 | 反向过渡 | 恢复 Community；直达 fallback Community | 保留当前页错误 | none | navigation | 不写游客状态、不黑屏 |
| signup.onEmail.change.1 / signup.onPw.change.1 / signup.onPw2.change.1 | Signup2628/2634/2646 | input | none | 来源输入与提示实时变化；清旧提交错误 | 只更新内存表单 | none | none | current form | 刷新不保留密码；无明文 storage |
| signup.togglePw.click.1 | Signup2637 | click / Enter / Space | 非保存中 | Show/Hide 同时切换两个真实 password 字段 | 可见状态改变但值不丢失 | none | none | current form | 默认隐藏；隐藏/卸载清密码 |
| signup.appleAuth.click.1 | Signup2617 | Continue with Apple | Apple 服务未配置 | 明确英文错误 | 不伪造授权、不进验证 | 保持原页、零写入 | none | none | 浏览器/WKWebView 同一真实失败 |
| signup.createAccount.click.1 | Signup2652 | Create Account | 合法邮箱；8–128 字符且含数字；密码一致；成人与三项协议草稿有效 | AuthActionLoading 500ms | Store 原子创建一个 salted PBKDF2 本地账号，再进入 Email Verification | 重复邮箱、持久化/加密失败完整回滚；保留可重试表单 | accounts + pending auth_flow | registration flow | Loading 前零写、连点单次、无 session/学生认证/明文密码 |
| signup.goLogin.click.1 | Signup2653 | Already have an account? Log in | 非保存中 | push/cRise | Login；Login Back 恢复原 Signup | 导航失败留原页并显示错误 | none | navigation | 往返栈深正确；直达返回归属正确 |

证据见 [来源契约](./ui-restoration/signup/source-contract.json)、[差异审计](./ui-restoration/signup/difference-audit.md) 与 [验收摘要](./ui-restoration/signup/acceptance.json)。浏览器确定性测试 7/7、注册 Store 10/10、注册浏览器回归 3/3、iPhone 17 Pro WKWebView 专项 1/1 均通过；实测原生视口 402×874、安全区 62/34，并覆盖真实系统键盘。重复邮箱、Apple 与注入存储失败均不产生半成品；成功只创建一个本地账号，刷新恢复待验证状态且密码为空。依据用户授权，本页已自动确认为 `verified / passed`。
