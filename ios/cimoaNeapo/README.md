# cimoaNeapo

Cimoa 的 UIKit / WKWebView iOS 工程。界面是随包加载的独立 Vue / uni-app H5，不加载原型文件，也不需要电脑上的预览服务。

## 运行

打开 `cimoaNeapo.xcodeproj`，选择共享 scheme **cimoaNeapo** 和 **iPhone 17 Pro** 模拟器，然后 Command-R。临时 Bundle Identifier `com.cimoa.neapo.dev` 已获用户授权，仅用于本地开发；真机和发行需自行配置正式ID、团队与签名。

导出工程包含 `Resources/H5`、主题和资源哈希清单。在完整Cimoa仓库中修改Vue后，运行 `corepack pnpm build:h5` 即自动重建并同步它们，再在Xcode重新运行；不用改原HTML。单独导出的工程只包含当前H5产物，要修改Vue仍回原仓库源码。

## 原生/JS 接口

- `CimoaNativeBridge.request('getEnvironment')`：真实项目/系统版本/能力信息。
- `CimoaNativeBridge.request('getSafeArea')`：原生实测安全区。
- `CommonTemplateSafeArea`：H5既有安全区请求与更新。
- `CimoaPurchase`：当前内购产品未配置，明确失败、不加币；不模拟成功。

包内静态服务仅绑定 `127.0.0.1:18765`，固定origin以保留WebKit数据，拒绝写请求和越界路径；不对局域网开放。端口占用时显示错误，不静默换origin。业务与媒体存储均保留在H5的Store/IndexedDB。

Command-U 可运行四项原生集成测试。原生侧滑返回关闭，返回由H5路由统一处理。全部页面尚未完整验收；缺失下级页会明确提示待还原，不代表已完成产品。正式App Store签名、内购、验证码/客服等服务成功路径尚未配置。
