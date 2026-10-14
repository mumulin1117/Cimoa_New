# Cimoa 个人资料与账号闭环

本轮范围为当前账号的资料编辑、照片、兴趣、目标、破冰问题、预览，以及设置主页面的退出和重新登录。来源为原型 Edit All、Basic Info、Interests、Connection Goals、Icebreakers、Preview、Settings 与 Logout；不扩展支付、学生认证、客服和删除账号服务。

## 当前执行

Edit All 本页通过，恢复 pending 等待子页与原生回归，full pending。其余目标页 pending，当前无 in_progress。完整验收和 verified 均待实际回归，不以路由存在代替完成。

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

Edit All：4项新增 Store 单元、5项 Profile 既有单元通过；Chrome8组覆盖真实照片选择/IndexedDB/主图、草稿取消、500ms写时序、存储失败回滚、原稿尺寸、长/空/会话失效、小屏固定区与无音源失败。见[浏览器记录](./evidence/profile-edit/edit-acceptance.json)和[截图](./evidence/profile-edit/edit-default.png)。三项强制命令通过无警告。原型文件浏览器访问受策略限制，来源通过本地静态源码核对，未声称原型浏览器视觉对照通过。完整原生与子页仍 pending；不推送。
