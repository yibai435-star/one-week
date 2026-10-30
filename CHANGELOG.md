# Changelog

## 1.6.0 · 2026-10-30

- Release as One Week with Chinese and English interfaces.
- Add English CSV headers, full weekday names, and odd/even week patterns.
- Keep existing task, class, note, and backup data unchanged when switching language.
- Use Obsidian’s native HTML sanitizer and keep translations separate from user content.
- Preserve the original plugin ID for compatible upgrades.


## 1.5.3 · 2026-10-30

- 完成标记统一为浅绿色方框与深绿色勾，清除主题叠加的圆圈和白色勾样式。
- 同步统一四象限、待办清单和编辑窗口中的勾选控件。

## 1.5.2 · 2026-10-27

- 舒展模式随窗口高度适配 08:00–17:00；标准模式继续显示 08:00–20:00。
- 切换任一显示模式时回到早间起点，晚间安排仍可向下滚动查看。

## 1.5.1 · 2026-10-27

- 标准周历按当前页签高度适配前 12 小时；晚间安排仍可滚动查看。
- 本周待办栏支持显示/隐藏，记住选择，收起后课表扩宽。
- 保留快速录入草稿，窗口缩放不关闭正在编辑的弹窗。
- 紧凑视图中的相邻极短事项错列显示，保留可点击的完成按钮。

## 1.5.0 · 2026-10-27

- 新安装从空白学期开始，移除个人课表的打包依赖；已有数据继续使用原配置。
- 学期名称、周数、开始日期与时间轴范围可设置。
- 增加课程表格粘贴和 CSV / TSV 导入：预览、冲突提示、重复跳过、确认追加。
- 统一周历、月历、四象限、侧栏和编辑窗口的字体、色彩、图标及间距；适配深色与窄页签。
- 新增时间轴“舒展”显示和最近 10 步撤销；多窗口同步后清空撤销历史。
- 自动顺延与当前日期统一使用设备本地时区。
- 增加独立构建依赖、通用测试与公开发布文档。

## 1.4.2

- 极短事项保留独立完成勾选区域；紧急标记统一为暖黄色闹铃。
- 保留课程单次调整、备注链接、常规日程和周末顺延等既有功能。
