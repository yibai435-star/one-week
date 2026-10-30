const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const engine = require('./engine.js');
const defaults = require('./default-semester.js');
const importer = require('./course-import.js');
const config = () => defaults.create(engine, '2026-10-27');
let serial = 0;
const parse = (text, settings = config()) => importer.parse(text, settings, engine, () => `import-${++serial}`);
const head = '课程名称,星期,开始时间,结束时间,周次,教室,教师\n';

test('new users start with an empty semester anchored to their current Monday', () => {
  const settings = config();
  assert.equal(settings.firstMonday, '2026-10-26');
  assert.equal(defaults.create(engine, '2026-11-01').firstMonday, '2026-10-26');
  assert.deepEqual(settings.courses, []);
  assert.deepEqual(settings.periods, []);
  assert.equal(settings.source, undefined);
  assert.equal(engine.DEFAULT_STATE(settings, '2026-10-27').selectedWeek, 1);
});
test('production entry points never import a personal timetable', () => {
  for (const file of ['plugin.js','index.html','build.cjs']) {
    const source = fs.readFileSync(require('node:path').join(__dirname, file), 'utf8');
    assert.doesNotMatch(source, /semester\.json|semester-data\.js/);
  }
});
test('tab-separated spreadsheet template supports odd weeks and optional empty cells', () => {
  const result = parse(importer.TEMPLATE);
  assert.equal(result.courses.length, 2);
  assert.equal(result.courses[0].start, 480);
  assert.deepEqual(result.courses[1].weeks, [1,3,5,7,9,11,13,15]);
  assert.equal(result.courses[1].teacher, '');
});
test('CSV quoting preserves commas and escaped quotes', () => {
  const result = parse(head + '"学术写作,研讨",周日,10:00,11:00,"1,3,5","研讨室 ""A""",\n');
  assert.equal(result.courses[0].title, '学术写作,研讨');
  assert.equal(result.courses[0].room, '研讨室 "A"');
  assert.deepEqual(result.courses[0].weeks, [1,3,5]);
});
test('UTF-8 BOM, CRLF, numeric weekdays and five-column files are accepted', () => {
  const result = parse('\uFEFF课程名称,星期,开始时间,结束时间,周次\r\n课程,7,10:00,11:00,1-4\r\n');
  assert.equal(result.courses[0].day, 6);
  assert.equal(result.courses[0].room, '');
});
test('invalid rows fail with their position without mutating the current schedule', () => {
  const settings = config(), before = JSON.stringify(settings);
  assert.throws(() => parse(head + '课程,周一,10:00,09:00,1-4,,', settings), /第 2 行.*结束时间/);
  assert.equal(JSON.stringify(settings), before);
  assert.throws(() => parse(head + '课程,周八,10:00,11:00,1-4,,'), /第 2 行.*星期/);
  assert.throws(() => parse(head + '课程,周一,10:00,11:00,1-80,,'), /第 2 行.*周次/);
  assert.throws(() => parse(head + '课程,周一,07:00,08:00,1-4,,'), /第 2 行/);
});
test('duplicates are skipped within one file and against existing courses', () => {
  const row = '课程,周一,10:00,11:00,1-4,,', first = parse(head + row + '\n' + row);
  assert.equal(first.courses.length, 1); assert.equal(first.skipped, 1);
  const second = parse(head + row, { ...config(), courses: first.courses });
  assert.equal(second.courses.length, 0); assert.equal(second.skipped, 1);
});
test('conflicting courses fail, while alternating weeks can share a slot', () => {
  assert.throws(() => parse(head + '课程甲,周一,10:00,11:00,1-4,,\n课程乙,周一,10:30,11:30,1-4,,'), /第 3 行.*重叠/);
  const result = parse(head + '课程甲,周一,10:00,11:00,1-4(单),,\n课程乙,周一,10:00,11:00,1-4(双),,');
  assert.equal(result.courses.length, 2);
});
test('malformed columns, headers, quotes and oversized files are rejected', () => {
  assert.throws(() => parse('课程,星期,开始时间,结束时间,周次\n课程,1,10:00,11:00,1-4'), /列顺序/);
  assert.throws(() => parse(head + '课程,周一,10:00,11:00,1,3,5,,'), /列数/);
  assert.throws(() => parse(head + '"课程,周一,10:00,11:00,1-4,,'), /引号/);
  assert.throws(() => parse('x'.repeat(200001)), /200 KB/);
});
test('unsupported spreadsheet formulas remain plain text, never evaluated', () => {
  const result = parse(head + '=1+1,周一,10:00,11:00,1-4,,');
  assert.equal(result.courses[0].title, '=1+1');
});
test('imported schedule produces the correct weekly and monthly occurrences', () => {
  const settings = { ...config(), courses: parse(importer.TEMPLATE).courses };
  assert.equal(engine.getWeek(settings, 1).courses.length, 2);
  assert.equal(engine.getWeek(settings, 2).courses.length, 1);
  const month = engine.getMonth(settings, '2026-10');
  assert.equal(month.days.find(day => day.date === '2026-10-28').courses.length, 1);
});
test('automatic rollover preserves task identity and returns it to backlog exactly once', () => {
  const state = engine.DEFAULT_STATE(config(), '2026-10-27');
  state.tasks.push({ id:'task', title:'课程复习', duration:60, week:1, done:false, important:true, urgent:true, notes:'保留备注' });
  state.blocks.push({ id:'slot', taskId:'task', date:'2026-10-30', start:600, end:660 });
  const result = engine.rolloverState(state, '2026-11-02');
  assert.equal(result.state.tasks[0].id, 'task');
  assert.equal(result.state.tasks[0].week, 2);
  assert.equal(result.state.tasks[0].notes, '保留备注');
  assert.deepEqual(result.state.blocks, []);
  assert.deepEqual(engine.rolloverState(result.state, '2026-11-02').moved, []);
});
test('existing configurations remain user-owned when generic defaults change', () => {
  const state = engine.DEFAULT_STATE(config(), '2026-10-27');
  state.config.semester = '我的原学期';
  state.config.courses = parse(importer.TEMPLATE).courses;
  const normalized = engine.normalizeState(state, defaults.create(engine, '2027-02-22'));
  assert.equal(normalized.config.semester, '我的原学期');
  assert.equal(normalized.config.firstMonday, '2026-10-26');
  assert.equal(normalized.config.courses.length, 2);
});
