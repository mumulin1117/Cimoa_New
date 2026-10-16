# Onboarding Basic Info 第一轮来源锁定与差异审计

## 最终结论

已锁定 HTML 原型 2892–2944 行并完成逐项修正。浏览器确定性像素、真实数据闭环、失败/取消/刷新、iPhone 17 Pro WKWebView 安全区与真实软键盘均通过；按用户授权自动确认为 `status: verified`、`visual_acceptance: passed`。

## 来源与实现差异

| ID | 项目 | 锁定来源 | 审计结论 | 处理 |
| --- | --- | --- | --- | --- |
| OBB-001 | 进度 | 14%，`1 / 8` | 原实现从十步 Store 流程派生为 10%，`1 / 10` | 已增加页面来源覆盖，保持本页原稿 |
| OBB-002 | 返回入口 | 46×46，来源 `goBack` | 外观存在但无 interaction ID | 已补 `obBasic.goBack.click.1`，保持真实返回归属 |
| OBB-003 | 两个输入 | margin 16；56 高；DOB `2004-03-12` | margin 14；DOB `YYYY-MM-DD`；缺 ID | 已逐项恢复来源尺寸、占位和 ID |
| OBB-004 | Gender | 22 上距；48 高；10 gap；五项来源顺序 | 选项及外观基本一致但缺 ID | 已补 `obBasic.o.pick.click.1` |
| OBB-005 | Pronouns | 同一 chip 规则；四项来源顺序 | 选项及外观基本一致但缺 ID | 已补 `obBasic.o.pick.click.2` |
| OBB-006 | 自定义值 | 来源只显示 Self-describe / Add your own chip | 原型没有完成输入路径 | 保留默认来源态；选中后显示授权补充的真实输入，不伪造选择结果 |
| OBB-007 | Continue | 左右 20、底部 34、高 60、来源 `goObUni` | 共享 footer 外观一致 | 保留；提交前自定义 Loading，成功才 Store 写入与进入 University |
| OBB-008 | 键盘 | 来源未描述系统键盘 | 固定 footer 可能遮挡输入 | 按约定消费 visualViewport，键盘打开时折叠 footer，唯一滚动区保留聚焦字段 |
| OBB-009 | 离页写入 | 原型是即时内存导航 | 异步结果可能在隐藏页继续导航 | 已加 onShow/onHide/unmount active guard；取消不会写入或导航 |
| OBB-010 | 页面资源 | 本页只有返回 SVG，无图片/音频 | 清单错误继承三张歌曲封面 | 已移除无来源媒体映射 |

## 验收结果

1. 浏览器像素专项 10/10：393×852 actual/reference/overlay/diff，平均通道差 `1.0481444648`，大于 8 的像素 `10701`。
2. 注册入口至 Basic 联合回归 6/6、Onboarding Store 10/10；覆盖空值、18+、自定义值、双击、Loading 前零写、Storage 回滚、离页取消、刷新恢复与返回。
3. iPhone 17 Pro（iOS 26.5）WKWebView 专项 1/1：视口 402×874、安全区 62/34；真实软键盘缩小 visualViewport、折叠 footer 并保持输入可见。
4. 原生默认、键盘、错误三张截图均为 1206×2622；最终证据见 [acceptance.json](./acceptance.json)。
