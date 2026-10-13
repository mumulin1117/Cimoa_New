# Cimoa 阶段三点一主题修正要求

**状态：completed（主题与离线资源基础，不代表页面视觉通过）。** `src/config/theme.json` 已替换旧深绿、荧光黄、米白；语义颜色/渐变/阴影统一由 theme 工具映射 CSS 变量。App 引入提取的本地字体 CSS，SourceIcon 保存源 SVG 路径。47 项图片/字体资源均经字节与 SHA256 核对；Home 以原型系统字体栈为主，原型其他字体可离线使用。

| 语义 | HTML 源值 | 位置 |
| --- | --- | --- |
| 页面渐变背景 | 168deg，#e4f4fb → #eaf0fd 44% → #f2ecfb | 原型主画布 |
| 标题/主图标 | #0b1b3a | Home 卡片、标题、TabBar |
| 次级文字 | #5b6b85 | Home 副标题 |
| 品牌 tagline | #64748b | Home 顶栏 |
| 主按钮渐变 | 95deg，#1ec8f5 → #4a7bf7 34% → #a855f7 64% → #f81ce5 | Home 空态主操作 |
| Tab 选中渐变 | 120deg，#1ec8f5 → #4a7bf7 38% → #a855f7 68% → #f81ce5 | TabBar.dc.html |
| 白卡/标签底 | #ffffff / #f4f7fb | Home 联系卡 |
| Connected | #dcfce7 / #15803d | Home 状态标签 |
| Invite | #e2e9fb / #1e3a8a | Home 状态标签 |
| 阴影色 | rgba(16,36,74,0.07) 等不同语义透明度 | 卡片、Tab、Popover，分别建立 token |

所有颜色、渐变、边框/阴影/遮罩进入唯一 theme.json，并映射语义 CSS 变量；SVG 固有颜色生成主题一致的独立变体，保留源文件。尺寸按 393 宽设计换算为 rpx，边框 px 和安全区回退除外。所有消费者需要逐个核对，不能只换品牌主色就声称视觉还原。
