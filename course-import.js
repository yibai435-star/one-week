(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./i18n.js'));
  else root.WeekPlannerCourseImport = factory(root.OneWeekI18n);
})(typeof globalThis === 'object' ? globalThis : this, function createImporter(i18n, locale = 'zh') {
  const translations = i18n.create(locale), t = translations.t, h = translations.html;
  'use strict';
  const HEADERS = ['课程名称', '星期', '开始时间', '结束时间', '周次', '教室', '教师'];
  const EN_HEADERS = ['Class', 'Day', 'Start', 'End', 'Weeks', 'Room', 'Teacher'];
  const HEADER_ALIASES = [['class','class name','course','course name','title'],['day','weekday'],['start','start time'],['end','end time'],['weeks','teaching weeks'],['room','location'],['teacher','instructor']];
  const TEMPLATE = HEADERS.join('\t') + '\n高等数学\t周一\t08:00\t09:40\t1-16\t教学楼 201\t\n大学英语\t周三\t10:00\t11:40\t1-16(单)\t教学楼 305\t';
  function weeks(text, total) {
    const values = new Set();
    const normalized = String(text).replace(/\bodd\b/gi, '单').replace(/\beven\b/gi, '双').replace(/[，、]/g, ',').replace(/（/g, '(').replace(/）/g, ')').replace(/[—–~～]/g, '-').replace(/周/g, '');
    for (const part of normalized.split(',')) {
      const match = part.match(/^\s*(\d+)(?:\s*-\s*(\d+))?\s*(?:\((单|双)\))?\s*$/);
      if (!match) throw new Error(t('周次请填写 1-16、3,5,8 或 1-16(单)。'));
      const first = Number(match[1]), last = Number(match[2] || match[1]);
      if (first < 1 || last < first || last > total) throw new Error(h`周次须在第 1-${total} 周之间。`);
      for (let week = first; week <= last; week++) {
        if (match[3] === '单' && week % 2 === 0 || match[3] === '双' && week % 2 === 1) continue;
        values.add(week);
      }
    }
    if (!values.size) throw new Error(t('至少填写一个上课周次。'));
    return [...values].sort((a, b) => a - b);
  }
  // RFC 4180 quoting also works for tab-separated spreadsheets; never evaluate cells.
  function rows(text) {
    const source = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const delimiter = source.split('\n')[0].includes('\t') ? '\t' : ',';
    const result = []; let row = [], cell = '', quoted = false, closed = false;
    for (let index = 0; index <= source.length; index++) {
      const char = source[index];
      if (quoted) {
        if (char === undefined) throw new Error(t('有一个引号没有闭合，请检查粘贴的表格。'));
        if (char === '"') {
          if (source[index + 1] === '"') { cell += '"'; index++; }
          else { quoted = false; closed = true; }
        } else cell += char;
      } else if (char === delimiter || char === '\n' || char === undefined) {
        row.push(cell.trim()); cell = ''; closed = false;
        if (char !== delimiter) { if (row.some(Boolean)) result.push(row); row = []; }
      } else if (char === '"' && !cell && !closed) quoted = true;
      else {
        if (closed || char === '"') throw new Error(t('引号格式有误。含逗号的 CSV 单元格请用双引号包裹。'));
        cell += char;
      }
    }
    return result;
  }
  function fingerprint(course) {
    return JSON.stringify([course.title, course.day, course.start, course.end, [...course.weeks].sort((a,b) => a-b), course.room || '', course.teacher || '']);
  }
  function parse(text, config, engine, makeId) {
    if (typeof text !== 'string' || text.length > 200000) throw new Error(t('请导入不超过 200 KB 的课程表格。'));
    const table = rows(text);
    if (table.length < 2) throw new Error(t('请包含表头和至少一行课程。'));
    const header = table.shift();
    if (header.length < 5 || header.length > 7 || header.some((value, index) => value !== HEADERS[index] && !HEADER_ALIASES[index].includes(value.toLowerCase()))) {
      throw new Error(t('列顺序应为：课程名称、星期、开始时间、结束时间、周次、教室、教师。后两列可省略。'));
    }
    if (table.length > 300) throw new Error(t('一次最多导入 300 条课程规则，请分批导入。'));
    const known = new Set(config.courses.map(fingerprint)), courses = []; let skipped = 0;
    table.forEach((row, index) => {
      try {
        if (row.length !== header.length) throw new Error(t('列数与表头不一致，请检查逗号或制表符。'));
        const dayText = row[1].replace(/^(星期|周|礼拜)/, '');
        const englishDays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
        const englishDay = englishDays.findIndex(day => day === dayText.toLowerCase() || day.slice(0,3) === dayText.toLowerCase().replace(/\.$/, ''));
        const day = /^[1-7]$/.test(dayText) ? Number(dayText) - 1 : englishDay >= 0 ? englishDay : ['一','二','三','四','五','六','日'].indexOf(dayText === '天' ? '日' : dayText);
        if (day < 0) throw new Error(t('星期请填写周一至周日，或数字 1-7。'));
        const course = { id: makeId(), title: row[0], day, start: engine.parseTime(row[2]), end: engine.parseTime(row[3]), weeks: weeks(row[4], config.weeks), room: row[5] || '', teacher: row[6] || '' };
        const normalized = engine.normalizeConfig({ ...config, courses: [course] }).courses[0];
        const key = fingerprint(normalized);
        if (known.has(key)) skipped++;
        else {
          engine.normalizeConfig({ ...config, courses: [...config.courses, ...courses, normalized] });
          known.add(key); courses.push(normalized);
        }
      } catch (error) { throw new Error(h`第 ${index + 2} 行：${error.message}`); }
    });
    return { courses, skipped };
  }
  return { parse, weeks, get TEMPLATE() { return locale === 'en' ? EN_HEADERS.join('\t') + '\nCalculus\tMon\t08:00\t09:40\t1-16\tBuilding A 201\t\nCollege English\tWed\t10:00\t11:40\t1-16(odd)\tBuilding A 305\t' : TEMPLATE; }, withLocale: locale => createImporter(i18n, locale) };
});
