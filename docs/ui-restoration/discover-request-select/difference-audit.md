# 选题页差异审计

- 原稿 58 顶部 46 Back/48 Header、64 头像卡、28 Pick a question、三张带圆形勾选的 22 圆角题卡、64 Text/Voice 分段控件、60 Answer This Question 和费用说明；旧通用 flow UI 丢失头像、勾选器、控件形态，改为逐项来源尺寸。
- 恢复原文 Start the conversation with something fun.；去掉自创 Say Hi 副标题区；文字免费以说明行表达，分段控件仍为 Text/Voice。
- 纯选择不写；Answer 经过业务 Loading 才 prepare_introduction，复用同目标草稿与 operation_id，不覆盖已有文字/音频。返回后选题/模式由本人已保存草稿恢复。
- 共用新 Header/Person/Icon 仅用于本链四页，全部消费者纳入后续同包回归，不修改其他域的共享输出。
