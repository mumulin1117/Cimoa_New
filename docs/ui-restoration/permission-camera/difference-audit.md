# Camera Permission 来源锁定与差异审计

## 当前结论

锁定 HTML 原型 3229–3248 行及 5714–5721 行。已恢复无额外标题栏的相机预授权页：内容 y=172、92px 图标、60px Allow、46px Not Now；拒绝后原页显示 Access is off。已移除无来源的 Permission Header 和常驻 System status 卡片，并将来源的假照片计数替换为真实相机文件、Loading、IndexedDB 媒体与 Store 事务。浏览器与 iPhone 17 Pro WKWebView 均通过，当前 `status: verified`、`visual_acceptance: passed`。

| ID | 项目 | 来源 | 修改前 | 处理 |
| --- | --- | --- | --- | --- |
| PCM-001 | Header | 无 Header | 额外 `Permission` Header/Back | 已删除无来源控件 |
| PCM-002 | Content | y=172；92px 图标；16px gap | Header 后流式内容 | 已恢复来源几何并适配安全区 |
| PCM-003 | Copy | 声称视频通话使用相机 | 仅拍照真实用途 | 保留真实用途批准差异 |
| PCM-004 | Status | 仅 denied 时显示卡片 | 常驻 System status 卡片 | 已改为按拒绝/错误显示 |
| PCM-005 | Allow | 原型直接增加假照片 | 只探测 camera stream 后返回 | 真实 camera picker → Loading → Store/IndexedDB → 返回通过 |
| PCM-006 | Not Now | 原页进入 denied 状态 | 直接返回 | Access is off 与零写入通过 |
| PCM-007 | Settings | 提示跳 iOS Settings | 浏览器/宿主桥真实结果 | 无宿主明确失败，不假成功；WKWebView 配置通过 |

## 验收边界

iPhone Simulator 不提供实体相机画面，因此不编造“模拟器已拍照”。WKWebView 验收覆盖来源像素、安全区、拒绝/刷新零写入、`NSCameraUsageDescription`、可信本地来源的媒体权限委托和生产 H5 中 `sourceType: camera` 输入；真实图像返回、坏图回滚、Loading 时序及 IndexedDB/Store 刷新恢复由同一份 H5 在普通浏览器完成。
