# Cimoa 个人资料与账号闭环

2026-10-17更新：本轮已补齐语音简介录制/试听/暂存/最终原子Save和媒体刷新、源12组偏好、脱敏认证页，以及设置/安全/金币子页的账号与恢复边界。最新结论见[当前验收记录](./cimoa-profile-settings-coins-acceptance.md)；下文的80项与“语音/Coins/设置子页未完成”属于2026-10-14历史范围，不覆盖本轮。尚未配置的真实服务仍保持失败，完整视觉与生产验收不冒标通过。

本轮范围为当前账号的资料编辑、照片、兴趣、目标、破冰问题、预览，以及设置主页面的退出和重新登录。来源为原型 Edit All、Basic Info、Interests、Connection Goals、Icebreakers、Preview、Settings 与 Logout；不扩展支付、学生认证、客服和删除账号服务。

## 当前执行

Edit All、Basic Info、Interests、Connection Goals、Icebreakers、Preview、Settings 主页面与退出弹层均通过本轮局部闭环；status pending、local passed、full pending，当前无 in_progress。80项单元、17组资料账号浏览器检查及最终WKWebView 7/7通过；完整验收和 verified 不以路由存在或局部通过代替完成。

## 阶段一与交互契约

统一使用页面清单中原有 interaction_ids。每个入口的十字段契约由下表公共规则与该页行共同确定，新增真实照片操作用 profileEdit.photo.*。父页保留实例，三级页返回真实来源；刷新无历史时 Basic/Interests/Goals/Ice 返回 Edit All，Edit All/Preview/Settings 返回 Profile。Edit All 也允许来自 Preview 和 Settings。

| interaction_id / source_screen / trigger | preconditions | visible_feedback | success_result | failure_result | persistence | sync_scope | acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| editAll.goBack/eaSave；1057–1230；点击 | 已 hydration、同一有效账号 | 保存前 ProfileActionLoading 500ms；返回无 Loading | Save 原子保存本页变更并返回；Back 丢弃未保存草稿 | 留页保留草稿；不部分更新 | users、profile_photos、media_files；Blob 仅 IndexedDB | Profile、Preview、设置头像及所有同 ID 消费者 | 保存、取消、存储失败、连点、账号切换、刷新 |
| editAll.eaPhotos / profileEdit.photo.*；1071；选图/确认/排序 | 本人；图片可解码、20MB 内；最多3张 | 临时预览；删除自定义确认；最终 Save 才 Loading 写入 | 本地账号保留2–3张；旧 fixture 可保留1张；首张同步头像 | 取消/无效图片/保存失败不改变公开照片，清理新孤立 Blob | 同上；未提交草稿不落盘 | 头像、相册、Preview | 添加/替换/主图/前后移动/删除；刷新可读；取消不写 |
| editAll.eaOpenBio/onEaBio/f.pick/eaBioDone/eaClose；1157；点击/输入 | 有效账号；最多300字；字体来自既有 catalog | 原稿居中简介编辑弹层；Done 仅更新页面草稿 | Text 与字体在最终 Save 同时持久化 | 关闭弹层不改草稿；无可用语音明确错误，不伪造录音 | bio/bio_font | Profile/Preview | 切换字体、取消、保存及刷新一致 |
| editAll.eaOpenHeight/Degree/Country/Clubs/Mbti/Religion/Drink/Smoke、o.pick、eaCommit；1107–1154；点击 | 使用已有 Store picker_options；国家最多2项 | 原稿列表/网格 Sheet；选中仅页面草稿 | Save 写对应字段，major 与注册共用 | 非法选项拒绝；取消不写 | users 对应字段 | Profile/Preview | 首次/再次开关、滚动、保存/取消 |
| editAll.eaGoals/eaInterests/eaIce、profileEdit.basic；点击 | 目标页已还原；账号有效 | 即时导航，无 Loading | 正确子页；子页保存字段不会被父页旧草稿覆盖 | 未还原依赖明确错误，来源仍可见 | none | 同一用户实体 | 进入/返回/连续多层返回 |
| editAll.iceDown/iceUp/d.go；1106；滑动/点击 | 读取当前账号问题 | 切换真实问题、点位 | 浏览不写业务数据 | 空集合展示空态，pointercancel 不翻页 | none | none | 三题逐项显示 |
| editAll.eaOpenSong/g.pick/g.play/eaSongPlay/eaSongRemove；1072/1202；点击/搜索 | 本地 catalog 元数据；无合法音源 | 原稿歌曲列表及真实不可用错误；删除暂存草稿 | 已有歌曲可移除；无音源不可新增或播放 | 不启动假进度，不保存假音频 | song_id 仅移除 | Preview | 搜索无结果/无音源/取消/删除保存 |
| editBasic.onObName/onObField/o.pick/saveBasic；3471；输入/选择/保存 | 姓名1–50、专业1–100、有效年级、代词≤50 | 500ms 保存；支持入口未接入明确失败 | 只改姓名/代词/年级/专业，返回来源 | 失败草稿可重试；大学/生日不在此修改 | users | Profile、Edit All、Preview | 必填、长输入、保存/取消/刷新 |
| editInterests.o.pick/saveInterests；3514；选择/保存 | 至少3个有效兴趣 | 纯选择无写；Save 500ms | 同 onboarding 的 interest_ids | 不足3项不提交 | users.interest_ids | Profile/Preview/注册实体 | 多选、取消、保存、刷新 |
| editGoals.o.pick/saveGoals；3535；选择/保存 | 至少1个 catalog goal | 同上 | 同 onboarding 的 goal_ids | 空/非法拒绝 | users.goal_ids；缺 catalog 项合并 | 所有目标展示 | 保存及目标数量同步 |
| editIce.q.drop/q.pick/onObCustom/addCustom/saveIce；3584；选择/输入/保存 | 恰好3个不同、安全问题≤160字 | 纯草稿；Save 500ms | 更新 active IDs，保留历史请求引用的问题 | 拒绝重复、空白、不安全；取消不写 | icebreakers/users.icebreaker_ids | Edit All 和后续介绍入口 | 添加/删除/替换/刷新与历史引用 |
| profilePreview.goBack/openEditBasic/prevPhoto/nextPhoto/eaSongPlay；3355；点击 | 本人真实用户、照片与设置 | 固定头尾，真实翻图，缺音源错误 | 正确返回/编辑；显示实际资料，非写死演示人物 | 缺照片占位可重试；不伪造学生徽章 | none | 即时读同一 Store | 编辑返回、照片/文本/目标刷新一致 |
| settings.openEditBasic/openLogoutConfirm；3683；点击 | 本人会话 | 账号入口；自定义退出确认、取消；确认后500ms | logout 清会话、清栈 Welcome；账号与资料保留 | 存储失败保持登录，错误可见 | session；不删除用户、媒体、关系、金币 | 全部受保护页面 | 取消/连点/刷新/错误密码/重新登录 |
| settings 其余 open*；3683；点击 | 对应子页 readiness | 未恢复子页明确错误，不打开通用假目标 | 后续逐页接通 | 本轮记 deferred | none | none | 全入口不改变账号数据 |

技术补齐：原型定义 eaBasic 但 Edit All 没有可见入口，增加 Basic info 行连接已有来源稿；不改变生日/大学编辑规则。简介语音、学生验证、歌曲真实播放及设置其他子页依赖保持 deferred，不作为成功路径验收。

## 阶段二至四

复用 users、profile_photos、icebreakers、goals、interests、picker_options、songs、settings 与本地账号。新增 profile_editor/catalog getter、save_profile_section 与 save_profile_edit；不新增页面业务种子。section 保存白名单字段；媒体与元数据成功后一起公布，失败删除本次新 Blob；保留旧媒体供历史引用，不删除其他账号数据。所有保存校验 expected_account_id；失效取消延迟写入。

照片编辑与 onboarding 分别校验：新本地账号维持 onboarding 的两张下限；历史 fixture 当前只有一张，允许保留不强制伪造第二张。资料分组保存不重置 onboarding 状态、验证状态、余额、关系或主 Tab 骨架资格。

主题沿用唯一 theme.json，原稿393宽换算rpx。共用 SecondaryPageFrame、PageTransition、真实相册选择/解码、照片展示和自定义弹层；不新增主 Tab。

## 验收记录

最终原生：`ProfileAccountAcceptance-3.xcresult`，iPhone17Pro / iOS26.5，7/7通过、0失败/跳过。注册用例创建真实本地账号并完成009789及资料引导，再修改姓名/专业/兴趣/目标/三题/文字字体/主图，验证Profile、Preview、Settings同步，预览/设置进入编辑的来源返回，退出取消与500ms确认，错误密码及正确重登，三Tab单次骨架，真实新文档的IndexedDB图片恢复。测试后恢复原模拟器元数据、移除仅本次新建媒体。见[摘要](./evidence/profile-account-native/acceptance.json)、[附件清单](./evidence/profile-account-native/manifest.json)、[稳定预览截图](./evidence/profile-account-native/2D3241B1-C742-4AC7-A72A-1973C4A96DA8.png)。实测安全区top62/bottom34。前两轮功能亦7/7，但第二轮截图捕获过渡帧，已移至本地build诊断目录，不作为最终视觉证据。

既有页面回归：Profile20、Home22、Discover20、Events19及完整注册18组通过。注册使用真实本地新账号，从启动、009789到资料引导、Home、退出重登完成，见[完整注册回归](./evidence/registration/complete-browser.json)。普通浏览器没有宿主时音源等缺项明确失败；未伪造服务结果。主Tab来回切换、二级页返回、状态隔离、拉黑过滤、刷新及媒体加载回归保持通过。

最终三项强制命令按顺序执行通过：`corepack pnpm check:conventions`、`git diff --check`、`corepack pnpm build:h5`；约定检查无警告。随后`corepack pnpm archive:ios`生成独立工程包，解压完整性通过。ZIP共215条目，全部182份H5与dist、宿主资源、原生测试构建及正常模拟器构建逐文件SHA256一致；更新后的测试和README亦包含，原HTML、DerivedData及xcuserdata均未打包。见[打包报告](./evidence/profile-account-native/package.json)。

正常App使用独立`ProfileAccountRunData`构建并安装到iPhone17Pro，不卸载、不清除已有账号；运行PID8229，仅监听127.0.0.1:18765，见[模拟器整屏截图](./evidence/profile-account-native/simulator-home.png)。本轮临时H5服务、测试脚本与隔离Chrome进程最终检查无残留；用户原4173服务未操作。工程包位于`artifacts/cimoaNeapo-ios.zip`。以下逐页记录保留各提交时点的检查数量与待办，不覆盖本节最终结果。

Edit All 回查：新增照片替换/前后排序/删除二次确认/取消/全部删除拒绝用例，保存前通过 Store 纯校验，非法数量不进入 Loading；外来照片 ID 不能被替换到本人资料。字体显示名、选项 emoji、Sheet 来源 ID 与样式格式已校准。最新累计 Chrome17组、资料专属6项单元通过；本页重新恢复 pending。首轮原生7/7通过，最终修正版原生及既有页面回归正在执行。

Settings / Logout：Chrome16组累计回归通过；79项全量单元通过。设置头像/余额、Account返回、社区规则、退出取消/失败/500ms写时序、清栈Welcome、访客主Tab守卫、错误密码、同账号重登、三Tab单次骨架和刷新保持通过。见[完整浏览器记录](./evidence/profile-edit/settings-acceptance.json)。其余设置子页明确 deferred，不标记成功。三项检查通过；local passed/full pending。

Preview：Chrome13组通过，同一资料/照片顺序、预览发起编辑后保存返回、Profile即时同步、刷新和小屏固定按钮已验证；缺少音源明确报错。见[preview验收](./evidence/profile-edit/preview-acceptance.json)。三项检查通过；local passed/full pending。

Icebreakers：Chrome12组通过，三题/重复校验、题库替换、自定义保存、取消草稿、刷新及历史问题保留均通过。见[ice验收](./evidence/profile-edit/ice-acceptance.json)。三项检查通过；local passed/full pending。

Connection goals：复用注册目标 catalog；Chrome11组通过，空选择拒绝写入，新增目标 catalog 项同步、父页摘要与刷新保持一致。见[goals验收](./evidence/profile-edit/goals-acceptance.json)。三项检查通过；local passed/full pending。

Interests：复用 onboarding 兴趣实体与最低3项校验；Chrome10组通过（包含前页回归），子页保存、父页再保存、不保存返回、刷新与 Profile 展示一致。见[interests验收](./evidence/profile-edit/interests-acceptance.json)。三项检查通过；local passed/full pending。

Basic info：原稿输入/代词/年级/专业、大学生日不可改、缺客服依赖已落实；Chrome9组（含前页8组）通过，空姓名在Loading前拒绝，取消无写入，刷新与无历史返回正确。见[basic验收](./evidence/profile-edit/basic-acceptance.json)。三项检查通过；local passed/full pending。本页提交后继续 Interests。

Edit All：4项新增 Store 单元、5项 Profile 既有单元通过；Chrome8组覆盖真实照片选择/IndexedDB/主图、草稿取消、500ms写时序、存储失败回滚、原稿尺寸、长/空/会话失效、小屏固定区与无音源失败。见[浏览器记录](./evidence/profile-edit/edit-acceptance.json)和[截图](./evidence/profile-edit/edit-default.png)。三项强制命令通过无警告。原型文件浏览器访问受策略限制，来源通过本地静态源码核对，未声称原型浏览器视觉对照通过。完整原生与子页仍 pending；不推送。

上述逐页记录为各提交时点；最终结果以本节顶部为准。首次组件和页面已逐页本地提交：Edit All `21facf1`、Basic `cd51ea5`、Interests `5729b31`、Goals `9184efe`、Ice `667cbbe`、Preview `acb0c05`、Settings `f4829de`、编辑回查 `76b36e8`。没有推送。

## 范围和未完成项

- 注册引导和本轮编辑共用users、profile_photos、interests、goals及icebreakers，不新增页面种子。照片替换保持photo_id，重新写真实媒体；头像引用按第一张同步。退出不删除账号/资料/媒体，只清会话和入口草稿。
- 原型语音简介、歌曲真实音源、学生认证、Coins、客服及通知/隐私/权限/语言/拉黑列表/举报列表/法律/删除账号的独立设置子页尚未完成。所有缺依赖入口继续明确失败，不能用本轮结果冒充这些成功路径。
- 原生测试使用真实图片送入系统WebKit文件输入并走生产解码、存储路径；未自动点击系统相册弹窗，硬件、键盘/实际触摸和全App依赖仍待完整验收。
- 原HTML未改动或嵌入；普通浏览器禁止打开原型的限制仍存在，UI来源由静态源码核对，不能宣称原型运行时逐像素对照完成。
- 新增7条路由；总36条注册路由、33/103条计划路由已注册、70条待补。verified仍0。

## 改动文件

- 页面：`src/pages/profile/edit.vue`、`basic.vue`、`interests.vue`、`goals.vue`、`ice.vue`、`preview.vue`、`editor.css`、`src/pages/settings/index.vue`；原`profile/index.vue`消费保存字体。
- 共用组件：`ProfileEditorFrame.vue`、`ProfileChoiceEditor.vue`、`ProfileFieldSheet.vue`、`ProfileBioConfirmDialog.vue`、`ProfileActionLoading.vue`、`LogoutConfirmDialog.vue`；复用并扩展`PhotoActionsConfirmDialog.vue`、`SourceIcon.vue`和`MainTabFrame.vue`。
- 数据/工具：`src/stores/profileEditing.js`、`store.js`、`src/composables/useProfileEditor.js`、`src/utils/profileNavigation.js`、`profilePresentation.js`、`settingsNavigation.js`；路由`src/pages.json`，主题`src/config/theme.json`，全局样式引用`src/App.vue`。
- 验证：`scripts/profile-edit.test.mjs`、`profile-edit-browser.test.mjs`、`profile.test.mjs`、`scripts/lib/profile-browser.mjs`、`ios/cimoaNeapo/Tests/HostTests.swift`；证据在`docs/evidence/profile-edit`及`profile-account-native`。
- 文档/产物：本记录、页面清单、实现审计、阶段五/六状态、宿主README、`dist/build/h5`、自动同步的`ios/cimoaNeapo/Resources`与独立导出包。两份强制约定没有修改。
