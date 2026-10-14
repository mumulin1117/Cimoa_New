# 注册与资料引导：2026-10-14 本轮

用户优先要求首次启动到主界面跑通。本轮依次 Age → Community → Signup → Verification Email → Basic → University → Major → Photos → About → Interests → Goal → Icebreakers（含 Library/Custom）→ Notifications → Complete。复用已有 Splash/Welcome/Login/Code/Success，不嵌入原 HTML。

本地注册、固定码009789；不发邮件、不授予学生身份、不启用真实匹配/支付/推送服务。先完成本路径；全App其余依赖仍pending。任一时刻仅一页in_progress，每页检查、三项强制命令、本地提交后转pending待全路径回归。不执行push。

## 来源、骨架与数据（阶段1–4增量）

原HTML SHA256 `6c49411c6868b476ff46cedaa9828ee2ccbfe89d5eaa7ea1f739feb2c8018060`。Age2528–2559、Community2561–2604、Signup2606–2656、Email2709–2732；Basic2893–2943、University2949–2985、Major2991–3013、Photos3019–3051、About3057–3078、Interests3084–3104、Goal3110–3130、Ice3138–3175及4469–4494、Notifications3181–3190、Complete3196–3205。按393基准转换rpx；共享主题；自定义固定头/底部CTA，中间唯一scroll-view，两安全区各一个。返回保留前实例，直达回前一步；首页用reLaunch清栈。

只有Store持久化：注册草稿只保存DOB/同意项；密码只在内存、离开清除。用户实体字段是资料唯一来源；资料进度归当前本地账号，逐步校验并保存，刷新恢复未完成步骤；照片保存真实Blob到IndexedDB，元数据引用media_id。资料完成不复制测试账号关系/币数/学生认证。输入中未提交的文本属于组件内存草稿；Continue成功之后才持久化。缺失/过期/换账号一律失败，不静默重置。

## 十字段交互契约

同一行列出的源interaction_ids共享反馈/持久化规则；逐页使用清单中的准确ID。每个步骤的返回/输入/选择归属如下；专属交互在对应页实现前补充。

| interaction_id | source_screen | trigger | preconditions | visible_feedback | success_result | failure_result | persistence | sync_scope | acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| age.goBack.click.1 / age.closeUnder.click.1 | Age | Back/Close | 非写入中 | 反向过渡无Loading | 来源Welcome/Login，直达Welcome | 原页英文错误 | none | navigation | 原页恢复、不黑屏 |
| age.onObDob.change.1 | Age | 输入DOB | none | 输入框 | 仅内存草稿 | 格式错误不写入 | none | 当前表单 | YYYY-MM-DD真实日期 |
| age.underage.click.1 | Age | I’m under18 | none | 源拒绝卡片 | 不注册 | 无业务写入 | none | 当前页 | 17岁/未来/不存在日期拒绝 |
| age.goAgree.click.1 | Age | Continue | 合法日期且UTC年龄≥18；无现有会话/待注册账号 | 自定义Loading500ms | 保存DOB/age同意再push Community | 保存失败留原页可重试 | auth_flow | Signup | Loading前零写入；返回/刷新恢复；18岁边界 |
| agree.tTerms.click.1 / agree.tPrivacy.click.1 / agree.tGuides.click.1 | Community | 勾选 | 已通过年龄页 | 源勾选色变化 | 内存同意项 | 不自动同意 | none | 当前表单 | 未全选不能继续 |
| agree.goSignup.click.1 | Community | Continue | 三项明确同意/年龄有效 | Loading500ms | 同意项保存后push Signup | 原页错误/不注册 | auth_flow.agreements | Signup | 存储失败原子回滚 |
| signup.onEmail.change.1 / signup.onPw.change.1 / signup.onPw2.change.1 / signup.togglePw.click.1 | Signup | 输入/Show | none | 源输入/密码强度/不一致提示 | 内存草稿 | 非法不得创建 | none | 表单 | 隐藏/卸载清密码 |
| signup.createAccount.click.1 | Signup | Create Account | 年龄/同意/有效邮箱/8–128位含数字/密码相同 | Loading500ms后PBKDF2 | 原子创建空白本地账号→Email | 重复/取消/容量失败不半创建 | accounts/users/auth_flow | 登录、验证 | 本地登录成功、无明文密码、无伪认证 |
| signup.appleAuth.click.1 / signup.goLogin.click.1 | Signup | Apple/Login | none | Apple明确未配置；Login即时过渡 | 真实Login | 不假Apple成功 | none | auth | 不改认证状态 |
| verEmail.onEmail.change.1 / verEmail.goVerCode.click.1 | Email | 修改邮箱/继续验证 | 当前本地账号，邮箱格式有效且未重复 | 修改时500msLoading；不改邮箱即时导航 | 更正当前邮箱→Code | 冲突/过期不写入 | 当前account.email | Login/Code | 不发送邮件、仍为固定码 |
| ob*.goBack.click.1 | 对应资料页 | Back | 非写入中 | 反向过渡 | 前资料步骤/Basic回Success | 原页错误 | none | 当前账号 | 可返回、不丢已提交字段 |
| ob*.on*.change.1 / ob*.o.pick.click.* / obMajor.m.pick.click.1 | 对应资料页 | 输入/选择 | 有效本地验证账号；不跳过前步骤 | 源字段/选中色 | 内存草稿 | 校验错误 | none | 表单 | 业务目录只从Store getter读取 |
| obBasic.goObUni.click.1 / obUni.goObMajor.click.1 / obMajor.goObPhotos.click.1 / obPhotos.goObAbout.click.1 / obAbout.goObInterests.click.1 / obInterests.goObGoal.click.1 / obGoal.goObIce.click.1 / obIce.goObNotif.click.1 | 对应资料页 | Continue | 步骤字段有效；2照片/3兴趣/≥1目标/3问题 | Loading500ms | 只更新当前用户实体和账号进度→下一步 | 原页可重试，原快照不变 | users、account.onboarding、媒体/问题 | Profile/启动恢复 | 不伪造预填；刷新/跨页一致 |
| obComplete.enterApp.click.1 | Complete | Explore Cimoa | 所有步骤有效且照片仍可解码 | Loading500ms | 完成资料、首次消费Tab骨架资格、reLaunch Home | 未完成/缺媒体错误可返回修复 | onboarding_status | 全局Store/三Tab | 冷启动/再登录不重新引导、不复制关系/币数 |

## 当前执行

- Age：本页浏览器2组检查、日期/原子写单元通过；默认及320小屏截图已检查。三项强制命令通过无警告，临时服务73151已关闭。恢复pending待Community依赖；证据`evidence/registration/age-browser.json`。其余新页面pending。
