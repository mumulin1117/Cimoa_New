# iOS WKWebView 宿主接入说明

2026-10-13 用户已授权在本仓库新建/构建 `cimoaNeapo`，并确认仅供本地模拟器的 Bundle Identifier `com.cimoa.neapo.dev`。正式签名、App Store ID、产品 ID 尚未提供。此文替代旧“只有已有宿主接入说明”的记录。

## 工程与资源链路

工程：[cimoaNeapo.xcodeproj](../ios/cimoaNeapo/cimoaNeapo.xcodeproj/project.pbxproj)，源码位于 `ios/cimoaNeapo/Sources`，共享 scheme 为 cimoaNeapo。UIKit仅有WKWebView和加载失败重试容器，没有第二套业务UI。

执行 `corepack pnpm build:h5` 后，postbuild先复制原有本地资源，再运行 `scripts/package-ios.mjs`；将 **同一份** `dist/build/h5` 复制到 `ios/cimoaNeapo/Resources/H5`，同时复制唯一主题和生成逐文件SHA256清单。生成资源不重复提交Git，但当前本地工程与导出zip包含它们。可单独 `corepack pnpm prepare:ios` 同步已构建产物；不能只改dist而不重新构建。

App包内的只读静态资源适配器固定绑定 `127.0.0.1:18765`，WKWebView加载 `/index.html#/pages/home/index`。固定origin保证localStorage/IndexedDB稳定，绝不使用电脑5173/4173服务、局域网或原型HTML。只允许GET/HEAD、准确Host、合法根目录内文件；拒绝目录遍历、写操作和未知类型。端口占用显示可重试错误，不换端口导致数据看似丢失。桥接和导航仅允许本origin主框架，禁止外部页面获得原生能力。

使用Apple的 [WKWebView](https://developer.apple.com/documentation/webkit/wkwebview/) 与 [Network局部绑定接口](https://developer.apple.com/documentation/network/nwparameters/requiredlocalendpoint)，不启用私有WebKit文件权限API。网络监听属于App进程生命周期，不是驻留Node服务。

## 桥接 v1

| 消息 | JS→原生 | 原生→JS | 权限与失败 |
| --- | --- | --- | --- |
| CommonTemplateSafeArea | postMessage('getSafeAreaInsets') | CommonTemplateSafeAreaBridge.update({top,bottom}) | view.safeAreaInsets实测点数；首次加载/布局/恢复更新；Web env回退 |
| CimoaHost | {version:1,request_id,method:'getEnvironment'或'getSafeArea'} | Promise {version:1,request_id,success:true,result} | 仅白名单主框架/origin/版本/非空ID；无宿主/坏方法/坏响应/8秒超时明确拒绝 |
| CimoaPurchase | 既有{request_id,package_id,owner_user_id,product_id} | CimoaPurchaseBridge.resolve(id,{同一关联字段,status:'failure',message}) | 当前产品/验证服务未配置，返回真实不可用，不加币。未来success仍须Store校验receipt/provider，不接受网页自报余额 |

JS业务代码使用 `src/utils/hostBridge.js` 的封装；全局 `CimoaNativeBridge.request('getEnvironment')` 或 `request('getSafeArea')` 可从Web Inspector验证真实往返。使用Apple [带回复的脚本消息协议](https://developer.apple.com/documentation/webkit/wkscriptmessagehandlerwithreply)，不接收任意原生方法、任意URL或脚本。

`CimoaPurchase`合法结果枚举是 success/failure/cancelled（旧文档failed是错误值，已纠正）；未回调时既有8秒超时保持，迟到/重复/ID错配不能落账。缺产品配置的明确failure不同于假成功，也不等于真实购买成功验收。

## 安全区、手势、媒体与数据所有权

- WebView铺满window，contentInsetAdjustmentBehavior=never。H5 TopSafeArea/BottomSafeArea或业务接管者独占安全区，不叠加原生safeArea约束或额外网页padding。
- 禁用WKWebView原生前后手势，采用H5真实栈/返回与cRise；因此不能声称已验收“原生交互式侧滑返回”。系统状态栏/HomeIndicator由iOS绘制。
- 默认持久WKWebsiteDataStore，业务metadata/Blob仍只由既有Store与媒体仓库写入，原生不维护副本、不在启动时清缓存。
- 媒体权限仅向可信主框架返回prompt，不预先授权；系统相机/麦克风说明已声明。尚未还原的相册/录音页面和真实硬件成功路径待逐页验收。
- 原生加载失败重试仅恢复本地页面，不写业务数据。颜色从打包theme.json读取；如果主题资源本身缺失，只在原生错误容器使用系统可读性回退。

## 构建与验证

```sh
corepack pnpm build:h5
open ios/cimoaNeapo/cimoaNeapo.xcodeproj
```

在Xcode选择cimoaNeapo / iPhone 17 Pro，Command-R。默认开发部署目标iOS17，当前机器可用runtime为iOS26.5，工程名不是系统版本号。模拟器构建不需要生产证书。

原生集成测试 `Tests/HostTests.swift` 覆盖真实WebKit包内H5、系统安全区、JS双向桥/非法输入、三Tab与Profile栈、localStorage/IndexedDB刷新、只读HTTP失败。证据更新到 [阶段六记录](./cimoa-stage6-acceptance.md)。宿主能构建/运行不代表全App完成；未还原子页、签名发布、真实登录/验证码/服务、IAP产品和媒体硬件仍有门槛。
