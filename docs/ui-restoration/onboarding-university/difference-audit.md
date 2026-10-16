# Onboarding University 第一轮来源锁定与差异审计

## 最终结论

已锁定 HTML 原型 2948–2987 行并完成逐项修正。浏览器确定性像素、真实数据闭环、失败/取消/刷新、iPhone 17 Pro WKWebView 安全区与真实软键盘均通过；按用户授权自动确认为 `status: verified`、`visual_acceptance: passed`。

## 来源与实现差异

| ID | 项目 | 锁定来源 | 审计结论 | 处理 |
| --- | --- | --- | --- | --- |
| OBU-001 | 进度 | 26%，`2 / 8` | 原实现从十步 Store 派生 | 已增加本页来源覆盖 |
| OBU-002 | 返回 | 46×46，来源 `goBack` | 外观存在但缺 interaction ID | 补 `obUni.goBack.click.1`，返回 Basic |
| OBU-003 | 学校卡片 | HKUST、蓝色验证勾及“Verified”文案 | 本地固定码不能证明学校身份；原实现又缺来源图标结构 | 恢复 20px 图标、18px 标题和来源间距；改为学校图标与明确的 self-reported/pending 文案，学校名可真实填写 |
| OBU-004 | 年级 | 五项、48 高、10 gap，来源 `yearOptions` | 外观基本一致但缺 interaction ID | 补 `obUni.o.pick.click.1` |
| OBU-005 | 专业 | 16 上距、56 高、Design 占位 | 原实现接近但缺 interaction ID | 补 `obUni.onObField.change.1` 并锁定来源间距 |
| OBU-006 | 毕业年份 | 来源是静态 `Expected graduation · 2027` | 原实现自主增加标签、Optional 和第二个输入控件 | 删除无来源控件，恢复来源文案；值随同一资料实体保存 |
| OBU-007 | 冷启动 | 来源是内存态 | 原实现只在 setup 时读取 context，异步 hydrate 后保留空草稿 | 改为按 account_id 一次性恢复，编辑中不被 Store 更新覆盖 |
| OBU-008 | Continue | 来源进入 Major | 共享行为已有 Loading 和 Store action | 保留真实校验、500ms Loading、单次原子写入、失败回滚和离页取消 |
| OBU-009 | 键盘/安全区 | 原型固定 393×852 | 系统键盘与刘海由宿主决定 | 继续使用真实安全区；键盘打开折叠 footer，唯一滚动区保持输入可达 |

## 验收结果

1. 浏览器像素专项 9/9：393×852 actual/reference/overlay/diff，平均通道差 `2.9685151836`，大于 8 的像素 `20778`；差异包含已批准的本地身份诚实表达。
2. 注册入口至 University 联合回归 7/7、Onboarding Store 10/10；覆盖空值、100 字边界、双击、Loading 前零写、Storage 回滚、离页取消、刷新恢复与返回。
3. iPhone 17 Pro（iOS 26.5）WKWebView 专项 1/1：视口 402×874、安全区 62/34；真实软键盘缩小 visualViewport、折叠 footer 并保持输入可见。
4. 原生默认、键盘、错误三张截图均为 1206×2622；最终证据见 [acceptance.json](./acceptance.json)。
