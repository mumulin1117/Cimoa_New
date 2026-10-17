# 语音回复差异审计

- 原稿 Answer an Icebreaker、64 目标资料、Icebreaker 问题/序号、录音白卡、84 渐变描边播放圆、Switch to text、提示条与 Send Request · 10 Coins；恢复该布局，原 00:12/虚假播放改为实际录音、时长和播放器，空录音显示 00:00，无假波形。
- 新 recording 控件是补齐缺失行为：Start → 原稿麦克风 pre-prompt → 真实 create_recorder → Stop → 试听。页头 Voice options 打开可操作 Re-record/Delete voice，不沿用原型 Toast。缺权限、无设备、不支持、解码失败真实报错。
- Send Request 保留源文案，先将有效 Blob 与草稿原子关联并进入既有 Voice preview，最终仍需 10 coins 确认；不会因为录音页按钮跳过费用确认。已有保存录音可直接预览，纯导航不 Loading。
- 返回/后台/卸载停止轨道、播放器和待执行任务；未落盘录音离开前可取消。切换文字保存已有录音且保留文字草稿，重新录音后替换旧可删除资源。
- ConfirmDialog 依硬性约定用于危险丢弃；mic/options/coin 专属 Sheet 随本页首用实现，安全区和全屏遮罩复用既有 EventConfirmDialog 机制。
