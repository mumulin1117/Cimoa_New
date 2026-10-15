# Splash 第一轮来源锁定与差异审计

## 结论

来源已锁定，Splash 的本轮实现与浏览器/WKWebView 专项回归已完成。无来源的 20px padding 已删除，点击热区已恢复为整屏；真实安全区、会话分流和错误重试均保留。确定性 reference、actual、overlay、diff 与原生截图已经生成，并于 2026-10-15 获得用户视觉确认；`status` 为 `verified`，`visual_acceptance` 为 `passed`。

来源：HTML 内层 2499–2508 行；自动跳转 4855 行；点击行为 5560 行。完整锁定值见 [source-contract.json](./source-contract.json)，本轮机器验收见 [acceptance.json](./acceptance.json) 与 [browser-acceptance.json](./browser-acceptance.json)。

## 对照结果

| ID | 项目 | 来源值 | 当前实现 | 结论 | 后续处理 |
| --- | --- | --- | --- | --- | --- |
| SPL-001 | 页面背景 | 168deg，`#e4f4fb → #eaf0fd 44% → #f2ecfb` | `--cimoa-page-gradient` 对应同值 | 一致 | 保留 token，不在页面硬编码 |
| SPL-002 | 主结构 | absolute inset 0，整屏居中 column | SafeArea → PageTransition → flex 居中 | 有批准适配，已实测 | 浏览器 393×852 居中；WKWebView 402×874、62/34 安全区内居中 |
| SPL-003 | 主间距 | 品牌组与进度条 34px | 64.885rpx = 34px | 一致 | 保留 |
| SPL-004 | 品牌组间距 | 3px | 5.725rpx = 3px | 一致 | 保留 |
| SPL-005 | 彩弧 | 81×22.8，原 path/4px round stroke，三段渐变 | 154.58×43.511rpx，path/stroke/渐变一致 | 一致 | 保留源 SVG |
| SPL-006 | 品牌文案 | `CIRCA`，30px/500/0.30em | `Cimoa`，57.252rpx/500/0.30em | 批准差异 | 品牌替换已由交互约定授权，不再自主改大小写 |
| SPL-007 | 进度轨 | 150×4、2px 圆角、rgba(11,27,58,.08) | 286.26×7.634rpx、3.817rpx、主题 token 同值 | 一致 | 保留 |
| SPL-008 | 进度填充 | 64×4、2px 圆角、95deg 四色渐变 | 122.137rpx×100%、相同圆角/渐变 | 一致 | 保留 |
| SPL-009 | 入场动效 | cRise 240ms ease，Y 14px | PageTransition 240ms ease，Y 26.718rpx = 14px | 一致 | reference/actual 均固定结束帧 |
| SPL-010 | 进度动效 | cPulse 1500ms ease-in-out infinite | 参数一致 | 一致并已确定性取证 | reference/actual 均暂停在 750ms 相位 |
| SPL-011 | 自动跳转 | 1800ms 后 Welcome | 1800ms 后按会话目的地跳转 | 批准差异 | 验证游客 Welcome、有效会话 Home、失败 Retry |
| SPL-012 | 点击结果 | 整屏点击 Welcome | 根 `.splash-page` 整屏点击并按会话目的地跳转 | 已修正；会话分流为批准差异 | 顶部/底部安全区点击、连点与定时器竞争只导航一次 |
| SPL-013 | 内容 padding | 来源无 padding | `.splash-content` 为 0px | 已修正 | 393×852 几何测试通过 |
| SPL-014 | 系统装饰 | 原型公共层含 54px StatusBar | 不绘制，使用真实上下安全区 | 批准差异并已实测 | 浏览器注入 62/34；iPhone 17 Pro 实测 62/34 |
| SPL-015 | 错误/Retry | 来源默认状态无该分支 | 水合或导航失败显示英文 Retry | 必要补齐 | 只在真实失败出现，不影响默认截图 |
| SPL-016 | 参考图 | 393×852、来源锁定参数 | 本地 file URL 受浏览器安全边界保护；改用哈希校验后的来源契约确定性渲染 | 已生成证据，非原型运行时截图 | 用户需据 reference/actual/overlay/diff 作最终视觉确认 |

## 控件与文案清单

- 默认状态只有一个整屏点击入口、一个品牌组和一个非交互进度轨，不允许增加副标题、按钮、跳过文字或加载说明。
- 默认可见文案只允许批准后的 `Cimoa`。`Retry` 仅属于真实错误状态。
- Splash 不读取页面级业务数组，不写账号或骨架资格；会话目的地只从 Store/工具层派生。

## 确定性截图与差异结果

- 浏览器 reference 与 actual 固定为 393×852；cRise 固定结束帧，cPulse 固定 750ms。
- [reference.png](./reference.png) 是依据锁定且哈希验证通过的来源契约生成的参考图，不冒充原型运行时截图。
- [actual-browser.png](./actual-browser.png)、[overlay.png](./overlay.png)、[diff.png](./diff.png) 已生成。绝对像素差为 1128 像素，其中通道差值大于 8 的像素为 447；平均绝对通道差 0.040159，最大通道差 98。目视差异集中在文字抗锯齿与进度填充的亚像素边缘。
- [actual-browser-safe-area.png](./actual-browser-safe-area.png) 验证 62/34 安全区下来源品牌组仍在内容区正确居中。
- [actual-wkwebview.png](./actual-wkwebview.png) 来自 iPhone 17 Pro 模拟器原生 WKWebView；设备逻辑视口 402×874、截图 1206×2622、真实安全区 62/34。

## 浏览器与 WKWebView 回归

两端均已验证：游客自动进入 Welcome；有效会话恢复 Home；损坏存储显示 Retry 且原字节不被覆盖；整屏点击、连点和 1800ms 定时器竞争只导航一次；安全区下品牌组保持正确居中。WKWebView XCTest `HostTests.testSplashPixelRestoration` 在 iPhone 17 Pro（iOS 26.5）通过，1 test / 0 failures。

用户已完成视觉确认。最终三项强制校验与 H5 重构建通过后，本页随 Splash 本地专项提交封版；随后才允许把 Welcome 切换为唯一 `in_progress` 并开始其来源锁定。
