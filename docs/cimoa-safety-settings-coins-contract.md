# Cimoa 安全、设置、金币与本地账号契约

2026-10-17实现增量见[本轮记录](./cimoa-profile-settings-coins-acceptance.md)。用户已决定移除Apple登录/注册UI，本轮不恢复这些入口；下文早期Apple登录契约不代表当前页面。金币请求使用原created_at+8000ms窗口和精确请求/产品/账号绑定，隐藏页停止观察与写入、恢复不重复派发。初始余额与经过验证的购买在统一详情getter中区分。Terms/Privacy现还支持Coin Help来源，刷新回退只携带Store验证过的本人draft ID。注销成功页由本次auth_flow.deleted_account_id归属，不能展示旧注销。

本契约在阶段 5 开始前补齐本轮页面的阶段 1–3 信息。UI 来源为 `CIRCA All Screens (interactive).html`；涉及服务承诺的演示脚本不作为真实结果。所有页面使用当前账号 Store、统一路由过渡、固定 Header/底部安全区和唯一滚动区。

## 本地能力边界

- 举报提交在校验后返回来源页，仅显示统一品牌反馈，不新增举报历史；允许对同一对象重复举报。若同时选择拉黑，仅拉黑关系与既有关系清理结果持久化。客服能力仍按实际可用状态反馈。
- 拉黑原子移除双方关系、待处理请求、当前 Auto Match 候选、私聊会话和私聊消息；解除拉黑只移除 block 记录，不恢复上述数据。
- 权限页读取系统或浏览器真实状态；普通浏览器的宿主设置入口明确失败。通知请求使用真实系统结果。
- 法律页是本地构建的信息说明，不声称已有发布主体、隐私联系人或生产服务条款。
- 金币余额来自已完成账本。套餐价格只是原型 UI 参考；`product_id`、StoreKit 与收据校验缺失时，购买记录为 failure/timeout/cancelled，余额不变。
- Apple 登录没有授权配置，入口只显示明确错误且不创建会话。密码重置仅适用于本设备已有账号，固定本地代码为 `009789`；不发送邮件、不证明邮箱或学生身份，成功后仍需用新密码登录。

## 页面与返回归属

| 页面 | 路由 | 来源 / 返回 |
| --- | --- | --- |
| Notifications / Privacy / Permissions / Language / Blocked / Support / Legal | `/pages/settings/*` | Settings → 返回 Settings |
| Submitted reports / Report detail | `/pages/safety/reports`, `/pages/safety/report-detail` | Settings → Reports → Detail |
| Report user | `/pages/safety/report-user?user_id=…&context_id=…` | 人物/聊天/参与者 → 返回真实来源 |
| Report event | `/pages/events/report?event_id=…` | 活动详情 → 返回活动详情 |
| Delete info / reason / final / success | `/pages/settings/delete/*` | Settings 逐层进入；成功清栈到 success，再进入 Welcome |
| Terms / Privacy | `/pages/legal/terms`, `/pages/legal/privacy` | Legal、Welcome 或 Signup → 返回真实来源 |
| Coin Center / purchase state / history / details / help | `/pages/coins/*` | Profile/Settings/付费上下文 → 返回真实来源 |
| Password reset email / code / new password | `/pages/auth/reset/*` | Login 逐层进入；成功清栈回 Login |

## interaction_ids 十字段契约

下表每行包含十字段：ID、来源、触发、前置、可见反馈、成功、失败、持久化、同步范围、验收。

| interaction_id / 来源 | trigger 与 preconditions | visible_feedback / success_result | failure_result | persistence / sync_scope / acceptance |
| --- | --- | --- | --- | --- |
| `setNotif.toggleNotifMaster.click.1`, `setNotif.n.toggle.click.1` / Notifications | 点击；账号有效，开启主通知需真实权限 | 系统请求或开关立即反映；Store 通知偏好更新 | 拒绝、不可用或写失败时原值不变并显示原因 | local metadata；Settings/Onboarding；刷新后值一致，系统拒绝不假开启 |
| `setPrivacy.o.pick.click.1`, `setPrivacy.p.toggle.click.1` / Privacy | 点击；账号有效 | 选择描边/开关变化；Store 原子保存 | 写失败恢复旧值并报错 | local metadata；Discover/Auto Match/资料/活动/媒体入口；切换账号隔离并刷新恢复 |
| `setPerm.p.openSettings.click.1` / Permissions | 点击；真实状态读取完成 | 状态徽标；WKWebView 打开系统设置 | 浏览器/宿主失败显示明确错误 | none；系统权限；前后台恢复后重新读取 |
| `setLang.o.pick.click.1` / Language | 点击 | English 保持选中 | 繁中未实现时明确不可用，不伪切换 | none；全局 locale；刷新仍为 en-US |
| `blockedList.b.unblock.click.1`, `unblockOpen.confirmUnblock.click.1` / Blocked | 点击、确认；目标仍被当前账号拉黑 | 自定义 Sheet + 400–600ms Loading；成功移除 block | 取消/写失败保持拉黑 | local metadata；所有人物/聊天/活动筛选；解除后不恢复关系/消息 |
| `safetyReport.submitReport.click.1`, `evReport.submitEvReport.click.1` / Report | 点击；真实目标、原因有效且不能举报自己 | 400–600ms 品牌 Loading；返回来源页并显示 `Thank you for sharing your concern. We’ll review it as soon as possible.` | 失败保留理由/描述；不显示成功反馈 | 不新增举报记录；同一对象可重复提交；勾选拉黑时仅持久化拉黑事务 |
| `settings.openDelInfo.click.1` → `delFinal.confirmDelete.click.1` / Delete | 逐层点击；密码正确 | 自定义危险确认、Loading；清除本地账号私有实体并进入成功页 | 密码/存储失败保持账号和会话 | local metadata + IndexedDB cleanup；所有受保护页；旧凭据不可再登录 |
| `coinStore.p.pick.click.1`, `coinStore.continuePurchase.click.1` / Coin Center | 选择、继续；套餐存在且无 pending 购买 | 选择不写；确认后 Loading、创建 pending 并进入 purchasing | 写失败余额不变 | local metadata；购买状态/历史；重复触发只产生一个 request_id |
| `coinApple.appleConfirm.click.1` / Purchasing | 原生回调；请求、账号、商品、receipt 匹配 | 八秒仅限制宿主应答，已受理保持 pending；原生验签并二次核对、Store 原子落账后 ACK/finish | 未受理超时或真实失败不加币；退出不假取消苹果付款 | purchase request + verified ledger；Profile/Settings/History；迟到有效交易可恢复，每 transaction ID 仅入账一次 |
| `coinPurchasing.reviewInterrupted.click.1` / Purchasing | 点击；当前账号请求为 interrupted 且 native 标记可释放 | 打开品牌确认弹窗，明确原付款仍可能完成、新购买为另一笔付款 | 不可释放/待批准时不修改状态 | none；同一 request_id；正常 Apple pending 无此入口 |
| `purchaseRecovery.close.click.1`, `purchaseRecovery.keepChecking.click.1` / Purchase recovery dialog | 关闭/继续核对；尚未提交 | 关闭弹层，继续保留原请求 | Loading 期间禁用重复操作 | none；Purchasing；取消不取消苹果交易、不扣币 |
| `purchaseRecovery.release.click.1` / Purchase recovery dialog | 明确确认；当前账号同请求仍可释放 | 单次 400–600ms Loading 后原生释放等待、H5 同步 Request released；允许另开一笔购买 | 原生或 H5 写失败可刷新重试，不假称支付取消 | native journal + purchase metadata；恢复页/历史/余额；中途退出后可修复释放状态，原交易迟到仍幂等交付 |
| `coinHistory.h.pick.click.1`, `coinHistory.t.go.click.1` / History | 点击筛选/流水 | 过滤当前账号同一账本，详情传 transaction_id | 非法 ID 显示可返回错误态 | none；余额/详情；空、长列表、刷新和返回一致 |
| `fpEmail.goFpCode.click.1` / Reset email | 点击；登出且本设备存在 active local/fixture 账号 | Loading 后创建 reset_id，明确展示本地固定码规则 | 未找到/写失败保留邮箱 | local auth_flow；reset pages；其他账号不可复用 reset_id |
| `fpCode.goFpNew.click.1` / Reset code | 点击；reset_id 匹配且代码精确为字符串 `009789` | Loading 后标记该 reset 已验证 | 任意其他格式失败且不写 | local auth_flow；new password page；刷新恢复验证状态 |
| `fpNew.finishReset.click.1` / New password | 点击；reset 已验证、密码规则满足 | Loading 后生成新盐和摘要，清 reset，回 Login | 失败不改变旧凭据，保留表单以重试 | local account credential；Login；旧密码失败、新密码成功 |
| `login.appleAuth.click.1`, `signup.appleAuth.click.1` / Auth | 点击 | 明确显示 Apple 授权未配置 | 不导航、不创建账号/会话 | none；Auth；点击前后 Store 深度一致 |

## 验收场景

每页覆盖默认、空、错误、长内容、滚动、安全区、返回、刷新和账号切换。安全链路额外覆盖拉黑后的 Home/Discover/Auto Match/参与者/私聊/群聊同步；购买覆盖 failure/cancel/timeout/重复/迟到回调；删除覆盖密码错误和存储失败原子性；普通浏览器与 iOS WKWebView 分别记录，未配置服务的失败路径不能被记为成功路径。
