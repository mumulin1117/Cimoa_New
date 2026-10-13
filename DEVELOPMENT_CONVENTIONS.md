# 开发约定

本项目只交付 uni-app H5。页面放在 `src/pages`，可复用 UI 必须放在 `src/components`，业务状态与写操作归属 Pinia Store，`src/utils` 只承载持久化、媒体、路由和宿主桥接等适配能力。除边框线宽外，固定设计尺寸统一使用 `rpx`；所有 `border` 简写及 `border-width`、`border-top/right/bottom/left-width` 中的线宽只能使用 `px`，`border-radius` 仍使用 `rpx`。此外仅视口高度计算允许 `100vh`，系统安全区 `env(..., 0px)` 允许 `0px` fallback，不得新增其他 `px`、`vw` 或 `rem` 设计尺寸，也不要把主题颜色硬编码进页面。

## 文件职责与规则归属

本文件只回答“如何实现”：目录与页面骨架、组件/API 选择、Store 与持久化、主题变量、Loading、动画、媒体、桥接、安全区、滚动和代码校验。`INTERACTION_CONVENTIONS.md` 只回答“用户操作后必须发生什么”：入口、前置条件、成功/失败结果、跨页面状态一致性和验收闭环。

| 规则主题 | 唯一主文件 | 另一文件允许出现的内容 |
| --- | --- | --- |
| 页面结构、组件、CSS、路由方法、动画时长、Loading 实现 | 本文件 | 仅描述用户可观察到的交互结果，并引用本文件章节 |
| 数据字段、Store action、localStorage/IndexedDB、宿主桥接 | 本文件 | 仅描述操作成功后哪些业务状态应改变或保持不变 |
| 入口是否可点、操作前置条件、成功/失败去向、显示/隐藏结果 | `INTERACTION_CONVENTIONS.md` | 本文件只提供满足该结果的实现模式 |
| 业务闭环与手工验收场景 | `INTERACTION_CONVENTIONS.md` | 本文件只保留自动检查和技术验收命令 |

同一规则不得在两份文件中各自定义。必须跨文件提及时，非主文件只写章节引用，不复制代码或重新定义数值。若两份文件仍有冲突：技术实现按本文件执行，业务结果按 `INTERACTION_CONVENTIONS.md` 执行；用户新需求改变规则时，只修改对应主文件，并检查另一文件的引用是否仍成立。



## 平台范围（最高优先级）

- 唯一开发、构建与交付形态是 H5，生产运行方式是嵌入原生 iOS 应用的 `WKWebView`。固定交付链路为：`uni-app 源码 → corepack pnpm build:h5 → H5 静态产物 → iOS WKWebView 加载`。平台开发/构建命令只使用 `corepack pnpm dev:h5`、`corepack pnpm build:h5`；约定检查仍按第 13 节执行。
- iOS `WKWebView` 是唯一生产运行环境和最终验收环境。普通移动/桌面浏览器只用于 H5 开发调试、基础冒烟和无原生宿主降级验证，不是第二个产品平台；浏览器中运行正常不能代替 `WKWebView` 验收。
- 本仓库只维护 H5 代码和与宿主通信的 Web 桥接层，不编译 uni-app App，也不承载 Swift/Objective-C 宿主工程。不得新增 App-Plus、Android、iOS 原生包或小程序专属页面/条件编译；`package.json` 中其他历史脚本的存在不代表对应平台受支持。文档中的“iOS”“原生宿主”或“WebView”均指承载本 H5 静态产物的 iOS 宿主。
- 页面和组件只调用标准 Web、uni-app H5 API、Pinia Store，以及不写业务状态的 `src/utils` 命名适配接口；不得直接调用 `plus.*`、App-Plus API 或在页面散写 `window.webkit.messageHandlers`。
- 安全区、iOS 内购等宿主能力统一封装在 `src/utils` 桥接文件中。桥接消息名只在对应工具文件顶部定义；普通浏览器调试时没有宿主，必须走各工具规定的降级或超时流程，页面不得伪造原生成功结果。
- `src/utils/safeArea.js` 在无宿主时允许回退到 WebKit `env()`/`0px`；`src/utils/iapBridge.js` 的请求无论是否检测到原生 handler，都必须登记 pending request 并等待该文件 `callback_timeout_ms` 定义的完整超时。页面不得自行缩短等待、绕过回调或直接更新金币。

## 技术栈

- Vue 3：页面与组件采用 Composition API、`<script setup>`。
- uni-app：H5 页面生命周期、路由和组件运行时；不作为多端交付依据。
- Vite：开发和构建工具。
- Pinia：业务数据的唯一运行时来源。
- pnpm：唯一包管理器；构建命令为 `corepack pnpm build:h5`。
- Element Plus：依赖包为 `element-plus`；通用页面图标使用 `@element-plus/icons-vue`，组件库与图标的使用边界见第 15.2 节。不得写成 Vue 2 时代的 “Element UI”。
- localStorage：账号会话、轻量持久化数据和 Pinia hydration 缓存；媒体 Blob 使用 IndexedDB，不写入 localStorage。
- 国际化：默认语言和格式化 locale 固定使用规范 BCP 47 标识 `en-US`；用户可见文案使用英文，不得写成 `en-Us`、`en_us` 或“欧美”等模糊范围。

## 数据管理

项目按马甲包模式开发。初始业务数据、本地测试数据及本地业务初始数据统一维护在 Pinia Store 中；页面加载时从对应 Store 读取数据，新增、修改、删除由 Store action 处理。页面不得维护与 Store 重复的业务数据，Pinia 是业务数据的唯一运行时来源。

### 数据分层与唯一调用链

业务数据固定按“页面/组件 → Pinia Store → 持久化适配层”单向流动：

| 层级 | 允许职责 | 禁止事项 |
| --- | --- | --- |
| 页面/组件 | 订阅 Store state/getter；在 Loading 结束后调用 Store action；调用路由、媒体选择/解析、宿主桥接等无业务状态适配接口 | 直接修改业务数组；直接读写 `localStorage`/IndexedDB；把 `src/utils` 当作第二个 Store |
| Pinia Store | 保存唯一运行时业务状态；执行 hydration；校验 action 入参；协调状态变更与持久化；返回统一成功/失败结果 | 让页面同时维护同一实体副本；在 getter 中反复读取持久化数据 |
| 持久化/系统适配层 | `src/utils` 或 Store 私有 helper 封装 `localStorage`、IndexedDB、媒体、路由和宿主 API 的底层差异；持久化由 Store action 协调，媒体选择/解析可由页面在受控流程中调用 | 拥有独立业务数组；绕过 Store 发布业务状态；在兼容接口中重复实现业务规则 |

`localStorage` 和 IndexedDB 只承担持久化职责，不作为页面直接读取的第二数据源。应用启动时只调用一次幂等的 `store.hydrate()`：先装载 Store seed，再用有效持久化记录覆盖；hydration 完成后页面只订阅 Store。后续写入只由 Store action 发起，持久化成功后所有页面通过同一 Store 自动同步；失败时 action 返回失败并保持或恢复一致状态。

当前 `src/utils/auth.js`、`accounts.js`、`posts.js`、`moderation.js` 中的同名业务接口属于兼容门面，必须只转发到 `use_app_store()`，不能自行保存数组或直接成为页面数据源。新增页面直接使用 `use_app_store`；只有需要稳定旧调用方时才保留兼容门面。

```js
import { use_app_store } from '@/stores/store.js'

const app_store = use_app_store()
const current_user = computed(() => app_store.current_user)

app_store.update_user_profile({
  user_id,
  username,
  avatar_url
})
```

新增页面只使用 `use_app_store`。旧项目遗留的 Store 别名即使暂时仍存在于代码中，也不得写入新文档或新页面；模板迁移时应以阶段 2 确定的通用 Store 名为准。

Store action 的职责为：校验入参、协调 Pinia state 与 `localStorage`/IndexedDB 持久化、返回统一结果。提交、发布、删除、拉黑、评论等写操作仍必须先展示第 5 节规定的自定义 Loading，Loading 结束后再调用 action；页面不能绕过 Store 直接修改业务数组或持久化层。

```js
// Store action 参考形态；persist_user_profile 是 src/utils 或 Store 内部的低层持久化 helper。
const update_user_profile = async (payload) => {
  const next_user = validate_user_profile({ ...this.current_user, ...payload })
  const persisted_user = await persist_user_profile(next_user)
  this.current_user = persisted_user
  return { success: true, data: persisted_user }
}
```

## 数据字段设计习惯

- 字段优先贴近页面原型和业务展示，不做过度抽象。
- 业务字段统一使用英文 `snake_case`，例如 `user_id`、`user_name`、`event_id`、`creator_id`。
- 业务实体按用户、活动、已加入活动的人、活动评论、活动聊天室、动态、动态评论、动态点赞记录、用户关注等清晰拆分；初始数据放入对应 Pinia Store，不散落在页面或静态 JSON。
- 关联关系需要建立关联关系表，使用显式 `id` 字段保存对应的关系，例如用户 id、活动 id、创建人 id、评论用户 id、点赞人 id、聊天室 id。
- 为减少页面渲染时反查，关联数据可冗余保存展示字段，如姓名、头像、简介、创建人姓名/头像、评论用户姓名/头像。
- 图片字段保存可访问图片地址；头像、图片、视频等本地媒体地址指向 IndexedDB，远端媒体保存 URL。
- 原型阶段时间字段可以使用字符串；数量字段使用明确语义，例如 `event_limit_count`、`joined_count`、`coin_balance`、`member_since_year`。
- 轻量原型中的多值标签可用英文逗号分隔字符串，例如 `interest_tags: 'music,travel,coffee'`。

```js
const post = {
  post_id: 'post_001',
  creator_id: 'user_001',
  creator_name: 'Mia Chen',
  creator_avatar_url: 'indexeddb://common_template_post_media/media_files/media_avatar_001',
  content_type: 'video',
  cover_url: 'https://example.com/cover.jpg',
  like_count: 12,
  created_at: '2026-08-04 10:10:10'
}
```

## 1. 主题与基础样式

唯一主题来源是 `src/config/theme.json`。页面、组件均导入此文件，并将值映射为语义 CSS 变量。不得在页面中重复写主题主色、正文色、按钮色或图标色，也不得用目标模板中的颜色字面量绕过主题配置。

主题 token 的处理顺序固定如下：

1. 先按语义使用现有 token，例如页面背景用 `colors.page.background`、卡片用 `colors.surface.card`、正文用 `colors.text.title`。
2. 目标模板需要的语义颜色不存在时，先在 `theme.json` 对应分组新增明确 token，再映射 CSS 变量并使用；不得临时借用语义不符的 token。
3. 同一语义只允许一个 token。新增或改名时必须同步搜索全部消费者，不在页面设置“找不到就用原型颜色”的 fallback。
4. 透明度、边框、遮罩和状态色也属于主题色，必须来自 `theme.json`；只有布局数值、动画和媒体资源本身不受颜色 token 管理。

```js
import theme from '@/config/theme.json'

const theme_style = {
  '--page-background': theme.colors.page.background,
  '--title-color': theme.colors.text.title,
  '--secondary-color': theme.colors.text.secondary,
  '--tertiary-color': theme.colors.text.tertiary,
  '--accent-color': theme.colors.button.primary,
  '--accent-text-color': theme.colors.button.text,
  '--ghost-border-color': theme.colors.button.ghost.border,
  '--ghost-text-color': theme.colors.button.ghost.text,
  '--surface-color': theme.colors.surface.card,
  '--surface-deep-color': theme.colors.surface.deep,
  '--surface-border-color': theme.colors.surface.border,
  '--surface-outline-color': theme.colors.surface.outline,
  '--dialog-background': theme.colors.dialog.background,
  '--dialog-confirm-background': theme.colors.dialog.confirm.background,
  '--dialog-confirm-text-color': theme.colors.dialog.confirm.text,
  '--dialog-cancel-border-color': theme.colors.dialog.cancel.border,
  '--dialog-cancel-text-color': theme.colors.dialog.cancel.text,
  '--dialog-danger-background': theme.colors.dialog.danger.background,
  '--dialog-danger-text-color': theme.colors.dialog.danger.text,
  '--switch-active-background': theme.colors.button_change.active.background,
  '--switch-active-text': theme.colors.button_change.active.text,
  '--switch-default-background': theme.colors.button_change.default.background,
  '--switch-default-text': theme.colors.button_change.default.text,
  '--icon-color': theme.colors.icon.primary
}
```

```vue
<view class="page" :style="theme_style">
  <!-- 页面内容 -->
</view>
```

```scss
.page {
    min-height: 100vh;
    background: var(--page-background);
    color: var(--title-color); 
}
.title { 
    color: var(--title-color); 
}
.secondary-copy { 
    color: var(--secondary-color);
}
.icon { 
    color: var(--icon-color); 
}
.primary-button { 
    height: 88rpx;
    background: var(--accent-color);
    color: var(--accent-text-color);
    line-height: 88rpx;
    text-align: center;
}
```

### 按钮规范

- 静态主操作（保存、发布、登录、提交）使用 `colors.button.primary` 与 `colors.button.text`。
- 可变 tab、分段控件、可选择的原因/筛选项使用 `colors.button_change.default` 与 `colors.button_change.active`。未选中和选中状态均不可自定义主题色。
- 弹窗确认/取消/危险按钮分别使用 `colors.dialog.confirm`、`colors.dialog.cancel`、`colors.dialog.danger`；弹窗卡片背景使用 `colors.dialog.background`。
- 幽灵次按钮（透明底 + 描边）使用 `colors.button.ghost` 的 `border` 与 `text`。
- 文字、次级文字、三级文字、图标分别使用 `text.title`、`text.secondary`、`text.tertiary`、`icon.primary`。
- 卡片、分割线、描边分别使用 `surface.card`、`surface.border`、`surface.outline`；语义状态色使用 `status.*`（success/info/danger/coin/locked）。
- 页面和组件的可点击按钮统一使用 `<view role="button">`，禁止使用 `<button>` 及其 `button::after` 默认样式处理；除边框线宽只能使用 `px` 外，其余设计尺寸使用 `rpx`。
- 只有“固定高度、单行纯文字、垂直水平居中”的按钮才设置 `line-height` 等于组件高度并使用 `text-align: center`。包含图标、可能换行或多行文案的按钮改用 flex 居中，并给文字设置独立的 `rpx` 行高，不能用整块高度作为行高。

```scss
.change-button {
    height: 72rpx;
    background: var(--switch-default-background); 
    color: var(--switch-default-text);
    line-height: 72rpx;
    text-align: center;
}
.change-button--active {
    background: var(--switch-active-background);
    color: var(--switch-active-text); 
}
```

## 2. 页面结构

### 2.1 页面目录与命名约定

`src/pages` 按业务域分文件夹存放，路由目录必须表达功能归属，不得把无关页面堆放在根目录，也不要为了单个页面新增无意义的一级目录。页面文件统一使用 kebab-case；同一流程的连续步骤保留在同一目录下。

示例：

| 目录             | 页面职责                                          | 典型页面                                                     |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| `pages/login/`   | 登录与会话入口                         | `index.vue`                  |
| `pages/signup/`  | 注册与创建账号                         | `index.vue`                  |
| `pages/home/`    | 首页主 Tab 与首页详情                  | `index.vue`、`activity.vue`  |
| `pages/library/` | 收藏/内容库主 Tab 与集合详情            | `index.vue`、`collection.vue` |
| `pages/wall/`    | 动态主 Tab、发布、详情与发布成功         | `index.vue`、`create.vue`、`detail.vue`、`success.vue` |
| `pages/profile/` | 个人中心主 Tab 与资料编辑                | `index.vue`、`edit.vue`      |
| `pages/coins/`   | 金币充值                               | `index.vue`                  |

具体规则：

- `index.vue` 只用于该业务域的默认入口或主 Tab 页面；二级、三级页面用清晰的业务名，例如当前已有的 `wall/detail.vue`、`profile/edit.vue`、`home/activity.vue`。
- 跨页面功能按**主要入口业务域**归档。例如动态详情与发布属于 Wall，放在 `pages/wall/`；收藏集合详情属于 Library，放在 `pages/library/`。新项目的业务域以阶段 1 页面清单为准，不沿用模板中未被目标原型使用的目录语义。
- 页面专属 UI 不拆成另一个页面目录；可复用 UI 一律放 `src/components/`。页面只订阅 Store 并调用 Store action；持久化、媒体、路由和宿主适配逻辑按“数据分层与唯一调用链”放入 `src/utils/`。
- 新增页面时同步维护 `pages.json` 路由。调用处必须使用完整路由，例如 `/pages/wall/detail?post_id=...`，不使用相对路径。
- 若业务域内页面数量增长，可在该域下建立一层语义子目录；新目录必须先登记到阶段 1 页面清单并注册到 `pages.json`，迁移时同步更新所有路由、返回逻辑和页面过渡实现。

### 2.2 二级/三级页面跳转不使用全屏 Loading

同一个页面既可能由主 Tab 进入（作为二级页），也可能由二级页继续进入（作为三级页）。二级/三级页面的进入和返回都属于纯路由交互，**来源页与目标页均不得因为页面跳转展示全屏 Loading，也不得人为等待 400–600ms 后再跳转**。导航执行顺序由来源页结构决定：

- 主 Tab 页或其他未包裹 `PageTransition` 的普通入口调用 `push_route()`，点击后立即执行无原生动画的 `navigateTo`，由目标页的 `PageTransition` 播放入场动画。目标模板明确要求 iOS Push/Pop 双页面联动时改用第 11.2.2 节的 `push_stack_route()`，不得在页面内自行复制 DOM 或组合路由定时器。
- 已包裹 `PageTransition` 的二级/三级页进入下一级时，调用组件暴露的 `navigate_forward()`；组件先播放来源页离场动画，再在 `@after-leave` 中执行 `push_route()`，目标页创建后播放入场动画。
- 二级/三级页返回上一层调用 `navigate_back()`；固定返回主 Tab 调用 `navigate_relaunch()`。两者都先完成来源页离场，再执行实际路由。
- 页面不得直接调用 `uni.navigateTo`、`uni.navigateBack`、`uni.redirectTo` 或 `uni.reLaunch`，也不得自行组合 `is_page_visible`、`setTimeout` 与路由 API；无原生动画参数、离场兜底和失败恢复统一由 `src/utils/routeTransition.js` 与 `PageTransition.vue` 负责。
- 路由 URL 只传递业务参数和明确的返回归属参数，不传递 Loading 所有权或入口 Loading 状态。
- 目标页在 `onLoad` 中读取业务参数，并从 Pinia Store 同步派生当前可用数据；不得为“刚进入页面”增加全屏 `LoadingOverlay`。
- 目标页确实需要等待异步列表、评论或媒体数据时，只能在对应内容区域使用现有 `DiscoverDataLoading`，不能覆盖页面头部、返回按钮或整页。
- 私聊、他人主页、帖子详情和模拟视频通话等二级/三级页面遵循相同规则，不得把路由跳转包装成 Loading 流程。
- 返回时调用 `PageTransition` 的 `navigate_back()`，或按明确返回归属调用 `navigate_relaunch()`；组件先完成离场，再通过路由工具执行实际导航。页面从下级返回时的可见状态也由 `PageTransition` 在 `onShow` 统一恢复。
- 登录、发布、保存、删除、举报等业务写入操作的自定义 Loading 仍按对应章节执行；本节只移除页面导航本身的全屏 Loading。

调用方示例：

```js
const open_post_detail = (post_id) => {
  push_route({
    url: `/pages/wall/detail?post_id=${encodeURIComponent(post_id)}`
  })
}
```

目标页示例：

```js
const post_id = ref('')

onLoad((query) => {
  post_id.value = query?.post_id || ''
  refresh_post()
})
```

```vue
<!-- 只有异步数据区尚未就绪时才使用局部 loading。 -->
<DiscoverDataLoading v-if="is_comments_loading" />
```

### 主页面（Tabbar 页）

Tabbar 完全由 `CustomTabBar` 组件管理，`pages.json` 不配置 `tabBar`；自定义 Tabbar 或同级自定义导航组件的页面切换统一使用 `replace_route()`，不得使用 `uni.reLaunch` 或 `uni.switchTab`。`replace_route()` 内部以无原生动画的 `redirectTo` 只替换当前主页面，避免每次切换都清空并重建整个页面栈；登录完成、退出登录等明确要求清栈的业务使用 `relaunch_route()`。主页面固定使用：`TopSafeArea`、主页面骨架屏、`.main-page-content` 内容区、`CustomTabBar`。

```js
const switch_tab = (item) => {
  if (item.path === current_path.value) return

  replace_route({ url: `/${item.path}` })
}
```

自定义导航组件的目标路径统一保存为不带开头 `/` 的页面路径，调用 `replace_route()` 时再补 `/`；同一路径必须直接返回，避免重复跳转。切换不使用 uni-app 原生动画，视觉切换效果如有需要由页面 Vue `<transition>` 实现。

```vue
<template>
  <view class="page" :style="theme_style">
    <TopSafeArea />
    <MainTabSkeleton v-if="is_main_tab_loading" type="home" />
    <view v-else class="content main-page-content">
      <!-- 主页面内容 -->
    </view>
    <CustomTabBar />
  </view>
</template>

<script setup>
import TopSafeArea from '@/components/TopSafeArea.vue'
import CustomTabBar from '@/components/CustomTabBar.vue'
import MainTabSkeleton from '@/components/MainTabSkeleton.vue'
import { use_main_tab_skeleton } from '@/utils/useMainTabSkeleton'

const { is_main_tab_loading } = use_main_tab_skeleton('pages/home/index')
</script>
```

`useMainTabSkeleton` 使用模块级“按路由待消费集合”，并且默认不展示骨架屏。只有登录或注册成功、完成账号与会话写入后，才调用 `prepare_main_tab_skeleton()`，一次性为 `MAIN_TAB_SKELETON_ROUTES` 中的每个静态主 Tab 登记一次 500–700ms 骨架屏资格。每个主 Tab 必须把自己的完整路由传给 `use_main_tab_skeleton(route)`，首次进入时只消费自己的资格，不影响其他主 Tab；同一 Tab 后续切换、返回或重新创建都直接显示内容。创建、编辑、发布等流程页不得加入该集合。已登录状态下刷新浏览器或恢复会话时，模块默认集合为空，不得再次启动骨架屏；退出后再次成功登录或重新注册成功时，允许重新准备一轮每 Tab 单次展示。

```js
export const MAIN_TAB_SKELETON_ROUTES = Object.freeze([
  'pages/home/index',
  'pages/library/index',
  'pages/wall/index',
  'pages/profile/index'
])
```

```js
import { prepare_main_tab_skeleton } from '@/utils/useMainTabSkeleton'
import { use_app_store } from '@/stores/store'

const app_store = use_app_store()

const complete_authentication = (account) => {
  app_store.save_login_state(account)
  prepare_main_tab_skeleton()
  relaunch_route({ url: '/pages/home/index' })
}
```

`prepare_main_tab_skeleton()` 必须位于登录/注册成功分支中，并在 `app_store.save_login_state()` 之后、进入主页面之前调用；登录失败、注册失败、普通冷启动、已登录会话 hydration、主 Tab 切换或普通 `reLaunch` 均不得调用。主页面内容高度继续遵循“`100vh - 顶部安全区 - Tabbar 高度`”的既有 `.main-page-content` 约束；内容自身允许滚动，不能让滚动容器在底部锁死。

### 二级页面

二级页默认包含 `TopSafeArea`、`SecondaryPageHeader`、单一主滚动区与 `BottomSafeArea`，并以 `PageTransition` 作为页面根容器；目标模板要求头部或底部业务背景覆盖系统安全区时，对应边缘改由业务组件按第 15.1.2 节接管。返回由 `SecondaryPageHeader` 调用当前 `PageTransition` 的 `navigate_back()`，不在每个页面重复实现或直接调用 uni-app 路由 API。

```vue
<template>
  <PageTransition ref="page_transition" :style="theme_style">
    <TopSafeArea />
    <view class="page-content">
      <SecondaryPageHeader eyebrow="ACCOUNT" title="Edit profile" />
      <scroll-view class="content-scroll" scroll-y :show-scrollbar="false">
        <view class="content-scroll__inner"><!-- 页面内容 --></view>
      </scroll-view>
    </view>
    <BottomSafeArea />
  </PageTransition>
</template>
```

从主页面进入需要读取 Store 或业务数据的二级页时直接跳转。目标页从 Pinia Store 读取数据；若确有异步数据未就绪，只在对应内容区展示局部 Loading。

```js
const open_detail = (post_id) => {
  push_route({
    url: `/pages/wall/detail?post_id=${encodeURIComponent(post_id)}`
  })
}
```

## 3. 可切换 Tab 的局部加载

不要在标签筛选切换时覆盖整页，也不要刷新 Tabbar；仅将数据区域替换为现有 `DiscoverDataLoading`，加载 400–600ms 后再更新数据。

```vue
<view
  v-for="item in labels"
  :key="item"
  class="change-button"
  :class="{ 'change-button--active': active_label === item }"
  role="button"
  @click="change_label(item)"
>
  {{ item }}
</view>
<DiscoverDataLoading v-if="is_data_loading" />
<view v-else><PostCard v-for="post in filtered_posts" :key="post.post_id" :post="post" /></view>
```

```js
const is_data_loading = ref(false)
let data_loading_timer = null
const change_label = (label) => {
  if (label === active_label.value || is_data_loading.value) return
  is_data_loading.value = true
  data_loading_timer = setTimeout(() => {
    active_label.value = label
    is_data_loading.value = false
  }, 400 + Math.floor(Math.random() * 201))
}
onUnmounted(() => clearTimeout(data_loading_timer))
```

## 4. 自定义确认弹窗

所有确认弹窗都写成 `src/components/*ConfirmDialog.vue`，不能依赖浏览器原生 `confirm`。使用 fixed 遮罩、主题背景卡片和 `cancel`/`confirm` 事件；点击遮罩取消，点击卡片本身阻止冒泡。删除、退出、清缓存、取消拉黑等均复用此结构并改写语案。

```vue
<template>
  <view class="dialog-layer" :style="dialog_style" @click="emit('cancel')">
    <view class="dialog-card" @click.stop>
      <text class="dialog-eyebrow">ACCOUNT</text>
      <text class="dialog-title">Delete account?</text>
      <text class="dialog-copy">This action cannot be undone.</text>
      <view class="dialog-actions">
        <view class="dialog-button dialog-button--secondary" role="button" @click="emit('cancel')">Cancel</view>
        <view class="dialog-button dialog-button--primary" role="button" @click="emit('confirm')">Confirm</view>
      </view>
    </view>
  </view>
</template>
```

```scss
.dialog-button {
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
}
```

弹窗层级不低于 `z-index: 1200`；卡片、确认、取消和危险操作分别使用 `colors.dialog.background/confirm/cancel/danger`，不使用含义不明的“主题 primary”或透明白 fallback，也不使用平台默认弹窗。

## 5. 所有本地持久化写操作的 Loading 约定（强制）

本节只定义写操作的技术顺序、组件位置和定时器清理；哪些入口需要确认、成功/失败后用户看到什么，以 `INTERACTION_CONVENTIONS.md` 第 1.2 节及对应业务章节为准。

除点赞/取消点赞这类即时轻量交互外，**所有会写 `localStorage`、IndexedDB 或修改本地业务状态的按钮都必须先展示自定义 Loading，再执行后续流程**。包括但不限于：登录、注册、修改资料、发布/编辑 Post、提交举报、删除账号、拉黑/取消拉黑、清缓存、充值结果写入。

- 加载组件必须放在 `src/components`，按业务命名，例如 `ProfileSavingLoading.vue`、`ReportSubmittingLoading.vue`、`PostPublishLoading.vue`。
- 加载组件的页面背景、遮罩、文案和强调色分别映射 `colors.page.background`、`colors.surface.scrim_soft`、`colors.text.title` 和 `colors.button.primary`；覆盖当前页面时保持下层上下文可辨识。
- 默认模拟时长为 400–600ms；提交期间禁用重复点击与关闭操作。
- 只有 Loading 定时结束后才能调用 Store action；由 action 协调持久化与 Store 更新。action 成功后才能显示成功状态、跳转或刷新列表；失败时关闭 Loading 并在原页面显示错误。
- 页面卸载时必须 `clearTimeout`，避免离开页面后继续写入。

```vue
<view
  class="primary-button"
  :class="{ 'primary-button--disabled': is_saving }"
  role="button"
  :aria-disabled="is_saving"
  @click="save"
>
  Save changes
</view>
<ProfileSavingLoading v-if="is_saving" />
```

```scss
.primary-button {
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
}
.primary-button--disabled {
  opacity: .5;
  pointer-events: none;
}
```

```js
const is_saving = ref(false)
let save_timer = null
const save = () => {
  if (is_saving.value) return
  is_saving.value = true
  save_timer = setTimeout(() => {
    save_timer = null
    try {
      // 仅在这里调用 Store action；页面不得直接调用 uni.setStorageSync。
      app_store.update_user_profile(profile_payload.value)
      page_transition.value?.navigate_back()
    } catch (error) {
      form_error.value = error?.message || 'Unable to save changes.'
      is_saving.value = false
    }
  }, 400 + Math.floor(Math.random() * 201))
}
onBeforeUnmount(() => clearTimeout(save_timer))
```

## 6. 个人资料与账号数据

本节只定义个人资料、会话和头像媒体的同步实现；保存成功/失败后的可见结果以 `INTERACTION_CONVENTIONS.md` 第 6.1、6.3 节为准。

默认测试用户、`current_user`、`user_session` 与 `user_accounts` 都由 `src/stores/store.js` 管理。`src/utils/auth.js` 和 `src/utils/accounts.js` 仅保留转发到 Store 的兼容接口，不拥有另一份会话或账号数据。

修改个人资料必须：

1. 在自定义 Loading 结束后调用一次 `app_store.update_user_profile(payload)`；
2. 由该 action 同步账号记录、当前会话和本人已发布动态的作者名/头像，并完成持久化；
3. 个人中心直接订阅 `app_store.current_user`，不得在 `onShow` 重新从 `localStorage` 建立页面副本。

头像与图文 Post 媒体采用同一套 IndexedDB Blob 存储：H5 选择图片后裁剪压缩为 Blob，在同一次保存流程中调用媒体适配器 `save_post_media_file({ file: avatar_blob, kind: 'avatar', owner_user_id })`，再把返回的 `indexeddb://common_template_post_media/media_files/<id>` 稳定地址交给 `app_store.update_user_profile`。**不得把 Blob、Base64 或 data URL 头像写入 `localStorage`。**

页面展示头像必须使用 `UserAvatar.vue`，它通过 `resolve_post_media_url` 将 IndexedDB 地址转换为缓存的 Blob object URL。组件替换来源或卸载时仍须调用 `revoke_post_media_url` 释放一次使用权；工具层会在 URL 空闲 2 分钟后，或可释放的空闲缓存超过 48 项时再真正撤销，避免相邻页面/列表重复读取 IndexedDB：

```vue
<UserAvatar class="avatar" :source="current_user?.avatar_url" />
```

## 7. 图文动态：保存与展示

本节只定义图文媒体和帖子元数据的保存、解析与释放方式；列表、详情和发布入口的业务结果以 `INTERACTION_CONVENTIONS.md` 第 3 节为准。

动态元数据（作者、文案、时间、媒体地址、封面、统计）由 Pinia Store 的 `published_posts` 管理，并持久化到 `localStorage`。图片和视频文件本体不写入 `localStorage`，而由 `src/utils/postMediaStorage.js` 以 Blob 保存至 IndexedDB；元数据只持有稳定的 `indexeddb://common_template_post_media/media_files/<id>` 地址。

```js
// 选择到 File 后保存 Blob，再保存 metadata。
const media = await save_post_media_file({ file, kind: 'image', owner_user_id: current_user.user_id })
const post = app_store.save_published_post({
  content_type: 'image',
  content,
  media_url: media.media_url,
  cover_url: ''
})
```

展示时统一使用 `PostMedia.vue`，不得直接假设 `media_url` 可被浏览器加载。组件内部用 `resolve_post_media_url` 从 IndexedDB 获取可复用的缓存 object URL；在替换或卸载时调用 `revoke_post_media_url` 释放使用权，不直接调用浏览器 `URL.revokeObjectURL`。

```vue
<PostMedia :media-url="post.media_url" :content-type="post.content_type" />
```

发布、编辑、删除等写操作遵循第 5 节 Loading 规则。列表与详情均订阅 Store 的 `get_visible_posts` 或基于该 getter 按 `post_id` 派生，不各自维护另一份动态数据。

## 8. 视频动态：封面、保存与播放

本节只定义视频 Blob、封面和播放组件的技术实现；用户何时看到封面、何时允许播放及播放失败结果以 `INTERACTION_CONVENTIONS.md` 第 3.3 节为准。

视频选择后必须使用 `create_video_second_cover_blob(file)` 生成第 2 秒封面，视频 Blob 和封面 Blob 都保存至 IndexedDB。首页和列表页只展示封面，不自动播放。

```js
const media = await save_post_media_file({ file: video_file, kind: 'video', owner_user_id })
const cover_blob = await create_video_second_cover_blob(video_file)
const cover = await save_post_media_file({ file: cover_blob, kind: 'image', owner_user_id })
app_store.save_published_post({ content_type: 'video', media_url: media.media_url, cover_url: cover.media_url })
```

详情页使用以下模式：初始渲染封面和播放按钮；用户点击后再创建 `<video>` 并播放。详情播放必须传入 `:muted="false"`，且在 `loadedmetadata` 和 `play` 时显式解除静音，保证移动端可播放声音。

```vue
<PostMedia
  :media-url="post.media_url"
  content-type="video"
  :poster="post.cover_url"
  controls
  playable
  :muted="false"
/>
```

### 8.1 沉浸式首页 Post：垂直滑动、视口高度与视频封面

当阶段 1 的页面还原清单确认目标模板需要“像短视频一样一屏一条 Post、上下滑动切换”时，必须以本节为准：**使用 uni-app 的竖向 `swiper`，不要用普通 `scroll-view` 模拟分页滚动**。`swiper` 每次切换天然停在完整的一页；底部到达最后一条时不产生虚假的下一页。当前模板未注册独立的沉浸式视频首页，不得把示例页面写成既有实现。

#### 页面层级与数据来源

- 主 Tab 页面仍由 `TopSafeArea`、`MainTabSkeleton`、内容区和 `CustomTabBar` 组成；顶部用户头像/发布入口位于 Swiper 外，因此不会随 Post 滚动。
- 列表只订阅 `app_store.get_visible_posts`，保证被拉黑用户内容已在 Store 统一过滤；按 `created_at` 倒序派生，不在页面维护第二份 Post 数组。
- 仅在登录或注册成功后由认证页调用 `prepare_main_tab_skeleton()`；随后每个登记在 `MAIN_TAB_SKELETON_ROUTES` 中的静态主 Tab 都使用自己的完整路由调用 `use_main_tab_skeleton(route)`，并在本轮认证后的首次进入展示一次骨架屏。该 Tab 消费资格后，返回、再次切换、页面重建或已登录刷新均不重复展示；点击进入详情/发布页时立即调用 `push_route()`，不展示导航全屏 Loading。

```js
const app_store = use_app_store()
const { is_main_tab_loading } = use_main_tab_skeleton('pages/home/index')
const active_feed_index = ref(0)

const posts = computed(() => [...app_store.get_visible_posts]
  .sort((first_post, second_post) => new Date(second_post.created_at) - new Date(first_post.created_at)))
```

#### 内容组件高度计算（强制）

首页根容器使用固定 `100vh` 的纵向 flex，禁止页面整体滚动。`CustomTabBar` 已固定在页面底部并自行包含底部安全区，内容区只扣除顶部安全区和完整 Tabbar 高度；固定工具栏再从 Feed 视口扣除。不得再次扣除 `env(safe-area-inset-bottom)`，否则会重复计算底部安全区并压缩最后一条 Post。

```scss
.home-page {
  position: relative;
  display: flex;
  box-sizing: border-box;
  height: 100vh;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: var(--page-background);
}

.home-content {
  --home-feed-height: calc(
    100vh
    - var(--app-top-safe-area-height)
    - var(--app-main-tab-bar-height)
    - 84rpx
  );
  display: flex;
  height: calc(100vh - var(--app-top-safe-area-height) - var(--app-main-tab-bar-height));
  min-height: 0;
  flex: 0 0 calc(100vh - var(--app-top-safe-area-height) - var(--app-main-tab-bar-height));
  flex-direction: column;
  overflow: hidden;
}

.home-toolbar {
    height: 84rpx; 
    flex: 0 0 84rpx; 
}
.home-swiper { 
    width: 100%; 
    height: var(--home-feed-height); 
    min-height: 0; 
    flex: 0 0 var(--home-feed-height);
}
.feed-post, .video-feed, .image-feed {
    display: flex; 
    box-sizing: border-box; 
    height: 100%; 
    min-height: 100%; 
    flex-direction: column; }
.video-card, .moment-card {
    min-height: 0; flex: 1; 
}
.watch-row { 
    flex: 0 0 auto;
}
```

`TopSafeArea` 和 `CustomTabBar` 已经处理对应系统安全区；不得再为 `.home-content`、`.home-swiper` 或 Post 卡片重复增加顶部/底部安全区 padding。任何新增固定栏都必须先从 `--home-feed-height` 中扣除其明确高度，保持每个 `swiper-item` 正好占据一条可视 Post。

#### 竖向 Swiper 与相邻项预挂载

`swiper` 的 `current` 必须是受控的 `active_feed_index`，只在 `change` 回调中同步。每个 `swiper-item` 本身保留，卡片内容仅渲染当前项及前后一项，避免下一页滑入时才挂载媒体；禁止恢复 400–600ms 的单条 Post 队列 Loading 或人为延时。

```vue
<swiper
  v-if="posts.length"
  class="home-swiper"
  vertical
  :current="active_feed_index"
  @change="on_feed_change"
>
  <swiper-item v-for="(post, post_index) in posts" :key="post.post_id">
    <view
      v-if="is_post_in_render_window(post_index)"
      class="feed-post"
      :class="{ 'feed-post--active': active_feed_index === post_index }"
    >
      <!-- video-feed 或 image-feed -->
    </view>
  </swiper-item>
</swiper>
```

```js
const is_post_in_render_window = (post_index) => Math.abs(post_index - active_feed_index.value) <= 1

const on_feed_change = (event) => {
  active_feed_index.value = event.detail.current
}

watch(posts, (next_posts) => {
  active_feed_index.value = Math.min(active_feed_index.value, Math.max(next_posts.length - 1, 0))
}, { immediate: true, flush: 'post' })
```

不得在 `@change` 中写 Store、存储或网络请求；该回调只改变当前索引。Post 内的横向图集可嵌套 `swiper`，但当图数少于两张时必须 `disable-touch`，避免与外层竖向 Swiper 的滑动意图冲突。

```vue
<swiper
  class="moment-card__media"
  :current="get_current_image_index(post)"
  :duration="280"
  :disable-touch="get_post_images(post).length < 2"
  @change="set_current_image_index(post, $event)"
>
  <swiper-item v-for="media in get_post_images(post)" :key="media.media_id">
    <PostMedia :media-url="media.media_url" content-type="image" cover-only />
  </swiper-item>
</swiper>
```

#### 视频类 Post：首页只展示封面（强制）

首页视频卡片禁止挂载 `video`/`PostMedia` 的视频模式、禁止自动播放和动态读取视频时长。页面只显示 `post.cover_url` 对应的 `image`、固定播放图标和已持久化的 `post.duration_seconds`；真实视频仅在详情页经用户点击后播放。

`cover_url` 若为普通 URL 可直接使用；若是 `indexeddb://`，必须先通过 `resolve_post_media_url` 异步解析为 Blob ObjectURL。解析结果按 `post_id` 缓存在页面级 Map 中；Post 被移除或页面卸载时调用 `revoke_post_media_url` 释放一次使用权，不能直接调用 `URL.revokeObjectURL`。

```vue
<view v-if="post.content_type === 'video'" class="video-feed">
  <view class="video-card" role="button" :aria-label="`Open ${post.author_name || 'post'} video`" @click="go_to_post(post)">
    <view class="video-card__media">
      <image class="video-card__cover" :src="get_video_cover_source(post)" mode="aspectFill" />
    </view>
    <view class="video-card__overlay" />
    <view class="video-card__play" aria-hidden="true">
      <VideoPlay class="video-card__play-icon" aria-hidden="true" />
    </view>
    <view class="video-card__badges">
      <text class="video-badge">VIDEO</text>
      <text class="time-badge">{{ format_duration(post.duration_seconds) }}</text>
    </view>
  </view>
</view>
```

```js
const video_cover_sources = ref({})
const video_cover_object_urls = new Map()
const video_cover_inputs = new Map()
let is_feed_unmounted = false

const get_video_cover_source = (post) => video_cover_sources.value[post?.post_id]
  || (!String(post?.cover_url || '').startsWith('indexeddb://') ? post?.cover_url || '' : '')

const resolve_video_cover = async (post) => {
  const post_id = post?.post_id
  const cover_url = post?.cover_url || ''
  if (!post_id || !cover_url || video_cover_inputs.get(post_id) === cover_url) return

  try {
    const source = await resolve_post_media_url(cover_url)
    const current_post = posts.value.find((item) => item.post_id === post_id)
    if (is_feed_unmounted || current_post?.cover_url !== cover_url) {
      revoke_post_media_url(source)
      return
    }

    const previous_source = video_cover_object_urls.get(post_id)
    if (previous_source && previous_source !== source) revoke_post_media_url(previous_source)
    video_cover_object_urls.set(post_id, source)
    video_cover_inputs.set(post_id, cover_url)
    video_cover_sources.value = { ...video_cover_sources.value, [post_id]: source }
  } catch {
    video_cover_inputs.set(post_id, cover_url)
  }
}

const format_duration = (duration_seconds) => {
  const seconds = Math.max(0, Math.round(Number(duration_seconds) || 0))
  return `${Math.floor(seconds / 60)}:${`${seconds % 60}`.padStart(2, '0')}`
}

watch(posts, (next_posts) => {
  const visible_post_ids = new Set(next_posts.map((post) => post.post_id))
  const next_video_cover_sources = { ...video_cover_sources.value }
  video_cover_object_urls.forEach((source, post_id) => {
    if (visible_post_ids.has(post_id)) return
    revoke_post_media_url(source)
    video_cover_object_urls.delete(post_id)
    video_cover_inputs.delete(post_id)
    delete next_video_cover_sources[post_id]
  })
  video_cover_sources.value = next_video_cover_sources
  next_posts.filter((post) => post.content_type === 'video').forEach(resolve_video_cover)
}, { immediate: true, flush: 'post' })

onBeforeUnmount(() => {
  is_feed_unmounted = true
  video_cover_object_urls.forEach((source) => revoke_post_media_url(source))
  video_cover_object_urls.clear()
  video_cover_inputs.clear()
})
```

图文 Post 的多图查询应复用 `post_media_by_id` Map，禁止对每张图片在完整媒体数组上 `find`：

```js
const post_media_by_id = computed(() => new Map(app_store.post_media.map((media) => [media.media_id, media])))
const get_post_images = (post) => {
  const images = (post.media_ids || [])
    .map((media_id) => post_media_by_id.value.get(media_id))
    .filter((media) => media?.media_kind === 'image')
  return images.length ? images : [{ media_id: post.post_id, media_url: post.media_url }]
}
```

首页 Post 的点击、头像、举报与发布入口继续调用已有真实交互：详情跳转直接使用无原生动画的 `push_route`，当前用户不显示举报，举报使用受控 `ReportUserSheet`；不得仅复制视觉卡片而省略交互闭环。

## 9. 举报与拉黑

本节只定义举报组件、记录表、拉黑表和统一过滤实现；入口、成功反馈与拉黑后的可见结果以 `INTERACTION_CONVENTIONS.md` 第 3.2、3.3 节为准。

举报统一使用 `ReportUserSheet.vue`：非本人动态的更多操作打开组件；组件采用受控 `visible` 属性，不可用父级 `v-if` 立即销毁，以确保底部进出动画完整执行。

```vue
<ReportUserSheet
  :visible="is_report_visible"
  :target-name="report_target?.user_name || ''"
  :target-user-id="report_target?.user_id || ''"
  :post-id="post?.post_id || ''"
  :comment-id="report_target?.comment_id || ''"
  @update:visible="is_report_visible = $event"
  @submitted="handle_report_submitted"
/>
```

- 弹层使用 `<transition name="report-sheet-slide">`，进入与退出均从底部渐入/渐出。`bottomOffset` 默认值为 `auto`，由组件根据当前路由决定面板位置，调用页面不重复判断页面类型。
- 普通二级/三级页的面板外部偏移为 `0rpx`，面板内部底部 padding 使用 `var(--page-safe-bottom)`，确保只补一次系统底部安全区。
- 主 Tab 页的面板外部偏移统一使用 `var(--app-main-tab-bar-height)`，完整避让 `CustomTabBar`。该变量已经包含 Tabbar 本体和底部安全区，禁止写死 `178rpx`，也禁止再拼接 `env(safe-area-inset-bottom)`；此模式下面板内部不重复增加系统安全区。
- Sheet 根层保持全屏 `inset: 0`，遮罩覆盖页面和 Tabbar；层级必须高于 `CustomTabBar`，但低于当前业务 Loading。只有页面还存在其他固定底栏时才允许显式传入 `bottomOffset`，且偏移值必须来自共享 CSS 高度变量，不得写魔法数字。
- 举报理由和 `Block This User` 都用单选框样式；拉黑是显式可选项。
- 点击提交后先显示 `ReportSubmittingLoading` 400–600ms，再调用 `app_store.submit_post_report`，最后显示成功页。
- 举报记录 `user_reports` 与黑名单 `blocked_users` 都归属 Pinia Store；`src/utils/moderation.js` 只能作为转发 Store action/getter 的兼容门面。`get_visible_posts`、`get_visible_post_comments` 等 Store getter 必须统一过滤被拉黑用户内容。
- 取消拉黑同样属于持久化写操作，必须先显示自定义 Loading，再调用 `app_store.unblock_user(target_user_id)`；成功后所有订阅可见 getter 的页面自动刷新。

```js
// loading 结束后执行
app_store.submit_post_report({
  reporter_user_id: app_store.current_user?.user_id,
  target_user_id: props.targetUserId,
  post_id: props.postId,
  reason: selected_reason.value,
  block_target: block_selected.value
})
```

### 9.1 评论操作组件：举报与本人删除

评论列表统一封装在 `src/components/PostComments.vue`。每条评论右侧必须保留一个固定操作位：`comment.user_id === current_user_id` 时显示删除图标，否则显示举报图标；不允许本人评论同时出现举报入口，也不允许他人评论出现删除入口。静态资源没有对应图标时使用 `@element-plus/icons-vue` 的 `Delete`、`Warning` 组件，颜色从 `theme.json` 映射。

评论组件只负责展示和分发操作，不直接持久化数据。参考实现：

```vue
<view v-for="comment in comments" :key="comment.comment_id" class="comment">
  <UserAvatar :source="comment.user_avatar_url" />
  <view class="comment__body">
    <text>{{ comment.user_name }}</text>
    <text>{{ comment.content }}</text>
  </view>
  <view
    class="comment__action"
    role="button"
    :aria-label="is_current_user_comment(comment) ? 'Delete reply' : 'Report reply'"
    @click.stop="handle_comment_action(comment)"
  >
    <Delete v-if="is_current_user_comment(comment)" />
    <Warning v-else />
  </view>
</view>
```

```js
const is_current_user_comment = (comment) => Boolean(
  props.currentUserId && comment?.user_id === props.currentUserId
)

const handle_comment_action = (comment) => {
  emit(is_current_user_comment(comment) ? 'delete' : 'report', comment)
}
```

页面接收 `report` 事件后写入评论作者、评论 id 并打开常驻挂载的 `ReportUserSheet`。接收 `delete` 事件后先校验归属，再打开当前页的 `CommentDeleteConfirmDialog`；确认时先关闭确认弹窗，显示 `CommentDeletingLoading` 400–600ms，Loading 结束后才调用 Store action 删除并持久化。弹窗、举报 Sheet 均只使用受控 `visible`，不能用父级 `v-if` 销毁。

```vue
<PostComments
  :comments="comments"
  :current-user-id="current_user_id"
  @report="open_comment_report"
  @delete="request_comment_delete"
/>
<CommentDeleteConfirmDialog
  :visible="is_delete_dialog_visible"
  @cancel="close_comment_delete"
  @confirm="confirm_comment_delete"
/>
<CommentDeletingLoading v-if="is_comment_deleting" />
<ReportUserSheet
  :visible="is_report_visible"
  :target-user-id="report_target?.user_id || ''"
  :post-id="post?.post_id || ''"
  :comment-id="report_target?.comment_id || ''"
  @update:visible="is_report_visible = $event"
/>
```

```js
const confirm_comment_delete = () => {
  const comment_id = comment_delete_target.value?.comment_id
  if (!comment_id || is_comment_deleting.value) return
  is_delete_dialog_visible.value = false
  is_comment_deleting.value = true
  comment_delete_timer = setTimeout(() => {
    comment_delete_timer = null
    app_store.delete_post_comment({ comment_id })
    comment_delete_target.value = null
    is_comment_deleting.value = false
  }, 400 + Math.floor(Math.random() * 201))
}

onBeforeUnmount(() => clearTimeout(comment_delete_timer))
```

Store 删除 action 必须再次校验评论归属，禁止只依赖界面隐藏删除 icon。删除成功后持久化完整评论表；帖子 `comment_count` 继续从评论实体派生，不维护重复计数状态。

```js
delete_post_comment({ comment_id } = {}) {
  const user_id = this.current_user?.user_id
  const index = this.post_comments.findIndex((comment) => comment.comment_id === comment_id)
  if (!user_id || index < 0) return { success: false, error: 'Reply not found.' }
  if (this.post_comments[index].user_id !== user_id) {
    return { success: false, error: 'You can only delete your own reply.' }
  }
  this.post_comments.splice(index, 1)
  this.persist_list(STORAGE_KEYS.POST_COMMENTS, this.post_comments)
  return { success: true }
}
```

### 9.2 关注关系表（唯一方向来源）

用户关注关系只使用 `user_relationships` 一张表，方向由两个字段表达，不能额外维护“粉丝列表”“关注列表”或布尔缓存：

- `follower_user_id`：发起关注的用户 id。
- `following_user_id`：被关注的用户 id。
- 用户 A 关注用户 B，只新增一条 `follower_user_id: A`、`following_user_id: B` 的记录；取消关注只物理删除这一方向的记录。
- 只要同时存在 `A → B` 和 `B → A` 两条记录，即为互相关注；互关不是第三条记录，也不由页面本地状态判断。
- `relationship_status` 仅保留历史数据兼容；新关注记录写入 `active`，业务查询以记录是否存在为准（历史 `removed` 记录视为不存在）。

关系记录只能通过 `src/stores/store.js` 的 `request_follow`、`cancel_follow` action 更新。点击入口先执行 400–600ms 自定义 Loading，Loading 结束后才调用 action；禁止页面直接修改 `user_relationships` 或持久化层。

```js
// Store action：当前用户 A 关注目标 B，只建立 A → B。
request_follow({ target_user_id }) {
  const follower_user_id = this.current_user?.user_id
  if (!follower_user_id || !target_user_id || follower_user_id === target_user_id) {
    return { success: false, error: 'Unable to follow this user.' }
  }

  const state = this.get_relationship_state(target_user_id)
  if (state.is_following) return { success: true, relationship: state.following }

  const now = new Date().toISOString()
  const follow_record = {
    relationship_id: `relationship_${Date.now()}`,
    follower_user_id,
    following_user_id: target_user_id,
    relationship_status: 'active',
    created_at: now,
    accepted_at: now
  }
  this.user_relationships = [follow_record, ...this.user_relationships]
  this.persist_user_relationships()
  return { success: true, relationship: follow_record }
}

// Store action：当前用户 A 取消关注 B，只移除 A → B。
cancel_follow({ target_user_id }) {
  const follower_user_id = this.current_user?.user_id
  this.user_relationships = this.user_relationships.filter((item) => !(
    item.follower_user_id === follower_user_id
    && item.following_user_id === target_user_id
  ))
  this.persist_user_relationships()
  return { success: true, relationship: this.get_relationship_state(target_user_id) }
}
```

所有页面都必须从同一份 Store 关系表派生列表和状态。Following 查询当前用户作为关注方的记录并读取目标用户；Followers 查询当前用户作为被关注方的记录并读取关注用户：

```js
const current_user_id = computed(() => app_store.current_user?.user_id || '')

const following_ids = computed(() => app_store.user_relationships
  .filter((item) => item.follower_user_id === current_user_id.value && item.relationship_status !== 'removed')
  .map((item) => item.following_user_id))

const follower_ids = computed(() => app_store.user_relationships
  .filter((item) => item.following_user_id === current_user_id.value && item.relationship_status !== 'removed')
  .map((item) => item.follower_user_id))

const relationship = app_store.get_relationship_state(target_user_id)
// 两个方向的记录同时存在才为 true。
const is_mutual = relationship.is_mutual
```

### 9.3 拉黑表与统一可见数据过滤

拉黑表 `blocked_users` 是后续所有被拉黑数据过滤的唯一来源。记录字段固定为：`user_id`（被拉黑用户）、`owner_user_id`（执行拉黑的当前用户）和 `blocked_at`。同一用户只保存一条当前用户拥有的记录；不同登录用户的黑名单必须相互隔离。

- `use_app_store().blocked_users` 是该表 hydration 后的唯一运行时数据；页面只调用 `app_store.block_user`、`app_store.unblock_user` 和相关 getter，不直接读取持久化层。
- `src/utils/moderation.js` 的兼容接口只允许转发到上述 Store action/getter；不得自行读写另一份黑名单。
- 拉黑、取消拉黑同属持久化写操作：确认后先显示 400–600ms Loading，再调用 Store action；action 成功后 Store 已同步且完成持久化，Loading 期间禁止重复操作。
- 任何帖子、圈子、用户搜索、评论、通知、私聊会话与消息等聚合查询，都必须基于 `app_store.blocked_users` 过滤目标用户。禁止只在当前组件隐藏一条数据，或将过滤结果写回业务原数组。
- 首选 Store 的可见 getter（例如 `get_visible_posts`、`get_visible_post_comments`）；缺少专用 getter 时，在 computed 查询入口使用同一黑名单表过滤，并补充对应 Store getter，避免不同页面口径不一致。

```js
// Loading 结束后只调用 Store action。
app_store.block_user(target_user_id)

// 页面只订阅 Store getter，不自行复制过滤规则。
const visible_posts = computed(() => app_store.get_visible_posts)
const visible_comments = computed(() => app_store.get_visible_post_comments(post_id.value))
```

```js
// 推荐在 Store 中集中封装，页面只订阅可见数据。
get_visible_posts: (state) => state.published_posts.filter((post) => (
  post.status === 'published'
  && !state.blocked_users.some((item) => item.user_id === (post.creator_id || post.owner_user_id))
))
```

## 10. 页面样式

- 颜色、表面、文字、按钮、图标和状态样式只执行第 1 节的主题 token 流程；目标模板负责确定视觉语义和布局，不提供绕过 `theme.json` 的颜色 fallback。
- 图标和图片严格执行第 15.2 节的来源优先级、颜色和资源保留规则；禁止在单个页面重新定义另一套 fallback 顺序。
- CSS 尺寸单位固定遵循“布局使用 `rpx`、边框线宽使用 `px`”：宽高、间距、定位、字号、行高和 `border-radius` 使用 `rpx`；`border` 简写中的线宽以及 `border-width`、`border-top-width`、`border-right-width`、`border-bottom-width`、`border-left-width` 只能使用 `px`。允许 `border: none` 等不声明线宽的写法；显式声明零线宽时写 `0px`，不得写 `0`、`0rpx`，也不得在同一项目中混用 `rpx` 边框。
- 边框颜色仍必须来自 `theme.json` 映射的 CSS 变量；单位例外只适用于边框线宽，不允许把阴影、圆角、布局尺寸或其他设计尺寸改成 `px`。
- CSS 排版以一个选择器规则块中的**声明数量**为判断依据；一条 `property: value;` 计为一条声明。复合值仍只算一条，例如 `padding: 0 20rpx;` 是一条声明，不按值的数量拆分。
- 一个规则块包含 `1–5` 条声明时，允许写成单行，也允许按多行格式展开；单行格式固定为 `.selector { property: value; }`，选择器、左右花括号和声明之间各保留一个空格。不得把两个不同的选择器规则块拼接在同一行。
- 一个规则块包含 `6` 条或更多声明时，禁止写在同一行；选择器和左右花括号分行，每条声明独占一行并使用两空格缩进。相邻规则块之间保留一个空行。
- 只调整样式排版时可执行 `corepack pnpm format:styles`。该命令会把 `src/**/*.vue` 的 `<style>` 内容统一展开为多行格式，不修改 template、script、选择器或属性值；多行格式对任意声明数量都合规。

```scss
.content {
  padding: 28rpx 40rpx 150rpx;
}

.content-title {
  color: var(--title-color);
  font-size: 32rpx;
  border-bottom: 1px solid var(--surface-border-color);
}

.coins-content { padding: 4rpx 28rpx 52rpx; }

.history-link {
  display: flex;
  height: 64rpx;
  align-items: center;
  padding: 0 20rpx;
  border: 2px solid var(--coins-button-background);
  border-radius: 999rpx;
  color: var(--coins-button-background);
  font-size: 22rpx;
  font-weight: 800;
}
```

## 11. 页面过渡动画规范

路由跳转统一使用 `animationType: 'none'` 关闭平台原生动画，过渡效果全部由页面/组件自身的 Vue `<transition>` + CSS transition 控制，保证全局节奏一致。通用参数约定：

- 页面路由动画时长的唯一来源是 `src/utils/routeTransition.js` 的 `ROUTE_TRANSITION_DURATION.ENTER` 与 `ROUTE_TRANSITION_DURATION.LEAVE`。`PageTransition.vue` 必须把两个值映射为 `--route-transition-enter-duration`、`--route-transition-leave-duration`；iOS Push/Pop 联动过渡把 `ENTER` 映射为 `--route-transition-stack-duration`，保证前后页面使用同一时长。全局 CSS 与离场兜底定时器只消费这些映射，页面、组件和文档示例不得另写独立毫秒值。调整路由动画时长时只修改该常量。
- 缓动：入场用 `cubic-bezier(.33,1,.68,1)`（easeOutCubic）；离场用 `cubic-bezier(.32,.72,0,1)`。
- 位移幅度 40–72rpx，缩放幅度 0.92–0.98；动画元素加 `will-change: opacity, transform`。
- 全屏覆盖层关闭并揭示下层页面时，采用"覆盖层离场 + 下层入场"的交叉过渡：下层内容在覆盖层开始离场约 80ms 后入场。
- 覆盖层/弹层组件必须用受控 `visible` prop 驱动 `<transition>`，不可用父级 `v-if` 直接销毁，否则离场动画不会执行；确认类按钮在过渡期间要禁用防重复触发。

### 11.1 协议 Sheet

当前模板的协议实现是 `src/components/AgreementViewer.vue`，由登录页和注册页常驻挂载，通过 `v-model`、`type="user|privacy"` 与 `presentation="bottom|page"` 控制。底部模式遵循第 11.4 节的 Sheet 进出场和第 9 节的底部定位规则；二级页面模式遵循 `PageTransition`。不得把未注册的欢迎页或 EULA 组件描述成当前实现；阶段 1 确认新项目需要欢迎页时，必须先登记并注册页面。协议组件不得直接写登录或账号状态。

### 11.2 二级/三级页面过渡（PageTransition）

二级/三级页面根节点统一使用当前真实组件 `src/components/PageTransition.vue`。组件根据路由动作选择标准的 `page-slide-forward`、`page-slide-back`、`page-route-none`，或第 11.2.2 节的 `page-stack-forward`、`page-stack-back`，并从 `ROUTE_TRANSITION_DURATION` 注入 CSS 变量；页面不得再声明旧项目专属的过渡类名。

```vue
<PageTransition ref="page_transition" :style="theme_style">
  <TopSafeArea />
  <view class="page-content">
    <SecondaryPageHeader title="Detail" />
    <scroll-view class="content-scroll" scroll-y :show-scrollbar="false">
      <view class="content-scroll__inner"><!-- 页面内容 --></view>
    </scroll-view>
  </view>
  <BottomSafeArea />
</PageTransition>
```

### 11.2.1 页面层级导航、返回归属与过渡

页面跳转必须先确定“返回哪一层”，再编写路由。所有路由调用都使用 `animationType: 'none'` 和 `animationDuration: 0`，视觉过渡由 Vue `<transition>` 完成；二级/三级页面进入和返回时均不展示全屏 Loading，也不以定时器延迟路由。

本节中的“来源页先离场，再打开目标页”仅描述标准串行过渡，不适用于当前模板默认的 iOS Stack 多级链路。当前公共方法的实际调用方式、同步 Push/Pop 和逐级返回统一按第 11.2.3 节执行。

#### 主 Tab 页面 → 二级页面

以 `主 Tab 页面` 进入视频/图文详情为标准：

1. 主 Tab 页面点击入口后立即使用 `push_route()` 打开二级页，不创建导航 Loading 状态，不等待模拟请求；主 Tab 来源页不播放整页离场动画。
2. URL 只传递页面所需业务参数；目标二级页直接从 Store 派生可用数据。确实需要等待异步数据时，仅在对应内容区域展示局部 Loading。
3. 二级页统一使用 `PageTransition` 入场和离场。标准入场从右侧 `32rpx` 滑入并淡入，标准离场向左 `32rpx` 滑出并淡出；时长分别由 `ROUTE_TRANSITION_DURATION.ENTER`、`ROUTE_TRANSITION_DURATION.LEAVE` 控制。
4. 二级页返回时调用 `page_transition.navigate_back()`；隐藏页面、等待离场、执行 `back_route()`、路由失败恢复及 `onShow` 恢复均由 `PageTransition` 内部处理。
5. 来源主 Tab 页在 `onShow` 中恢复必要的可见状态，不能因为二级页离场动画而黑屏。主 Tab 骨架屏由 `prepare_main_tab_skeleton()` 与 `use_main_tab_skeleton(route)` 共同管理；每个静态主 Tab 只消费自己的单次资格，已经展示过的来源 Tab 返回时不得重新出现，也不在详情页额外启动一份。

示例结构：

```js
const open_detail = (post_id) => {
  push_route({
    url: `/pages/wall/detail?post_id=${encodeURIComponent(post_id)}`
  })
}
```

```js
const go_back = () => page_transition.value?.navigate_back()
```

#### 二级页面 A → 二级页面 B，B 固定返回主 Tab

当业务要求 B 返回主 Tab 时，A 必须在 B 的 URL 中声明返回目标，例如 `return_to_wall=wall_index`。该链路适用于“发布成功 → 帖子详情 → Wall 主 Tab”等场景：

1. A 已包裹 `PageTransition` 时调用 `page_transition.navigate_forward()`：先完成 A 的离场，再打开 B；不显示全屏 Loading，也不传递导航 Loading 状态。
2. B 使用 `PageTransition` 入场/离场；返回时调用 `page_transition.navigate_relaunch({ url: '<明确的主 Tab 路由>' })`，离场完成后清空中间页面栈并固定回到主 Tab，不得直接调用 `uni.reLaunch`。
3. 该返回过程同样不显示全屏 Loading。只有登录或注册成功分支提前调用 `prepare_main_tab_skeleton()` 时，目标主 Tab 尚未消费本轮资格才允许展示一次；已经展示过的主 Tab 重新创建后直接渲染内容。二级页返回、发布成功页返回及普通主 Tab 重建不得重新准备骨架屏。

#### 二级页面 A → 二级页面 B，B 返回 A

以 `二级页面的post列表` 点击进入 post 详情为标准：

1. A 点击入口后调用 `page_transition.navigate_forward()`；`PageTransition` 先播放 A 的离场动画，并在 `@after-leave` 后调用 `push_route()` 打开 B。整个链路不展示全屏 Loading，B 负责自身入场和内容渲染。
2. A 在路由完成前保持离场状态；路由失败、下级页面返回或页面重新显示时，由 `PageTransition` 统一恢复可见状态，避免黑屏或闪回。
3. B 返回时调用 `page_transition.navigate_back()`；`PageTransition` 使用 `ROUTE_TRANSITION_DURATION.LEAVE` 完成离场后执行 `back_route()`，并在 A 的 `onShow` 中统一恢复页面可见状态。
4. 若 B 由发布成功页进入且业务规定返回主 Tab，则改用上一节的 `return_to_*` 标记和 `navigate_relaunch()`，不能混用普通 `navigate_back()`。

### 11.2.2 iOS Push/Pop 双页面联动过渡（H5 + WKWebView）

目标模板明确要求类似 `UINavigationController` 的页面联动时，使用 `src/utils/routeTransition.js` 已封装的 iOS Stack 变体；当前参考链路为 `/pages/library/index → /pages/library/collection`。该变体仍使用真实 `uni.navigateTo`/`uni.navigateBack` 页面栈，并继续传入 `animationType: 'none'`、`animationDuration: 0`，不调用 iOS 原生导航，也不接管 iOS 宿主的左滑返回手势。

- Push 开始前，`push_stack_route()` 在 H5 运行时创建来源 `uni-page` 的只读 DOM 快照；快照设置 `inert`、`aria-hidden` 与 `pointer-events: none`，只用于视觉过渡，不响应点击、滚动或媒体控制。
- Push 时来源 A 同步执行 `translate3d(0, 0, 0) scale(1) → translate3d(-30%, 0, 0) scale(.95)`，目标 B 执行 `translate3d(100%, 0, 0) → translate3d(0, 0, 0)`。
- 点击返回触发 Pop 时，来源快照 A 与当前 B 必须使用同一个 `--route-transition-stack-duration` 和 `cubic-bezier(.32,.72,0,1)` 同步联动：A 执行 `translate3d(-30%, 0, 0) scale(.95) → translate3d(0, 0, 0) scale(1)`，B 执行 `translate3d(0, 0, 0) → translate3d(100%, 0, 0)`。B 向右退出多少，A 就同步恢复多少；B 完全退出时 A 必须恰好完整显示，双方均不得加入 `opacity`。
- 目标页使用 `<PageTransition transition-variant="ios-stack">`，返回入口仍由 `SecondaryPageHeader` 调用上下文的 `navigate_back()`。B 离场完成后工具层执行真实路由返回；只有检测到真实上一级 `uni-page` 已重新挂载并完成一帧绘制，才能清理快照、前景层级和 `requestAnimationFrame`，不得用固定两帧直接移除。
- WKWebView 原生历史手势返回不再播放点击返回使用的第二套 H5 Pop 动画。公共工具监听本次 Stack 的 `popstate`，仅在原生手势提交后无动画揭示完整 A，并等待真实 A 就绪后清理视觉快照；手势取消时不会触发历史提交，也不得提前修改页面状态。监听器必须随快照清理一并移除，避免后续普通路由误触发。
- 路由失败时工具层清理或复位快照并恢复当前页，页面不得维护第二套快照、可见状态或兜底计时器。普通浏览器与 WKWebView 共用同一实现；没有 DOM 的非 H5 环境只保留真实路由和目标页位移，不为其维护另一套页面栈。
- `route-stack-page--foreground` 是嵌套快照条目共享的页面层级资源，不属于某一个快照条目的独占状态。A → B → C 后从 C 返回 B 时，B 同时是“A 快照的前景页”和“C 返回后的真实来源页”；清理 C 对应条目时不得直接移除 B 的前景 class。
- 释放前景页时必须先把当前条目的 `foreground_page_element` 置空，再检查 `ios_stack_entries` 中是否还有其他条目引用同一个元素。只有最后一个持有者释放时才允许移除 `route-stack-page--foreground`。`clear_ios_stack_snapshot` 与 `bind_stack_foreground_page` 必须共用同一个释放方法，不得分别直接调用 `classList.remove`。

#### 嵌套快照的前景层级共享所有权（强制实现）

若三级页返回后出现主 Tab 内容覆盖二级列表、设置列表或其他中间页面，说明中间页面的 `route-stack-page--foreground` 被新一层快照提前移除。`routeTransition.js` 必须使用以下共享所有权实现：

```js
const release_stack_foreground_page = (stack_entry) => {
  const foreground_page_element = stack_entry?.foreground_page_element
  if (!foreground_page_element) return

  stack_entry.foreground_page_element = null
  const is_owned_by_another_entry = ios_stack_entries.some((entry) => (
    entry !== stack_entry
    && entry.foreground_page_element === foreground_page_element
  ))
  if (!is_owned_by_another_entry) {
    foreground_page_element.classList.remove('route-stack-page--foreground')
  }
}

const clear_ios_stack_snapshot = (stack_entry = get_active_stack_entry()) => {
  if (!stack_entry) return

  cancel_stack_animation_frame(stack_entry)
  cancel_stack_cleanup_frame(stack_entry)
  release_stack_foreground_page(stack_entry)
  stack_entry.snapshot_element?.remove()
  const entry_index = ios_stack_entries.indexOf(stack_entry)
  if (entry_index >= 0) ios_stack_entries.splice(entry_index, 1)
  if (!ios_stack_entries.length) remove_stack_history_listener()
}

const bind_stack_foreground_page = (stack_entry) => {
  if (!stack_entry) return
  const active_page_element = get_active_uni_page()
  if (stack_entry.foreground_page_element !== active_page_element) {
    release_stack_foreground_page(stack_entry)
    stack_entry.foreground_page_element = active_page_element
  }
  stack_entry.foreground_page_element?.classList.add('route-stack-page--foreground')
}
```

禁止在任何绑定或清理函数中改回下面这种无条件移除方式，否则嵌套返回时会再次丢失中间页面的前景层级：

```js
// 错误：未检查其他快照条目是否仍持有该页面。
stack_entry.foreground_page_element?.classList.remove('route-stack-page--foreground')
```

最小验收必须至少覆盖两条真实的三级链路，例如“主 Tab → 二级列表 → 三级详情 → 返回二级列表”和“个人中心 → 设置 → 设置子页 → 返回设置”。返回后应同时满足：活动 `uni-page` 仍含 `route-stack-page--foreground`、计算层级为 `z-index: 11`、快照数量只减少当前一级、视口顶部与中部均由当前二级页覆盖。派生项目应使用阶段 1 页面清单中已注册的真实页面替换示例名称，不得为了验收创建空页面。

```vue
<PageTransition transition-variant="ios-stack" :style="theme_style">
  <!-- 二级页面固定骨架 -->
</PageTransition>
```

```js
const open_collection = (item_id) => push_stack_route({
  url: `/pages/library/collection?item_id=${encodeURIComponent(item_id)}`
})
```

#### 常见故障：目标页透明导致来源快照穿透

iOS Stack 为了在 Push/Pop 时同时显示上下两层页面，会把前景 `uni-page`、`uni-page-wrapper` 和 `uni-page-body` 设为透明；真正遮住来源快照的必须是目标页自己的 `.page` 根节点。因此，所有使用 `transition-variant="ios-stack"` 的页面都必须满足以下规则：

- `theme_style` 必须从 `theme.json` 映射 `--page-background`，并直接传给 `PageTransition`。
- `PageTransition` 生成的页面根节点必须使用 `background: var(--page-background)`，且该背景必须是不透明主题色；不得只给内部 `scroll-view`、卡片或内容区设置背景。
- Push 完成后若来源页的 Logo、标题、按钮等仍固定显示在目标页内容之间，先检查目标页根节点的计算背景与内联 `--page-background`，不要先删除快照、提高内部组件 `z-index` 或提前清理 Stack。删除快照虽然能暂时遮住问题，但会破坏返回时的双页面 Pop 联动。
- 新增或改造 Stack 页面时，必须在 Push 动画结束后停留至少一帧检查目标页；来源页只允许在 Push 进行过程中从目标页尚未覆盖的左侧区域可见，动画结束后不得透过目标页。

```vue
<PageTransition
  ref="page_transition"
  transition-variant="ios-stack"
  :style="theme_style"
>
  <!-- 页面内容 -->
</PageTransition>
```

```js
const theme_style = {
  '--page-background': theme.colors.page.background,
  '--route-transition-shadow': theme.colors.surface.deep
}
```

```scss
.page {
  background: var(--page-background);
}
```

#### 常见故障：登录守卫取消 Push 后遗留孤儿快照

`push_stack_route()` 必须在调用真实 `uni.navigateTo` 前创建来源页快照。若 `uni.addInterceptor('navigateTo', ...)` 的 `invoke` 因未登录返回 `false`，uni-app H5 可能不会调用本次导航的 `fail` 或 `complete`；此时只用原生 `uni.reLaunch()` 跳到认证入口，会把刚创建的快照留在 DOM 中。该孤儿快照层级高于认证页，协议弹层关闭后会继续覆盖认证页，视觉上可能表现为“同意后回到首页”“部分页面卡住”或点击失效，但协议回调本身并未执行错误跳转。

登录守卫和其他会取消 Stack 导航的全局守卫必须遵守以下规则：

- 守卫拦截后进入欢迎页、登录页或其他固定入口时，统一调用 `relaunch_route()`；不得直接调用 `uni.reLaunch()`。`relaunch_route()` 会先清理全部 Stack 快照、前景类名、动画帧和历史监听，再执行无原生动画的真实 `reLaunch`。
- 守卫重定向目标必须加入公开页面白名单，避免 `relaunch_route()` 再次被同一守卫拦截形成循环。
- 协议同意回调只保存协议状态、关闭弹层并揭示当前认证页内容；没有成功写入登录会话时，不得进入主 Tab。不要在协议组件中用额外跳转掩盖孤儿快照问题。
- 该问题属于路由工具层与守卫的协作边界，必须在守卫中统一修复；不得在认证页、协议组件或各个来源页面分别删除 DOM 快照。
- 当前模板的公开认证入口是 `/pages/login/index`，协议组件是 `AgreementViewer.vue`。派生项目只有在阶段 1 已登记并在 `pages.json` 注册欢迎页/EULA 流程后，才能把重定向目标替换为 `/pages/welcome/index`；不得引用未注册页面。

```js
import { relaunch_route } from '@/utils/routeTransition'

const redirect_to_public_entry = () => {
  relaunch_route({
    url: '/pages/login/index',
    complete: finish_login_redirect
  })
}
```

验收时至少覆盖 Wall 和 Profile 两种不同来源页：

1. 清除登录状态，从主页面点击任一受保护入口。
2. 守卫完成后 URL 必须为当前项目登记的公开认证入口，DOM 中 `.route-stack-snapshot` 数量必须为 `0`，真实 `uni-page` 只能保留该认证页。
3. 若项目包含首次协议弹层，同意协议后 URL 仍为该认证入口，认证页内容正常显示，快照数量仍为 `0`；未建立登录会话时不得进入主 Tab。
4. 再从另一主页面重复拦截流程，确认不会出现来源页覆盖、点击失效、黑屏或页面卡住。

### 11.2.3 多级页面跳转与逐级返回（`e446179` 修复方案）

本节依据提交 `e4461792ae148517f7d8f3cbf3995b30ffdfc5d1`（`fix(common-template): preserve nested route foreground ownership`）及其路由回归测试编写。该提交修复的是**嵌套返回时中间页前景层级被提前释放**，不是通过刷新首页、重新打开中间页或清空快照规避问题。底层共享所有权代码以第 11.2.2 节的 `release_stack_foreground_page()` 为唯一实现，本节只补充调用方法与交接约束。

#### 页面调用：进入下一层保留当前层，返回只退出当前层

使用当前已注册的真实页面作为示例：

```text
A 首页 → B 帖子详情 → C 他人主页 → D 帖子详情
A 首页 ← B 帖子详情 ← C 他人主页 ← D 帖子详情
```

B 与 D 可以使用同一个 `/pages/wall/detail` 路由文件，但它们是不同的页面栈实例，分别接收各自的 `post_id`；不能按路由字符串相同就合并实例、覆盖中间页或跳回首页。

- A 未包裹 `PageTransition`：调用 `push_route()`。当前 `push_route()` 已默认创建 iOS Stack 来源快照，`push_stack_route` 是它的别名，不是另一套导航实现。
- B、C、D 已包裹 `PageTransition`：进入下一层调用当前页面实例的 `navigate_forward()`；该方法立即交给公共 Push 流程，不先隐藏来源页、不等待来源页串行离场，也不增加导航 Loading。
- 普通逐级返回调用当前页面实例的 `navigate_back()`，默认只返回一层。不得用 `replace_route()`、`navigate_replace()`、`navigate_relaunch()` 或 `relaunch_route()` 替代，否则会替换或清空需要保留的页面栈。
- 登录完成、退出登录、守卫重定向及业务明确要求固定返回主 Tab 时，才使用对应清栈方法。`return_to_wall=wall_index` 只属于明确的固定返回流程，不得附加到本节的普通多级浏览链路。
- 返回栏使用 `SecondaryPageHeader`，组件会从当前 `PageTransition` 上下文调用返回方法；页面不重复绑定另一套路由。业务额外返回入口需要方法时，再使用下面的 `go_back()`。

A 首页入口方法（点击的 `post` 来自 Store 可见帖子列表）：

```js
import { push_route } from '@/utils/routeTransition'

const go_to_post = (post) => {
  if (!post?.post_id) return
  push_route({
    url: `/pages/wall/detail?post_id=${encodeURIComponent(post.post_id)}`
  })
}
```

B、C、D 共用以下页面骨架；实际页面保留各自的标题和内容，安全区与固定返回栏按第 15.1.2 节执行：

```vue
<template>
  <PageTransition
    ref="page_transition"
    transition-variant="ios-stack"
    :style="theme_style"
  >
    <TopSafeArea />
    <view class="page-content">
      <SecondaryPageHeader title="Detail" />
      <scroll-view class="content-scroll" scroll-y :show-scrollbar="false">
        <view class="content-scroll__inner">
          <!-- 当前页面的业务内容与下一级入口 -->
        </view>
      </scroll-view>
    </view>
    <BottomSafeArea />
    <!-- 当前页的业务 Loading、Sheet 和 ConfirmDialog 放在这里。 -->
  </PageTransition>
</template>

<script setup>
import { ref } from 'vue'
import theme from '@/config/theme.json'
import BottomSafeArea from '@/components/BottomSafeArea.vue'
import PageTransition from '@/components/PageTransition.vue'
import SecondaryPageHeader from '@/components/SecondaryPageHeader.vue'
import TopSafeArea from '@/components/TopSafeArea.vue'

const page_transition = ref(null)
const theme_style = {
  '--page-background': theme.colors.page.background,
  '--route-transition-shadow': theme.colors.surface.shadow
}

// 仅供额外的业务返回入口使用；SecondaryPageHeader 已自动处理返回。
const go_back = () => {
  page_transition.value?.navigate_back()
}
</script>
```

B 帖子详情进入 C 他人主页的方法；`post` 和 `can_open_author_profile` 沿用详情页从 Store 派生的当前帖子与非本人判断：

```js
const open_author_profile = () => {
  if (!can_open_author_profile.value) return
  page_transition.value?.navigate_forward({
    url: `/pages/profile/user?user_id=${encodeURIComponent(post.value.owner_user_id)}`
  })
}
```

C 他人主页进入 D 帖子详情的方法；参数来自该用户的 Store 可见帖子列表：

```js
const open_post = (post) => {
  if (!post?.post_id) return
  page_transition.value?.navigate_forward({
    url: `/pages/wall/detail?post_id=${encodeURIComponent(post.post_id)}`
  })
}
```

在 D、C、B 依次点击各自固定返回栏，公共组件分别执行 `navigate_back()`，依次恢复 C、B、A；页面不得在 `onShow` 中再次 Push、清栈、删除 DOM、切换整页可见状态或重新准备主 Tab 骨架屏。

#### 工具层交接：只释放当前层，不提前释放中间页

点击返回时，公共工具先让当前页向右退出，同时让上一级快照同步恢复；离场完成后才执行真实返回，待真实上一级页面就绪并完成绘制后再移除当前层快照。动画时长、背景不透明要求和原生历史手势处理继续按第 11.2.2 节执行，页面不自行添加定时器、淡出、滤镜或“关灯”效果。

`e446179` 的关键约束是：C 返回 B 时，B 仍被 A 对应的快照条目持有。因此清理当前条目时，必须先置空它自己的 `foreground_page_element`，再检查其他条目是否仍引用同一个 DOM 元素；只有最后一个持有者释放时才移除 `route-stack-page--foreground`。`clear_ios_stack_snapshot()` 与 `bind_stack_foreground_page()` 都必须调用第 11.2.2 节的同一个释放方法。该代码只放在 `src/utils/routeTransition.js`，不得复制到页面中。

以下数量以从 A 开始、没有更早 Stack 条目的单条链路为前提，均指动画和真实页面交接完成后的状态：

| 操作完成后 | 当前真实页面 | 保留的来源快照 | 前景层级约束 |
| --- | --- | --- | --- |
| A → B → C → D | D | A、B、C，共 3 个 | D 覆盖下层快照 |
| D → C | C | A、B，共 2 个 | C 仍持有前景 class，不能被 A/B 覆盖 |
| C → B | B | A，共 1 个 | B 仍持有前景 class，不能露出半个首页 |
| B → A | A | 0 个 | 全部 Stack 条目及历史监听释放 |

#### 对应回归验证

修改公共导航或新增多级链路后，运行已有的一次性测试：

```powershell
corepack pnpm test:routes
```

`scripts/route-transition.test.mjs` 直接加载真实 `routeTransition.js`，覆盖 Home/Wall 两种来源的“详情 → 他人主页 → 返回详情”、四层页面与历史返回、Push/Pop 失败恢复和 `relaunch_route()` 清理。它验证中间页可见状态、前景 class、剩余快照与监听/定时器释放；这是模拟 DOM 回归，不替代 iOS WKWebView 实机对返回过程、滚动位置和闪烁的验收。验收还需确认：每次只退出一层、返回内容仍来自同一 Store、下层页面从 Pop 开始即同步露出、已消费过骨架屏资格的主 Tab 返回时不重新加载。

### 11.3 页面淡入上浮（page-fade-up）

用于主页面或数据加载完成后的整页揭示，常与骨架屏/loading 切换搭配：

```vue
<transition name="page-fade-up" appear>
  <view v-if="!is_loading" class="content">
    <!-- 页面内容 -->
  </view>
</transition>
```

```scss
.page-fade-up-enter-active {
    transition: opacity .4s cubic-bezier(.33,1,.68,1), transform .4s cubic-bezier(.33,1,.68,1); 
}
.page-fade-up-enter-from { 
    opacity: 0;
    transform: translateY(36rpx);
}
```

### 11.4 底部弹层滑入滑出（sheet-slide）

用于举报、支付确认等底部 Sheet（例如 `ReportUserSheet`）。Sheet 位置只使用第 9 节定义的 `bottomOffset` 规则：普通页为 `0rpx`，主 Tab 页为 `var(--app-main-tab-bar-height)`。

```vue
<transition name="sheet-slide">
  <view v-if="visible" class="sheet-layer" :style="sheet_position_style">
    <view class="sheet-scrim" />
    <view class="sheet-panel">
      <!-- 弹层内容 -->
    </view>
  </view>
</transition>
```

```js
const resolved_bottom_offset = computed(() => props.bottomOffset === 'auto'
  ? (is_main_tab_page() ? 'var(--app-main-tab-bar-height)' : '0rpx')
  : props.bottomOffset)

const sheet_position_style = computed(() => ({
  '--sheet-bottom-offset': resolved_bottom_offset.value,
  '--sheet-panel-safe-bottom': resolved_bottom_offset.value === '0rpx'
    ? 'var(--page-safe-bottom)'
    : '0rpx'
}))
```

```scss
.sheet-layer {
  position: fixed;
  z-index: 1200;
  inset: 0;
  display: flex;
  box-sizing: border-box;
  align-items: flex-end;
  padding-bottom: var(--sheet-bottom-offset);
}
.sheet-scrim {
  position: absolute;
  inset: 0;
}
.sheet-panel {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  padding-bottom: calc(48rpx + var(--sheet-panel-safe-bottom));
  will-change: transform;
}
.sheet-slide-enter-active,
.sheet-slide-leave-active {
  transition: opacity .28s ease;
}
.sheet-slide-enter-active .sheet-panel,
.sheet-slide-leave-active .sheet-panel {
  transition: transform .34s cubic-bezier(.32,.72,0,1);
}
.sheet-slide-enter-from,
.sheet-slide-leave-to {
  opacity: 0;
}
.sheet-slide-enter-from .sheet-panel,
.sheet-slide-leave-to .sheet-panel {
  transform: translateY(calc(100% + var(--sheet-bottom-offset)));
}
```

### 11.5 居中弹窗缩放淡入（dialog-pop）

用于 `*ConfirmDialog.vue` 系列确认弹窗。transition 包裹遮罩层控制整体透明度，缩放作用于卡片：

```vue
<transition name="dialog-pop">
  <view v-if="visible" class="dialog-layer" @click="emit('cancel')">
    <view class="dialog-card" @click.stop>
      <!-- 弹窗内容 -->
    </view>
  </view>
</transition>
```

```scss
.dialog-layer { 
    position: fixed; 
    inset: 0; 
    z-index: 1200; 
}
.dialog-card { 
    will-change: opacity, transform;
}
.dialog-pop-enter-active { 
    transition: opacity .28s ease-out;
}
.dialog-pop-enter-active .dialog-card {
    transition: transform .28s cubic-bezier(.34,1.4,.64,1);
}
.dialog-pop-leave-active {
    transition: opacity .2s ease-in;
}
.dialog-pop-leave-active .dialog-card {
    transition: transform .2s ease-in; 
}
.dialog-pop-enter-from { 
    opacity: 0; 
}
.dialog-pop-enter-from .dialog-card {
    transform: scale(.92); 
}
.dialog-pop-leave-to { 
    opacity: 0; 
}
.dialog-pop-leave-to .dialog-card {
    transform: scale(.95); 
}
```

### 11.6 列表项交错入场（stagger fade-up）

用于 feed、历史记录、排行榜等列表首次揭示。用 `revealed` 标记在挂载后触发，`transitionDelay` 按索引递增并封顶，避免长列表尾部等待过久：

```vue
<view
  v-for="(item, index) in list"
  :key="item.id"
  class="list-item"
  :class="{ 'list-item--in': revealed }"
  :style="{ transitionDelay: `${Math.min(index, 8) * 40}ms` }"
>
  <!-- 列表项内容 -->
</view>
```

```js
const revealed = ref(false)
onMounted(() => {
  nextTick(() => {
    revealed.value = true
  })
})
```

```scss
.list-item {
    opacity: 0;
    transform: translateY(24rpx);
}
.list-item--in {
    opacity: 1;
    transform: translateY(0); 
    transition: opacity .36s cubic-bezier(.33,1,.68,1), transform .36s cubic-bezier(.33,1,.68,1);
}
```

### 11.7 Tab 内容交叉淡入（tab-fade）

用于页内 tab 切换（不覆盖整页、不刷新 Tabbar，与第 3 节局部加载约定配合）。`mode="out-in"` 保证旧内容先退出，`key` 变化触发动画：

```vue
<transition name="tab-fade" mode="out-in">
  <view :key="active_tab" class="tab-panel">
    <!-- 当前 tab 内容 -->
  </view>
</transition>
```

```scss
.tab-fade-enter-active { 
    transition: opacity .24s ease-out, transform .24s ease-out;
}
.tab-fade-leave-active {
    transition: opacity .16s ease-in;
}
.tab-fade-enter-from {
    opacity: 0; 
    transform: translateY(12rpx);
}
.tab-fade-leave-to {
    opacity: 0;
}
```

## 12. 群组消息、私聊与模拟视频通话

本节只定义消息实体、滚动定位、发送持久化和通话定时器的技术实现；会话可见性、发送反馈和通话结束结果以 `INTERACTION_CONVENTIONS.md` 第 5 节为准。

### 12.1 数据归属与关系约束

- 群聊种子数据放在 `src/stores/store.js` 的 `group_messages`，群组列表放在 `group_list`；每条消息必须有 `group_id`。
- 私聊会话种子数据放在 `dm_conversations`，消息放在 `dm_messages`；每条消息必须有 `conversation_id`。
- 若目标模板包含聊天，先在对应 Pinia Store 建立会话、消息 state/getter/action；页面只通过 getter 与 `add_*_message` action 读写，不能自行拼接 `localStorage` key。低层持久化适配器只负责保存消息与处理缓存版本，不负责合并第二份页面数据。
- 群聊消息至少保留 `message_id`、`group_id`、`user_id`、`user_name`、`user_avatar_url`、`content_type`、`content`、`image_url`、`created_at`。私聊消息使用 `conversation_id` 与 `is_mine` 区分会话和发送方。
- 私聊会话只允许出现在互为朋友的用户之间；聊天首页显示的每个 `dm_conversations` 项必须是朋友关系。模拟数据中，每个已展示的群聊与私聊各准备 3–5 条消息。
- 虚拟用户与消息作者的头像必须指向阶段 1 已登记且真实存在的资源；当前模板可使用 `/static/logo.png` 作为默认头像，不得编造不存在的目录。页面中的头像优先使用 `UserAvatar.vue`，保证 IndexedDB 头像和默认头像均可正常显示。

```js
// src/stores/store.js：种子数据示例
export const dm_conversations = reactive([
  {
    conversation_id: 'dm_001',
    user_id: 'user_002',
    user_name: 'Alex Morgan',
    user_avatar_url: '/static/logo.png',
    is_online: true,
    is_mutual: true,
    last_message: 'ok go?',
    last_time: '09:12'
  }
])

export const dm_messages = [
  {
    message_id: 'dm_001_m1',
    conversation_id: 'dm_001',
    is_mine: false,
    content_type: 'text',
    content: 'like your life',
    image_url: '',
    created_at: '2026-08-04 05:58:15'
  }
]
```

### 12.2 消息页布局与定位

群聊、私聊及带评论发送栏的页面必须使用统一固定骨架：默认由页面根节点中的 `TopSafeArea` 和 `BottomSafeArea` 占位；目标模板要求聊天头部或发送栏背景延伸至系统边缘时，对应组件按第 15.1.2 节接管该侧安全区。顶部返回栏、会话/用户信息栏、底部发送栏全部在 `scroll-view` 外并设置 `flex: none`；只有消息或评论内容区使用纵向 `scroll-view` 占据剩余高度。输入栏不得作为消息列表的最后一项。页面首次进入、`onShow` 刷新消息、发送成功及图片加载完成后，都要调用一次 `scroll_to_latest`，将消息定位至底部。

```vue
<view class="page" :style="theme_style">
  <TopSafeArea />
  <view class="page-content">
    <view class="chat-header"><!-- 返回按钮、页面标题 --></view>
    <view class="user-summary"><!-- 会话或用户信息；没有则删除本层 --></view>
    <scroll-view
      class="message-scroll"
      scroll-y
      :scroll-top="scroll_top"
      :scroll-with-animation="false"
      :show-scrollbar="false"
    >
      <view class="message-list"><!-- 消息或评论列表 --></view>
    </scroll-view>
    <view class="input-bar"><!-- 图片、输入框、发送按钮 --></view>
  </view>
  <BottomSafeArea />
</view>
```

```scss
.page {
  --chat-top-safe-area-height: var(--page-safe-top);
  --chat-bottom-safe-area-height: var(--page-safe-bottom);
  --chat-content-height: calc(100vh - var(--chat-top-safe-area-height) - var(--chat-bottom-safe-area-height));
  display: flex;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
  flex-direction: column;
}
.page-content { 
    display: flex; 
    box-sizing: border-box;
    height: var(--chat-content-height); 
    min-height: 0; 
    flex: 0 0 var(--chat-content-height); 
    flex-direction: column;
}
.chat-header, .user-summary, .input-bar {
    position: relative; 
    z-index: 8; 
    flex: none;
}
.message-scroll { 
    box-sizing: border-box;
    height: 0;
    min-height: 0;
    overscroll-behavior-y: auto; 
    -webkit-overflow-scrolling: touch; 
    flex: 1;
}
.message-list { 
    box-sizing: border-box; 
    min-height: calc(100% + 2rpx);
}
```

`scroll-view` 刷新后不能只设置一次 `99999`；需先归零、等待 DOM 更新后设为 `99999`，再用短定时器重复一次，兼容图片和异步布局高度变化。页面卸载时清理定时器。

```js
const scroll_top = ref(0)
let scroll_timer = null

const scroll_to_latest = () => {
  scroll_top.value = 0
  nextTick(() => {
    scroll_top.value = 99999
    clearTimeout(scroll_timer)
    scroll_timer = setTimeout(() => {
      scroll_top.value = 0
      nextTick(() => {
        scroll_top.value = 99999
        scroll_timer = null
      })
    }, 16)
  })
}

onBeforeUnmount(() => clearTimeout(scroll_timer))
```

### 12.3 发送文字与图片

目标模板包含聊天时，先在 `src/components` 创建业务专用的 `MessageSendingLoading.vue`。发送文字、发送图片均属于本地消息写入：点击后展示该组件 400–600ms，加载期间禁止重复发送，结束后才调用 Store 的 `add_dm_message` 或 `add_group_message` action。文字发送成功后清空草稿、刷新列表并滚动到底部。图片发送前使用 `compress_chat_image` 压缩，再由 `blob_to_data_url` 转成可展示地址；图片 `@load` 后再次调用 `scroll_to_latest`。

```js
const send_text = () => {
  const content = draft.value.trim()
  if (!content || is_sending.value) return

  is_sending.value = true
  send_timer = setTimeout(() => {
    send_timer = null
    app_store.add_dm_message({
      conversation_id: conversation_id.value,
      is_mine: true,
      content_type: 'text',
      content
    })
    draft.value = ''
    refresh_messages()
    is_sending.value = false
  }, 400 + Math.floor(Math.random() * 201))
}

const send_image = async (file) => {
  try {
    const image_url = await blob_to_data_url(await compress_chat_image(file))
    app_store.add_group_message({
      group_id: group_id.value,
      user_id: current_user_id,
      user_name: current_user?.username || 'You',
      user_avatar_url: current_user?.avatar_url || '',
      content_type: 'image',
      image_url
    })
    refresh_messages()
  } finally {
    is_sending.value = false
  }
}

onBeforeUnmount(() => clearTimeout(send_timer))
```

```vue
<MessageSendingLoading v-if="is_sending" />
<image v-if="message.content_type === 'image'" :src="message.image_url" @load="scroll_to_latest" />
```

### 12.4 私聊、他人主页与视频通话路由

- 从消息主 Tab 进入私聊时，以阶段 1 页面清单中的 `dm_route` 调用 `push_route()`；来源页与目标页都不得添加入口全屏 Loading。
- 从他人主页等已包裹 `PageTransition` 的页面点击“发送私信”时调用 `navigate_forward()`，离场完成后再进入私聊页；私聊返回时由来源页的 `PageTransition` 恢复可见状态。
- 私聊头像点击可进入他人主页；只有朋友关系可创建或进入 DM 会话。
- 点击视频通话后调用当前页 `PageTransition` 的 `navigate_forward()` 进入阶段 1 页面清单定义的 `video_call_route`；视频通话页返回时调用 `navigate_back()`。不得把模拟准备时间实现为页面跳转前的全屏 Loading。

```js
const start_video_call = () => {
  page_transition.value?.navigate_forward({
    url: `${video_call_route}?conversation_id=${encodeURIComponent(conversation_id.value)}`
  })
}
```

### 12.5 模拟视频通话页面

模拟视频通话不建立真实 WebRTC 连接。页面展示对方与自己的头像预览，顶部用动态“等待接通”提示代替通话时长，下方只保留挂断按钮。等待提示每 450ms 循环更新省略号；进入后随机 8–12 秒自动挂断。手动挂断和自动挂断都走相同的 `end_call`，清理定时器，并调用 `PageTransition.navigate_back()` 完成离场与返回。

```js
const waiting_dot_count = ref(0)
const waiting_copy = computed(() => `Waiting for connection${'.'.repeat(waiting_dot_count.value)}`)
let waiting_timer = null
let auto_end_timer = null

const end_call = () => {
  if (is_navigating_back.value) return
  is_navigating_back.value = true
  clearTimeout(auto_end_timer)
  auto_end_timer = null
  page_transition.value?.navigate_back({
    fail: () => { is_navigating_back.value = false }
  })
}

onMounted(() => {
  waiting_timer = setInterval(() => {
    waiting_dot_count.value = (waiting_dot_count.value + 1) % 4
  }, 450)
  auto_end_timer = setTimeout(end_call, 8000 + Math.floor(Math.random() * 4001))
})

onBeforeUnmount(() => {
  clearInterval(waiting_timer)
  clearTimeout(auto_end_timer)
})
```

## 13. 代码提交前检查

每项任务完成后执行：

```powershell
corepack pnpm check:conventions
git diff --check
corepack pnpm build:h5
git add <task-files>
git commit -m "feat(common-template): concise change"
git push
```

只暂存本任务文件，保留工作区其他人或其他任务的改动。H5 build 的 legacy Sass warning 可记录但不作为构建失败处理。

## 14. 开发复盘：高频问题、根因与标准实现

本节记录本项目已反复出现的问题。后续开发遇到同类需求时，必须优先使用下面的标准实现，不得通过页面临时状态、重复 Loading 或直接读写持久化层绕过。

### 14.1 同一业务出现两份数据，导致个人中心、首页与详情不一致

**典型表现：** 个人中心的帖子区域仍显示静态图片；新发布的图文/视频只出现在首页；删除后首页或详情仍能看到旧数据；评论数字与实际评论列表不一致。

**根因：** 页面分别维护了静态数组、已发布数组和展示数组，统计数字又被单独写死。

**标准实现：** 个人中心帖子、首页、搜索和详情只读取同一个帖子聚合查询；当前用户帖子使用 `creator_id`/`owner_user_id` 过滤得到，不再维护独立的个人帖子图片数组。评论数从评论实体派生，禁止手工累加后与列表脱节。

```js
// 页面：个人中心帖子区与首页订阅同一个 Store getter。
const visible_posts = computed(() => app_store.get_visible_posts)
const my_posts = computed(() => visible_posts.value
  .filter((post) => (post.creator_id || post.owner_user_id) === app_store.current_user?.user_id)
  .sort((first, second) => new Date(second.created_at) - new Date(first.created_at)))

// Store action：评论数量始终以评论实体为准。
post.comment_count = state.post_comments.filter((item) => item.post_id === post_id).length
```

删除必须校验所有权并同时影响所有读取该聚合查询的页面。种子帖子若需要可删除，不直接修改常量数组；把被隐藏的种子 `post_id` 持久化，并在聚合查询时过滤。

```js
const delete_owned_post = ({ post_id, user_id }) => {
  const post = find_post(post_id)
  if (!post || post.creator_id !== user_id) return { success: false, error: 'You can only delete your own post.' }
  remove_or_hide_post(post_id)
  return { success: true }
}
```

### 14.2 把 `indexeddb://` 地址直接赋给 `<image>` 或 `<video>`，导致媒体不显示

**典型表现：** 控制台出现 `ERR_UNKNOWN_URL_SCHEME`；帖子详情黑图、头像空白、视频封面无法加载。

**根因：** `indexeddb://...` 是项目保存 Blob 的稳定标识，不是浏览器可直接请求的 URL。

**标准实现：** 所有帖子媒体必须使用 `PostMedia.vue`；首页视频列表由外层 `view`、封面 `image` 和 `@element-plus/icons-vue` 的 `VideoPlay` 组成，不挂载视频本体；头像必须使用 `UserAvatar.vue`。图标颜色遵循第 15.2 节。媒体组件内部调用 `resolve_post_media_url` 获取带使用计数的缓存 object URL；替换或卸载时必须调用 `revoke_post_media_url` 释放使用权。工具层仅在缓存空闲 2 分钟或可释放的空闲缓存超过 48 项时真正撤销 IndexedDB 对应 URL，避免内存泄漏且不影响相邻页面复用。

```js
let current_object_url = ''

const refresh_media = async (media_url) => {
  revoke_post_media_url(current_object_url)
  current_object_url = await resolve_post_media_url(media_url)
  resolved_url.value = current_object_url
}

onBeforeUnmount(() => revoke_post_media_url(current_object_url))
```

```vue
<!-- 正确：统一组件负责 IndexedDB 转换、fallback 与释放。 -->
<PostMedia :media-url="post.media_urls[0]" :poster="post.cover_url" :content-type="post.content_type" />
<UserAvatar :source="post.creator_avatar_url" />
```

### 14.3 视频选择后预览黑屏或列表播放了视频本体

**根因：** 将 `File`/视频 Blob 直接用于列表预览，或未保存视频封面与真实时长。

**标准实现：** 选择视频后生成第 2 秒封面；视频 Blob 与封面 Blob 都写入 IndexedDB。首页、个人中心帖子区和搜索列表只使用封面，详情页才允许点击播放。显示时长优先读取真实 metadata，种子时长只作 fallback。

```js
const video_media = await save_post_media_file({ file: video_file, kind: 'video', owner_user_id })
const cover_blob = await create_video_second_cover_blob(video_file)
const cover_media = await save_post_media_file({ file: cover_blob, kind: 'image', owner_user_id })

app_store.save_published_post({
  content_type: 'video',
  media_url: video_media.media_url,
  cover_url: cover_media.media_url,
  video_duration: await get_video_duration(video_file)
})
```

```vue
<!-- 列表只展示封面，避免自动播放和 IndexedDB 视频直连。 -->
<PostMedia content-type="video" :media-url="post.media_urls[0]" :poster="post.cover_url" cover-only />
```

### 14.4 二级/三级页面跳转误加全屏 Loading

**根因：** 把页面导航误当成模拟接口请求，在来源页或目标页创建了入口 Loading、延时定时器或额外的路由状态。

**标准实现：** 来源页与目标页都不展示导航全屏 Loading。主 Tab 来源页点击后立即调用 `push_route()`；已包裹 `PageTransition` 的来源页调用 `navigate_forward()`，离场完成后再执行路由。目标页直接读取 Store 数据并播放自身入场过渡，数据未就绪时只允许在具体内容区域使用局部 Loading。详细规则见 2.2 节。

```js
push_route({ url: `/pages/wall/detail?post_id=${encodeURIComponent(post_id)}` })
```

不要为了移除导航 Loading 而取消目标页的数据刷新；数据未就绪时应使用 `DiscoverDataLoading` 等局部占位，页面头部和返回入口必须始终可见。

### 14.5 倒计时在切换页面后重新开始，或多个页面时间不一致

**根因：** 在每个页面的 `onMounted` 中从零开始累加 `elapsed_seconds`。

**标准实现：** 倒计时基准只在项目运行时初始化一次；页面只每秒刷新当前时间并按同一基准重新计算剩余值，不写回初始倒计时字段。

```js
const RUNTIME_KEY = '__common_template_initialized_at__'
const runtime = globalThis
export const PROJECT_INITIALIZED_AT = Number(runtime[RUNTIME_KEY]) || Date.now()
runtime[RUNTIME_KEY] = PROJECT_INITIALIZED_AT

export const format_remain_timer = (initial_timer, now = Date.now()) => {
  const remain_seconds = parse_timer(initial_timer)
  const elapsed_seconds = Math.max(0, Math.floor((now - PROJECT_INITIALIZED_AT) / 1000))
  return format_timer(Math.max(0, remain_seconds - elapsed_seconds))
}

const now = ref(Date.now())
let timer = null
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onBeforeUnmount(() => clearInterval(timer))
```

### 14.6 有 `TopSafeArea` 的页面内容整体下移，或聊天输入栏被滚动走

**根因：** 安全区已由 `TopSafeArea` 占位，滚动容器又额外设置 `padding-top`；或输入栏被放进消息 `scroll-view`。

**标准实现：** 使用 `TopSafeArea` 后，紧随其后的滚动内容不再补顶部安全区；若顶部业务背景必须覆盖安全区，则删除 `TopSafeArea` 并由该组件按第 15.1.2 节接管，二者不能并存。聊天页采用列 flex 布局，输入栏位于 `scroll-view` 外；首次进入、刷新、发送成功和图片加载后调用 `scroll_to_latest`。详细消息布局见 12.2 节。

```vue
<view class="page">
  <TopSafeArea />
  <view class="header" />
  <scroll-view class="message-scroll" scroll-y :scroll-top="scroll_top" />
  <view class="input-bar" />
</view>
```

```scss
.page { 
    display: flex; 
    height: 100vh; 
    min-height: 0; 
    flex-direction: column; 
    overflow: hidden;
}
.header, .input-bar {
    flex: none; 
}
.message-scroll {
    min-height: 0; 
    flex: 1; }
```

### 14.7 页面离场动画后返回黑屏，或底层主 Tab 覆盖当前列表页

**典型表现：** 返回时出现黑屏；或执行“主 Tab → 二级列表 → 三级详情 → 返回”后，主 Tab 内容覆盖二级列表的一部分；“个人中心 → 设置 → 设置子页 → 返回”也出现相同覆盖。

**根因：** 离场时通过 `v-if`/可见状态隐藏了当前页，但从下级页返回时没有恢复；或路由返回在动画结束前执行。嵌套 iOS Stack 的另一类根因是：三级页对应的快照条目清理时无条件移除了二级页的 `route-stack-page--foreground`，但更早的快照仍位于 `z-index: 10`，于是失去 `z-index: 11` 的二级页被底层主 Tab 快照覆盖。

**标准实现：** 二级/三级页以 `PageTransition` 作为根容器，只调用其 `navigate_forward()`、`navigate_back()` 或 `navigate_relaunch()`。组件内部统一管理 `is_page_visible`、`@after-leave`、离场兜底、失败恢复与 `onShow` 恢复；页面不得再维护第二套可见状态或 pending 标记。嵌套快照必须使用 11.2.2 节的 `release_stack_foreground_page` 共享所有权实现，确保只有最后一个快照持有者释放时才移除前景 class；禁止在 `clear_ios_stack_snapshot` 或 `bind_stack_foreground_page` 中直接无条件调用 `classList.remove`。

```js
const page_transition = ref(null)

const open_post_detail = (post_id) => {
  page_transition.value?.navigate_forward({
    url: `/pages/wall/detail?post_id=${encodeURIComponent(post_id)}`
  })
}
```

### 14.8 删除、发布、发送等写操作瞬间完成或可重复触发

**根因：** 点击事件直接写入持久化层或 Store，未锁定按钮，也没有统一的请求态。

**标准实现：** 先关闭确认弹窗、显示业务专属 Loading、锁定重复提交，400–600ms 后才调用 Store action；无论成功或失败都释放锁，并在卸载时清理定时器。

```js
const is_deleting = ref(false)
let delete_timer = null

const confirm_delete = (post) => {
  if (!post || is_deleting.value) return
  is_deleting.value = true
  delete_timer = setTimeout(() => {
    delete_timer = null
    const result = store.delete_post({ post_id: post.post_id })
    if (result.success) refresh_posts()
    is_deleting.value = false
  }, 400 + Math.floor(Math.random() * 201))
}

onBeforeUnmount(() => clearTimeout(delete_timer))
```

### 14.9 测试数据更新后仍显示旧数据，关系统计不可信

**根因：** `localStorage` 中残留旧种子；朋友、群组、金币、评论等数字与实体数据分开维护。

**标准实现：** 为每类种子数据设置版本键，版本变化时用新的种子重新 hydration；朋友数、加入群组数、评论数和金币余额都从关系/流水实体推导。金币流水必须先有充值记录，再按时间追加消费记录，余额等于所有流水净额。

```js
// Store 私有 helper：仅供 hydrate() 调用；需要跨 Store 复用时再提取到 src/utils。
const load_seeded_list = (storage_key, version_key, version, seed) => {
  if (uni.getStorageSync(version_key) !== version) {
    uni.setStorageSync(version_key, version)
    uni.setStorageSync(storage_key, structuredClone(seed))
  }
  return uni.getStorageSync(storage_key)
}

const coin_balance = coin_transactions
  .filter((item) => item.user_id === user_id)
  .reduce((total, item) => total + item.amount, 0)
```

### 14.10 首次打开 Sheet 没有入场动画、后续打开才有动画

**根因：** 调用页使用 `v-if="target"` 包裹 Sheet，并在首次点击的同一次状态更新中同时设置目标数据与 `visible = true`。此时组件会以“已打开”状态首次挂载；Vue `<transition>` 默认不启用 `appear`，因此不会播放第一次的 enter 动画。后续打开时组件已挂载，只切换 `visible`，动画才会正常出现。

**标准实现：** 调用页始终挂载 Sheet 组件，仅通过受控 `visible` 属性控制显示；目标数据为空时传入安全的空字符串默认值。组件内部使用 `<transition>` 包裹 `v-if="visible"` 的遮罩层/面板，负责遮罩渐变和底部面板滑入滑出。禁止在调用页给 `ReportUserSheet`、协议 Sheet、筛选 Sheet、位置 Sheet 等增加与目标数据绑定的外层 `v-if`。

```vue
<!-- 正确：组件常驻，首次和后续打开都能触发 enter 动画 -->
<ReportUserSheet
  :visible="is_report_visible"
  :target-name="report_target?.user_name || ''"
  :target-user-id="report_target?.user_id || ''"
  :post-id="post?.post_id || ''"
  :comment-id="report_target?.comment_id || ''"
  @update:visible="is_report_visible = $event"
/>

<!-- 错误：首次点击会以 visible=true 直接挂载，跳过 enter 动画 -->
<ReportUserSheet v-if="report_target" :visible="is_report_visible" />
```

```js
const open_comment_report = (comment) => {
  if (!comment?.user_id) return
  report_target.value = {
    user_id: comment.user_id,
    user_name: comment.user_name,
    comment_id: comment.comment_id
  }
  is_report_visible.value = true
}
```

### 14.11 交付前最小回归清单

- 从首页、搜索、个人中心分别进入同一详情页：确认跳转过程没有全屏 Loading，页面过渡正常，媒体、头像和评论数一致。
- 发布图文和视频：确认视频列表显示封面、详情可播放、视频时长正确，发布后个人中心帖子区自动更新。
- 删除自己的帖子：确认确认弹窗 → 自定义 Loading → 首页/个人中心/搜索同步消失，不能删除他人帖子。
- 进入和返回私聊/他人主页：确认页面不黑屏、输入栏固定、消息定位在底部。
- 切换页面后检查倒计时：确认按项目启动时刻持续递减，而非页面进入时重新计时。
- 最后执行 `corepack pnpm check:conventions`、`git diff --check` 与 `corepack pnpm build:h5`。

## 15. 页面安全区、图标、点击与持久化补充约定

本节补充安全区、资源和点击实现细节；主题和按钮语义分别以第 1 节为唯一来源，本节只引用，不重新定义冲突规则。

### 15.1 系统安全区

- 必须保留页面上下滑动时的原生惯性和边界回弹效果。
- 不开发页面顶部的时间、信号、网络或电池等系统状态栏视觉；默认使用 `TopSafeArea` 组件占位。若目标模板要求头图、导航栏或其他顶部业务组件的背景延伸到状态栏区域，则按第 15.1.2 节“业务组件接管安全区”执行。
- 不开发页面底部的 Home Indicator 或其他系统导航栏视觉；默认使用 `BottomSafeArea` 组件占位。若固定按钮栏、播放器控制栏、Tabbar 或其他底部业务组件的背景需要延伸到 Home Indicator 区域，则由该业务组件按第 15.1.2 节接管底部安全区。
- 二级、三级页面默认同时包含 `TopSafeArea` 与 `BottomSafeArea`。只有对应边缘已由业务组件完整接管时，才删除该侧安全区组件；顶部和底部必须分别判断，不得因为一侧被接管而删除另一侧。
- 同一侧安全区只能有一个布局所有者：使用 `TopSafeArea`/`BottomSafeArea` 时，业务组件、滚动容器和内容区不得重复添加对应安全区 padding；由业务组件接管时，必须删除同侧安全区组件，并由接管组件自身补齐对应 padding。

```vue
<template>
  <view class="page" :style="theme_style">
    <TopSafeArea />
    <view class="page-content"><!-- 页面内容 --></view>
    <BottomSafeArea />
  </view>
</template>
```

### 15.1.1 页面原生惯性与边界回弹（`App.vue` 强制实现）

生产环境的 iOS `WKWebView` 必须由 `App.vue` 统一保留纵向触摸滚动、惯性和边界回弹；普通浏览器仅用同一份 H5 做开发调试，不单独维护另一套滚动实现。外层 uni-app H5 容器只负责锁定视口，实际页面根节点或页面内 `scroll-view` 承担滚动；不得在真实纵向滚动容器上设置 `overscroll-behavior-y: none/contain`，也不得通过全局 `touchmove.prevent` 阻止单指纵向手势。最终触摸手感以 iOS `WKWebView` 实机验收为准。

`App.vue` 的全局非 scoped 样式必须保留以下等价实现：

```scss
html,
body,
#app,
uni-app,
uni-page,
uni-page-wrapper,
uni-page-body {
  height: 100%;
  overflow: hidden;
  overscroll-behavior-x: none;
  overscroll-behavior-y: auto;
  touch-action: pan-x pan-y;
}

page {
  min-height: 100%;
  overscroll-behavior-x: none;
  overscroll-behavior-y: auto;
}

uni-page-body > .page {
  box-sizing: border-box;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-x: none;
  overscroll-behavior-y: auto;
  -webkit-overflow-scrolling: touch;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

uni-page-body > .page > .main-page-content {
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-x: none;
  overscroll-behavior-y: auto;
  -webkit-overflow-scrolling: touch;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

uni-scroll-view,
.uni-scroll-view {
  overscroll-behavior-x: none;
  overscroll-behavior-y: auto;
  -webkit-overflow-scrolling: touch;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

uni-page-body > .page::-webkit-scrollbar,
uni-page-body > .page > .main-page-content::-webkit-scrollbar,
uni-scroll-view::-webkit-scrollbar,
.uni-scroll-view::-webkit-scrollbar,
.uni-scroll-view-content::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
```

### 15.1.2 所有页面统一固定骨架（最高优先级）

所有普通页面都必须采用“安全区固定 + 页面功能栏固定 + 单一主滚动区”的结构。本节覆盖前文任何让整个 `.page`、`.page-content` 或返回栏参与纵向滚动的旧示例。

- 默认模式下，`TopSafeArea` 是根节点第一个布局组件，`BottomSafeArea` 是根节点最后一个布局组件；两者都不进入 `scroll-view`。目标模板要求业务背景占据某侧安全区时，改用本节后文的“业务组件接管安全区”模式。
- `.page` 固定为 `100vh` 的纵向 flex，并设置 `overflow: hidden`，禁止页面根节点和内部主滚动区同时滚动。
- 默认独立占位模式下，`.page-content` 高度为 `100vh - 顶部安全区 - 底部安全区`。返回栏、标题栏、筛选栏等上方固定组件放在 `.page-content` 中、主 `scroll-view` 之前，并设置 `flex: none`。业务组件接管安全区时不得继续使用这套重复扣减公式。
- 除固定功能栏外，其余页面内容全部放入一个主 `scroll-view`；滚动区使用 `height: 0; min-height: 0; flex: 1`，其实际高度即“总高度减去顶部安全区、上方全部固定组件和底部安全区”。
- 主滚动区必须设置 `scroll-y` 和 `:show-scrollbar="false"`。内容根节点必须设置 `min-height: calc(100% + 2rpx)`，保证内容不足一屏时仍可上下拉动并在松手后产生原生边界回弹。
- 不得再给滚动区添加顶部安全区 padding；底部业务留白放在滚动内容根节点中，不能用重复的系统安全区 padding 代替。
- Loading、Sheet、ConfirmDialog 等覆盖层放在页面骨架之后，不进入主 `scroll-view`。

普通二级、三级页面统一使用以下结构：

```vue
<template>
  <view class="page" :style="theme_style">
    <TopSafeArea />
    <view class="page-content">
      <SecondaryPageHeader title="Title" />

      <scroll-view class="content-scroll" scroll-y :show-scrollbar="false">
        <view class="content-scroll__inner">
          <!-- 除固定栏外的全部页面内容 -->
        </view>
      </scroll-view>
    </view>
    <BottomSafeArea />
  </view>
</template>
```

```scss
.page {
  --page-top-safe-area-height: var(--page-safe-top);
  --page-bottom-safe-area-height: var(--page-safe-bottom);
  --page-content-height: calc(100vh - var(--page-top-safe-area-height) - var(--page-bottom-safe-area-height));
  display: flex;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
  flex-direction: column;
}

.page-content {
  display: flex;
  box-sizing: border-box;
  height: var(--page-content-height);
  min-height: 0;
  flex: 0 0 var(--page-content-height);
  flex-direction: column;
}

.content-scroll {
  box-sizing: border-box;
  width: 100%;
  height: 0;
  min-height: 0;
  overscroll-behavior-y: auto;
  -webkit-overflow-scrolling: touch;
  flex: 1;
}

.content-scroll__inner {
  box-sizing: border-box;
  min-height: calc(100% + 2rpx);
}
```

#### 业务组件接管顶部或底部安全区（强制例外）

当目标模板出现头图、沉浸式导航栏、底部操作栏等视觉，并且该组件的**背景必须连续覆盖到屏幕物理边缘**时，安全区不再由独立占位组件绘制，而由对应业务组件接管。截图类顶部头图属于顶部接管：背景图片延伸至状态栏背后，但返回按钮、菜单、标题等可操作内容必须从顶部安全区之后开始。

接管规则：

- 顶部业务组件接管时，页面删除 `TopSafeArea`，接管组件根节点设置 `box-sizing: border-box; padding-top: var(--page-safe-top)`；不得直接写 `env(safe-area-inset-top)`、固定设备高度或另一份安全区计算。
- 底部业务组件接管时，页面删除 `BottomSafeArea`，接管组件根节点设置 `box-sizing: border-box; padding-bottom: var(--page-safe-bottom)`；主 `CustomTabBar` 已是此模式，不得在外部再添加 `BottomSafeArea`。
- 只有组件的背景层占据安全区，文字、图标、输入框和点击区域仍位于 padding 形成的安全内容区内。不得为了还原截图把按钮放到状态栏、刘海、动态岛或 Home Indicator 的不可安全操作区域。
- 顶部和底部独立判断。只接管顶部时仍保留 `BottomSafeArea`；只接管底部时仍保留 `TopSafeArea`；两侧都接管时两个独立安全区组件都删除。
- 接管组件必须放在 `src/components`，作为页面根 flex 布局中的固定项并设置 `flex: none`。剩余内容使用单一 `scroll-view` 的 `height: 0; min-height: 0; flex: 1` 自动占满；不得再用 `calc(100vh - var(--page-safe-top) - var(--page-safe-bottom))` 重复扣除已经包含在组件 padding 内的安全区。
- 禁止同一侧同时出现“安全区组件 + 业务组件安全区 padding”，也禁止把安全区 padding 加到 `.page`、整个 `scroll-view` 或滚动内容根节点。检查 DOM 时，每一侧必须能指出唯一的安全区所有者。

页面顶部和底部都由业务组件接管时，统一采用以下结构：

```vue
<template>
  <PageTransition class="page" :style="theme_style">
    <!-- SafeAreaHeroHeader 内部接管顶部安全区，因此不渲染 TopSafeArea。 -->
    <SafeAreaHeroHeader />

    <scroll-view class="content-scroll" scroll-y :show-scrollbar="false">
      <view class="content-scroll__inner">
        <!-- 页面主体内容 -->
      </view>
    </scroll-view>

    <!-- SafeAreaBottomAction 内部接管底部安全区，因此不渲染 BottomSafeArea。 -->
    <SafeAreaBottomAction />
  </PageTransition>
</template>

<script setup>
import PageTransition from '@/components/PageTransition.vue'
import SafeAreaHeroHeader from '@/components/SafeAreaHeroHeader.vue'
import SafeAreaBottomAction from '@/components/SafeAreaBottomAction.vue'
</script>
```

```scss
.page {
  display: flex;
  box-sizing: border-box;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
  flex-direction: column;
}

.content-scroll {
  box-sizing: border-box;
  width: 100%;
  height: 0;
  min-height: 0;
  overscroll-behavior-y: auto;
  -webkit-overflow-scrolling: touch;
  flex: 1;
}

.content-scroll__inner {
  box-sizing: border-box;
  min-height: calc(100% + 2rpx);
}
```

顶部接管组件参考实现；背景层覆盖组件完整高度，安全区 padding 只负责把业务内容推到可操作区域：

```vue
<template>
  <view class="safe-area-hero-header">
    <image class="safe-area-hero-header__background" :src="backgroundSource" mode="aspectFill" />
    <view class="safe-area-hero-header__content">
      <view class="safe-area-hero-header__toolbar"><!-- 返回与菜单入口 --></view>
      <view class="safe-area-hero-header__summary"><!-- 标题与统计信息 --></view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  backgroundSource: {
    type: String,
    default: ''
  }
})
</script>

<style scoped lang="scss">
.safe-area-hero-header {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  padding-top: var(--page-safe-top);
  overflow: hidden;
  flex: none;
}

.safe-area-hero-header__background {
  position: absolute;
  z-index: 0;
  inset: 0;
  width: 100%;
  height: 100%;
}

.safe-area-hero-header__content {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  min-height: 440rpx;
  padding: 24rpx 32rpx 40rpx;
}
</style>
```

底部接管组件参考实现；背景延伸到屏幕底边，按钮本体保持在 Home Indicator 上方：

```vue
<template>
  <view class="safe-area-bottom-action">
    <view
      class="safe-area-bottom-action__button"
      role="button"
      aria-label="Create item"
      @click="emit('confirm')"
    >
      Create item
    </view>
  </view>
</template>

<script setup>
const emit = defineEmits(['confirm'])
</script>

<style scoped lang="scss">
.safe-area-bottom-action {
  box-sizing: border-box;
  width: 100%;
  padding: 24rpx 32rpx var(--page-safe-bottom);
  background: var(--page-background);
  flex: none;
}

.safe-area-bottom-action__button {
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  background: var(--accent-color);
  color: var(--accent-text-color);
}
</style>
```

如果只有顶部组件接管安全区，上述页面末尾仍必须保留 `<BottomSafeArea />`；如果只有底部组件接管，页面开头仍必须保留 `<TopSafeArea />`。目标模板解析阶段必须在页面还原清单中记录 `top_safe_area_owner` 与 `bottom_safe_area_owner`，值只能是独立安全区组件或明确的业务组件名，避免后续页面还原时重复计算。

私聊、群聊、帖子评论等带用户信息和发送栏的页面，必须将用户信息栏和发送栏同样固定在主滚动区之外：

```vue
<template>
  <view class="page" :style="theme_style">
    <TopSafeArea />
    <view class="page-content">
      <SecondaryPageHeader title="Conversation" />
      <view class="user-summary"><!-- 用户或会话信息 --></view>

      <scroll-view class="content-scroll" scroll-y :show-scrollbar="false">
        <view class="content-scroll__inner"><!-- 消息或评论内容 --></view>
      </scroll-view>

      <view class="message-composer"><!-- 图片、输入框、发送按钮 --></view>
    </view>
    <BottomSafeArea />
  </view>
</template>
```

```scss
.user-summary,
.message-composer {
  flex: none;
}

.content-scroll {
  height: 0;
  min-height: 0;
  flex: 1;
}
```

主 Tab 页面遵循同一骨架原则，但底部由已包含底部安全区的 `CustomTabBar` 替代 `BottomSafeArea`，不得重复插入安全区；顶部主功能栏固定，剩余内容进入主 `scroll-view`。只有业务明确要求“一屏一条 Post”的沉浸式页面，才用竖向 `swiper` 替换主 `scroll-view`，固定头部、视口高度扣减和安全区规则保持不变。无返回入口的主页面不得为了套模板虚构返回按钮。

隐藏滚动条只使用 `:show-scrollbar="false"`、`scrollbar-width: none` 和 `::-webkit-scrollbar`，不得以禁用 `overflow-y`、触摸事件或纵向 overscroll 的方式隐藏滚动条。

### 15.1.3 iOS WebView 安全区失效的原因与诊断

iOS WebView 中 `TopSafeArea`、`BottomSafeArea` 高度为 `0` 时，不能先通过固定 `rpx` 高度掩盖问题。必须按“HTML viewport → CSS 环境变量 → uni-app 变量 → 原生宿主”顺序定位。WebKit 的安全区环境变量只有在页面使用 `viewport-fit=cover` 并且宿主允许网页布局延伸到屏幕边缘时才可能返回有效值；官方说明见 [Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)。

本项目曾存在以下两个失效点，现已修复，后续不得回退：

1. `index.html` 曾通过 `CSS.supports` 判断后才动态追加 `viewport-fit=cover`。部分 WKWebView 的能力检测结果或执行时机不可靠，一旦没有生成该字段，`env(safe-area-inset-top)` 与 `env(safe-area-inset-bottom)` 会保持 `0px`；当前必须静态声明该字段。
2. `App.vue` 曾使用 `var(--status-bar-height, env(safe-area-inset-top, 0px))`。CSS `var()` 的第二个参数只在自定义属性未定义或无效时使用；若 uni-app 在 H5 中把 `--status-bar-height` 定义为合法的 `0px`，后面的 `env()` 不会参与计算，顶部安全区因此被锁定为 `0px`；当前必须使用 `max()` 合并三个来源。

标准实现必须满足：

- `index.html` 的 viewport meta 静态、无条件包含 `viewport-fit=cover`，不使用运行时能力检测决定是否追加。
- 顶部安全区不能用 `var()` fallback 在 uni-app 状态栏变量与 WebKit 安全区变量之间二选一，应使用 `max()` 取可用值中的最大值。
- 底部安全区同时接收 WebKit `env()` 和原生宿主注入值；宿主没有把 WKWebView 扩展到安全区时，Web 端的 `env()` 返回 `0px` 属于宿主边界，不是 CSS 组件故障。
- 原生宿主必须从 `WKWebView.safeAreaInsets`（或承载视图的 safe area）取得数值，并在 CSS `env()` 为 `0px` 的容器场景下注入 `--native-safe-area-top`、`--native-safe-area-bottom`。横竖屏或容器尺寸变化后必须重新注入；宿主侧实现依据见 [Positioning content relative to the safe area](https://developer.apple.com/documentation/uikit/positioning-content-relative-to-the-safe-area)。
- 不得为刘海、动态岛或 Home Indicator 写死 `44px`、`34px` 等设备值；不同设备、方向和宿主布局的安全区不同。

本项目的宿主桥接统一由 `src/utils/safeArea.js` 注册：H5 加载后向 `window.webkit.messageHandlers.CommonTemplateSafeArea` 发送 `getSafeAreaInsets`；iOS 将 `UIEdgeInsets` 的逻辑点数回调给 `window.CommonTemplateSafeAreaBridge.update({ top, bottom })`。桥接方法会更新根节点的 `--native-safe-area-top`、`--native-safe-area-bottom`，并在旋转、视口变化和页面恢复时重新请求。若宿主修改消息名，只修改该工具文件顶部的常量，不在页面中散写桥接名称。

参考变量结构：

```scss
html {
  --native-safe-area-top: 0px;
  --native-safe-area-bottom: 0px;
  --app-safe-top: max(
    var(--status-bar-height, 0px),
    var(--native-safe-area-top, 0px),
    env(safe-area-inset-top, 0px)
  );
  --app-safe-bottom: max(
    var(--native-safe-area-bottom, 0px),
    env(safe-area-inset-bottom, 0px)
  );
  --page-safe-top: var(--app-safe-top);
  --page-safe-bottom: var(--app-safe-bottom);
}
```

参考 viewport：

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
/>
```

调试时至少记录以下结果，不能只看组件 DOM 是否存在：

```js
const root_style = getComputedStyle(document.documentElement)

console.table({
  status_bar_height: root_style.getPropertyValue('--status-bar-height').trim(),
  native_safe_top: root_style.getPropertyValue('--native-safe-area-top').trim(),
  native_safe_bottom: root_style.getPropertyValue('--native-safe-area-bottom').trim(),
  app_safe_top: root_style.getPropertyValue('--app-safe-top').trim(),
  app_safe_bottom: root_style.getPropertyValue('--app-safe-bottom').trim(),
  viewport: document.querySelector('meta[name="viewport"]')?.content || ''
})
```

若 viewport 已包含 `viewport-fit=cover`，但 iOS WebView 中两个 `env()` 仍为 `0px`，必须转到原生宿主检查 WebView frame、safe area、内容 inset 和是否覆盖系统区域；此时仅修改 `TopSafeArea.vue` 或 `BottomSafeArea.vue` 无法得到真实物理安全区。

### 15.2 图标与图片资源

- 图标来源优先级固定为：目标模板或 `static/icons`、`static/tabbar` 中已有的设计资源 → `@element-plus/icons-vue` 中语义匹配的通用单色图标 → 新增到 `static/icons` 的设计专属 SVG/PNG。禁止使用 Unicode、Emoji、CSS 几何图形或文字字符临摹图标。
- 设计资源必须保留原文件；同一图形需要不同固有颜色时新建语义明确的变体，不覆盖旧资源。单色 Element Plus 图标的 `color` 必须映射 `theme.colors.icon.primary/secondary` 或对应状态 token；新增固有颜色 SVG 时，其颜色必须与 `theme.json` 的目标 token 一致，并在主题变化时同步更新。
- SVG/PNG 设计资源通过 `image` 引用；需要扩大点击区、定位角标或控制层级时，使用外层 `view` 包裹。通用 Element Plus 图标直接作为 Vue 组件使用并继承 CSS 变量，不再复制一份等价 SVG。

```vue
<view class="header-action" role="button" aria-label="Report post" @click="open_report">
  <Warning class="header-action__icon" aria-hidden="true" />
</view>
```

- 普通 PNG 图片直接使用 `image` 引用；例如 Logo 使用 `/static/logo.png`。只有交互、定位或复合图层需要时才增加外层 `view`，不得为了形式统一创建无职责包装组件。

```vue
<image src="/static/logo.png" class="brand-logo" mode="aspectFit" />
```

### 15.2.1 头像编辑图层参考

编辑个人资料时，头像与相机编辑图标必须作为同一个相对定位容器中的同级节点实现。头像使用 `UserAvatar`，相机使用 `@element-plus/icons-vue` 的 `Camera`；不得将相机图标嵌入头像组件内部。头像层级固定低于相机图标，保证编辑图标始终浮在头像右下角且不随头像媒体解析状态丢失。

```vue
<view
  class="avatar-editor"
  role="button"
  aria-label="Change profile photo"
  :aria-disabled="is_saving"
  @click="choose_avatar"
>
  <UserAvatar class="avatar-editor__image" :source="avatar_source" />
  <Camera class="avatar-editor__camera" aria-hidden="true" />
</view>
```

```scss
.avatar-editor {
  position: relative;
  display: flex;
  width: 176rpx;
  height: 176rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.avatar-editor__image {
  position: relative;
  z-index: 1;
  width: 176rpx;
  height: 176rpx;
  border-radius: 50%;
}

.avatar-editor__camera {
  position: absolute;
  z-index: 2;
  right: -4rpx;
  bottom: -4rpx;
  width: 60rpx;
  height: 60rpx;
  padding: 14rpx;
  border-radius: 50%;
  background: var(--accent-color);
  color: var(--accent-text-color);
}
```

### 15.3 页面点击组件

- 所有页面和业务组件以 `view` 作为可点击入口，不使用 `button` 组件；通过 `@click` 绑定真实业务方法，不得因样式便利新增 `button`。
- 真实交互入口必须提供与行为匹配的 `role`。`aria-label` 不是所有点击区域的必填属性：按钮已有能够完整表达操作的可见英文文字时，不重复添加；纯图标、纯图片、无可见文字或可见内容无法说明操作目的时，必须提供准确的英文 `aria-label`。只有入口存在禁用或 Loading 状态时才提供 `aria-disabled`，并在该状态期间阻止重复触发。遮罩层用于 `@click.self` 关闭、容器仅用于阻止冒泡时，不把它们伪装成按钮，也不补无意义的 `aria-label`。
- 视觉 token 统一使用第 1 节按钮规范。固定高度的单行纯文字按钮使用“行高 = 高度 + `text-align: center`”；含图标或可能换行时使用 flex 布局和独立文字行高。

```vue
<view class="primary-action" role="button" @click="publish_post">
  <text>Publish</text>
</view>
```

```scss
.primary-action {
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
}
```

### 15.4 业务交互与本地持久化

- 所有页面业务交互必须通过 Pinia Store action 更新；页面和组件不得直接调用 `uni.setStorageSync`、IndexedDB 写接口或直接修改业务数组。现有 `src/utils` 业务兼容接口必须只转发到 Store，不得形成第二条写入链路。
- 包括但不限于喜欢/取消喜欢 Post、关注/取消关注用户、发送消息、修改用户姓名或头像、发布图文或视频、发布活动及其他业务数据的新增、修改和删除，均由 action 协调 Store 更新与持久化，使刷新页面后仍能从 Store hydration 恢复一致状态。
- 媒体文件 Blob 按既有约定保存至 IndexedDB；`localStorage` 保存业务元数据、关系、会话与可恢复状态，不保存 Blob、Base64 或 data URL 媒体本体。页面只能在受控媒体流程中调用媒体适配器，并将其返回的稳定地址交给 Store action。
- 所有本地写入继续遵循“自定义业务 Loading 400–600ms → Store action → 成功后呈现统一 Store 结果”的流程，Loading 期间禁止重复提交，并在页面卸载时清理定时器。
