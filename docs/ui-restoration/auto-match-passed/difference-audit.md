# Passed 来源锁定与差异审计

来源 HTML 1820–1840：保留圆形叉号、Match skipped、两段说明和 Find Another Match / Return Home 两个固定入口。移除旧通用结果组件的无来源布局。实际安全区、固定区域和 Store 状态守卫按约定适配。

Find Another Match 按用户确认沿用原入池资格，500ms Loading 后创建关联下一轮；不修改原结果、不再扣次数或金币。返回 Home 不偷偷离开或收费。视觉证据和完整跨页依赖通过前不标 verified。
