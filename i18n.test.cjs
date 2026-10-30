const test=require('node:test'),assert=require('node:assert/strict');
const i18n=require('./i18n.js'),baseEngine=require('./engine.js'),defaults=require('./default-semester.js'),importer=require('./course-import.js');
test('language templates translate literals while preserving identical Chinese user content',()=>{
  const en=i18n.create('en'),zh=i18n.create('zh-CN');
  const user='课程设置 <img src=x onerror=alert(1)> 我的一周';
  assert.equal(en.html`完成 ${user}`,`Complete ${user}`);
  assert.equal(zh.html`完成 ${user}`,`完成 ${user}`);
  assert.equal(en.html`第 ${8} 教学周`,'Teaching week 8');
  en.setLocale('zh');assert.equal(en.t('我的一周'),'我的一周');
  assert.equal(zh.t('我的一周'),'我的一周');
});
test('English and Chinese engines keep the same user data and independent validation messages',()=>{
  const en=baseEngine.withLocale('en'),zh=baseEngine.withLocale('zh');
  const state=zh.DEFAULT_STATE(defaults.create(zh,'2026-10-27'),'2026-10-27');
  state.tasks.push({id:'task',title:'课程设置',duration:30,done:false,important:true,urgent:true,notes:'备注\n  [[我的一周]] https://example.com/中文',week:1});
  assert.deepEqual(en.normalizeState(state,state.config),zh.normalizeState(state,state.config));
  assert.throws(()=>en.parseTime('not-a-time'),error=>!/\p{Script=Han}/u.test(error.message));
  assert.throws(()=>zh.parseTime('not-a-time'),/时间/);
  const invalid={...state.config,weeks:0};
  assert.throws(()=>en.normalizeConfig(invalid),error=>/integer between/.test(error.message)&&!/[\u3400-\u9fff]/.test(error.message));
});
test('English CSV and spreadsheet imports support full weekdays, aliases, odd and even weeks',()=>{
  const en=baseEngine.withLocale('en'),settings=defaults.create(en,'2026-10-27','en'),imp=importer.withLocale('en');let id=0;
  const parsed=imp.parse('Class name,Weekday,Start time,End time,Teaching weeks,Location,Instructor\n课程设置,Monday,08:00,09:00,1-16(odd),教室,教师\nLab,tue.,10:00,11:00,1-16(even),A,',settings,en,()=>String(++id));
  assert.deepEqual(parsed.courses[0].weeks,[1,3,5,7,9,11,13,15]);
  assert.deepEqual(parsed.courses[1].weeks,[2,4,6,8,10,12,14,16]);
  assert.equal(parsed.courses[0].title,'课程设置');assert.equal(parsed.courses[1].day,1);
  assert.match(imp.TEMPLATE,/Class\tDay/);
  assert.throws(()=>imp.parse('Bad header\ninvalid',settings,en,()=>String(++id)),error=>!/[\u3400-\u9fff]/.test(error.message));
});
