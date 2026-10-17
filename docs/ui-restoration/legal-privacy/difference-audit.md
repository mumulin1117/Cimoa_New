# Privacy Policy 来源锁定与差异审计

## 当前结论

锁定 HTML 原型 1034–1054 行及 6011–6017 行。已恢复 `Privacy Policy`、58px Header、118px 滚动起点和来源长文排版。原型中的生产数据收集、服务商共享、审核团队和 `privacy@circa.app` 均未配置，因此保留明确标记为 unpublished local draft 的真实内容。浏览器、320×568 安全区探针和 iPhone 17 Pro WKWebView 均通过，当前 `status: verified`、`visual_acceptance: passed`。

| ID | 项目 | 来源 | 当前实现 | 处理 |
| --- | --- | --- | --- | --- |
| LGP-001 | Header | `Privacy Policy`；Back y=58 | 来源标题与几何 | 浏览器与 WKWebView 通过 |
| LGP-002 | Scroll | y=118；左右 20px；底部 48px | 单一 scroll-view | 通过 |
| LGP-003 | Updated | 生产日期 | `Local draft · 14 October 2026` | 批准差异，明确未发布 |
| LGP-004 | Intro/sections | 声称生产收集、共享、审核与服务商 | 九节本机数据范围和缺口说明 | 批准差异，禁止虚假服务 |
| LGP-005 | Contact | `privacy@circa.app` | 明确未配置生产隐私/支持联系方式 | 批准差异，禁止编造联系人 |
| LGP-006 | 刷新/返回 | 返回来源页 | Guest 回 Welcome；登录用户回 Settings Legal | 通过 |
| LGP-007 | 状态 | 阅读型页面 | 全程零写入 | 通过 |
