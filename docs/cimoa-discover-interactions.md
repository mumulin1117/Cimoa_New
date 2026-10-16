# Discover 页面交互契约

来源：原 HTML 第 34 屏 `Discover / Profile / Photo` 与第 35 屏 `Discover / Profile / Expanded`。独立路由为 `/pages/discover/index` 和 `/pages/discover/profile?user_id=...`；主 Tab 通过 replace 切换，详情通过 push 进入并按来源返回。

## 页面结构

- 顶部工具栏独占一次系统安全区；人物卡、Send shot 和 Tabbar 分属固定区域。
- 393×852 基准下卡片为 353×542、圆角 28；较矮 iPhone 只缩短卡片，不开启纵向页面滚动，不隐藏姓名、认证状态或三项资料标签。
- 卡片资料全部来自 `discover_people` getter。稳定顺序为 Zane、Linden、Evan、Coco、Anna、Bella；被拉黑、不可见、删除或会话失效的实体不会进入牌堆。
- 每个资料实体拥有三张本人照片、完整详情字段、三条破冰问题及一条带精确文案和时长的语音介绍。
- 当前卡片点击进入同一 `user_id` 的详情；详情照片只在该实体的三张图片间切换，返回后牌序不重置。

## 交互矩阵

| interaction_id | 触发 | 前置条件 | 行为 | 数据写入 | 失败表现 |
| --- | --- | --- | --- | --- | --- |
| `photo.browse.drag.1` | 卡片横向拖动 | 有当前人物且页面未导航 | 卡片随手指平移并轻微旋转，下张卡同步抬升；距离达到卡宽 24% 或速度达到阈值后离场，否则回弹 | none | 手势取消时回弹，不改变牌序 |
| `photo.expand.click.1` | 点击当前卡片 | 当前 `user_id` 可访问 | push 到同一人物详情 | none | 失效或拉黑时留在原页并显示错误 |
| `photo.sayHi.click.1` | 点击 Send shot | 会话、认证和请求资格有效 | 进入当前人物的破冰问题选择页 | none | 重复请求、已连接或资格失败时明确提示 |
| `photo.openMe.click.1` | 左上头像 | 有效会话 | 进入自己的 Profile | none | 目标未就绪时留原页提示 |
| `photo.openDiscoverFilters.click.1` | 右上筛选 | 有效会话 | 进入匹配偏好页 | none | 目标未就绪时留原页提示 |
| `expanded.prevPhoto.click.1` / `expanded.nextPhoto.click.1` | 详情相册左右区域 | 当前人物至少两张照片 | 只切换同一人的照片与指示点 | none | 媒体失败显示可见错误 |
| `expanded.voiceIntroPlay.click.1` | 语音介绍播放键 | 当前人物有有效音频 | 读取随包音频并播放；再次点击暂停 | none | 获取、解码或播放失败时显示错误，不显示虚假进度 |

左右甩卡都表示继续浏览下一位，不创建喜欢、跳过、关系、连接请求或金币记录。只有后续介绍发送流程可以改变请求与关系状态。

## 媒体与生命周期

- 图片与音频 URL 由人物实体提供；页面不硬编码替代人物或替代图片。
- 照片使用每张资源自己的 focal point；加载失败保留当前实体并允许重试。
- 语音组件通过工具层取得 MP3 Blob URL，离开详情立即停止播放器并释放 URL；iOS 包内服务同时支持 `audio/mpeg` 与单段 HTTP Range。
- 拖拽动画、导航定时器、音频句柄在 `onHide` / `onUnmounted` 清理；从详情返回时解除导航锁并保留当前牌序。

## 验收要求

- 320×568、375×667、375×812、390×844、393×852、402×874、414×896、430×932 八组视口中，卡片内容、CTA 与 Tabbar 必须在一屏内且滚动位置恒为 0。
- 验证短拖回弹、左右离场、循环六人、点击详情、三图切换、精确语音文案、真实播放、返回牌序、当前人物 Send shot、拉黑过滤、空态、损坏存储、会话过期和安全区。
- 普通浏览器使用用户手势验证音频播放；iPhone 17 Pro WKWebView 验证包内资源传输、Range、iOS 解码时长、安全区和卡片闭环。宿主继续要求媒体由用户操作触发。
