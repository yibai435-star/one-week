(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./locales/en.json'));
  else root.OneWeekI18n = factory(root.ONE_WEEK_EN);
})(typeof globalThis === 'object' ? globalThis : this, function (english) {
  'use strict';
  english = english || {};
  const pattern = new RegExp(Object.keys(english).sort((a,b) => b.length-a.length).map(key => key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'), 'g');
  const phrases = {
    '{0}必须是对象。': '{0} must be an object.',
    '{0}必须是文字。': '{0} must be text.',
    '{0}必须是 true 或 false。': '{0} must be true or false.',
    '{0}必须是 {1}–{2} 之间的整数。': '{0} must be an integer between {1} and {2}.',
    '{0}不能为空，且不能超过 {1} 个字符。': '{0} must not be empty or exceed {1} characters.',
    '{0}不能超过 10000 个字符。': '{0} must not exceed 10,000 characters.',
    '{0}含有无效字符。': '{0} contains invalid characters.',
    '{0}包含无法识别的字段“{1}”，请确认备份版本。': '{0} contains the unknown field "{1}". Check the backup version.',
    '{0}的标识“{1}”重复。': '{0} contains the duplicate ID "{1}".',
    '第 {0} 条课程详情': 'Class detail {0}', '第 {0} 条节次时间': 'Period time {0}',
    '第 {0} 个例行模板': 'Routine template {0}', '第 {0} 条提醒': 'Reminder {0}',
    '第 {0} 条例行应用历史': 'Routine history entry {0}',
    '{0}开始时间': '{0} start time', '{0}结束时间': '{0} end time',
    '{0}结束时间必须晚于开始时间。': '{0}: end time must be later than start time.',
    '{0}时长须为 15–840 分钟。': '{0}: duration must be 15–840 minutes.',
    '{0}的完成状态必须是 true 或 false。': '{0}: completion must be true or false.',
    '第 {0} 教学周': 'Teaching week {0}', '第 {0} 周': 'Week {0}',
    '第 {0} 行：{1}': 'Row {0}: {1}', '第 {0} 条课程': 'Class rule {0}',
    '第 {0} 节': 'Period {0}', '第 {0}-{1} 节': 'Periods {0}–{1}',
    '{0} 年 {1} 月': '{0} / {1}', '{0} 月': 'Month {0}',
    '上一{0}': 'Previous {0}', '下一{0}': 'Next {0}', '本{0}': 'This {0}',
    '完成 {0}': 'Complete {0}', '选择 {0}': 'Select {0}', '删除 {0}': 'Delete {0}',
    '查看 {0}': 'View {0}', '切换{0}': 'Switch {0}',
    '还有 {0} 项': '+{0} more', '已选 {0} 项': '{0} selected',
    '未安排时间 · {0} 分钟': 'Unscheduled · {0} min',
    '已将 {0} 项顺延到下周待办，请重新安排时间。': 'Moved {0} tasks to next week. Choose new times when ready.',
    '已将 {0} 个未完成事项顺延到本周待办，请重新安排时间。': 'Moved {0} incomplete tasks to this week. Choose new times when ready.',
    '已加入 {0} 项常规日程': 'Added {0} routine tasks',
    '将新增 {0} 条课程': '{0} class rules to add', '已导入 {0} 条课程': 'Imported {0} class rules',
    '，跳过 {0} 条完全重复的课程': '; skipped {0} exact duplicates',
    '周次须在第 1-{0} 周之间。': 'Teaching weeks must be between 1 and {0}.',
    '周次请填写 1-16、3,5,8 或 1-16(单)。': 'Use 1-16, 3,5,8, or 1-16(odd).',
    '（{0} 项时段冲突，已放入待办）': ' ({0} conflicts; kept in the task list)',
    '已安排 {0}': 'Scheduled {0}', '已完成 {0}': 'Completed {0}',
    '取消重要标记：{0}': 'Remove important flag: {0}', '标为重要：{0}': 'Mark important: {0}'
  };
  const resolveLocale = value => /^zh(?:-|$)/i.test(value || '') ? 'zh' : 'en';
  function create(initial = 'zh') {
    let locale = resolveLocale(initial);
    // This function receives source-code literals only. Interpolated user data
    // is appended untouched by html(), never searched or translated.
    const t = literal => locale === 'zh' ? literal : english[literal] || String(literal).replace(pattern, key => english[key]).replace(/，/g, ', ').replace(/。/g, '.').replace(/：/g, ': ').replace(/；/g, '; ').replace(/（/g, '(').replace(/）/g, ')').replace(/“|”/g, '"').replace(/、/g, ', ').replace(/？/g, '?').replace(/！/g, '!');
    const html = (parts, ...values) => {
      const key = parts.reduce((text, part, index) => text + (index ? `{${index-1}}` : '') + part, '');
      if (locale === 'en' && phrases[key]) return phrases[key].replace(/\{(\d+)\}/g, (_,index) => String(values[Number(index)]));
      return parts.reduce((text, part, index) => text + (index ? String(values[index-1]) : '') + t(part), '');
    };
    return { t, html, get locale() { return locale; }, setLocale(value) { locale = resolveLocale(value); } };
  }
  return { create, resolveLocale };
});
