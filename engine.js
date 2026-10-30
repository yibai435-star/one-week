(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./i18n.js'));
  else root.WeekPlannerEngine = factory(root.OneWeekI18n);
})(typeof globalThis === 'object' ? globalThis : this, function createEngine(i18n, locale = 'zh') {
  const translations = i18n.create(locale), t = translations.t, h = translations.html;
  'use strict';

  var DAY_NAMES = [t('周一'), t('周二'), t('周三'), t('周四'), t('周五'), t('周六'), t('周日')];
  var MIN_DURATION = 15;
  var MAX_DURATION = 840;

  function fail(message) { throw new Error(message); }
  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(h`${label}必须是对象。`);
  }
  function knownFields(value, allowed, label) {
    Object.keys(value).forEach(function (key) {
      if (allowed.indexOf(key) === -1) fail(h`${label}包含无法识别的字段“${key}”，请确认备份版本。`);
    });
  }
  function integer(value, min, max, label) {
    if (!Number.isInteger(value) || value < min || value > max) fail(h`${label}必须是 ${min}–${max} 之间的整数。`);
    return value;
  }
  function text(value, label, max, allowEmpty) {
    if (typeof value !== 'string') fail(h`${label}必须是文字。`);
    var result = value.trim();
    if ((!allowEmpty && !result) || result.length > max) fail(h`${label}不能为空，且不能超过 ${max} 个字符。`);
    return result;
  }
  function importantFlag(value, label) {
    if (value === undefined) return false;
    if (typeof value !== 'boolean') fail(h`${label}必须是 true 或 false。`);
    return value;
  }
  function notesText(value, label) {
    if (value === undefined) return '';
    if (typeof value !== 'string') fail(h`${label}必须是文字。`);
    if (value.length > 10000) fail(h`${label}不能超过 10000 个字符。`);
    // Notes are user content: preserve indentation, blank lines and trailing spaces.
    return value;
  }
  function id(value, label) {
    var result = text(value, label, 160, false);
    if (result !== value || /[\x00-\x1f\x7f]/.test(result)) fail(h`${label}含有无效字符。`);
    return result;
  }
  function courseOccurrenceId(value, label) {
    if (typeof value !== 'string') fail(h`${label}必须是文字。`);
    var match = /^(.*)@(\d{4}-\d{2}-\d{2})$/.exec(value);
    if (!match || match[0] !== value) fail(h`${label}须为课程规则标识@YYYY-MM-DD。`);
    id(match[1], h`${label}中的课程规则标识`);
    parseDate(match[2]);
    return value;
  }
  function uniqueIds(items, label) {
    var used = new Set();
    items.forEach(function (item) {
      if (used.has(item.id)) fail(h`${label}的标识“${item.id}”重复。`);
      used.add(item.id);
    });
  }
  function jsonCopy(value, label, depth) {
    depth = depth || 0;
    if (depth > 30) fail(h`${label}嵌套过深。`);
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return value.map(function (item) { return jsonCopy(item, label, depth + 1); });
    if (value && typeof value === 'object') {
      var result = {};
      Object.keys(value).forEach(function (key) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') fail(h`${label}包含无效字段。`);
        result[key] = jsonCopy(value[key], label, depth + 1);
      });
      return result;
    }
    fail(h`${label}只能包含有效 JSON 数据。`);
  }
  function pad(number, width) { return String(number).padStart(width || 2, '0'); }

  // Parse calendar dates from components. No UTC-to-local conversion is involved.
  function parseDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(t('日期请使用 YYYY-MM-DD 格式。'));
    var parts = value.split('-').map(Number);
    if (parts[0] < 1 || parts[0] > 9999 || parts[1] < 1 || parts[1] > 12 || parts[2] < 1 || parts[2] > 31) fail(h`日期“${value}”不存在。`);
    var result = new Date(0);
    result.setFullYear(parts[0], parts[1] - 1, parts[2]);
    result.setHours(12, 0, 0, 0);
    if (result.getFullYear() !== parts[0] || result.getMonth() !== parts[1] - 1 || result.getDate() !== parts[2]) fail(h`日期“${value}”不存在。`);
    return result;
  }
  function formatDate(value) {
    if (typeof value === 'string') return formatDate(parseDate(value));
    if (!value || typeof value.getFullYear !== 'function' || !Number.isFinite(value.getTime())) fail(t('无法读取这个日期。'));
    var year = value.getFullYear();
    if (year < 1 || year > 9999) fail(t('日期年份超出范围。'));
    return pad(year, 4) + '-' + pad(value.getMonth() + 1) + '-' + pad(value.getDate());
  }
  function addDays(value, days) {
    integer(days, -100000, 100000, t('日期间隔'));
    var date = parseDate(formatDate(value));
    date.setDate(date.getDate() + days);
    return formatDate(date);
  }
  function dayOrdinal(value) {
    var date = parseDate(value);
    // UTC is used only for a timezone-independent count of calendar days.
    var anchor = new Date(0);
    anchor.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    anchor.setUTCHours(0, 0, 0, 0);
    return anchor.getTime() / 86400000;
  }
  function weekNumber(config, date) { return Math.floor((dayOrdinal(date) - dayOrdinal(config.firstMonday)) / 7) + 1; }
  function parseTime(value) {
    if (value === '24:00') return 1440;
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail(t('时间请使用 HH:MM 格式。'));
    var parts = value.split(':').map(Number);
    return parts[0] * 60 + parts[1];
  }
  function formatTime(value) {
    integer(value, 0, 1440, t('时间'));
    return pad(Math.floor(value / 60)) + ':' + pad(value % 60);
  }
  function overlaps(a, b) { return a.start < b.end && b.start < a.end; }
  function weekList(value, total, label) {
    if (!Array.isArray(value) || !value.length) fail(h`${label}至少需要选择一个教学周。`);
    var used = new Set();
    var result = value.map(function (week) {
      integer(week, 1, total, label);
      if (used.has(week)) fail(h`${label}包含重复的第 ${week} 周。`);
      used.add(week);
      return week;
    });
    return result.sort(function (a, b) { return a - b; });
  }
  function interval(start, end, config, label, task) {
    integer(start, config.dayStart, config.dayEnd - 1, h`${label}开始时间`);
    integer(end, config.dayStart + 1, config.dayEnd, h`${label}结束时间`);
    if (end <= start) fail(h`${label}结束时间必须晚于开始时间。`);
    if (task && (end - start < MIN_DURATION || end - start > MAX_DURATION)) fail(h`${label}时长须为 15–840 分钟。`);
  }

  function normalizeConfig(raw) {
    object(raw, t('课程设置'));
    knownFields(raw, ['semester', 'firstMonday', 'weeks', 'dayStart', 'dayEnd', 'periods', 'courses', 'reminders', 'source'], t('课程设置'));
    var result = {
      semester: text(raw.semester, t('学期名称'), 100, false),
      firstMonday: formatDate(raw.firstMonday),
      weeks: integer(raw.weeks, 1, 60, t('教学周数')),
      dayStart: integer(raw.dayStart, 0, 1439, t('时间轴开始时间')),
      dayEnd: integer(raw.dayEnd, 1, 1440, t('时间轴结束时间'))
    };
    if (parseDate(result.firstMonday).getDay() !== 1) fail(t('第 1 教学周的起始日期必须是周一。'));
    if (result.dayEnd <= result.dayStart) fail(t('时间轴结束时间必须晚于开始时间。'));
    addDays(result.firstMonday, result.weeks * 7 - 1);
    if (!Array.isArray(raw.periods)) fail(t('节次时间必须是列表。'));
    var periodNumbers = new Set();
    result.periods = raw.periods.map(function (period, index) {
      var label = h`第 ${index + 1} 条节次时间`;
      object(period, label);
      knownFields(period, ['number', 'start', 'end'], label);
      var number = integer(period.number, 1, 60, h`${label}节次`);
      if (periodNumbers.has(number)) fail(h`节次 ${number} 重复。`);
      periodNumbers.add(number);
      interval(period.start, period.end, result, label, false);
      return { number: number, start: period.start, end: period.end };
    }).sort(function (a, b) { return a.number - b.number; });
    result.periods.forEach(function (period, index) {
      if (index && result.periods[index - 1].end > period.start) fail(t('节次时间必须按顺序排列，且不能重叠。'));
    });
    if (!Array.isArray(raw.courses)) fail(t('课程规则必须是列表。'));
    result.courses = raw.courses.map(function (course, index) {
      var label = h`第 ${index + 1} 条课程`;
      object(course, label);
      knownFields(course, ['id', 'title', 'day', 'start', 'end', 'weeks', 'room', 'teacher', 'firstPeriod', 'lastPeriod'], label);
      interval(course.start, course.end, result, label, false);
      var normalized = {
        id: id(course.id, h`${label}标识`),
        title: text(course.title, h`${label}名称`, 240, false),
        day: integer(course.day, 0, 6, h`${label}星期`),
        start: course.start,
        end: course.end,
        weeks: weekList(course.weeks, result.weeks, h`${label}周次`),
        room: text(course.room === undefined ? '' : course.room, h`${label}教室`, 300, true),
        teacher: text(course.teacher === undefined ? '' : course.teacher, h`${label}教师`, 300, true)
      };
      if (course.firstPeriod !== undefined || course.lastPeriod !== undefined) {
        integer(course.firstPeriod, 1, 60, h`${label}首节`);
        integer(course.lastPeriod, course.firstPeriod, 60, h`${label}末节`);
        var first = result.periods.find(function (period) { return period.number === course.firstPeriod; });
        var last = result.periods.find(function (period) { return period.number === course.lastPeriod; });
        if (!first || !last || first.start !== course.start || last.end !== course.end) fail(h`${normalized.title}的节次与钟点不一致；自定义钟点时请移除节次字段。`);
        for (var number = course.firstPeriod; number <= course.lastPeriod; number += 1) {
          if (!periodNumbers.has(number)) fail(h`${normalized.title}的第 ${number} 节不存在。`);
        }
        normalized.firstPeriod = course.firstPeriod;
        normalized.lastPeriod = course.lastPeriod;
      }
      return normalized;
    });
    uniqueIds(result.courses, t('课程规则'));
    for (var left = 0; left < result.courses.length; left += 1) {
      for (var right = left + 1; right < result.courses.length; right += 1) {
        var a = result.courses[left];
        var b = result.courses[right];
        if (a.day !== b.day || !overlaps(a, b)) continue;
        var commonWeek = a.weeks.find(function (week) { return b.weeks.indexOf(week) !== -1; });
        if (commonWeek !== undefined) fail(h`第 ${commonWeek} 周${DAY_NAMES[a.day]}的课程“${a.title}”与“${b.title}”重叠。`);
      }
    }
    if (raw.reminders !== undefined && !Array.isArray(raw.reminders)) fail(t('课程提醒必须是列表。'));
    result.reminders = (raw.reminders || []).map(function (reminder, index) {
      var label = h`第 ${index + 1} 条提醒`;
      object(reminder, label);
      knownFields(reminder, ['id', 'title', 'weeks', 'teacher', 'note'], label);
      return {
        id: id(reminder.id, h`${label}标识`),
        title: text(reminder.title, h`${label}名称`, 240, false),
        weeks: weekList(reminder.weeks, result.weeks, h`${label}周次`),
        teacher: text(reminder.teacher === undefined ? '' : reminder.teacher, h`${label}教师`, 300, true),
        note: text(reminder.note === undefined ? '' : reminder.note, h`${label}说明`, 2000, true)
      };
    });
    uniqueIds(result.reminders, t('课程提醒'));
    // Migrate older saved data/backup files while preserving all other reminders.
    result.reminders = result.reminders.filter(function (reminder) { return reminder.id !== 'moral-education'; });
    if (raw.source !== undefined) {
      object(raw.source, t('课程来源'));
      result.source = jsonCopy(raw.source, t('课程来源'));
    }
    return result;
  }

  function buildOriginalWeek(config, week) {
    integer(week, 1, config.weeks, t('教学周'));
    var monday = addDays(config.firstMonday, (week - 1) * 7);
    var dates = Array.from({ length: 7 }, function (_, day) { return addDays(monday, day); });
    var courses = config.courses.filter(function (course) { return course.weeks.indexOf(week) !== -1; }).map(function (course) {
      var instance = {
        id: course.id + '@' + dates[course.day],
        ruleId: course.id,
        title: course.title,
        date: dates[course.day],
        day: course.day,
        start: course.start,
        end: course.end,
        room: course.room,
        teacher: course.teacher,
        kind: 'course'
      };
      if (course.firstPeriod !== undefined) {
        instance.firstPeriod = course.firstPeriod;
        instance.lastPeriod = course.lastPeriod;
      }
      return instance;
    }).sort(function (a, b) { return a.day - b.day || a.start - b.start || a.id.localeCompare(b.id); });
    var reminders = config.reminders.filter(function (reminder) { return reminder.weeks.indexOf(week) !== -1; }).map(function (reminder) {
      return { id: reminder.id, title: reminder.title, teacher: reminder.teacher, note: reminder.note, kind: 'reminder' };
    });
    return { week: week, monday: monday, sunday: dates[6], dates: dates, courses: courses, reminders: reminders };
  }
  function originalOccurrence(config, occurrenceId) {
    var ruleId = occurrenceId.slice(0, -11);
    var date = occurrenceId.slice(-10);
    var rule = config.courses.find(function (course) { return course.id === ruleId; });
    if (!rule) return null;
    var week = weekNumber(config, date);
    if (week < 1 || week > config.weeks || rule.weeks.indexOf(week) === -1 || (parseDate(date).getDay() + 6) % 7 !== rule.day) return null;
    var course = { id: occurrenceId, ruleId: rule.id, title: rule.title, date: date, day: rule.day, start: rule.start, end: rule.end, room: rule.room, teacher: rule.teacher, kind: 'course' };
    if (rule.firstPeriod !== undefined) { course.firstPeriod = rule.firstPeriod; course.lastPeriod = rule.lastPeriod; }
    return course;
  }
  function normalizeCourseDetails(raw, config) {
    if (raw !== undefined && !Array.isArray(raw)) fail(t('课程详情必须是列表。'));
    var details = (raw || []).map(function (detail, index) {
      var label = h`第 ${index + 1} 条课程详情`;
      object(detail, label);
      knownFields(detail, ['id', 'important', 'notes', 'adjustment'], label);
      var normalized = {
        id: courseOccurrenceId(detail.id, h`${label}标识`),
        important: importantFlag(detail.important, h`${label}的重要标记`),
        notes: notesText(detail.notes, h`${label}备注`)
      };
      if (detail.adjustment !== undefined) {
        var adjustment = detail.adjustment;
        object(adjustment, h`${label}调课设置`);
        knownFields(adjustment, ['date', 'start', 'end', 'room'], h`${label}调课设置`);
        var has = function (key) { return Object.prototype.hasOwnProperty.call(adjustment, key); };
        var timeFields = ['date', 'start', 'end'].filter(has).length;
        if (timeFields && timeFields !== 3) fail(h`${label}调课日期、开始时间和结束时间必须一起填写。`);
        var original = originalOccurrence(config, normalized.id);
        var changed = {};
        if (timeFields) {
          if (typeof adjustment.date !== 'string' || adjustment.date.length !== 10 || formatDate(adjustment.date) !== adjustment.date) fail(h`${label}调课日期请使用 YYYY-MM-DD 格式。`);
          interval(adjustment.start, adjustment.end, config, h`${label}调课`, false);
          var week = weekNumber(config, adjustment.date);
          if (original && (week < 1 || week > config.weeks)) fail(h`“${original.title}”的调课日期须在本学期 ${config.firstMonday} 至 ${addDays(config.firstMonday, config.weeks * 7 - 1)} 之间。`);
          if (!original || adjustment.date !== original.date || adjustment.start !== original.start || adjustment.end !== original.end) {
            changed.date = adjustment.date; changed.start = adjustment.start; changed.end = adjustment.end;
          }
        }
        if (has('room')) {
          var room = text(adjustment.room, h`${label}调课教室`, 300, true);
          if (!original || room !== original.room) changed.room = room;
        }
        if (Object.keys(changed).length) normalized.adjustment = changed;
      }
      return normalized;
    });
    uniqueIds(details, t('课程详情'));
    return details;
  }
  function effectiveOccurrence(course, detail) {
    var original = { date: course.date, day: course.day, start: course.start, end: course.end, room: course.room };
    if (course.firstPeriod !== undefined) { original.firstPeriod = course.firstPeriod; original.lastPeriod = course.lastPeriod; }
    var adjustment = detail && detail.adjustment;
    var result = Object.assign({}, course, { original: original, adjusted: false, timeAdjusted: false, roomAdjusted: false });
    if (adjustment && adjustment.date !== undefined) {
      result.date = adjustment.date; result.start = adjustment.start; result.end = adjustment.end;
      result.day = (parseDate(result.date).getDay() + 6) % 7;
      result.timeAdjusted = result.date !== original.date || result.start !== original.start || result.end !== original.end;
      if (result.timeAdjusted) { delete result.firstPeriod; delete result.lastPeriod; }
    }
    if (adjustment && adjustment.room !== undefined) {
      result.room = adjustment.room;
      result.roomAdjusted = result.room !== original.room;
    }
    result.adjusted = result.timeAdjusted || result.roomAdjusted;
    return result;
  }
  function effectiveCourses(config, details) {
    var byId = new Map((details || []).map(function (detail) { return [detail.id, detail]; }));
    var result = [];
    for (var week = 1; week <= config.weeks; week += 1) {
      buildOriginalWeek(config, week).courses.forEach(function (course) { result.push(effectiveOccurrence(course, byId.get(course.id))); });
    }
    return result.sort(function (a, b) { return a.date.localeCompare(b.date) || a.start - b.start || a.id.localeCompare(b.id); });
  }
  function assertCourseConflicts(config, details) {
    var courses = effectiveCourses(config, details);
    for (var index = 1; index < courses.length; index += 1) {
      var previous = courses[index - 1], course = courses[index];
      if (previous.date === course.date && overlaps(previous, course)) fail(h`调课冲突：${course.date} 的“${previous.title}”（${formatTime(previous.start)}–${formatTime(previous.end)}）与“${course.title}”（${formatTime(course.start)}–${formatTime(course.end)}）时间重叠。`);
    }
  }
  function buildWeek(config, week, details) {
    var result = buildOriginalWeek(config, week);
    result.courses = effectiveCourses(config, details).filter(function (course) { return course.date >= result.monday && course.date <= result.sunday; });
    return result;
  }
  function getCourseOccurrence(config, occurrenceId, courseDetails) {
    var normalized = normalizeConfig(config);
    courseOccurrenceId(occurrenceId, t('课程标识'));
    var details = normalizeCourseDetails(courseDetails, normalized);
    var original = originalOccurrence(normalized, occurrenceId);
    return original ? effectiveOccurrence(original, details.find(function (detail) { return detail.id === occurrenceId; })) : null;
  }
  function getWeek(config, week, courseDetails) {
    var normalized = normalizeConfig(config);
    return buildWeek(normalized, week, normalizeCourseDetails(courseDetails, normalized));
  }
  function getMonth(config, month, courseDetails) {
    var normalized = normalizeConfig(config);
    var allCourses = effectiveCourses(normalized, normalizeCourseDetails(courseDetails, normalized));
    if (typeof month !== 'string' || month.length !== 7 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) fail(t('月份请使用 YYYY-MM 格式。'));
    var firstDate = parseDate(month + '-01');
    var lastDate = parseDate(month + '-01');
    lastDate.setMonth(lastDate.getMonth() + 1, 0);
    var start = formatDate(firstDate);
    var end = formatDate(lastDate);
    var gridStart = addDays(start, -((firstDate.getDay() + 6) % 7));
    var days = Array.from({ length: 42 }, function (_, index) {
      var date = addDays(gridStart, index);
      var week = weekNumber(normalized, date);
      var inSemester = week >= 1 && week <= normalized.weeks;
      var courses = [];
      if (inSemester) courses = allCourses.filter(function (course) { return course.date === date; });
      return { date: date, inMonth: date.slice(0, 7) === month, inSemester: inSemester, courses: courses };
    });
    return { month: month, start: start, end: end, days: days };
  }
  function dateToWeek(config, date) { return weekNumber(normalizeConfig(config), formatDate(date)); }
  function currentWeek(config, today) {
    var normalized = normalizeConfig(config);
    var week = weekNumber(normalized, formatDate(today === undefined ? new Date() : today));
    return Math.max(1, Math.min(normalized.weeks, week));
  }
  function DEFAULT_STATE(config, asOf) {
    var normalized = normalizeConfig(config);
    return {
      schemaVersion: 1,
      config: normalized,
      tasks: [],
      blocks: [],
      courseDetails: [],
      routines: [],
      routineApplications: [],
      selectedWeek: currentWeek(normalized, asOf)
    };
  }

  function asTaskConflict(block, tasks) {
    var task = tasks.find(function (item) { return item.id === block.taskId; });
    return { id: block.id, taskId: block.taskId, title: task ? task.title : t('已有安排'), date: block.date, start: block.start, end: block.end, kind: 'task' };
  }
  function placement(state, config, candidate, options) {
    options = options || {};
    var date;
    var week;
    try {
      object(candidate, t('安排'));
      date = formatDate(candidate.date);
      interval(candidate.start, candidate.end, config, t('安排'), true);
      week = weekNumber(config, date);
      if (week < 1 || week > config.weeks) fail(h`安排日期须在本学期 ${config.firstMonday} 至 ${addDays(config.firstMonday, config.weeks * 7 - 1)} 之间。`);
      if (candidate.taskId !== undefined && !state.tasks.some(function (task) { return task.id === candidate.taskId; })) fail(t('这个安排对应的待办不存在。'));
    } catch (error) {
      return { ok: false, message: error.message, conflicts: [] };
    }
    if (candidate.taskId !== undefined) {
      var sameTask = state.blocks.find(function (block) { return block.taskId === candidate.taskId && block.id !== options.ignoreBlockId; });
      if (sameTask) return { ok: false, message: t('这个待办已有安排，请移动原安排或先取消安排。'), conflicts: [asTaskConflict(sameTask, state.tasks)] };
    }
    var conflicts = effectiveCourses(config, state.courseDetails).filter(function (course) { return course.date === date && overlaps(course, candidate); });
    state.blocks.forEach(function (block) {
      if (block.id !== options.ignoreBlockId && block.date === date && overlaps(block, candidate)) conflicts.push(asTaskConflict(block, state.tasks));
    });
    if (conflicts.length) {
      var first = conflicts[0];
      var suffix = conflicts.length > 1 ? h`等 ${conflicts.length} 个日程` : '';
      return { ok: false, message: h`与“${first.title}”${suffix}冲突（${formatTime(first.start)}–${formatTime(first.end)}）。`, conflicts: conflicts };
    }
    return { ok: true, message: '', conflicts: [] };
  }
  function validatePlacement(state, config, candidate, options) {
    object(state, t('周计划'));
    if (!Array.isArray(state.tasks) || !Array.isArray(state.blocks)) fail(t('周计划缺少待办或安排列表。'));
    var normalized = normalizeConfig(config);
    return placement({ tasks: state.tasks, blocks: state.blocks, courseDetails: normalizeCourseDetails(state.courseDetails, normalized) }, normalized, candidate, options);
  }

  function normalizeState(raw, fallbackConfig) {
    object(raw, t('周计划备份'));
    knownFields(raw, ['schemaVersion', 'config', 'tasks', 'blocks', 'courseDetails', 'routines', 'routineApplications', 'selectedWeek'], t('周计划备份'));
    if (raw.schemaVersion !== 1) fail(t('不支持这个备份版本，只能导入 schemaVersion 为 1 的周计划。'));
    var config = normalizeConfig(raw.config === undefined ? fallbackConfig : raw.config);
    if (!Array.isArray(raw.tasks) || !Array.isArray(raw.blocks)) fail(t('备份必须包含待办列表和安排列表。'));
    var result = { schemaVersion: 1, config: config, tasks: [], blocks: [], courseDetails: [], routines: [], routineApplications: [], selectedWeek: integer(raw.selectedWeek, 1, config.weeks, t('选中的教学周')) };
    result.tasks = raw.tasks.map(function (task, index) {
      var label = h`第 ${index + 1} 个待办`;
      object(task, label);
      knownFields(task, ['id', 'title', 'duration', 'done', 'important', 'urgent', 'week', 'notes', 'routineId', 'routineWeek'], label);
      if (typeof task.done !== 'boolean') fail(h`${label}的完成状态必须是 true 或 false。`);
      var normalized = {
        id: id(task.id, h`${label}标识`),
        title: text(task.title, h`${label}名称`, 240, false),
        duration: integer(task.duration, MIN_DURATION, MAX_DURATION, h`${label}预计时长`),
        done: task.done,
        important: importantFlag(task.important, h`${label}的重要标记`),
        urgent: importantFlag(task.urgent, h`${label}的紧急标记`),
        notes: notesText(task.notes, h`${label}备注`)
      };
      if (task.routineId !== undefined || task.routineWeek !== undefined) {
        normalized.routineId = id(task.routineId, h`${label}例行模板标识`);
        normalized.routineWeek = integer(task.routineWeek, 1, config.weeks, h`${label}原始生成周`);
      }
      return normalized;
    });
    uniqueIds(result.tasks, t('待办'));
    if (raw.routines !== undefined && !Array.isArray(raw.routines)) fail(t('例行模板必须是列表。'));
    result.routines = (raw.routines || []).map(function (routine, index) {
      var label = h`第 ${index + 1} 个例行模板`;
      object(routine, label);
      knownFields(routine, ['id', 'title', 'duration', 'notes', 'important', 'urgent', 'slots'], label);
      var normalized = {
        id: id(routine.id, h`${label}标识`),
        title: text(routine.title, h`${label}名称`, 240, false),
        duration: integer(routine.duration, MIN_DURATION, MAX_DURATION, h`${label}预计时长`),
        notes: notesText(routine.notes, h`${label}备注`),
        important: importantFlag(routine.important, h`${label}的重要标记`),
        urgent: importantFlag(routine.urgent, h`${label}的紧急标记`),
        slots: []
      };
      if (!Array.isArray(routine.slots)) fail(h`${label}的固定时段必须是列表；不固定时间时请使用空列表。`);
      var seen = new Set();
      normalized.slots = routine.slots.map(function (slot) {
        object(slot, h`${label}固定时段`);
        knownFields(slot, ['day', 'start'], h`${label}固定时段`);
        var day = integer(slot.day, 0, 6, h`${label}星期`);
        interval(slot.start, slot.start + normalized.duration, config, h`${label}固定时段`, true);
        var key = day + ':' + slot.start;
        if (seen.has(key)) fail(h`${label}含有重复的固定时段。`);
        seen.add(key);
        return { day: day, start: slot.start };
      });
      return normalized;
    });
    uniqueIds(result.routines, t('例行模板'));
    if (raw.routineApplications !== undefined && !Array.isArray(raw.routineApplications)) fail(t('例行应用历史必须是列表。'));
    var applicationKeys = new Set();
    result.routineApplications = (raw.routineApplications || []).map(function (application, index) {
      var label = h`第 ${index + 1} 条例行应用历史`;
      object(application, label);
      knownFields(application, ['routineId', 'week', 'taskIds'], label);
      var routineId = id(application.routineId, h`${label}模板标识`);
      var week = integer(application.week, 1, config.weeks, h`${label}教学周`);
      var key = JSON.stringify([routineId, week]);
      if (applicationKeys.has(key)) fail(t('同一例行模板在同一周的应用历史重复。'));
      applicationKeys.add(key);
      if (!Array.isArray(application.taskIds)) fail(h`${label}的任务标识必须是列表。`);
      var taskIds = new Set();
      return { routineId: routineId, week: week, taskIds: application.taskIds.map(function (taskId) {
        taskId = id(taskId, h`${label}任务标识`);
        if (taskIds.has(taskId)) fail(h`${label}含有重复的任务标识。`);
        taskIds.add(taskId);
        return taskId;
      }) };
    });
    result.courseDetails = normalizeCourseDetails(raw.courseDetails, config);
    // Keep unmatched occurrences after rule/date edits so their notes survive backups.
    assertCourseConflicts(config, result.courseDetails);
    var scheduledTasks = new Set();
    result.blocks = raw.blocks.map(function (block, index) {
      var label = h`第 ${index + 1} 个安排`;
      object(block, label);
      knownFields(block, ['id', 'taskId', 'date', 'start', 'end'], label);
      var taskId = id(block.taskId, h`${label}待办标识`);
      if (!result.tasks.some(function (task) { return task.id === taskId; })) fail(h`${label}引用了不存在的待办，备份未导入。`);
      if (scheduledTasks.has(taskId)) fail(h`每个待办只能有一个安排；待办“${taskId}”被安排了多次。`);
      scheduledTasks.add(taskId);
      interval(block.start, block.end, config, label, true);
      return { id: id(block.id, h`${label}标识`), taskId: taskId, date: formatDate(block.date), start: block.start, end: block.end };
    });
    uniqueIds(result.blocks, t('安排'));
    result.tasks.forEach(function (task, index) {
      var block = result.blocks.find(function (item) { return item.taskId === task.id; });
      // An arranged date is authoritative, including after a move to another week.
      var week = block ? weekNumber(config, block.date) : raw.tasks[index].week;
      task.week = integer(week === undefined ? result.selectedWeek : week, 1, config.weeks, h`待办“${task.title}”所属教学周`);
    });
    result.blocks.forEach(function (block) {
      var validation = placement(result, config, block, { ignoreBlockId: block.id });
      if (!validation.ok) fail(h`安排 ${block.date} ${formatTime(block.start)} 校验失败：${validation.message} 备份未导入。`);
    });
    return result;
  }

  function tasksForWeek(state, week, options) {
    var normalized = normalizeState(state, state && state.config);
    integer(week, 1, normalized.config.weeks, t('教学周'));
    options = options === undefined ? {} : options;
    object(options, t('任务筛选选项'));
    var includeDone = options.includeDone === undefined ? true : options.includeDone;
    if (typeof includeDone !== 'boolean') fail(t('includeDone 必须是 true 或 false。'));
    return normalized.tasks.filter(function (task) { return task.week === week && (includeDone || !task.done); });
  }

  function selectedIds(values, label, allowEmpty) {
    if (!Array.isArray(values) || (!allowEmpty && !values.length)) fail(h`${label}必须是${allowEmpty ? '' : t('非空的')}标识列表。`);
    var seen = new Set();
    return values.map(function (value) {
      value = id(value, h`${label}标识`);
      if (seen.has(value)) fail(h`${label}包含重复标识。`);
      seen.add(value);
      return value;
    });
  }

  function postponeNormalized(state, taskIds) {
    var selected = taskIds.map(function (taskId) {
      var task = state.tasks.find(function (item) { return item.id === taskId; });
      if (!task) fail(h`找不到待办“${taskId}”；课程不能作为待办顺延。`);
      if (task.done) fail(h`已完成待办“${task.title}”不能顺延。`);
      if (task.week >= state.config.weeks) fail(h`待办“${task.title}”已在最后教学周，不能继续顺延。`);
      return { task: task, fromWeek: task.week };
    });
    var selectedSet = new Set(taskIds);
    // Postponement carries the task into next week's backlog, never a calendar slot.
    state.blocks = state.blocks.filter(function (block) { return !selectedSet.has(block.taskId); });
    var moved = selected.map(function (item) {
      item.task.week = item.fromWeek + 1;
      return { id: item.task.id, fromWeek: item.fromWeek, toWeek: item.task.week, unscheduled: true };
    });
    return { state: state, moved: moved, unscheduled: taskIds.slice() };
  }

  function postponeTasks(rawState, taskIds) {
    var state = normalizeState(rawState, rawState && rawState.config);
    var selected = selectedIds(taskIds, t('顺延待办'), false);
    var result = postponeNormalized(state, selected);
    result.state = normalizeState(result.state, result.state.config);
    return result;
  }

  function rolloverState(rawState, asOfDateString) {
    var state = normalizeState(rawState, rawState && rawState.config);
    if (typeof asOfDateString !== 'string' || asOfDateString.length !== 10 || formatDate(asOfDateString) !== asOfDateString) fail(t('自动顺延日期请使用 YYYY-MM-DD 格式。'));
    var targetWeek = Math.max(1, Math.min(state.config.weeks, weekNumber(state.config, asOfDateString)));
    var summaries = new Map();
    var unscheduled = new Set();
    while (true) {
      var overdue = state.tasks.filter(function (task) { return !task.done && task.week < targetWeek; }).map(function (task) { return task.id; });
      if (!overdue.length) break;
      var step = postponeNormalized(state, overdue);
      step.moved.forEach(function (movement) {
        var previous = summaries.get(movement.id);
        summaries.set(movement.id, { id: movement.id, fromWeek: previous ? previous.fromWeek : movement.fromWeek, toWeek: movement.toWeek, unscheduled: movement.unscheduled });
      });
      step.unscheduled.forEach(function (taskId) { unscheduled.add(taskId); });
    }
    return { state: normalizeState(state, state.config), moved: Array.from(summaries.values()), unscheduled: Array.from(unscheduled) };
  }

  function routineInstanceId(state, routineId, week, slot) {
    var first = 2166136261, second = 3339675911;
    for (var index = 0; index < routineId.length; index += 1) {
      first = Math.imul(first ^ routineId.charCodeAt(index), 16777619) >>> 0;
      second = Math.imul(second ^ routineId.charCodeAt(index), 2246822519) >>> 0;
    }
    var base = 'routine-' + first.toString(16).padStart(8, '0') + second.toString(16).padStart(8, '0') + '@' + week + '-' + slot;
    var used = new Set(state.tasks.map(function (task) { return task.id; }));
    state.routineApplications.forEach(function (application) { application.taskIds.forEach(function (taskId) { used.add(taskId); }); });
    var candidate = base, suffix = 0;
    while (used.has(candidate)) { suffix += 1; candidate = base + '-' + suffix; }
    return candidate;
  }

  function applyRoutines(rawState, week, routineIds) {
    var state = normalizeState(rawState, rawState && rawState.config);
    integer(week, 1, state.config.weeks, t('例行事项目标周'));
    var selected = routineIds === undefined ? state.routines.map(function (routine) { return routine.id; }) : selectedIds(routineIds, t('例行模板'), true);
    var routines = selected.map(function (routineId) {
      var routine = state.routines.find(function (item) { return item.id === routineId; });
      if (!routine) fail(h`找不到例行模板“${routineId}”。`);
      return routine;
    });
    var added = [], unscheduled = [], skipped = 0;
    routines.forEach(function (routine) {
      if (state.routineApplications.some(function (application) { return application.routineId === routine.id && application.week === week; })) { skipped += 1; return; }
      var legacyInstances = state.tasks.filter(function (task) { return task.routineId === routine.id && task.routineWeek === week; });
      if (legacyInstances.length) {
        state.routineApplications.push({ routineId: routine.id, week: week, taskIds: legacyInstances.map(function (task) { return task.id; }) });
        skipped += 1;
        return;
      }
      var taskIds = [];
      (routine.slots.length ? routine.slots : [null]).forEach(function (slot, index) {
        var taskId = routineInstanceId(state, routine.id, week, index);
        var task = { id: taskId, title: routine.title, duration: routine.duration, done: false, important: routine.important, urgent: routine.urgent, notes: routine.notes, week: week, routineId: routine.id, routineWeek: week };
        state.tasks.push(task); taskIds.push(taskId); added.push(taskId);
        if (slot) {
          var candidate = { id: 'schedule-' + taskId, taskId: taskId, date: addDays(state.config.firstMonday, (week - 1) * 7 + slot.day), start: slot.start, end: slot.start + routine.duration };
          // IDs are independent of user block IDs; resolve a rare hand-edited collision.
          var base = candidate.id, suffix = 0;
          while (state.blocks.some(function (block) { return block.id === candidate.id; })) { suffix += 1; candidate.id = base + '-' + suffix; }
          if (placement(state, state.config, candidate).ok) { state.blocks.push(candidate); return; }
        }
        unscheduled.push(taskId);
      });
      state.routineApplications.push({ routineId: routine.id, week: week, taskIds: taskIds });
    });
    return { state: normalizeState(state, state.config), added: added, unscheduled: unscheduled, skipped: skipped };
  }

  return {
    withLocale: locale => createEngine(i18n, locale),
    DEFAULT_STATE: DEFAULT_STATE,
    normalizeState: normalizeState,
    normalizeConfig: normalizeConfig,
    getWeek: getWeek,
    getCourseOccurrence: getCourseOccurrence,
    getMonth: getMonth,
    tasksForWeek: tasksForWeek,
    postponeTasks: postponeTasks,
    rolloverState: rolloverState,
    applyRoutines: applyRoutines,
    validatePlacement: validatePlacement,
    parseDate: parseDate,
    formatDate: formatDate,
    addDays: addDays,
    parseTime: parseTime,
    formatTime: formatTime,
    dateToWeek: dateToWeek,
    currentWeek: currentWeek,
    overlaps: overlaps,
    DAY_NAMES: DAY_NAMES.slice(),
    MIN_DURATION: MIN_DURATION,
    MAX_DURATION: MAX_DURATION
  };
});
