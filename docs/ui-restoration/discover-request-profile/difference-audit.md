# 他人主页来源审计

范围：expanded 源稿结构、三图/歌曲、统一人物标签/简介/目标/兴趣，用户批准新增的本人真实语音简介与三问题；既有首用安全 Sheet/相册组件复用。

- UI-01：来源第一张资料卡与照片间隔 20，当前通用 margin 16；只修正 tags margin 为 20，不改变其他资料卡来源 16 间隔。
- UI-02：源 CTA 距底部 34，旧实现紧贴底部且多了整条渐变底板；恢复 34 设计留白，删除底板，物理安全区仍由 BottomSafeArea 单独拥有。无歌曲实体时来源参考亦不伪造歌曲卡。
- DATA-01：底部 Chat/请求/匹配/Send shot 逻辑与 Discover 重复；统一 introduction_context.primary，缺少有效会话不误发新邀请。
- NAV-01：拉黑后旧 replace 留下第二个 Discover；改为明确清栈回 Discover。正常 Back 保留真实来源和牌序。
- MEDIA-01：三张图、gallery、语音播放均指当前 user_id；照片集合变化时修正越界索引；无歌曲音源真实错误，不显示进度。
- 自动视觉结论等待本轮来源叠图、完整功能和最终 WKWebView 包回归，不沿用历史 passed。
