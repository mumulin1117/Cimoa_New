# Terms of Service 来源锁定与差异审计

## 当前结论

锁定 HTML 原型 1034–1054 行及 6011–6017 行。已恢复 `Terms of Service`、58px Header、118px 滚动起点和来源长文排版。生产运营方、真实学生验证、审核团队、StoreKit 成功、活动主办方与 `support@circa.app` 均未配置，因此保留明确标记为 unpublished local draft 的真实内容。浏览器、320×568 安全区探针和 iPhone 17 Pro WKWebView 均通过，当前 `status: verified`、`visual_acceptance: passed`。

| ID | 项目 | 来源 | 当前实现 | 处理 |
| --- | --- | --- | --- | --- |
| LGT-001 | Header | `Terms of Service`；Back y=58 | 已恢复来源标题与几何 | 浏览器与 WKWebView 通过 |
| LGT-002 | Scroll | y=118；左右 20px；底部 48px | 单一 scroll-view | 通过 |
| LGT-003 | Updated | 生产日期 | `Local draft · 14 October 2026` | 批准差异，明确未发布 |
| LGT-004 | Intro/sections | 声称生产服务、审核、支付与组织者 | 八节本机能力和缺口说明 | 批准差异，禁止虚假服务 |
| LGT-005 | Contact | `support@circa.app` | 明确未配置生产法律/支持联系方式 | 批准差异，禁止编造联系人 |
| LGT-006 | 刷新/返回 | 返回来源页 | Guest 回 Welcome；登录用户回 Settings Legal | 通过 |
| LGT-007 | 状态 | 阅读型页面 | 全程零写入 | 通过 |
