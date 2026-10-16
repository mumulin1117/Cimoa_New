# 固定本地验证码

用户明确验证码为`009789`，本轮按该请求实施固定验证码。Login、Email Verification、Code 与 Success 均已完成来源锁定、确定性像素证据、完整状态回归和 iPhone 17 Pro WKWebView 验收，并升级为 `verified`。

## 字段与边界

固定字符串集中在`src/config/local-auth.js`；页面从Store getter读取。仅当前有效登录账号或本次成功注册所绑定的账号可验证，不接收页面任意邮箱来指定另一账号。`accounts.local_verification`缺失表示未本地验证；成功保存`method=fixed_code,status=verified,verified_at`。`auth_flow.pending_registration_account_id`只由注册action设置，退出清除。旧数据缺字段不自动视为通过，不改schema版本或重置用户数据。

`apply_verification(code, expected_account_id)`精确匹配字符串，不trim、不转Number、不放行任意六位码。成功幂等；失败、取消、过期会话、切账号不写半状态。验证码本身不是密码，也不是邮件/短信服务，不创建虚假请求、发送记录、重发倒计时或过期时间。学生`verification_status`不改变，不赠金币、关系或已完成资料；不用于密码重置。

## 页面和交互契约

Code来源2735–2774，路由`/pages/auth/verification/code`；源46返回/16紧凑标题、120盾牌区域、6个44×60输入格、说明卡和60固定按钮，393基准换rpx。唯一滚动区由AuthPageFrame复用，header/footer/安全区固定。源“已发邮件/HKUST学生验证”文案按用户本地模式改为如实说明，不展示真实认证承诺。输入格共用一个uni-app输入框，保留前导零。

| interaction_id | source_screen | trigger | preconditions | visible_feedback | success_result | failure_result | persistence | sync_scope | acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| verCode.goBack.click.1 | Code2738 | Back | 非提交 | 180ms返回 | 来源页；直达Login | 留原页错误 | none | route | 无Loading、栈不重复、清理输入/定时器 |
| verCode.input（补齐原型无输入绑定的格子） | Code2754 | 输入/粘贴 | 有当前账号 | 六格同步 | 只保留前六个 ASCII 数字的内存字符串 | 少于六位提示 | none | none | 009789前导零；混合字符过滤；全角数字不接受 |
| verCode.goVerSuccess.click.1 | Code2773 | Verify | 六位数字、当前账号 | 自定义500ms Loading锁重复 | Store原子写local_verification；进入Success | 错码/存储失败保留草稿，状态不变 | account local metadata | Code/Success/Login | 正确/错误、500ms前不写、刷新、双击、切号与离开取消 |
| verCode.changeEmail.click.1 | Code2763 | Change email | 真实账号 context | push无Loading | 同账号 Email correction | 缺 context 不泄露账号 | none | account | 真实入口与返回已闭环、零写入 |
| verCode.login（缺账号补齐） | Code空态 | Log In | 无有效账号 | 纯路由 | Login | 原地错误 | none | session | 访客/过期/删除无账号信息泄漏 |
| verSuccess.goObBasic.click.1 | Success2790 | Continue Profile Setup | 本地验证成功且当前账号有效 | 首次启动自定义500ms Loading；已有流程直接恢复 | Store原子建立session/onboarding/basic；已有步骤恢复，完成态Home | 存储失败完整回滚；离页取消；缺/未验证context进入Code/Login | first start: session + onboarding；resume: none | account/profile | Loading前零写、双击单写、刷新、失败、取消、直达守卫 |

Success来源2778–2791，路由`/pages/auth/verification/success`；96渐变圆/44源check、30标题、说明胶囊、底部60按钮。仅Store结果为verified时展示“Local verification complete”，不把直接打开成功URL算作通过。Code到Success、首次原子建立Basic、已有引导恢复、完成态Home、存储失败回滚和离页取消均已接通并回归。源top196减去原系统占位54后的内容间距转rpx，由实际TopSafeArea占位，不绘制假系统栏。

## 验收状态

Code 与 Success 当前专项：Store 10/10；Verification 联合浏览器 15/15；Success 确定性像素与行为 9/9；注册入口回归 2/2。Success 已生成 hash 锁定的 reference/actual/overlay/diff，并覆盖 393×852、320×568、62/34 安全区、刷新零写、首次资料引导原子写入、恢复、失败回滚、离页取消和未验证/访客直达守卫。

最终Code/Success联合[14项浏览器检查](evidence/auth/verification-success-browser.json)全部通过，新增成功页数据守卫/96圆尺寸、小屏长标题与错误滚动、验证前后真实登录导向和三Tab仅消费登录的一次骨架、长邮箱换行。既有[Login13项](evidence/auth/login-browser.json)回归通过，浏览器脚本异常0；截图默认/小屏已人工复核。PID91223、91222及隔离浏览器由finally关闭。

iPhone17Pro/iOS26.5，[FixedCodeAcceptance-2原生结果](evidence/fixed-code-native/acceptance.json)6/6通过，0失败/跳过；含新增真实WKWebView错误码不写、正确码本地结果、学生身份/会话/余额不变、刷新、缺资料依赖明确失败，及既有五项宿主检查。[截图/附件](evidence/fixed-code-native/manifest.json)已检查。首轮增量构建只发现原有5项，改用全新FixedCodeDerivedData后确认6项均被执行，不将5项通过误报为新测试通过。

第13节三项检查通过，无约定警告。测试早期出现脚本问题：单元测试通配符误含浏览器入口导致缺playwright；浏览器抢在uni-input值、rpx尺寸和页面动画更新前断言，以及误用了另一页按钮文本。已用明确单元清单、实际UI就绪条件及正确标签修复，全部原始断言保留，无跳过。中间失败截图移到本地build目录，不作为通过证据。

固定码验证链路与 Success 已逐页标记 verified；其余注册资料引导页面仍按各自清单独立核验，不能由本页结果替代。本次只本地提交，不推送；没有真实邮箱发送、学生验证或重置密码。

最终重新执行第13节三项并导出`artifacts/cimoaNeapo-ios.zip`，155条目/122个H5文件逐个哈希及ZIP完整性检查通过；新HostTests源码与包内副本一致，原生实际测试构建manifest与最终H5一致，见[导出报告](evidence/fixed-code-native/package.json)。没有原型、DerivedData或用户Xcode配置进入ZIP。中间失败截图只移入本地`ios/cimoaNeapo/build/verification-browser-diagnostic.png`保留，不删除用户数据。

## 本轮文件范围

- `src/config/local-auth.js`、`src/utils/localVerification.js`、`src/stores/store.js`/`selectors.js`：精确常量、账号上下文与原子持久化。
- `src/pages/auth/verification/code.vue`/`success.vue`、`src/components/VerificationEmblem.vue`、`src/pages/auth/login.vue`、`src/utils/authNavigation.js`、`src/pages.json`、`src/config/theme.json`：独立Vue页面、原型SVG/主题、真实路由、复用Loading/安全区/过渡。
- `scripts/auth.test.mjs`、`scripts/verification-browser.test.mjs`、`ios/cimoaNeapo/Tests/HostTests.swift`：数据、普通浏览器、WKWebView检查。
- 两份约定、阶段2字段、认证/页面/阶段5/6与差距审计、`docs/evidence/auth`及`fixed-code-native`：范围与证据；`dist/build/h5`为对应独立构建产物，iOS离线Resources/导出ZIP同步更新。
