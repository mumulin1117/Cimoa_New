# Discover 页面验收记录

当前状态：`local_acceptance: passed`、`wkwebview_acceptance: passed`、`full_acceptance: pending`。本轮完成第 34 屏卡片牌堆和第 35 屏六人详情的专项还原；全 App 阶段六状态不因本页专项自动改为完成。

## 已完成

- 对照原 HTML 保留顶部 54 圆形入口、393 基准 353×542 卡片、姓名/年龄/认证、大学/专业/MBTI 标签、60 高 Send shot 与三主 Tab。
- 接入 Zane、Linden、Evan、Coco、Anna、Bella 六个 Store 实体。每人三张照片、一条 MP3、精确音频文案、个人信息、目标、兴趣和三条破冰问题；旧保存通过加法迁移获得缺失实体，不覆盖已有用户内容。
- Discover 使用双层牌堆。横拖实时平移/旋转前卡并抬升后卡；短拖回弹，左右达到阈值均浏览下一人。纯浏览不写请求、关系、金币或偏好。
- 点击卡片进入当前人物详情；详情展示三张照片、资料标签、简介、语音介绍、目标、兴趣及问题，返回保持当前牌序。Send shot 始终绑定当前人物及其问题。
- 主页面锁定纵向滚动；卡片高度为 `min(来源高度, 固定区域剩余高度)`，短屏缩短照片区域但保留完整信息与操作区。
- 音频通过工具层读取随包 MP3 并生成可释放 Blob URL；浏览器已实际播放。iOS 包内服务支持 MP3 MIME、单段 Range 与 206 响应，AVFoundation 对同一 Linden 文件实测为 14.04 秒。
- 页面只从 Pinia getter 读取人物和媒体引用；媒体校验、旧保存迁移、拉黑过滤及导航目标均在 Store/工具层完成。

## 自动化结果

- `node --test scripts/data.test.mjs`：22 项通过，包含六人顺序、每人三图/三问题、音频路径/时长/文案与加法迁移。
- 隔离 Chrome 回归通过：六人牌堆、八种 iPhone 视口、短拖/左右甩卡、详情返回、三图、音频播放、Send shot、空态、拉黑、损坏存储、过期会话和安全区；预览服务在 `finally` 中关闭。
- iPhone 17 Pro 模拟器定向测试 `HostTests.testDiscoverDeckProfilesAndBundledAudioInRealWebKit` 通过：连续滑出六人、返回牌序、三图、精确文案、卡片几何、无纵向滚动、MP3 200/206、Range 长度/MIME、iOS 解码时长及无业务写入。

浏览器证据：

- `docs/evidence/discover-default.png`
- `docs/evidence/discover-iphone-320x568.png`
- `docs/evidence/discover-iphone-430x932.png`
- `docs/evidence/discover-dragging.png`
- `docs/evidence/discover-returned-from-profile.png`
- `docs/evidence/discover-safe-area.png`
- `docs/evidence/discover-browser.json`

原生证据：`docs/evidence/discover-wkwebview/` 与 `ios/cimoaNeapo/build/DiscoverAcceptance-4.xcresult`。后者位于构建忽略目录，用于本机复核，不纳入源代码提交。

## 仍保持 pending 的范围

- 全局通知的真实事件来源及通知目标仍按全 App 验收清单处理。
- 系统照片选择器、真实麦克风、后台恢复和整套阶段六回归不由本页专项替代。
- App Store 签名、正式 Bundle ID、内购和外部服务仍遵循现有明确失败规则。

因此本轮可确认 Discover 专项通过，但只有全项目阶段六的其余检查完成后，才把整页和新项目总状态标记为 `verified`。
