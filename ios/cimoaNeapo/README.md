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

Command-U 可运行五项原生集成测试，包括访客启动、欢迎页和真实本地登录。首次启动不再自动登录测试账号；可手动使用 cimoa@gmail.com / 12341234。新增本地注册的数据接口已实现，年龄/社区/注册页面尚待逐页还原；验证码方案由用户另定，未生成演示码或假发送邮件。原生侧滑返回关闭，返回由H5路由统一处理。全部页面尚未完整验收；缺失下级页会明确提示待还原，不代表已完成产品。正式App Store签名、内购、验证码/客服等服务成功路径尚未配置。
