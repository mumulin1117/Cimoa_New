# Found 来源差异审计

来源HTML1705–1764，sheetAccepting/AmFoundLeave。旧实现为FlowHeader与圆头像，缺340照片墙、匹配标题SVG、45s pill、源标签/共同兴趣/双按钮。

按原稿重建固定Header、滚动内容、Connect60/Skip60、View profile及确认Sheet。照片/资料/共同兴趣只读当前match_id候选实体；蓝色学生标识只对真实verified字段展示。共享兴趣按实体交集取代原型写死三项。长资料标签允许换行避免裁切，除此保留原尺寸、SVG、文案层级、样式。

计时只读固定expires_at，进入详情/刷新不重置；失效旧URL自动替换结果。Connect只写self_accepted并进入Waiting，不伪造对方同意。Skip提交一次真实passed；返回先显示源Leave Sheet。实际profile导航传当前user_id并返回同一match。


补充边界审计：320×568 长大学/专业标签超出照片内容宽度。按约定允许长内容扩展，补充标签 max-width、最小高度与文本换行；默认资料保持原尺寸和视觉。不得裁掉完整资料或缩小字号。
