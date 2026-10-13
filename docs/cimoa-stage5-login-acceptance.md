# Login 当前检查与未完成项

2026-10-13。运行检查通过，页面还原pending（用户优先要求固定验证码，暂停Login视觉决策），local/full均pending；未verified。来源2659–2705及交互十字段见[认证契约](./cimoa-auth-interactions.md)。

## 已实现

- 独立Vue/uni-app页面，复用安全区、单scroll-view、固定header/footer、240ms入场/180ms返回；46返回、56输入/Apple、60登录按钮按393原稿转rpx。主题/SVG提取到项目，不嵌入HTML。
- 本地邮箱/密码登录经500ms自定义Loading后调用Store；成功才持久化会话、清栈到Home并准备三个主Tab各一次骨架。失败原子回滚，密码不写草稿；隐藏/卸载清理延迟和密码，异步凭据校验结束前再次检查操作是否有效。
- 首次启动访客，有效既有会话只恢复、不准备骨架。旧auth/index只重定向新页面，未恢复目标明确报错，不渲染旧合并界面。
- Apple和密码重置保持真实未配置/缺依赖反馈，不制造授权或验证码。本地注册数据接口已实现，不自动给学生认证、资料、金币或好友。

## 证据

- [Login浏览器报告](./evidence/auth/login-browser.json)：13项，通过默认布局、空/错误表单、Show/Hide、错误密码、存储失败、400ms前无写入、成功后的3Tab骨架/栈、刷新、离开取消、320×568长内容及62/34安全区、直达Back、旧链接兼容。无浏览器运行异常。截图：[默认](./evidence/auth/login.png)、[小屏](./evidence/auth/login-small.png)。PID85727由finally关闭。
- [Welcome浏览器报告](./evidence/auth/welcome-browser.json)：8项，包括真实Welcome→Login→Back；PID85202已关闭。
- 59项单元测试全通过，含拉黑过滤、媒体持久化/恢复、跨账号隔离和新本地注册/login/取消校验。这不是未实现页面的端到端验收。
- Home22、Discover20、Events19、Profile20项最新浏览器回归通过；PID85379/86002/86052/86086均由finally关闭。图片404/ERR_FAILED为预期故障注入，非未处理脚本异常。
- [原生摘要](./evidence/ios-entry/acceptance.json)：EntryAcceptance-3.xcresult，iPhone17Pro/iOS26.5，5/5通过，0失败/跳过。覆盖访客重载→Welcome→真实本地登录、单次Home骨架、原生安全区/本地资源、桥接失败边界、三Tab/Profile返回、WebKit媒体探针恢复。Welcome滚动后文字可读且footer固定；正常开发浏览器无宿主失败路径也保留。
- 首次原生新测试失败因hash-only导航没有重建文档，现通过query触发真正冷启动；第二次及最终第三次5/5通过，未放宽断言。测试备份并恢复原有两份认证存储，临时IndexedDB探针清理。

## 必须保持未完成

1. HTML含TEST STATES/Wrong password/Unverified account。当前草稿未显示该调试区，已询问用户是否从正式App移除；未获决定前不能认定UI与原型一致。真实错误/未验证状态已有Store和自动化覆盖，不用静态按钮伪造业务结果。
2. 年龄、社区、注册UI及协议/重置依赖未还原。本地注册只有数据接口和单测，不能声称新用户注册页面已可用。用户随后明确固定009789，Code/Success单独实施，见[最新记录](./cimoa-local-verification.md)；不变更本页其他未决范围。
3. 全页面实体同步、所有返回归属、系统触摸/键盘/权限硬件与完整生产链路仍待补齐；发布法律信息与正式签名也未配置。

## 本页任务文件

- `src/pages/auth/login.vue`、`auth.css`、兼容入口`index.vue`，`src/components/AuthPageFrame.vue`、`AuthActionLoading.vue`、`SourceIcon.vue`。
- `src/config/theme.json`、`src/pages.json`、`src/utils/authNavigation.js`、`writeOperation.js`、`src/stores/store.js`。
- `scripts/auth-browser.test.mjs`、`auth.test.mjs`、`circa-source.test.mjs`、`h5-browser.test.mjs`；源清单测试修正Splash根页应没有假父路由。
- `ios/cimoaNeapo/Tests/HostTests.swift`、`README.md`；认证契约、清单/差距审计、阶段五/六记录与上述截图报告；`dist/build/h5`对应构建产物。

只做本地提交，不推送。提交用于保存本页已实现代码和实测证据，不表示页面已通过最终验收。原计划等待当前差异再开始下一页；随后用户明确固定验证码009789，按最新要求先完成该独立增量，Login视觉差异仍pending，不视为已获移除授权。

最后按顺序执行`corepack pnpm check:conventions`、`git diff --check`、`corepack pnpm build:h5`，全部通过，无约定警告。H5 117文件同步到宿主；[当前导出校验](./evidence/ios-entry/package.json)确认150个ZIP条目及全部H5哈希一致，无原型/DerivedData/xcuserdata。导出包是开发中快照，不是完整还原交付。所有记录的临时服务PID及隔离浏览器进程复查均已退出，未停止用户原4173服务。
