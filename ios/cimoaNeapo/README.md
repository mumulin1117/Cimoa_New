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

Command-U 可运行七项原生集成测试。注册用例已延伸覆盖新账号修改资料、真实照片顺序、预览、退出取消与确认、错误密码、重新登录、每个主Tab单次骨架和刷新；测试结束恢复原有账号数据。媒体测试使用真实图片送入WebKit文件输入，不代替手动系统照片选择器/键盘操作验收。

原生侧滑返回关闭，由H5路由统一处理。页面还原采用分段验收，仍有未完成下级页；本轮不代表全App完成。歌曲音源、语音简介编辑、学生认证、其他设置子页、正式法律文档及外部服务仍待补齐。验证码009789仅为本地流程验证；正式签名、App Store发布、Apple登录、密码重置、内购及客服服务不在已完成范围。
