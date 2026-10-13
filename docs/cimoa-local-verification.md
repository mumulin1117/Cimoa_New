# 固定本地验证码

用户明确验证码为`009789`，本轮按该新请求优先实施固定验证码。Login既有TEST STATES视觉决策仍pending，不并行施工、不升级验收；Code已完成本页检查并恢复pending（待依赖），Success随Code本地提交后顺序实施。

## 字段与边界

固定字符串集中在`src/config/local-auth.js`；页面从Store getter读取。仅当前有效登录账号或本次成功注册所绑定的账号可验证，不接收页面任意邮箱来指定另一账号。`accounts.local_verification`缺失表示未本地验证；成功保存`method=fixed_code,status=verified,verified_at`。`auth_flow.pending_registration_account_id`只由注册action设置，退出清除。旧数据缺字段不自动视为通过，不改schema版本或重置用户数据。

`apply_verification(code, expected_account_id)`精确匹配字符串，不trim、不转Number、不放行任意六位码。成功幂等；失败、取消、过期会话、切账号不写半状态。验证码本身不是密码，也不是邮件/短信服务，不创建虚假请求、发送记录、重发倒计时或过期时间。学生`verification_status`不改变，不赠金币、关系或已完成资料；不用于密码重置。

## 页面和交互契约

Code来源2735–2774，路由`/pages/auth/verification/code`；源46返回/16紧凑标题、120盾牌区域、6个44×60输入格、说明卡和60固定按钮，393基准换rpx。唯一滚动区由AuthPageFrame复用，header/footer/安全区固定。源“已发邮件/HKUST学生验证”文案按用户本地模式改为如实说明，不展示真实认证承诺。输入格共用一个uni-app输入框，保留前导零。

| interaction_id | source_screen | trigger | preconditions | visible_feedback | success_result | failure_result | persistence | sync_scope | acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| verCode.goBack.click.1 | Code2738 | Back | 非提交 | 180ms返回 | 来源页；直达Login | 留原页错误 | none | route | 无Loading、栈不重复、清理输入/定时器 |
| verCode.input（补齐原型无输入绑定的格子） | Code2754 | 输入/粘贴 | 有当前账号 | 六格同步 | 仅内存字符串 | 非六位/非数字提示 | none | none | 009789前导零；7位/空/错码拒绝 |
| verCode.goVerSuccess.click.1 | Code2773 | Verify | 六位数字、当前账号 | 自定义500ms Loading锁重复 | Store原子写local_verification；进入Success | 错码/存储失败保留草稿，状态不变 | account local metadata | Code/Success/Login | 正确/错误、500ms前不写、刷新、双击、切号与离开取消 |
| verCode.changeEmail.click.1 | Code2763 | Change email | 目标Email页就绪 | push无Loading | Email页 | 依赖未实现明确提示，不悄改账号 | none | account | 当前deferred；Email恢复后真实入口/返回 |
| verCode.login（缺账号补齐） | Code空态 | Log In | 无有效账号 | 纯路由 | Login | 原地错误 | none | session | 访客/过期/删除无账号信息泄漏 |
| verSuccess.goObBasic.click.1 | Success2790 | Continue Profile Setup | 本地验证成功且资料页就绪 | 纯路由 | 正确onboarding/basic | 缺依赖明确提示；验证结果保留 | none | account/profile | 不跳错误旧页、不伪造资料完成 |

Success来源2778–2791，路由`/pages/auth/verification/success`；96渐变圆/44源check、30标题、说明胶囊、底部60按钮。仅Store结果为verified时展示“Local verification complete”，不把直接打开成功URL算作通过。Code目标未就绪时显示已保存的本地结果并保留后续deferred记录；Success完成后再补真实跨页回归。

## 验收状态

Code：62项单元测试通过；9项一次性Chrome检查通过，见[evidence](evidence/auth/verification-code-browser.json)。含无宿主/无账号、源6格44×60尺寸、格式/错码零写入、Change email明确失败、存储失败原子回滚、500ms前不写、双击单次提交、刷新恢复、取消和本地登录导向、320小屏62/34安全区/滚动/返回。已检查默认和小屏截图。

第13节三项检查通过，无约定警告。测试PID89306及其隔离浏览器在finally关闭。首次误用单元测试通配符包含浏览器脚本，因缺默认playwright模块失败；改用明确单元清单及预装Chrome驱动后上述测试通过，没有安装依赖或留下服务。全App及注册/Email/Success/资料依赖仍未完成，不标记verified。本次仅本地提交，不推送。
