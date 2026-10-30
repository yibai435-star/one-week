(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WeekPlannerDefaults = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function create(engine, date = engine.formatDate(new Date()), locale = 'zh') {
    const day = engine.parseDate(date).getDay();
    return engine.normalizeConfig({
      semester: locale === 'en' ? 'My semester' : '我的学期', firstMonday: engine.addDays(date, -((day + 6) % 7)),
      weeks: 18, dayStart: 480, dayEnd: 1320, periods: [], courses: [], reminders: []
    });
  }
  return { create };
});
