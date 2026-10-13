# Cimoa 阶段五：页面还原状态

阶段五按主 Tab 顺序完成首轮页面骨架，并将原型的 query/sheet 状态收敛到业务域页面的 `view` 状态；每个页面仍只使用一个主纵向 scroll-view。

| page domain | Vue route | restored CIRCA states | status |
|---|---|---|---|
| Auth | /pages/auth/index | welcome, legal, sign up, log in | verified |
| Home | /pages/home/index | people met, upcoming events, profile entry | verified |
| Discover | /pages/discover/index | people list, profile, text/voice icebreaker, post actions | verified |
| Events | /pages/events/index | explore, detail, joined, participants, group chat entry | verified |
| Messages | /pages/messages/index | list, chat, incoming/active/ended call, safety actions | verified |
| Profile | /pages/profile/index | personal, coin center, settings, logout confirmation | verified |
| Auto Match | /pages/auto-match/index | entry, preferences, searching, paused, connected, passed | verified |
| System | /pages/system/index | loading, offline, error, empty, permission, session | verified |

专属组件：TopSafeArea、CustomTabBar、AppLoading、ConfirmDialog。所有页面入口均使用 routeTransition 工具；业务写操作归 Store action，并由 use_write_loading 提供 400–600ms 自定义 Loading 及卸载清理。
