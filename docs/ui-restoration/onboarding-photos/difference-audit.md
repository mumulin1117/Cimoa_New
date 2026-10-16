# Onboarding Photos 与照片权限第一轮来源锁定与差异审计

## 当前结论

已锁定 HTML 原型 3018–3053、3208–3227 行及对应行为片段。`/pages/onboarding/photos` 的 Empty、Added 与首次照片库 pre-prompt 已作为同一媒体闭环完成浏览器及 iPhone 17 Pro `WKWebView` 验收；当前为 `status: verified`、`visual_acceptance: passed`。

## 来源与实现差异

| ID | 项目 | 锁定来源 | 审计结论 | 处理 |
| --- | --- | --- | --- | --- |
| OBP-001 | 进度 | 38%，`3 / 8` | 原实现按十步 Store 显示 `4 / 10`、40% | 本页覆盖为来源值 |
| OBP-002 | 返回 | 46×46，来源 `goBack` | 外观存在但缺 interaction ID | 增加 `obPhotos.goBack.click.1`，返回 Major；Complete 恢复入口仍 pop 实际来源 |
| OBP-003 | 标题与说明 | 居中；说明上距 10px | 现有布局一致 | 保留 |
| OBP-004 | 照片扇形 | 146×204；侧卡 top 44px、±96px、±12° | rpx 几何一致；主照片在中间卡 | 保留实体主序与视觉技术顺序映射 |
| OBP-005 | Added 提示 | `replace, reorder, delete...` | 实现误写为 `remove` | 恢复来源文案 `delete` |
| OBP-006 | Continue 门槛 | 可见文案要求至少 2 张；来源状态逻辑却 `photos > 0` | 来源自身矛盾 | 以可见规则和业务完整性为准，少于 2 张不可完成 |
| OBP-007 | 已填卡操作 | 来源只弹 toast，未形成闭环 | 已有自定义 Sheet 真实执行替换、排序、删除、设主图 | 作为用户授权补齐差异保留，并验收原子性与刷新同步 |
| OBP-008 | 照片权限位置 | 393×852 时内容 top 172px | 原实现低 10px | safe-area 基线下上移 10px |
| OBP-009 | 拒绝态 | `Access is off` 与来源完整说明 | 原实现统一为 Photos were not added | 拒绝态恢复来源文案；真实选择/存储错误保留明确原因 |
| OBP-010 | 品牌 | 来源写 CIRCA | 项目品牌是 Cimoa | 仅品牌词替换，结构和语义不改 |

## 验收结论

- 393×852 Empty、Added、Permission 三个来源完成帧已生成 reference、actual、overlay、diff；三组平均通道差分别为 `0.3152`、`0.9176`、`1.2212`。
- 浏览器 9/9：两张门槛、三张上限、取消/拒绝、无宿主 Settings、无效图片解码、真实 IndexedDB 写入、设主图、排序、删除确认、替换和刷新恢复均通过。
- 注册回归 `photos` 8/8、`photo-access` 9/9，Store 注册回归 10/10；失败和取消均无部分写入。
- Back 正确回到 Major/Photos；双击 Continue 只提交一次并进入 About。
- iPhone 17 Pro、iOS 26.5、402×874 `WKWebView` 通过 1/1，安全区上 62、下 34；三张截图来自离线包内 H5，真实图片文件经过生产解码与 IndexedDB 路径后刷新恢复。
- XCTest 中以受控文件输入注入包内真实图片来覆盖 WebKit 文件选择后的生产处理链；它不宣称自动化操作了系统照片选择器界面。
