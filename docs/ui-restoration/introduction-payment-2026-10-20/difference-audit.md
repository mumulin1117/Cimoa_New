# 介绍计费、语音预览与等待状态专项

2026-10-20 用户明确授权本目录 source-contract.json 的变更；覆盖此前“文字免费”的决定。HTML 本体未修改，也不进入运行产物。

- 原文字页直接免费发送：改为 `Send text introduction · 10 Coins`，复用语音确认 Sheet、余额不足、处理中与失败返回。确认前显示发送后余额；请求和账本原子提交；已存在的免费请求不追溯收费。
- 语音原已存在预览路由，但录音页 `Send Request` 不表达下一步骤：改为 `Review voice introduction`，实际验明录音保存后进入独立 `Voice preview`、刷新试听、确认扣费再发送。
- 原待处理 CTA 可点开 sent：卡片和他人详情改为灰色 `Waiting for reply`，派生自同一 pending request；鼠标/键盘均不可重复发送，Home 请求卡保留查看入口，Chat 与收到邀请不受影响。
- 金币用途、FAQ、账单详情功能名与 EULA/条款费用说明同步；协议 revision 更新，旧同意记录不自动迁移为新同意。不增加购买成功分支，不自动接收请求。
- 原确认 Sheet 的布局、rpx、主题 token、固定骨架、安全区和 PageTransition 保留；新增文字确认是经授权复用，不冒称原稿已有独立文字确认设计。CTA 文案变长采用可换行布局，覆盖 320–430 宽 iPhone。

测试来源与结果见 browser-acceptance.json、native-acceptance.json、text-regression 和 deck-regression。整页像素级验收/全 App 完成状态不在本专项重新声明。
