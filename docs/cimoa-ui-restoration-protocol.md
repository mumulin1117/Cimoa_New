# Cimoa 像素级页面还原流程

本流程补充阶段五的视觉执行门槛，不替代 `DEVELOPMENT_CONVENTIONS.md`、`INTERACTION_CONVENTIONS.md` 或 `模板项目开发流程.md`。发生冲突时，先按三份既有约定处理；仍无法确定则停止当前页面并请求用户决策。

## 1. 来源与零自主修改

`CIRCA All Screens (interactive).html` 是 UI 的唯一来源，现有 Vue 页面只能作为待审计实现。除已登记的用户决定和技术适配外，不得自行：

- 改写、缩短、润色、翻译或补充可见文案；
- 更换按钮、输入框、Popover、Sheet、Dialog、列表或卡片的控件类型；
- 增删标题、说明、图标、标签、卡片、分割线、阴影或装饰；
- 调整信息层级、内容顺序、固定区、滚动区或交互入口；
- 用近似图片、Emoji、通用图标、CSS 临摹或组件库默认皮肤替换来源资源；
- 以组件复用、代码简化或体验优化为理由改变视觉输出。

允许差异仅包括：CIRCA 到 Cimoa 的已批准品牌替换、交互约定中的用户业务决定、真实系统安全区替代原型系统装饰、以及缺服务/资源时的明确失败路径。每项都必须写入页面契约的 `approved_deltas`。

## 2. 页面状态与证据目录

页面清单继续使用 `status: pending | in_progress | verified`，并增加独立字段：

- `source_lock: pending | locked`
- `visual_acceptance: pending | failed | passed`
- 既有 `local_acceptance` 和 `full_acceptance`

只有四项验收均通过，页面才可 `verified`。每页证据放在 `docs/ui-restoration/<page>/`：

```text
source-contract.json
difference-audit.md
reference.png
actual-browser.png
overlay.png
diff.png
actual-wkwebview.png
acceptance.json
```

无法自动或人工取得原型运行图时，可以依靠静态源码完成 `source_lock`，但必须说明原因，且 `visual_acceptance` 保持 `pending`。

## 3. 单页固定流程

### 3.1 开工门禁

1. 确认当前没有其他 `in_progress` 页面，再把目标页设为唯一 `in_progress`。
2. 核对来源状态、路由、参数、入口、返回归属、固定区、滚动区、资源和全部 interaction IDs。
3. 确认 interaction ID 十字段契约完整；缺字段先回阶段 1–3，不在页面临时补业务数据。

### 3.2 来源锁定

编码前先生成 `source-contract.json`，至少记录：

- 原型文件 SHA-256、查询参数、来源行、条件区块和片段 hash；
- 393×852 下的全部坐标、尺寸、间距、层级和点击范围；
- 每段可见文案，包括大小写、标点、空格、换行与省略规则；
- 字体族、字号、字重、行高、字距、颜色、圆角、边框、阴影和渐变停点；
- SVG path、图片/字体资源 ID、目标本地路径和 hash；
- 默认、选中、禁用、Loading、空、错误、成功等状态；
- 动画名称、时长、曲线、位移、透明度和循环相位；
- 原型行为、项目业务行为及 `approved_deltas`。

来源不明确、资源缺失或多个状态冲突时，只记录证据和阻塞，不猜测设计值。

### 3.3 差异审计

暂不改代码，逐项比较来源与当前实现，在 `difference-audit.md` 中记录：

```text
ID | 项目 | 来源值 | 当前值 | 结论 | 处理方式 | 涉及文件
```

必须覆盖结构、文案、控件、资源、几何、字体、颜色、动效、固定/滚动关系、点击热区、状态与已批准差异。历史“构建通过”或“功能通过”不能替代本轮视觉结论。

### 3.4 实现顺序

按以下顺序修改，禁止同时展开下一页：

1. 页面骨架、固定区、滚动区与安全区所有权；
2. 原始图片、SVG、字体和主题 token；
3. 原始文案与信息层级；
4. 尺寸、定位、间距、字体、颜色、圆角、阴影；
5. 控件状态、弹层和动画；
6. interaction IDs、Store action、失败路径、持久化和跨页同步。

共享组件输出不一致时增加精确变体；修改共享组件前必须列出所有消费者并回归，不能为当前页破坏其他页面。

### 3.5 视觉取证

1. 来源与实现都使用 393×852，缩放 100%，相同字体、资源、数据和状态。
2. 等待字体与图片完成；入场动画固定在结束帧。循环动画固定在同一时间点并在证据中记录。
3. 分别保存 reference、浏览器 actual、50% 叠图和绝对差异图；之后保存 WKWebView actual。
4. 几何边界允许最多 1 CSS px 偏差；文案、控件清单、资源和状态不允许模糊匹配。
5. 仅字体抗锯齿和已登记的系统安全区允许注释后排除。不得只用整体差异百分比宣布通过。
6. 自动差异图用于定位问题，最终仍需逐区查看叠图。

### 3.6 功能与状态回归

完成默认、Loading、空、错误、长内容、滚动、键盘、安全区、返回、刷新恢复及首次/再次打开。主 Tab 还要检查固定 Tabbar、栈深和单次骨架；跨页入口必须使用真实实体 ID 并验证返回和同步。

### 3.7 验收、校验与提交

完成实现后先保持 `visual_acceptance: pending`，生成并保存来源图、实现图、叠图、差异图和未解决差异。2026-10-15 用户已授权后续页面自动视觉确认：只有来源锁定、已知差异全部修正、逐区叠图检查、浏览器与 WKWebView 取证、功能/状态回归均通过，且没有来源不确定或未解决差异时，才可自动设为 `passed`；证据仍须在进度说明中提供。任一条件不满足时保持 `pending` 或 `failed` 并停止当前页，不得用“自动确认”绕过差异。

页面还必须满足 local/full acceptance，并依次执行：

```bash
corepack pnpm check:conventions
git diff --check
corepack pnpm build:h5
```

只暂存本页及其专属依赖，完成本地专项提交，不 push。自动确认页在提交完成后直接开始下一页来源锁定；依赖未完成时按阶段五分段规则回到 `pending`，完整闭环和证据齐备后才标记 `verified`。

## 4. 判定原则

- 视觉不确定：`source_lock` 或 `visual_acceptance` 保持 pending。
- 已知视觉差异：`visual_acceptance: failed`，先修正再复核。
- 来源锁定不代表实现通过；构建成功不代表视觉通过；浏览器通过不代表 WKWebView 通过。
- 任何人都不得用旧截图、口头描述、组件存在或路由可打开替代当前页面的证据链。
