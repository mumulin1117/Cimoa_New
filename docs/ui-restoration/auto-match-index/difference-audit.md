# Entry 来源差异审计

来源锁定：HTML 1460–1508，393×852。当前旧实现为通用 FlowPageHeader/flow-body，未按来源还原。

ID | 项目 | 来源值 | 旧实现 | 处理
--- | --- | --- | --- | ---
E01 | 骨架 | 58px Header / 118px 内容 / bottom30 CTA | 通用区块间距 | 保留源几何，安全区替代54占位，固定头尾和唯一滚动区
E02 | 文案 | Join the pool and we’ll… / Get matched | 自行改为service文案 | 恢复源文案
E03 | 控件 | verified pill / 3 steps / 两信息卡 / cost note | 额外quota/service卡 | 恢复完整结构和原SVG
E04 | 入口 | Back / Join / Preferences | 额外History | 移除无来源入口；Profile既有History保留
E05 | 数据 | 48/2min为演示 | Waiting for service | 显示本机匹配引擎可用人数/9秒准备时间，禁止伪造在线人数
E06 | 状态 | quota/cost / resume | 通用文案 | 当前会话恢复不重开/扣费；失败不部分写入
E07 | 视觉 | 来源字体、圆角、渐变、图标 | 通用Flow皮肤 | 离线提取到独立Vue/rpx/主题token；不运行HTML

关联：src/pages/auto-match/index.vue、AutoMatchConfirmDialog.vue、useAutoMatchPage.js、matchPresentation.js。
已批准差异：品牌、真实安全区、固定骨架、当前实体/配额、区域距离；无实时在线服务时不把候选人数声称为在线统计。
