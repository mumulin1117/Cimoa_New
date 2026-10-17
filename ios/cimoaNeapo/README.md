# cimoaNeapo

Cimoa 的 UIKit / WKWebView iOS 工程。界面是随包加载的独立 Vue / uni-app H5，不加载原型文件，也不需要电脑上的预览服务。

## 运行

打开 `cimoaNeapo.xcodeproj`，选择共享 scheme **cimoaNeapo** 和 **iPhone 17 Pro** 模拟器，然后 Command-R。临时 Bundle Identifier `com.cimoa.neapo.dev` 已获用户授权，仅用于本地开发；真机和发行需自行配置正式ID、团队与签名。

导出工程包含 `Resources/H5`、主题和资源哈希清单。在完整Cimoa仓库中修改Vue后，运行 `corepack pnpm build:h5` 即自动重建并同步它们，再在Xcode重新运行；不用改原HTML。单独导出的工程只包含当前H5产物，要修改Vue仍回原仓库源码。

## 原生/JS 接口

首次安装从Splash→Welcome进入注册；本地账号验证码固定`009789`，不发送邮件或授予学生认证。填完资料并选择至少2张真实照片可进入Home；通知可选择Not Now。已有会话恢复原账号或未完成步骤，不自动清数据。

- `CimoaNativeBridge.request('getEnvironment')`：真实项目/系统版本/能力信息。
- `CimoaNativeBridge.request('getSafeArea')`：原生实测安全区。
- `getNotificationPermission` / `requestNotifications`：读取/请求真实通知权限；尚未配置通知投递。
- `openSettings`：打开本App系统设置，明确返回打开结果。
- `CommonTemplateSafeArea`：H5既有安全区请求与更新。
- `CimoaPurchase`：当前内购产品未配置，明确失败、不加币；不模拟成功。

包内静态服务仅绑定 `127.0.0.1:18765`，固定origin以保留WebKit数据，拒绝写请求和越界路径；不对局域网开放。端口占用时显示错误，不静默换origin。业务与媒体存储均保留在H5的Store/IndexedDB。

Home 左上头像进入 My profile。Edit Profile 可修改基本资料、照片、简介、兴趣、交友目标及三条破冰问题；Preview my profile 查看同一份保存结果。右上 Settings → Log Out 只退出会话，重新用本地账号登录后资料和照片仍保留。固定测试账号为 cimoa@gmail.com / 12341234；新注册账号使用自己设置的邮箱和密码。

Events 可进入详情、参与者、报名成功、My Events 和 Event group chat。已报名账号可发文字、照片和真实录音；报名/取消同步人数及群权限，数据保存在本设备。按当前本机账号范围，新注册账号完成固定码和资料后可使用社交、匹配及活动，但不会因此取得官方学生认证。

完整仓库中可用 Command-U 运行原生集成测试；部分测试读取仓库 docs/evidence 和 docs/ui-restoration 的受控 fixture，单独导出的工程不包含这些测试素材，正常 Command-R 不依赖它们。活动用例覆盖报名、成功、我的活动、参与者、群聊、文字/图片刷新及取消权限；私聊安全用例覆盖文字/图片刷新、等待接通、举报返回、静音、拉黑、解除拉黑及不恢复旧会话；已连接用户资料用例覆盖 Chat CTA、精确返回既有会话且全程不写业务数据；注册用例覆盖资料编辑、退出重登和单次骨架；本轮账号用例还覆盖父子资料草稿冲突、隐私保存、解除拉黑保留其他账号、源12组偏好、脱敏认证及真实原生购买失败不加币。测试结束恢复原有账号数据。媒体测试使用真实图片送入WebKit文件输入，不代替手动系统照片选择器/键盘操作验收。浏览器语音自动测试采用受控音源经过实际录音器，不代表实体麦克风验收。

Profile 语音简介已支持录制、试听、重录、删除、最终Save与刷新恢复；设置、安全和金币子页复用本人Store。购买、消费的隐藏/恢复和刷新不会重复计费，原型套餐价格不是已配置商品。原生侧滑返回关闭，由H5路由统一处理。完整视觉、系统操作与生产服务验收仍pending，本轮不代表全App完成。歌曲音源、学生认证、正式签名、App Store发布、内购与客服服务未配置；验证码009789不发送邮件、不代表学生认证。Apple登录/注册入口已按用户要求移除，不恢复假按钮。
