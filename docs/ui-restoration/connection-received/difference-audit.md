# reqReceived 来源锁定与差异审计

来源 SHA-256：6c49411c6868b476ff46cedaa9828ee2ccbfe89d5eaa7ea1f739feb2c8018060；第 842–972 行。393×852、cRise 结束帧；原稿内联几何、文案、SVG 全量保存在 source-contract.json。

项目 | 来源 | 当前实现（改前） | 处理
--- | --- | --- | ---
结构|照片墙、资料、固定回答|通用圆头像/两张卡|重建原结构
Header|46 back/name/badge/more|Introduction 标题|恢复真实人物与菜单
操作|Not Now / Accept 并排58|纵排|还原并排
媒体|有效音频播放器/明确缺失|通用播放|精确变体

颜色统一映射 theme；字体继承源系统栈，手写简介为本地 Caveat；照片使用实体原资源。物理安全区替代源系统占位。错误、Loading、长内容、刷新、返回与跨账号同步需分别取证；本记录不表示视觉通过。

行为核对：来源 5794 的 Not Now 返回 Home 并保留 pending，原实现误拒绝。恢复无写入返回。真正 decline 使用已有源行为 5793，在请求菜单补充明确 Decline introduction 入口（授权补齐缺失交互），确认后 Loading → Store → declined；不得复用 Not Now。
