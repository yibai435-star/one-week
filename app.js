(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./note-links.js'), require('./course-import.js'), require('./i18n.js'));
  else root.WeekPlannerApp = factory(root.WeekPlannerNoteLinks, root.WeekPlannerCourseImport, root.OneWeekI18n);
})(typeof globalThis === 'object' ? globalThis : this, function (noteLinks, courseImportBase, i18n) {
  'use strict';

  function mount(root, options) {
    const languageKey = "one-week:language";
    let savedLanguage;
    try { savedLanguage = root.ownerDocument.defaultView.localStorage.getItem(languageKey); } catch (_) {}
    const translations = i18n.create(savedLanguage || options.locale || "zh");
    const t = translations.t, h = translations.html;
    function setHtml(element, markup) {
      if (options.sanitizeHTML) { element.replaceChildren(options.sanitizeHTML(markup)); return; }
      // Standalone preview fallback. The plugin uses Obsidian's native sanitizer.
      const parsed = new root.ownerDocument.defaultView.DOMParser().parseFromString(markup, 'text/html');
      parsed.querySelectorAll('script,iframe,object,embed,link,meta,base,style').forEach(node => node.remove());
      for (const node of parsed.body.querySelectorAll('*')) {
        for (const attribute of [...node.attributes]) {
          if (/^on/i.test(attribute.name) || (['href','src','xlink:href'].includes(attribute.name) && /^\s*(?:javascript|vbscript|data):/i.test(attribute.value))) node.removeAttribute(attribute.name);
        }
      }
      element.replaceChildren(...parsed.body.childNodes);
    }
    let courseImport = courseImportBase.withLocale ? courseImportBase.withLocale(translations.locale) : courseImportBase;
  const getDays = () => [t('周一'), t('周二'), t('周三'), t('周四'), t('周五'), t('周六'), t('周日')];
  const escape = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const field = (label, control) => {
    const id = `wp-field-${uid()}`;
    return `<div class="wp-field"><label for="${id}">${label}</label>${control.replace(/<(input|select|textarea)\b/, `<$1 id="${id}"`)}</div>`;
  };
  const input = (name, value, type = 'text', attrs = '') => `<input name="${name}" type="${type}" value="${escape(value)}" ${attrs}>`;
  const iconPaths = {
    week: '<rect x="2" y="3" width="12" height="11" rx="2"/><path d="M5 2v3m6-3v3M2 7h12M6 7v7m4-7v7"/>',
    month: '<rect x="2" y="3" width="12" height="11" rx="2"/><path d="M5 2v3m6-3v3M2 7h12M5 10h.01M8 10h.01M11 10h.01"/>',
    matrix: '<rect x="2" y="2" width="12" height="12" rx="2"/><path d="M8 2v12M2 8h12"/>',
    settings: '<path d="M3 4h10M3 8h10M3 12h10"/><path d="M6 2v4m4 0v4m-5 0v4"/>',
    archive: '<path d="M3 6v8h10V6M6 9h4"/><rect x="2" y="2" width="12" height="4" rx="1"/>',
    sidebar: '<rect x="2" y="2" width="12" height="12" rx="2"/><path d="M10 2v12"/>',
    left: '<path d="m10 3-5 5 5 5"/>', right: '<path d="m6 3 5 5-5 5"/>',
    plus: '<path d="M8 3v10M3 8h10"/>', close: '<path d="m4 4 8 8M4 12l8-8"/>',
    undo: '<path d="m6 3-4 4 4 4M2 7h7a4 4 0 0 1 4 4v2"/>',
    grip: '<path d="M6 3h.01M10 3h.01M6 8h.01M10 8h.01M6 13h.01M10 13h.01"/>'
  };
  const icon = (name) => `<svg class="wp-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || ''}</svg>`;
  const flagIcon = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 14V2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M3 3c3-3 6 3 10 0v7c-4 3-7-3-10 0z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  const alarmIcon = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8.5" r="5"/><path d="M8 5.5v3l2 1.2M2 3.5l2-2M12 1.5l2 2M4.5 13l-1 1.5M11.5 13l1 1.5"/></svg>';
  const urgencyMark = (urgent) => urgent ? h`<span class="wp-urgency-indicator" title="紧急事项" aria-label="紧急事项">${alarmIcon}</span>` : '';
  const noteIcon = '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M3 2h10v12H3zM5.5 5h5M5.5 8h5M5.5 11h3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  const adjustmentBadge = (course) => course.adjusted ? t('<span class="wp-course-adjustment-badge" title="本次课程已调整" aria-label="本次课程已调整">调</span>') : '';
  const flagButton = (kind, id, important, title) => `<button type="button" class="wp-importance-toggle ${important ? 'is-important' : ''}" data-flag-${kind}="${escape(id)}" aria-pressed="${Boolean(important)}" aria-label="${important ? t('取消重要标记') : t('标为重要')}：${escape(title)}" title="${important ? t('取消重要标记') : t('标为重要')}">${flagIcon}</button>`;
  const taskMarkers = (task) => `<span class="wp-task-markers ${task.important || task.urgent ? 'has-priority' : ''}">${urgencyMark(task.urgent)}${flagButton('task', task.id, task.important, task.title)}</span>`;
  const notesContent = (notes) => notes ? noteLinks.renderLinkedText(notes) : t('<span class="wp-notes-placeholder">添加备注或链接…</span>');
  const notesField = (notes) => {
    const id = `wp-notes-${uid()}`, editing = !notes;
    return h`<div class="wp-field wp-notes-field" data-editing="${editing}"><div class="wp-notes-header"><label for="${id}" data-notes-label>备注</label><button type="button" data-notes-toggle aria-controls="${id} ${id}-preview" aria-label="${editing ? t('完成备注编辑') : t('编辑备注')}">${editing ? t('完成编辑') : t('编辑')}</button></div><textarea id="${id}" name="notes" rows="4" maxlength="10000" placeholder="补充地点、准备事项或粘贴链接…" ${editing ? '' : 'hidden'}>${escape(notes || '')}</textarea><div id="${id}-preview" class="wp-notes-preview" aria-label="备注内容" ${editing ? 'hidden' : ''}>${notesContent(notes)}</div></div>`;
  };
  const importanceField = (important) => h`<label class="wp-checkbox-row wp-important-field"><input type="checkbox" name="important" ${important ? 'checked' : ''}>${flagIcon}重要事项</label>`;
  const urgencyField = (urgent) => h`<label class="wp-checkbox-row wp-urgent-field"><input type="checkbox" name="urgent" ${urgent ? 'checked' : ''}>${alarmIcon}紧急事项</label>`;
  const getQuadrants = () => [
    { id: 'do', title: t('重要且紧急'), hint: t('优先处理'), important: true, urgent: true },
    { id: 'plan', title: t('重要不紧急'), hint: t('留出时间，持续推进'), important: true, urgent: false },
    { id: 'delegate', title: t('紧急不重要'), hint: t('集中处理，减少打断'), important: false, urgent: true },
    { id: 'later', title: t('不紧急不重要'), hint: t('有余力时再做'), important: false, urgent: false },
  ];

  const parseWeeks = (text, total) => courseImport.weeks(text, total);

  function weekText(weeks) {
    const parts = [];
    for (let i = 0; i < weeks.length; i++) {
      let last = weeks[i], start = last;
      while (weeks[i + 1] === last + 1) { i++; last = weeks[i]; }
      parts.push(start === last ? String(start) : `${start}-${last}`);
    }
    return parts.join(',');
  }


    let DAYS = getDays(), QUADRANTS = getQuadrants();
    let engine = options.engine.withLocale ? options.engine.withLocale(translations.locale) : options.engine;
    let state = engine.normalizeState(options.state, options.state.config);
    let saving = false, destroyed = false, drag = null, resize = null, status = '', statusKind = '';
    let suppressClickUntil = 0;
    let hourHeight = 52;
    const undoStack = [];
    const controller = new AbortController();
    const composingNotes = new WeakSet();
    const documentRef = root.ownerDocument;
    const windowRef = documentRef.defaultView;
    const preferencesKey = options.preferencesKey || 'baiyi-weekly-planner-preview-ui';
    let preferences = {};
    try { preferences = JSON.parse(windowRef.localStorage.getItem(preferencesKey) || '{}') || {}; } catch (_) { /* UI preferences are optional. */ }
    let density = preferences.density === 'comfortable' ? 'comfortable' : 'standard';
    let sidebarHidden = preferences.sidebarHidden === true;
    const sidebarId = `wp-sidebar-${uid()}`;
    const savePreferences = () => { try { windowRef.localStorage.setItem(preferencesKey, JSON.stringify({ view: viewMode, density, sidebarHidden })); } catch (_) { /* Optional UI preference storage. */ } };
    let viewMode = ['week', 'month', 'matrix'].includes(options.initialView || preferences.view) ? options.initialView || preferences.view : 'week';
    let monthCursor = engine.addDays(engine.getWeek(state.config, state.selectedWeek).monday, 3).slice(0, 7);
    let showCompleted = false;
    let pendingExternal = null;
    let selectionMode = false;
    const selectedTasks = new Set();
    const scrollPositions = {};
    const today = () => engine.formatDate(new Date());
    const taskById = (id) => state.tasks.find((task) => task.id === id);
    const courseDetail = (id) => state.courseDetails.find((detail) => detail.id === id) || { id, notes: '', important: false };
    const blockByTask = (id) => state.blocks.find((block) => block.taskId === id);
    const weekInfo = () => engine.getWeek(state.config, state.selectedWeek, state.courseDetails);
    const position = (minute) => (minute - state.config.dayStart) / 60 * hourHeight;
    const durationHeight = (minutes) => Math.max(10, minutes / 60 * hourHeight - 3);
    const intervalLabel = (block) => `${engine.formatTime(block.start)}-${engine.formatTime(block.end)}`;
    const on = (element, event, handler, opts = {}) => element.addEventListener(event, handler, { signal: controller.signal, ...opts });

    function switchView(view) {
      if (!['week', 'month', 'matrix'].includes(view) || drag || resize) return;
      if (view === 'month' && viewMode !== 'month') monthCursor = engine.addDays(weekInfo().monday, 3).slice(0, 7);
      viewMode = view;
      savePreferences();
      render();
    }

    function shiftMonth(month, direction) {
      const [year, number] = month.split('-').map(Number);
      const ordinal = year * 12 + number - 1 + direction;
      return `${String(Math.floor(ordinal / 12)).padStart(4, '0')}-${String(ordinal % 12 + 1).padStart(2, '0')}`;
    }

    function dateInSemester(date) {
      return date >= state.config.firstMonday && date <= engine.addDays(state.config.firstMonday, state.config.weeks * 7 - 1);
    }

    function coursesOn(date) {
      if (!dateInSemester(date)) return [];
      return engine.getWeek(state.config, engine.dateToWeek(state.config, date), state.courseDetails).courses.filter((course) => course.date === date);
    }

    function eventsOn(date, courses = coursesOn(date)) {
      return [...courses.map((course) => ({ ...course, course: true })), ...state.blocks.filter((block) => block.date === date).map((block) => ({ ...block, title: taskById(block.taskId).title, course: false }))].sort((a, b) => a.start - b.start);
    }

    function monthHtml() {
      const month = engine.getMonth(state.config, monthCursor, state.courseDetails);
      return `<div class="wp-month-scroll" data-surface="month"><div class="wp-month-calendar"><div class="wp-month-weekdays">${DAYS.map((day) => `<div>${day}</div>`).join('')}</div><div class="wp-month-grid">${month.days.map((day) => {
        const events = eventsOn(day.date, day.courses);
        return h`<div class="wp-month-day ${day.inMonth ? '' : 'is-outside'} ${day.inSemester ? '' : 'is-outside-semester'} ${day.date === today() ? 'is-today' : ''}" data-month-date="${day.date}" ${!day.inSemester ? 'aria-disabled="true"' : ''}><div class="wp-month-day-header"><button class="wp-month-date" data-open-date="${day.date}" ${!day.inSemester ? 'disabled' : ''} aria-label="查看 ${day.date}">${Number(day.date.slice(-2))}</button>${Number(day.date.slice(-2)) === 1 ? h`<small>${Number(day.date.slice(5, 7))} 月</small>` : ''}</div><div class="wp-month-events">${events.slice(0, 3).map((event) => {
          const detail = event.course ? courseDetail(event.id) : taskById(event.taskId);
          const label = `${event.title} · ${intervalLabel(event)}${event.course ? ` · ${event.room || t('未注明教室')}${courseAdjustmentLabel(event)}` : ''}${detail.urgent ? t(' · 紧急') : ''}${detail.important ? t(' · 重要') : ''}`;
          return `<button class="wp-month-event ${event.course ? 'wp-month-course' : 'wp-month-task'} ${event.course && event.adjusted ? 'is-adjusted' : ''} ${detail.done ? 'is-done' : ''}" ${event.course ? `data-course="${escape(event.id)}"` : `data-edit-task="${escape(event.taskId)}" data-drag-task="${escape(event.taskId)}" draggable="true"`} title="${escape(label)}" aria-label="${escape(label)}"><span class="wp-month-event-time">${engine.formatTime(event.start)}</span><span class="wp-month-event-title">${escape(event.title)}</span>${event.course ? adjustmentBadge(event) : urgencyMark(detail.urgent)}${detail.important ? h`<span class="wp-month-flag" aria-label="重要">${flagIcon}</span>` : ''}</button>`;
        }).join('')}${events.length > 3 ? h`<button class="wp-month-more" data-open-date="${day.date}">还有 ${events.length - 3} 项</button>` : ''}</div></div>`;
      }).join('')}</div></div></div>`;
    }

    function matrixHtml() {
      const tasks = engine.tasksForWeek(state, state.selectedWeek, { includeDone: showCompleted });
      return h`<div class="wp-matrix-heading"><div><strong>Eisenhower Matrix</strong><p>本周全部待办，包含已安排与未安排时间的事项。拖动卡片可调整紧急／重要分类。</p></div><label class="wp-show-completed"><input type="checkbox" data-show-completed ${showCompleted ? 'checked' : ''}>显示已完成</label></div><div class="wp-matrix-scroll" data-surface="matrix"><div class="wp-matrix-grid">${QUADRANTS.map((quadrant) => {
        const items = tasks.filter((task) => task.important === quadrant.important && task.urgent === quadrant.urgent);
        return `<section class="wp-quadrant" data-quadrant="${quadrant.id}" aria-label="${quadrant.title}"><header class="wp-quadrant-header"><h3>${quadrant.title}</h3><span>${items.length}</span></header><p class="wp-quadrant-hint">${quadrant.hint}</p><div class="wp-quadrant-tasks">${items.map((task) => {
          const block = blockByTask(task.id);
          return h`<div class="wp-matrix-card ${task.done ? 'is-done' : ''} ${task.important ? 'is-important' : ''}" data-drag-task="${escape(task.id)}" draggable="true"><input type="checkbox" data-done="${escape(task.id)}" aria-label="完成 ${escape(task.title)}" ${task.done ? 'checked' : ''}><div class="wp-matrix-card-body"><button class="wp-task-name" data-edit-task="${escape(task.id)}">${escape(task.title)}</button><span class="wp-task-time">${block ? `${block.date.slice(5)} ${intervalLabel(block)}` : h`未安排时间 · ${task.duration} 分钟`}</span>${task.notes ? `<p class="wp-matrix-notes">${noteLinks.renderLinkedText(task.notes)}</p>` : ''}</div>${taskMarkers(task)}</div>`;
        }).join('') || t('<div class="wp-quadrant-empty">拖入待办，或在事项中修改紧急／重要标记</div>')}</div></section>`;
      }).join('')}</div></div>`;
    }

    function notify(message, kind = '') {
      status = message; statusKind = kind;
      const bar = root.querySelector('.wp-statusbar');
      if (bar) { bar.textContent = message || (saving ? t('正在保存…') : t('已保存到本地')); bar.className = `wp-statusbar ${kind ? `is-${kind}` : ''}`; }
    }

    async function openNoteLink(link) {
      const href = link.dataset.href, kind = link.dataset.noteLink;
      try {
        if (kind === 'internal' && options.onOpenInternalLink) await options.onOpenInternalLink(href);
        else if (kind === 'external' && options.onOpenExternalLink) await options.onOpenExternalLink(href);
        else if (kind === 'internal') notify(t('请在 Obsidian 中打开内部笔记链接。'));
      } catch (error) { notify(h`链接未能打开：${error.message || error}`, 'error'); }
    }

    function applyExternalIfIdle() {
      if (!pendingExternal || destroyed || saving || drag || resize || root.querySelector('dialog[open]')) return false;
      const update = pendingExternal;
      pendingExternal = null;
      state = engine.normalizeState({ ...update.state, selectedWeek: Math.min(state.selectedWeek, update.state.config.weeks) }, update.state.config);
      undoStack.length = 0;
      update.onApplied?.();
      render();
      notify(t('已同步其它窗口的修改'), 'success');
      return true;
    }

    async function commit(change, message = t('已保存到本地'), errorBox, recordHistory = true) {
      if (pendingExternal) {
        const message = t('其它窗口已更新。请先关闭弹窗或结束拖动，待同步后重新编辑。');
        if (errorBox) errorBox.textContent = message;
        notify(message, 'error'); return false;
      }
      if (saving) { notify(t('正在保存，请稍候。')); return false; }
      let next;
      try { next = copy(state); change(next); next = engine.normalizeState(next, next.config); }
      catch (error) { if (errorBox) errorBox.textContent = error.message; notify(error.message, 'error'); return false; }
      saving = true; notify(t('正在保存…'));
      try {
        await options.onSave(copy(next));
        if (destroyed) return false;
        if (recordHistory && message && JSON.stringify(next) !== JSON.stringify(state)) {
          undoStack.push(copy(state)); if (undoStack.length > 10) undoStack.shift();
        }
        state = next; saving = false; status = message; statusKind = 'success'; render(); applyExternalIfIdle(); return true;
      } catch (error) {
        saving = false;
        const message = h`未保存：${error.message || error}。请重试。`;
        if (errorBox && errorBox.isConnected) errorBox.textContent = message;
        notify(message, 'error'); applyExternalIfIdle(); return false;
      }
    }

    async function undo() {
      if (!undoStack.length || saving || drag || resize || root.querySelector('dialog[open]')) return;
      const previous = copy(undoStack[undoStack.length - 1]);
      previous.selectedWeek = Math.min(state.selectedWeek, previous.config.weeks);
      if (await commit((next) => replaceState(next, previous), t('已撤销上一步'), undefined, false)) { undoStack.pop(); render(); }
    }

    function courseAdjustmentLabel(course) {
      if (!course.adjusted) return '';
      const original = course.original;
      return h` · 本次已调整${course.timeAdjusted ? h`；原时间 ${original.date} ${intervalLabel(original)}` : ''}${course.roomAdjusted ? h`；原教室 ${original.room || t('未注明')}` : ''}`;
    }

    function blockHtml(block, course) {
      const task = course ? null : taskById(block.taskId);
      const title = course ? block.title : task.title;
      const height = durationHeight(block.end - block.start);
      const detail = course ? courseDetail(block.id) : task;
      const labels = [title, block.date, intervalLabel(block), course ? block.room : t('可拖动、调整时长'), course ? courseAdjustmentLabel(block) : '', detail.important ? t('重要事项') : '', detail.urgent ? t('紧急事项') : '', detail.notes ? h`备注：${detail.notes.slice(0, 180)}` : ''];
      return `<div class="wp-block ${course ? `wp-course ${block.adjusted ? 'is-adjusted' : ''}` : `wp-task-block ${task.done ? 'is-done' : ''}`} ${detail.important ? 'is-important' : ''}" style="top:${position(block.start) + 2}px;height:${height}px" ${course ? `data-course="${escape(block.id)}" role="button" tabindex="0"` : `data-block="${escape(block.id)}" draggable="true" tabindex="0" role="button"`} aria-label="${escape(labels.filter(Boolean).join('，'))}" title="${escape(labels.filter(Boolean).join(' · '))}">
        <div class="wp-block-main"><div class="wp-block-title">${escape(title)}</div>${course ? adjustmentBadge(block) : ''}${detail.notes ? h`<span class="wp-note-indicator" title="有备注">${noteIcon}</span>` : ''}${course ? flagButton('course', block.id, detail.important, title) : taskMarkers(task)}</div><div class="wp-block-time">${intervalLabel(block)}</div>${course && block.room ? `<div class="wp-block-room">${escape(block.room)}</div>` : ''}
        ${course ? '' : h`<label class="wp-block-complete" data-complete-task="${escape(task.id)}" title="${task.done ? t('标为未完成') : t('标为已完成')}"><input class="wp-block-done" type="checkbox" data-done="${escape(task.id)}" ${task.done ? 'checked' : ''} aria-label="${task.done ? t('标为未完成') : t('完成')} ${escape(title)}"></label><div class="wp-resize-handle" data-resize="${escape(block.id)}" title="拖动调整时长"></div>`}
      </div>`;
    }

    function dayBlocksHtml(courses, blocks) {
      // At overview density, retain a 10px completion control. Short neighbours
      // get separate horizontal lanes when their minimum display heights overlap.
      const entries = [...courses.map(block => ({ block, course:true })), ...blocks.map(block => ({ block, course:false }))]
        .sort((a,b) => a.block.start - b.block.start || a.block.end - b.block.end);
      let group = [], ends = [], groupEnd = -Infinity;
      const output = [];
      const flush = () => {
        const lanes = ends.length;
        for (const item of group) {
          let html = blockHtml(item.block, item.course);
          if (lanes > 1) html = html.replace('style="', `style="left:calc(${item.lane * 100 / lanes}% + 4px);width:calc(${100 / lanes}% - 8px);right:auto;`);
          output.push(html);
        }
        group = []; ends = []; groupEnd = -Infinity;
      };
      for (const item of entries) {
        const top = position(item.block.start) + 2, bottom = top + durationHeight(item.block.end - item.block.start);
        if (top >= groupEnd) flush();
        let lane = ends.findIndex(end => end <= top);
        if (lane < 0) lane = ends.length;
        ends[lane] = bottom; groupEnd = Math.max(groupEnd, bottom);
        group.push({ ...item, lane });
      }
      flush(); return output.join('');
    }

    function render() {
      if (destroyed) return;
      const entry = root.querySelector('.wp-task-entry');
      const draft = entry ? { title:entry.elements.taskTitle.value, duration:entry.elements.duration.value } : null;
      const scroll = root.querySelector('[data-surface]');
      if (scroll) scrollPositions[scroll.dataset.surface] = { top: scroll.scrollTop, left: scroll.scrollLeft };
      const info = weekInfo(), config = state.config;
      const calendarHeight = (config.dayEnd - config.dayStart) / 60 * hourHeight;
      const scheduled = new Set(state.blocks.map((block) => block.taskId));
      const weeklyTasks = engine.tasksForWeek(state, state.selectedWeek);
      const pending = weeklyTasks.filter((task) => !task.done && !scheduled.has(task.id));
      const arranged = weeklyTasks.filter((task) => !task.done && scheduled.has(task.id));
      const completed = weeklyTasks.filter((task) => task.done);
      const selectableIds = new Set(weeklyTasks.filter((task) => !task.done).map((task) => task.id));
      for (const id of selectedTasks) if (!selectableIds.has(id)) selectedTasks.delete(id);
      const hours = [];
      for (let minute = config.dayStart; minute <= config.dayEnd; minute += 60) hours.push(`<div class="wp-time-label" style="top:${position(minute)}px">${engine.formatTime(minute)}</div>`);
      if ((config.dayEnd - config.dayStart) % 60) hours.push(`<div class="wp-time-label" style="top:${position(config.dayEnd)}px">${engine.formatTime(config.dayEnd)}</div>`);
      const days = info.dates.map((date, index) => {
        const courses = info.courses.filter((course) => course.date === date);
        const tasks = state.blocks.filter((block) => block.date === date);
        const now = new Date(), nowMinutes = now.getHours() * 60 + now.getMinutes();
        const nowLine = date === today() && nowMinutes >= config.dayStart && nowMinutes <= config.dayEnd ? `<div class="wp-now-line" style="top:${position(nowMinutes)}px"></div>` : '';
        return `<div class="wp-day ${index > 4 ? 'is-weekend' : ''}" data-date="${date}" style="height:${calendarHeight}px">${dayBlocksHtml(courses, tasks)}${nowLine}</div>`;
      }).join('');
      function taskRows(tasks) {
        return tasks.map((task) => { const block = blockByTask(task.id); return `<div class="wp-scheduled-row"><input type="checkbox" ${selectionMode && !task.done ? h`data-select-task="${escape(task.id)}" aria-label="选择 ${escape(task.title)}" ${selectedTasks.has(task.id) ? 'checked' : ''}` : h`data-done="${escape(task.id)}" aria-label="完成 ${escape(task.title)}" ${task.done ? 'checked' : ''}`}><span><span class="wp-task-heading"><button class="wp-task-name" data-edit-task="${escape(task.id)}">${escape(task.title)}</button>${taskMarkers(task)}</span><small>${block ? `${block.date.slice(5)} ${intervalLabel(block)}` : h`${task.duration} 分钟`}${task.notes ? t(' · 有备注') : ''}</small></span></div>`; }).join('');
      }
      const weekCalendar = `<div class="wp-calendar-scroll" data-surface="week"><div class="wp-calendar" style="--wp-hour-height:${hourHeight}px"><div class="wp-axis-corner"></div><div class="wp-day-headers">${info.dates.map((date, index) => `<div class="wp-day-header ${date === today() ? 'is-today' : ''}">${DAYS[index]} <span class="wp-date-number">${Number(date.slice(-2))}</span></div>`).join('')}</div><div class="wp-time-axis" style="height:${calendarHeight}px">${hours.join('')}</div><div class="wp-day-grid">${days}</div></div></div>`;
      const surface = viewMode === 'month' ? monthHtml() : viewMode === 'matrix' ? matrixHtml() : weekCalendar;
      const firstMonth = config.firstMonday.slice(0, 7), lastMonth = engine.addDays(config.firstMonday, config.weeks * 7 - 1).slice(0, 7);
      const previousDisabled = viewMode === 'month' ? monthCursor <= firstMonth : state.selectedWeek === 1;
      const nextDisabled = viewMode === 'month' ? monthCursor >= lastMonth : state.selectedWeek === config.weeks;
      const contextTitle = viewMode === 'month' ? h`${monthCursor.slice(0, 4)} 年 ${Number(monthCursor.slice(5))} 月` : h`第 ${state.selectedWeek} 教学周`;
      const contextDates = viewMode === 'month' ? t('整月课表与安排') : `${info.monday.replace(/-/g, '.')} - ${info.sunday.slice(5).replace('-', '.')}`;
      root.lang = translations.locale === 'zh' ? 'zh-CN' : 'en';
      setHtml(root, h`<div class="wp-shell">
        <header class="wp-topbar"><div class="wp-brand"><span class="wp-brand-icon">${icon('week')}</span><h1 class="wp-title">我的一周</h1></div><nav class="wp-view-switch" aria-label="切换视图">${[['week',t('周历')],['month',t('月历')],['matrix',t('四象限')]].map(([view, label]) => `<button data-view="${view}" aria-pressed="${viewMode === view}">${icon(view)}<span>${label}</span></button>`).join('')}</nav><div class="wp-top-actions"><select class="wp-language" data-language aria-label="Interface language"><option value="zh" ${translations.locale === 'zh' ? 'selected' : ''}>中文</option><option value="en" ${translations.locale === 'en' ? 'selected' : ''}>English</option></select><button data-action="toggle-sidebar" aria-expanded="${!sidebarHidden}" aria-controls="${sidebarId}" aria-label="${sidebarHidden ? t('显示') : t('隐藏')}本周待办" title="${sidebarHidden ? t('显示') : t('隐藏')}本周待办">${icon('sidebar')}<span>本周待办</span></button><button data-action="courses">${icon('settings')}<span>课程设置</span></button><button data-action="backup">${icon('archive')}<span>备份</span></button></div></header>
        ${!config.courses.length ? h`<div class="wp-welcome"><div><strong>把课表放好，开始规划这一周。</strong><p>先设置学期，再添加或导入课程。也可以直接在右侧记下待办。</p></div><button data-action="courses" class="wp-primary">设置我的课表</button></div>` : ''}
        <main class="wp-main ${sidebarHidden ? 'is-sidebar-hidden' : ''}"><section class="wp-calendar-panel" aria-label="${viewMode === 'month' ? t('月历') : viewMode === 'matrix' ? t('紧急重要四象限') : t('每周课表')}"><div class="wp-toolbar"><div class="wp-calendar-context"><span class="wp-week-label">${contextTitle}</span><span class="wp-date-range" title="${escape(config.semester)}">${contextDates}</span></div><div class="wp-calendar-controls">${viewMode === 'week' ? h`<select class="wp-density" data-density aria-label="时间轴显示密度"><option value="standard" ${density === 'standard' ? 'selected' : ''}>标准</option><option value="comfortable" ${density === 'comfortable' ? 'selected' : ''}>舒展</option></select>` : ''}<nav class="wp-nav" aria-label="切换${viewMode === 'month' ? t('月份') : t('教学周')}"><button data-action="previous" aria-label="上一${viewMode === 'month' ? t('月') : t('周')}" title="上一${viewMode === 'month' ? t('月') : t('周')}" ${previousDisabled ? 'disabled' : ''}>${icon('left')}</button><button data-action="current">本${viewMode === 'month' ? t('月') : t('周')}</button><button data-action="next" aria-label="下一${viewMode === 'month' ? t('月') : t('周')}" title="下一${viewMode === 'month' ? t('月') : t('周')}" ${nextDisabled ? 'disabled' : ''}>${icon('right')}</button></nav></div></div>
        ${surface}
        <div class="wp-legend">${viewMode === 'matrix' ? t('<span>仅个人待办 · 改分类不会改变已安排时间</span>') : h`<span><i class="wp-dot"></i>课程</span><span><i class="wp-dot task"></i>任务可拖动</span><span class="wp-adjustment-legend"><span class="wp-course-adjustment-badge" aria-hidden="true">调</span>本次课程有调整</span>${info.reminders.map((reminder) => h`<span class="wp-reminder" title="${escape(reminder.note)}">${escape(reminder.title)}：留意通知</span>`).join('')}`}</div></section>
        <aside id="${sidebarId}" class="wp-sidebar" aria-label="待办事项" ${sidebarHidden ? 'hidden' : ''}><div class="wp-sidebar-header">本周待办 <span class="wp-task-count" title="未完成事项">${pending.length + arranged.length}</span><select class="wp-sidebar-week" data-sidebar-week aria-label="待办所属教学周">${Array.from({ length: state.config.weeks }, (_, index) => index + 1).map((week) => h`<option value="${week}" ${week === state.selectedWeek ? 'selected' : ''}>${h`第 ${week} 周`}</option>`).join('')}</select></div><form class="wp-task-entry"><div class="wp-task-entry-line"><input name="taskTitle" placeholder="要做什么？" maxlength="240" required aria-label="新待办名称"><button type="submit" aria-label="添加待办">${icon('plus')}</button></div><div class="wp-duration-row"><span>预计时长</span><select name="duration" aria-label="新待办预计时长">${[15,30,45,60,90,120,180].map((duration) => h`<option value="${duration}" ${duration === 60 ? 'selected' : ''}>${duration} 分钟</option>`).join('')}</select></div></form>
        <div class="wp-sidebar-tools"><button data-action="routines">常规日程</button><button data-action="apply-routines" ${!state.routines.length ? 'disabled' : ''}>加入本周</button><button data-action="select-tasks" aria-pressed="${selectionMode}">${selectionMode ? t('取消选择') : t('选择')}</button></div>
        ${selectionMode ? h`<div class="wp-selection-bar"><button data-action="select-all">${selectedTasks.size === selectableIds.size && selectableIds.size ? t('取消全选') : t('全选')}</button><span>已选 ${selectedTasks.size} 项</span><button data-action="postpone-selected" ${!selectedTasks.size || state.selectedWeek === state.config.weeks ? 'disabled' : ''}>顺延下周</button></div>` : ''}
        <div class="wp-backlog">${pending.map((task) => h`<div class="wp-task-card ${task.important ? 'is-important' : ''} ${selectedTasks.has(task.id) ? 'is-selected' : ''}" data-drag-task="${escape(task.id)}" draggable="${!selectionMode}">${selectionMode ? h`<input class="wp-task-select" type="checkbox" data-select-task="${escape(task.id)}" aria-label="选择 ${escape(task.title)}" ${selectedTasks.has(task.id) ? 'checked' : ''}>` : h`<input class="wp-task-done" type="checkbox" data-done="${escape(task.id)}" aria-label="完成 ${escape(task.title)}">`}<div><div class="wp-task-heading"><button type="button" class="wp-task-name" data-edit-task="${escape(task.id)}">${escape(task.title)}</button>${taskMarkers(task)}</div><div class="wp-task-meta"><span>${task.duration} 分钟${task.notes ? t(' · 有备注') : ''}</span><span class="wp-task-actions"><button type="button" class="wp-inline-action" data-schedule-task="${escape(task.id)}">安排时间</button><button type="button" class="wp-inline-action wp-inline-delete" data-quick-delete-task="${escape(task.id)}" aria-label="删除 ${escape(task.title)}">删除</button></span></div></div></div>`).join('') || `<div class="wp-empty"><strong>${weeklyTasks.length ? t('待安排清单已清空') : t('这一周，想做些什么？')}</strong><span>${weeklyTasks.length ? t('已安排和已完成的事项在下方。') : t('从一件小事开始，<br>再把它放进课表的空档。')}</span></div>`}</div>
        <div class="wp-sidebar-bottom"><span>${viewMode === 'matrix' ? t('拖进四象限分类；点击名称编辑同一事项。') : viewMode === 'month' ? t('拖到日期安排；未安排的待办按所属周保留。') : t('拖进空档安排；拖回这里取消安排。')}</span>${arranged.length ? h`<details ${selectionMode ? 'open' : ''}><summary>已安排 ${arranged.length}</summary>${taskRows(arranged)}</details>` : ''}${completed.length && !selectionMode ? h`<details><summary>已完成 ${completed.length}</summary>${taskRows(completed)}</details>` : ''}<p class="wp-routine-summary">周结束后，未完成事项会自动顺延。</p></div></aside></main>
        <div class="wp-feedback"><div class="wp-statusbar ${statusKind ? `is-${statusKind}` : ''}" role="status" aria-live="polite">${escape(status || t('安排会自动保存到本地'))}</div><button class="wp-undo" data-action="undo" ${!undoStack.length || saving ? 'disabled' : ''} title="撤销本窗口最近一次修改（Ctrl / ⌘ Z）">${icon('undo')}撤销</button></div></div>`);
      const newScroll = root.querySelector('[data-surface]'), scrollPosition = scrollPositions[viewMode] || { top: 0, left: 0 };
      if (newScroll) { newScroll.scrollTop = scrollPosition.top; newScroll.scrollLeft = scrollPosition.left; }
      if (draft) { const nextEntry = root.querySelector('.wp-task-entry'); nextEntry.elements.taskTitle.value = draft.title; nextEntry.elements.duration.value = draft.duration; }
      fitGrid();
      fitBlocks();
    }

    function fitBlock(element) {
      element.classList.remove('is-compact', 'is-title-only', 'is-micro', 'has-two-lines', 'has-three-lines');
      const title = element.querySelector('.wp-block-title'), room = element.querySelector('.wp-block-room');
      if (room) room.hidden = true;
      // Measure rendered text after fonts and column widths have been applied.
      // Keep the actual event height: short events must not cover their neighbours.
      const height = element.clientHeight;
      const availableLines = Math.floor((height - 12 - 17) / 15);
      if (availableLines >= 1) {
        const lines = Math.max(1, Math.min(3, availableLines, Math.ceil(title.scrollHeight / 15)));
        if (lines === 2) element.classList.add('has-two-lines');
        if (lines === 3) element.classList.add('has-three-lines');
        if (room && height >= 12 + lines * 15 + 17 + 17) room.hidden = false;
      } else {
        element.classList.add('is-compact');
        if (height < 18) element.classList.add('is-title-only', 'is-micro');
        else if (title.scrollWidth > title.clientWidth) element.classList.add('is-title-only');
      }
    }

    function fitBlocks() {
      if (!destroyed) root.querySelectorAll('.wp-block').forEach(fitBlock);
    }

    function fitGrid() {
      if (destroyed || drag || resize || root.querySelector('dialog[open]')) return;
      const scroller = root.querySelector('.wp-calendar-scroll');
      if (!scroller || scroller.clientHeight < 80) return;
      const headerHeight = root.querySelector('.wp-day-headers')?.offsetHeight || 38;
      const visibleHours = Math.min(density === 'comfortable' ? 9 : 12, (state.config.dayEnd - state.config.dayStart) / 60);
      const scaledHeight = (scroller.clientHeight - headerHeight - 14) / visibleHours;
      const nextHeight = Math.max(12, density === 'comfortable' ? scaledHeight : Math.min(64, scaledHeight));
      if (Math.abs(nextHeight - hourHeight) < 0.05) { fitBlocks(); return; }
      hourHeight = nextHeight;
      render();
    }

    function dialog(title, body, footer, wide = false) {
      if (destroyed || !root.isConnected) throw new Error(t('日程视图已经关闭。'));
      root.querySelector('.wp-dialog')?.remove();
      const element = documentRef.createElement('dialog');
      element.className = `wp-dialog ${wide ? 'wide' : ''}`;
      element.setAttribute('aria-label', title);
      setHtml(element, h`<form><div class="wp-dialog-header"><h2>${escape(title)}</h2><button type="button" class="wp-dialog-close" aria-label="关闭">${icon('close')}</button></div><div class="wp-dialog-body">${body}<div class="wp-form-error" role="alert"></div></div><div class="wp-dialog-footer">${footer}</div></form>`);
      root.appendChild(element); element.showModal();
      element.querySelector('.wp-dialog-close').onclick = () => element.close();
      element.querySelectorAll('[data-cancel]').forEach((button) => { button.onclick = () => element.close(); });
      element.addEventListener('close', () => { element.remove(); applyExternalIfIdle(); fitGrid(); }, { once: true });
      return element;
    }

    function firstFreeSlot(task) {
      const info = engine.getWeek(state.config, task.week || state.selectedWeek);
      const current = info.dates.includes(today()) ? today() : info.monday;
      const dates = [current, ...info.dates.filter((date) => date !== current)];
      for (const date of dates) for (let start = state.config.dayStart; start + task.duration <= state.config.dayEnd; start += 5) {
        const candidate = { ...(taskById(task.id) ? { taskId: task.id } : {}), date, start, end: start + task.duration };
        if (engine.validatePlacement(state, state.config, candidate).ok) return candidate;
      }
      return { date: current, start: state.config.dayStart, end: state.config.dayStart + task.duration };
    }

    function firstFreeOn(date, task) {
      const block = task ? blockByTask(task.id) : null;
      const duration = task ? task.duration : 60;
      for (let start = state.config.dayStart; start + duration <= state.config.dayEnd; start += 5) {
        const candidate = { ...(task ? { taskId: task.id } : {}), date, start, end: start + duration };
        if (engine.validatePlacement(state, state.config, candidate, { ignoreBlockId: block?.id }).ok) return candidate;
      }
      return { date, start: state.config.dayStart, end: state.config.dayStart + duration };
    }

    function openDate(date) {
      if (!dateInSemester(date)) return;
      const events = eventsOn(date);
      const element = dialog(`${date} · ${DAYS[(engine.parseDate(date).getDay() + 6) % 7]}`, events.map((event) => `<div class="wp-course-rule"><div class="wp-course-rule-info"><button class="wp-task-name" ${event.course ? `data-course="${escape(event.id)}"` : `data-edit-task="${escape(event.taskId)}"`}>${escape(event.title)}${event.course ? adjustmentBadge(event) : urgencyMark(taskById(event.taskId).urgent)}</button><div class="wp-course-rule-sub">${intervalLabel(event)}${event.course ? ` · ${escape(event.room)}${escape(courseAdjustmentLabel(event))}` : ''}</div></div></div>`).join('') || t('<p class="wp-form-hint">这一天还没有课程或安排。</p>'), h`<button type="button" data-open-week="${date}">查看这一周</button><button type="button" data-new-on-date="${date}" class="wp-primary">添加安排</button>`);
      element.querySelector('[data-new-on-date]').onclick = () => openTaskEditor(null, true, firstFreeOn(date));
    }

    function replaceState(target, value) {
      Object.keys(target).forEach((key) => delete target[key]);
      Object.assign(target, copy(value));
    }

    function moveMessage(result) {
      return h`已将 ${result.moved.length} 项顺延到下周待办，请重新安排时间`;
    }

    function openPostpone(taskIds) {
      let preview;
      try { preview = engine.postponeTasks(state, taskIds); }
      catch (error) { notify(error.message, 'error'); return; }
      const element = dialog(t('顺延下周'), t('<p class="wp-form-hint">移到下周待办并清除原时间安排，之后由你重新安排。事项名称、预计时长、备注和重要／紧急标记都会保留。</p><div class="wp-rollover-summary">') + preview.moved.map((item) => {
        return h`<div class="wp-rollover-item"><strong>${escape(taskById(item.id).title)}</strong><span>第 ${item.fromWeek} 周 → 第 ${item.toWeek} 周</span><small>放入下周待办，暂不安排时间</small></div>`;
      }).join('') + '</div>', t('<button type="button" data-cancel>取消</button><button type="submit" class="wp-primary">顺延并查看下周待办</button>'));
      element.querySelector('form').onsubmit = async (event) => {
        event.preventDefault();
        let moved;
        if (await commit((next) => {
          moved = engine.postponeTasks(next, taskIds);
          replaceState(next, moved.state);
          next.selectedWeek = moved.moved[0].toWeek;
        }, moveMessage(preview), element.querySelector('.wp-form-error'))) {
          selectionMode = false; selectedTasks.clear();
          monthCursor = engine.addDays(weekInfo().monday, 3).slice(0, 7);
          render(); element.close();
        }
      };
    }

    function routineDescription(routine) {
      return routine.slots.length ? routine.slots.map((slot) => `${DAYS[slot.day]} ${engine.formatTime(slot.start)}`).join('、') : t('每周一个未安排时间的待办');
    }

    async function applyRoutineSelection(routineIds, week = state.selectedWeek, errorBox) {
      let preview;
      try { preview = engine.applyRoutines(state, week, routineIds); }
      catch (error) { if (errorBox) errorBox.textContent = error.message; notify(error.message, 'error'); return false; }
      if (!preview.added.length) {
        const message = t('这些常规日程已经加入这一周，不会重复添加。');
        if (JSON.stringify(preview.state.routineApplications) !== JSON.stringify(state.routineApplications)) {
          await commit((next) => replaceState(next, engine.applyRoutines(next, week, routineIds).state), message, errorBox);
        }
        if (errorBox) errorBox.textContent = message;
        notify(message); return false;
      }
      const conflicts = preview.unscheduled.filter((id) => {
        const task = preview.state.tasks.find((item) => item.id === id);
        return state.routines.some((routine) => routine.id === task?.routineId && routine.slots.length);
      });
      const message = h`已加入 ${preview.added.length} 项常规日程${conflicts.length ? h`；${conflicts.length} 项时段冲突，已放入待办` : ''}`;
      return commit((next) => {
        const result = engine.applyRoutines(next, week, routineIds);
        replaceState(next, result.state); next.selectedWeek = week;
      }, message, errorBox);
    }

    function openRoutines() {
      const element = dialog(t('常规日程'), t('<p class="wp-form-hint">保存经常做的事，准备新一周时一键加入。模板的修改用于以后加入的事项，已经生成的日程可单独调整。</p>') +
        field(t('加入哪一周'), h`<select name="routineWeek" aria-label="常规日程目标教学周">${Array.from({ length: state.config.weeks }, (_, index) => index + 1).map((week) => h`<option value="${week}" ${week === state.selectedWeek ? 'selected' : ''}>第 ${week} 教学周</option>`).join('')}</select>`) +
        `<div class="wp-routine-list">${state.routines.map((routine) => h`<div class="wp-routine-row"><input type="checkbox" data-routine-select="${escape(routine.id)}" checked aria-label="选择 ${escape(routine.title)}"><div class="wp-routine-info"><strong>${escape(routine.title)}</strong><small>${routine.duration} 分钟 · ${escape(routineDescription(routine))}</small></div><button type="button" data-edit-routine="${escape(routine.id)}">编辑</button><button type="button" data-delete-routine="${escape(routine.id)}" aria-label="删除常规模板 ${escape(routine.title)}">删除</button></div>`).join('') || t('<div class="wp-routine-empty">还没有常规日程。可以新建，也可以把已有事项存为常规。</div>')}</div>`,
        h`<div class="wp-secondary-actions"><button type="button" data-new-routine>新建常规</button></div><button type="button" data-cancel>关闭</button><button type="submit" class="wp-primary" ${!state.routines.length ? 'disabled' : ''}>加入所选周</button>`, true);
      element.querySelector('[data-new-routine]').onclick = () => openRoutineEditor();
      element.querySelectorAll('[data-edit-routine]').forEach((button) => { button.onclick = () => openRoutineEditor(button.dataset.editRoutine); });
      element.querySelectorAll('[data-delete-routine]').forEach((button) => { button.onclick = async () => {
        const routine = state.routines.find((item) => item.id === button.dataset.deleteRoutine);
        if (!windowRef.confirm(h`删除“${routine.title}”这个常规模板？已经生成的事项会保留。`)) return;
        if (await commit((next) => { next.routines = next.routines.filter((item) => item.id !== routine.id); }, t('常规模板已删除，已有事项保留'), element.querySelector('.wp-form-error'))) openRoutines();
      }; });
      element.querySelector('form').onsubmit = async (event) => {
        event.preventDefault();
        const ids = [...element.querySelectorAll('[data-routine-select]:checked')].map((input) => input.dataset.routineSelect);
        const errorBox = element.querySelector('.wp-form-error');
        if (!ids.length) { errorBox.textContent = t('请先选择要加入的常规日程。'); return; }
        const week = Number(element.querySelector('[name="routineWeek"]').value);
        if (await applyRoutineSelection(ids, week, errorBox)) { monthCursor = engine.addDays(weekInfo().monday, 3).slice(0, 7); render(); element.close(); }
      };
    }

    function openRoutineEditor(routineId) {
      const existing = state.routines.find((item) => item.id === routineId);
      const routine = existing || { id: uid(), title: '', duration: 60, notes: '', important: false, urgent: false, slots: [] };
      const slotRow = (slot) => h`<div class="wp-routine-time-row" data-routine-slot>${field(t('星期'), h`<select data-slot-day aria-label="常规日程星期">${DAYS.map((day, index) => `<option value="${index}" ${index === slot.day ? 'selected' : ''}>${day}</option>`).join('')}</select>`)}${field(t('开始时间'), h`<input type="time" data-slot-start step="60" value="${engine.formatTime(slot.start)}" aria-label="常规日程开始时间">`)}<button type="button" data-remove-slot aria-label="删除固定时段">移除</button></div>`;
      const element = dialog(existing ? t('编辑常规日程') : t('新建常规日程'),
        field(t('事项'), input('title', routine.title, 'text', t('required maxlength="240" aria-label="常规事项名称"'))) +
        field(t('预计时长（分钟）'), input('duration', routine.duration, 'number', t('required min="15" max="840" aria-label="常规事项预计时长"'))) +
        h`<label class="wp-checkbox-row"><input type="checkbox" name="fixed" ${routine.slots.length ? 'checked' : ''}>每周固定星期与时间</label><div class="wp-routine-slot-editor" ${routine.slots.length ? '' : 'hidden'}><div data-slot-list>${routine.slots.map(slotRow).join('')}</div><button type="button" data-add-slot>添加固定时段</button></div>` +
        `<div class="wp-priority-fields">${importanceField(routine.important)}${urgencyField(routine.urgent)}</div>` + notesField(routine.notes) +
        t('<p class="wp-form-hint">没有固定时间时，每周加入一条待办。有固定时间时，每个时段生成一条日程；与课程或已有安排冲突时先放入待办。</p>'),
        t('<button type="button" data-cancel>取消</button><button type="submit" class="wp-primary">保存常规</button>'));
      const form = element.querySelector('form'), list = element.querySelector('[data-slot-list]');
      const addSlot = () => {
        const start = Math.max(state.config.dayStart, Math.min(1080, state.config.dayEnd - 60));
        list.insertAdjacentHTML('beforeend', slotRow({ day: 0, start }));
      };
      form.elements.fixed.onchange = () => { element.querySelector('.wp-routine-slot-editor').hidden = !form.elements.fixed.checked; if (form.elements.fixed.checked && !list.children.length) addSlot(); };
      element.querySelector('[data-add-slot]').onclick = addSlot;
      list.onclick = (event) => { const remove = event.target.closest('[data-remove-slot]'); if (remove) remove.closest('[data-routine-slot]').remove(); };
      form.onsubmit = async (event) => {
        event.preventDefault();
        const errorBox = element.querySelector('.wp-form-error');
        try {
          const slots = form.elements.fixed.checked ? [...list.querySelectorAll('[data-routine-slot]')].map((row) => ({ day: Number(row.querySelector('[data-slot-day]').value), start: engine.parseTime(row.querySelector('[data-slot-start]').value) })) : [];
          if (form.elements.fixed.checked && !slots.length) throw new Error(t('请添加至少一个固定时段，或取消固定时间。'));
          const edited = { id: routine.id, title: form.elements.title.value.trim(), duration: Number(form.elements.duration.value), notes: form.elements.notes.value, important: form.elements.important.checked, urgent: form.elements.urgent.checked, slots };
          if (await commit((next) => { next.routines = next.routines.filter((item) => item.id !== edited.id); next.routines.push(edited); }, t('常规日程已保存'), errorBox)) openRoutines();
        } catch (error) { errorBox.textContent = error.message; }
      };
    }

    function openTaskEditor(taskId, scheduling = false, selectedSlot) {
      const task = taskId ? taskById(taskId) : null;
      const block = task ? blockByTask(taskId) : null;
      const defaultTask = task || { title: '', duration: 60, done: false, important: false, urgent: false, notes: '', week: state.selectedWeek };
      const slot = selectedSlot || block || (task ? firstFreeSlot(task) : { date: weekInfo().monday, start: 840, end: 900 });
      const isScheduled = Boolean(block || scheduling || selectedSlot);
      const element = dialog(task ? t('编辑事项') : t('添加安排'),
        field(t('事项'), input('title', defaultTask.title, 'text', t('required maxlength="240" autofocus aria-label="事项名称"'))) +
        field(t('所属周'), h`<select name="taskWeek" aria-label="事项所属教学周" ${isScheduled ? 'disabled' : ''}>${Array.from({ length: state.config.weeks }, (_, index) => index + 1).map((week) => h`<option value="${week}" ${week === (isScheduled ? engine.dateToWeek(state.config, slot.date) : defaultTask.week) ? 'selected' : ''}>第 ${week} 教学周 · ${engine.getWeek(state.config, week).monday.slice(5).replace('-', '/')}</option>`).join('')}</select>`) +
        `<div class="wp-field-row">${field(t('预计时长（分钟）'), input('duration', defaultTask.duration, 'number', t('required min="15" max="840" aria-label="预计时长"')))}${field(t('安排'), h`<select name="scheduled" aria-label="是否安排时间"><option value="no" ${!isScheduled ? 'selected' : ''}>先放待办清单</option><option value="yes" ${isScheduled ? 'selected' : ''}>安排具体时间</option></select>`)}</div>` +
        `<div class="wp-schedule-fields" ${!isScheduled ? 'hidden' : ''}><div class="wp-field">${field(t('日期'), input('date', slot.date, 'date', h`min="${state.config.firstMonday}" max="${engine.addDays(state.config.firstMonday, state.config.weeks * 7 - 1)}" aria-label="安排日期"`))}</div><div class="wp-field-row">${field(t('开始'), input('start', engine.formatTime(slot.start), 'time', t('step="60" aria-label="开始时间"')))}${field(t('结束'), input('end', engine.formatTime(slot.end), 'time', t('step="60" aria-label="结束时间"')))}</div></div>` +
        `<div class="wp-priority-fields">${importanceField(defaultTask.important)}${urgencyField(defaultTask.urgent)}</div>` + notesField(defaultTask.notes) +
        h`<label class="wp-checkbox-row"><input type="checkbox" name="done" ${defaultTask.done ? 'checked' : ''}>已完成</label>`,
        h`${task ? h`<div class="wp-secondary-actions"><button type="button" class="wp-danger" data-delete-task>删除事项</button><button type="button" data-postpone-task ${task.done || task.week >= state.config.weeks ? 'disabled' : ''}>顺延下周</button><button type="button" data-task-to-routine>${task.routineId && state.routines.some((item) => item.id === task.routineId) ? t('编辑常规') : t('存为常规')}</button></div>` : ''}<button type="button" data-cancel>取消</button><button type="submit" class="wp-primary">保存</button>`);
      const form = element.querySelector('form'), errorBox = element.querySelector('.wp-form-error');
      const syncSchedule = () => {
        const scheduled = form.elements.scheduled.value === 'yes';
        element.querySelector('.wp-schedule-fields').hidden = !scheduled;
        form.elements.taskWeek.disabled = scheduled;
        if (scheduled && form.elements.date.value) form.elements.taskWeek.value = engine.dateToWeek(state.config, form.elements.date.value);
      };
      form.elements.scheduled.onchange = syncSchedule;
      form.elements.date.onchange = syncSchedule;
      form.elements.taskWeek.onchange = () => {
        if (form.elements.scheduled.value === 'no') {
          const available = firstFreeSlot({ ...defaultTask, id: taskId || '', week: Number(form.elements.taskWeek.value) });
          form.elements.date.value = available.date;
          form.elements.start.value = engine.formatTime(available.start);
          form.elements.end.value = engine.formatTime(available.end);
        }
      };
      form.elements.duration.onchange = () => {
        if (form.elements.scheduled.value !== 'yes' || !form.elements.start.value) return;
        try {
          const end = engine.parseTime(form.elements.start.value) + Number(form.elements.duration.value);
          if (end <= 1439 && end > 0) form.elements.end.value = engine.formatTime(end);
        } catch (_) { /* The submit handler reports invalid input. */ }
      };
      const saveEditedTask = async (action = 'save') => {
        if (action === 'postpone') {
          if (!form.elements.title.reportValidity() || !form.elements.duration.reportValidity()) return;
        } else if (!form.reportValidity()) return;
        const id = task ? task.id : uid();
        try {
          const editedTask = { ...defaultTask, id, title: form.elements.title.value.trim(), duration: Number(form.elements.duration.value), done: form.elements.done.checked, important: form.elements.important.checked, urgent: form.elements.urgent.checked, notes: form.elements.notes.value, week: Number(form.elements.taskWeek.value) };
          let arrangedBlock = null;
          if (form.elements.scheduled.value === 'yes' && action !== 'postpone') {
            arrangedBlock = { id: block ? block.id : uid(), taskId: id, date: form.elements.date.value, start: engine.parseTime(form.elements.start.value), end: engine.parseTime(form.elements.end.value) };
            editedTask.duration = arrangedBlock.end - arrangedBlock.start;
            editedTask.week = engine.dateToWeek(state.config, arrangedBlock.date);
          }
          let moved, routineId;
          const success = await commit((next) => {
            next.tasks = next.tasks.filter((item) => item.id !== id); next.tasks.push(editedTask);
            next.blocks = next.blocks.filter((item) => item.taskId !== id); if (arrangedBlock) next.blocks.push(arrangedBlock);
            if (action === 'postpone') {
              moved = engine.postponeTasks(next, [id]);
              replaceState(next, moved.state); next.selectedWeek = moved.moved[0].toWeek;
            } else if (action === 'routine') {
              const linked = next.routines.find((item) => item.id === editedTask.routineId);
              routineId = linked?.id || uid();
              if (!linked) {
                const slots = arrangedBlock ? [{ day: (engine.parseDate(arrangedBlock.date).getDay() + 6) % 7, start: arrangedBlock.start }] : [];
                next.routines.push({ id: routineId, title: editedTask.title, duration: editedTask.duration, notes: editedTask.notes, important: editedTask.important, urgent: editedTask.urgent, slots });
                editedTask.routineId = routineId; editedTask.routineWeek = editedTask.week;
                next.routineApplications.push({ routineId, week: editedTask.week, taskIds: [editedTask.id] });
              }
            }
          }, action === 'routine' ? t('事项已保存为常规日程') : action === 'postpone' ? t('事项已移入下周待办') : t('事项已保存'), errorBox);
          if (success) {
            element.close();
            if (action === 'postpone') { monthCursor = engine.addDays(weekInfo().monday, 3).slice(0, 7); render(); notify(moveMessage(moved), 'success'); }
            if (action === 'routine') openRoutineEditor(routineId);
          }
        } catch (error) { errorBox.textContent = error.message; }
      };
      form.onsubmit = (event) => { event.preventDefault(); void saveEditedTask(); };
      element.querySelector('[data-postpone-task]')?.addEventListener('click', () => { void saveEditedTask('postpone'); });
      element.querySelector('[data-task-to-routine]')?.addEventListener('click', () => { void saveEditedTask('routine'); });
      const deleteButton = element.querySelector('[data-delete-task]');
      if (deleteButton) deleteButton.onclick = () => { void deleteTask(task.id, errorBox); };
    }

    async function deleteTask(taskId, errorBox) {
      const task = taskById(taskId);
      if (!task || !windowRef.confirm(h`删除“${task.title}”及它的安排？`)) return false;
      return commit((next) => {
        next.tasks = next.tasks.filter((item) => item.id !== taskId);
        next.blocks = next.blocks.filter((item) => item.taskId !== taskId);
      }, t('事项已删除'), errorBox);
    }

    function showCourse(courseId) {
      const course = engine.getCourseOccurrence(state.config, courseId, state.courseDetails);
      if (!course) return;
      const detail = courseDetail(courseId), original = course.original || course;
      const minDate = state.config.firstMonday, maxDate = engine.addDays(minDate, state.config.weeks * 7 - 1);
      const element = dialog(course.title,
        h`<div class="wp-detail-row wp-course-detail-row"><span>时间</span><div class="wp-course-detail-value"><div class="wp-course-current"><div data-course-time-display></div><button type="button" data-adjust-course-time aria-expanded="false">调整</button></div><small class="wp-course-original" data-course-original-time hidden>原：${original.date} ${DAYS[original.day]} ${intervalLabel(original)}${original.firstPeriod ? h` · 第 ${original.firstPeriod}-${original.lastPeriod} 节` : ''}</small><div class="wp-course-adjust-fields" data-course-time-fields hidden>${field(t('日期'), input('courseDate', course.date, 'date', `required disabled min="${minDate}" max="${maxDate}"`))}<div class="wp-field-row">${field(t('开始时间'), input('courseStart', engine.formatTime(course.start), 'time', 'required disabled step="60"'))}${field(t('结束时间'), input('courseEnd', engine.formatTime(course.end), 'time', 'required disabled step="60"'))}</div><button type="button" data-reset-course-time>恢复原时间</button></div></div></div>` +
        h`<div class="wp-detail-row wp-course-detail-row"><span>教室</span><div class="wp-course-detail-value"><div class="wp-course-current"><div data-course-room-display></div><button type="button" data-adjust-course-room aria-expanded="false">调整</button></div><small class="wp-course-original" data-course-original-room hidden>原：${escape(original.room || t('未注明'))}</small><div class="wp-course-adjust-fields" data-course-room-fields hidden>${field(t('本次教室'), input('courseRoom', course.room, 'text', t('disabled maxlength="300" placeholder="填写本次上课地点"')))}<button type="button" data-reset-course-room>恢复原教室</button></div></div></div>` +
        h`<div class="wp-detail-row"><span>教师</span><span>${escape(course.teacher || t('未注明'))}</span></div>` + importanceField(detail.important) + notesField(detail.notes) + t('<p class="wp-form-hint">调整、备注和标记仅用于本次课程，其它周仍按原课表上课。</p>'),
        t('<button type="button" data-cancel>取消</button><button type="submit" class="wp-primary">保存</button>'));
      const form = element.querySelector('form'), errorBox = element.querySelector('.wp-form-error');
      element.querySelector('[data-adjust-course-time]').setAttribute('aria-label', t('调整本次上课时间'));
      element.querySelector('[data-adjust-course-room]').setAttribute('aria-label', t('调整本次教室'));
      let courseDuration = course.end - course.start;
      let lastCourseStart = form.elements.courseStart.value;
      const overflowMessage = t('按当前课时推算会跨日，请提前开始时间或手动填写结束时间。');
      form.elements.courseEnd.title = t('修改开始时间时按课时自动推算，也可手动修改');
      const syncDraft = () => {
        const date = form.elements.courseDate.value, start = form.elements.courseStart.value, end = form.elements.courseEnd.value;
        const sameTime = date === original.date && start === engine.formatTime(original.start) && end === engine.formatTime(original.end);
        let day = '';
        try { day = DAYS[(engine.parseDate(date).getDay() + 6) % 7]; } catch (_) { /* Invalid drafts are reported on save. */ }
        setHtml(element.querySelector('[data-course-time-display]'), `${escape(date || t('请选择日期'))} ${day}<br>${escape(start || '--:--')}-${escape(end || '--:--')}${sameTime && original.firstPeriod ? h` · 第 ${original.firstPeriod}-${original.lastPeriod} 节` : ''}`);
        element.querySelector('[data-course-room-display]').textContent = form.elements.courseRoom.value.trim() || t('未注明');
        element.querySelector('[data-course-original-time]').hidden = sameTime;
        element.querySelector('[data-course-original-room]').hidden = form.elements.courseRoom.value.trim() === original.room;
      };
      const toggleFields = (kind, open) => {
        const fields = element.querySelector(`[data-course-${kind}-fields]`), button = element.querySelector(`[data-adjust-course-${kind}]`);
        fields.hidden = !open;
        fields.querySelectorAll('input').forEach((control) => { control.disabled = !open; });
        button.textContent = open ? t('收起') : t('调整');
        button.setAttribute('aria-expanded', String(open));
        if (open) fields.querySelector('input').focus();
      };
      for (const kind of ['time', 'room']) element.querySelector(`[data-adjust-course-${kind}]`).onclick = () => toggleFields(kind, element.querySelector(`[data-course-${kind}-fields]`).hidden);
      element.querySelector('[data-reset-course-time]').onclick = () => {
        form.elements.courseDate.value = original.date;
        form.elements.courseStart.value = engine.formatTime(original.start);
        form.elements.courseEnd.value = engine.formatTime(original.end);
        courseDuration = original.end - original.start;
        lastCourseStart = form.elements.courseStart.value;
        if (errorBox.textContent === overflowMessage) errorBox.textContent = '';
        syncDraft(); toggleFields('time', false); element.querySelector('[data-adjust-course-time]').focus();
      };
      element.querySelector('[data-reset-course-room]').onclick = () => {
        form.elements.courseRoom.value = original.room;
        syncDraft(); toggleFields('room', false); element.querySelector('[data-adjust-course-room]').focus();
      };
      const onCourseInput = (event) => {
        if (!/^course(Date|Start|End|Room)$/.test(event.target.name)) return;
        if (event.target.name === 'courseStart' && event.target.value !== lastCourseStart) {
          lastCourseStart = event.target.value;
          try {
            const end = engine.parseTime(lastCourseStart) + courseDuration;
            form.elements.courseEnd.value = end < 1440 ? engine.formatTime(end) : '';
            if (end >= 1440) errorBox.textContent = overflowMessage;
            else if (errorBox.textContent === overflowMessage) errorBox.textContent = '';
          } catch (_) { form.elements.courseEnd.value = ''; }
        } else if (event.target.name === 'courseEnd') {
          try {
            const duration = engine.parseTime(form.elements.courseEnd.value) - engine.parseTime(form.elements.courseStart.value);
            if (duration > 0) courseDuration = duration;
          } catch (_) { /* Keep the known duration while a time is incomplete. */ }
          if (form.elements.courseEnd.value && errorBox.textContent === overflowMessage) errorBox.textContent = '';
        }
        syncDraft();
      };
      form.addEventListener('input', onCourseInput);
      form.addEventListener('change', onCourseInput);
      syncDraft();
      form.onsubmit = async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        try {
          const date = form.elements.courseDate.value, start = engine.parseTime(form.elements.courseStart.value), end = engine.parseTime(form.elements.courseEnd.value), room = form.elements.courseRoom.value.trim();
          const edited = { ...detail, id: courseId, notes: form.elements.notes.value, important: form.elements.important.checked };
          const adjustment = {};
          if (date !== original.date || start !== original.start || end !== original.end) Object.assign(adjustment, { date, start, end });
          if (room !== original.room) adjustment.room = room;
          delete edited.adjustment;
          if (Object.keys(adjustment).length) edited.adjustment = adjustment;
          const success = await commit((next) => {
            next.courseDetails = next.courseDetails.filter((item) => item.id !== courseId);
            if (edited.notes || edited.important || edited.adjustment) next.courseDetails.push(edited);
            next.selectedWeek = engine.dateToWeek(next.config, date);
          }, edited.adjustment ? t('本次课程调整已保存') : t('本次课程已保存'), errorBox);
          if (success) {
            if (viewMode === 'month' && monthCursor !== date.slice(0, 7)) { monthCursor = date.slice(0, 7); render(); }
            element.close();
          }
        } catch (error) { errorBox.textContent = error.message; }
      };
    }

    function toggleImportance(taskId, courseId) {
      const important = taskId ? !taskById(taskId).important : !courseDetail(courseId).important;
      return commit((next) => {
        if (taskId) next.tasks.find((task) => task.id === taskId).important = important;
        else {
          const detail = next.courseDetails.find((item) => item.id === courseId);
          if (detail) detail.important = important;
          else next.courseDetails.push({ id: courseId, notes: '', important });
          next.courseDetails = next.courseDetails.filter((item) => item.notes || item.important || item.adjustment);
        }
      }, important ? t('已标为重要') : t('已取消重要标记'));
    }

    function openCourseEditor(ruleId) {
      const rule = state.config.courses.find((course) => course.id === ruleId);
      const defaults = rule || { title: '', day: 0, start: state.config.dayStart, end: Math.min(state.config.dayStart + 90, state.config.dayEnd), weeks: Array.from({ length: state.config.weeks }, (_, index) => index + 1), room: '', teacher: '' };
      const options = (selected) => h`<option value="">自定义钟点</option>${state.config.periods.map((period) => h`<option value="${period.number}" ${selected === period.number ? 'selected' : ''}>第 ${period.number} 节</option>`).join('')}`;
      const element = dialog(rule ? t('编辑课程') : t('添加课程'),
        field(t('课程名称'), input('title', defaults.title, 'text', t('required maxlength="240" aria-label="课程名称"'))) +
        h`<div class="wp-field-row">${field(t('星期'), h`<select name="day" aria-label="上课星期">${DAYS.map((day, index) => `<option value="${index}" ${index === defaults.day ? 'selected' : ''}>${day}</option>`).join('')}</select>`)}${field(t('上课周次'), input('weeks', weekText(defaults.weeks), 'text', t('required aria-label="上课周次"')))}</div><p class="wp-form-hint">例如 2-12、3,5,8 或 2-4(双),5-7。教师或教室分段变化时，可分成多条规则。</p>` +
        `<div class="wp-field-row">${field(t('开始节次（可选）'), `<select name="firstPeriod">${options(defaults.firstPeriod)}</select>`)}${field(t('结束节次（可选）'), `<select name="lastPeriod">${options(defaults.lastPeriod)}</select>`)}</div>` +
        `<div class="wp-field-row">${field(t('开始时间'), input('start', engine.formatTime(defaults.start), 'time', 'required step="60"'))}${field(t('结束时间'), input('end', engine.formatTime(defaults.end), 'time', 'required step="60"'))}</div>` +
        `<div class="wp-field-row">${field(t('教室'), input('room', defaults.room, 'text', 'maxlength="300"'))}${field(t('教师'), input('teacher', defaults.teacher, 'text', 'maxlength="300"'))}</div>`,
        t('<button type="button" data-cancel>取消</button><button type="submit" class="wp-primary">保存课程</button>'));
      const form = element.querySelector('form'), errorBox = element.querySelector('.wp-form-error');
      const syncPeriods = () => {
        const first = state.config.periods.find((item) => item.number === Number(form.elements.firstPeriod.value));
        const last = state.config.periods.find((item) => item.number === Number(form.elements.lastPeriod.value));
        if (first) form.elements.start.value = engine.formatTime(first.start);
        if (last) form.elements.end.value = engine.formatTime(last.end);
      };
      form.elements.firstPeriod.onchange = syncPeriods; form.elements.lastPeriod.onchange = syncPeriods;
      form.onsubmit = async (event) => {
        event.preventDefault();
        try {
          const edited = { id: rule ? rule.id : uid(), title: form.elements.title.value.trim(), day: Number(form.elements.day.value), start: engine.parseTime(form.elements.start.value), end: engine.parseTime(form.elements.end.value), weeks: parseWeeks(form.elements.weeks.value, state.config.weeks), room: form.elements.room.value.trim(), teacher: form.elements.teacher.value.trim() };
          const first = state.config.periods.find((item) => item.number === Number(form.elements.firstPeriod.value));
          const last = state.config.periods.find((item) => item.number === Number(form.elements.lastPeriod.value));
          if (first && last && first.start === edited.start && last.end === edited.end) { edited.firstPeriod = first.number; edited.lastPeriod = last.number; }
          const success = await commit((next) => { next.config.courses = next.config.courses.filter((item) => item.id !== edited.id); next.config.courses.push(edited); }, t('课程已保存'), errorBox);
          if (success) openCourses();
        } catch (error) { errorBox.textContent = error.message; }
      };
    }

    function openCourses() {
      const config = state.config;
      const courses = [...config.courses].sort((a, b) => a.day - b.day || a.start - b.start || a.weeks[0] - b.weeks[0]);
      const element = dialog(t('课程设置'),
        field(t('学期名称'), input('semester', config.semester, 'text', 'required maxlength="100"')) +
        `<div class="wp-field-row">${field(t('第 1 教学周的周一'), input('firstMonday', config.firstMonday, 'date', 'required'))}${field(t('教学周数'), input('weeks', config.weeks, 'number', 'required min="1" max="60"'))}</div>` +
        `<div class="wp-field-row">${field(t('时间轴从'), input('dayStart', engine.formatTime(config.dayStart), 'text', 'required pattern="[0-2][0-9]:[0-5][0-9]" placeholder="08:00"'))}${field(t('时间轴到'), input('dayEnd', engine.formatTime(config.dayEnd), 'text', 'required pattern="[0-2][0-9]:[0-5][0-9]" placeholder="22:00"'))}</div>` +
        h`<p class="wp-form-hint">使用 24 小时制。修改日期后，个人安排仍保留原日期；冲突或超出显示时段时不会保存。单次调课请直接点开课表中的课程。</p><div class="wp-course-list-header"><strong>我的课程 <span class="wp-muted">${courses.length}</span></strong><div><button type="button" data-import-courses>批量导入</button><button type="button" data-new-course>${icon('plus')}添加课程</button></div></div>${courses.map((course) => h`<div class="wp-course-rule"><div class="wp-course-rule-info"><div class="wp-course-rule-title">${escape(course.title)}</div><div class="wp-course-rule-sub">${DAYS[course.day]} ${intervalLabel(course)} · 第 ${weekText(course.weeks)} 周<br>${escape([course.room, course.teacher].filter(Boolean).join(' · '))}</div></div><button type="button" data-edit-course="${escape(course.id)}">编辑</button><button type="button" data-delete-course="${escape(course.id)}" aria-label="删除 ${escape(course.title)}">删除</button></div>`).join('') || t('<div class="wp-empty"><strong>还没有课程</strong><span>逐门添加，或从表格批量导入。单、双周也支持。</span></div>')}<p class="wp-form-hint">节假日、补课和考试请按学校通知调整。</p>`, t('<button type="button" data-cancel>关闭</button><button type="submit" class="wp-primary">保存学期设置</button>'), true);
      const form = element.querySelector('form'), errorBox = element.querySelector('.wp-form-error');
      const semesterChanges = () => ({ ...state.config, semester: form.elements.semester.value.trim(), firstMonday: form.elements.firstMonday.value, weeks: Number(form.elements.weeks.value), dayStart: engine.parseTime(form.elements.dayStart.value), dayEnd: engine.parseTime(form.elements.dayEnd.value) });
      async function saveSettings() {
        try {
          const config = semesterChanges();
          if (JSON.stringify(config) === JSON.stringify(state.config)) return true;
          return await commit((next) => { next.config = config; next.selectedWeek = Math.min(next.selectedWeek, config.weeks); }, t('学期设置已保存'), errorBox);
        } catch (error) { errorBox.textContent = error.message; return false; }
      }
      element.querySelector('[data-new-course]').onclick = async () => { if (await saveSettings()) openCourseEditor(); };
      element.querySelector('[data-import-courses]').onclick = async () => { if (await saveSettings()) openCourseImport(); };
      element.querySelectorAll('[data-edit-course]').forEach((button) => { button.onclick = async () => { if (await saveSettings()) openCourseEditor(button.dataset.editCourse); }; });
      element.querySelectorAll('[data-delete-course]').forEach((button) => { button.onclick = async () => {
        const course = state.config.courses.find((item) => item.id === button.dataset.deleteCourse);
        if (!windowRef.confirm(h`删除“${course.title}”的第 ${weekText(course.weeks)} 周课程规则？`)) return;
        try {
          const config = semesterChanges();
          if (await commit((next) => { next.config = { ...config, courses: config.courses.filter((item) => item.id !== course.id) }; next.selectedWeek = Math.min(next.selectedWeek, config.weeks); }, t('课程规则已删除'), errorBox)) openCourses();
        } catch (error) { errorBox.textContent = error.message; }
      }; });
      form.onsubmit = async (event) => { event.preventDefault(); if (await saveSettings()) openCourses(); };
    }

    function openCourseImport() {
      let preview = null;
      const element = dialog(t('批量导入课程'), h`<p class="wp-import-intro">从 Excel 或表格复制课程行，或选择 CSV / TSV 文件。确认前会检查周次、重复课程和时间冲突。</p><div class="wp-import-tools"><button type="button" data-import-example>填入示例格式</button><button type="button" data-course-file-button>选择文件</button><input type="file" data-course-file accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" hidden></div>${field(t('课程表格（含表头）'), t('<textarea name="courseTable" rows="7" maxlength="200000" spellcheck="false" placeholder="课程名称&#9;星期&#9;开始时间&#9;结束时间&#9;周次&#9;教室&#9;教师"></textarea>'))}<p class="wp-form-hint">必填前五列；时间如 08:00，周次如 1-16、1-16(单)、3,5,8。CSV 中带逗号的周次请用双引号包裹。教室和教师可留空；文本文件需使用 UTF-8。</p><div class="wp-import-preview" data-import-preview aria-live="polite"></div>`, t('<button type="button" data-cancel>取消</button><button type="button" data-preview-courses>预览课程</button><button type="submit" class="wp-primary" disabled>确认导入</button>'), true);
      const form = element.querySelector('form'), errorBox = element.querySelector('.wp-form-error'), output = element.querySelector('[data-import-preview]'), submit = element.querySelector('[type=submit]');
      const invalidate = () => { preview = null; submit.disabled = true; setHtml(output, ''); errorBox.textContent = ''; };
      form.elements.courseTable.oninput = invalidate;
      element.querySelector('[data-import-example]').onclick = () => {
        if (form.elements.courseTable.value.trim() && !windowRef.confirm(t('用示例替换当前尚未导入的文本？'))) return;
        form.elements.courseTable.value = courseImport.TEMPLATE; invalidate(); form.elements.courseTable.focus();
      };
      element.querySelector('[data-course-file-button]').onclick = () => element.querySelector('[data-course-file]').click();
      element.querySelector('[data-course-file]').onchange = async (event) => {
        const file = event.target.files[0]; if (!file) return;
        try {
          if (file.size > 200000) throw new Error(t('文件超过 200 KB，请分批导入。'));
          if (form.elements.courseTable.value.trim() && !windowRef.confirm(t('用文件内容替换当前尚未导入的文本？'))) return;
          const text = await file.text();
          if (element.isConnected) { form.elements.courseTable.value = text; invalidate(); }
        } catch (error) { errorBox.textContent = error.message; }
      };
      element.querySelector('[data-preview-courses]').onclick = () => {
        invalidate();
        try {
          preview = courseImport.parse(form.elements.courseTable.value, state.config, engine, uid);
          engine.normalizeState({ ...copy(state), config: { ...state.config, courses: [...state.config.courses, ...preview.courses] } }, state.config);
          setHtml(output, h`<p><strong>将新增 ${preview.courses.length} 条课程</strong>${preview.skipped ? h`，跳过 ${preview.skipped} 条完全重复的课程` : ''}</p>${preview.courses.length ? h`<div class="wp-import-table-wrap"><table class="wp-import-table"><thead><tr><th>课程</th><th>时间</th><th>周次</th><th>教室</th></tr></thead><tbody>${preview.courses.map((course) => `<tr><td>${escape(course.title)}</td><td>${DAYS[course.day]} ${intervalLabel(course)}</td><td>${weekText(course.weeks)}</td><td>${escape(course.room || '—')}</td></tr>`).join('')}</tbody></table></div>` : t('<p class="wp-form-hint">没有需要新增的课程。</p>')}`);
          submit.disabled = !preview.courses.length;
        } catch (error) { preview = null; errorBox.textContent = error.message; }
      };
      form.onsubmit = async (event) => {
        event.preventDefault(); if (!preview?.courses.length) return;
        const courses = copy(preview.courses);
        await commit((next) => { next.config.courses.push(...courses); }, h`已导入 ${courses.length} 条课程`, errorBox);
      };
    }

    function openBackup() {
      const element = dialog(t('备份'), t('<p>导出完整课表、待办和安排，保留一份副本。导入备份会替换当前数据。</p><div class="wp-backup-actions"><button type="button" data-export>导出备份</button><button type="button" data-import>导入备份</button><input type="file" accept=".json,application/json" hidden data-import-file></div>'), t('<button type="button" data-cancel>关闭</button>'));
      const errorBox = element.querySelector('.wp-form-error');
      element.querySelector('[data-export]').onclick = async () => {
        try {
          if (saving) throw new Error(t('正在保存，请稍后导出。'));
          if (options.onExport) { const path = await options.onExport(copy(state)); errorBox.textContent = ''; notify(h`备份已导出到：${path}`, 'success'); element.close(); }
          else {
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
            const url = windowRef.URL.createObjectURL(blob), anchor = documentRef.createElement('a');
            anchor.href = url; anchor.download = h`我的一周-${today()}.json`; anchor.click(); windowRef.setTimeout(() => windowRef.URL.revokeObjectURL(url), 1000);
            notify(t('备份已导出'), 'success'); element.close();
          }
        } catch (error) { errorBox.textContent = error.message; }
      };
      element.querySelector('[data-import]').onclick = () => element.querySelector('[data-import-file]').click();
      element.querySelector('[data-import-file]').onchange = async (event) => {
        const file = event.target.files[0]; if (!file) return;
        try {
          if (file.size > 5 * 1024 * 1024) throw new Error(t('备份文件过大，请选择本工具导出的 JSON 文件。'));
          const imported = engine.normalizeState(JSON.parse(await file.text()), state.config);
          const confirmation = dialog(t('导入备份'), h`<p>将用这份备份替换当前数据：</p><div class="wp-settings-info">${escape(file.name)}<br>${imported.tasks.length} 个待办 · ${imported.blocks.length} 个安排 · ${imported.config.courses.length} 条课程规则</div><p class="wp-form-hint">建议先导出当前数据，避免丢失之后新增的安排。</p>`, t('<button type="button" data-cancel>取消</button><button type="submit" class="wp-primary">替换当前数据</button>'));
          confirmation.querySelector('form').onsubmit = async (event) => { event.preventDefault(); await commit((next) => { Object.keys(next).forEach((key) => delete next[key]); Object.assign(next, copy(imported)); }, t('备份已导入'), confirmation.querySelector('.wp-form-error')); };
        } catch (error) { errorBox.textContent = h`未导入：${error.message}`; }
      };
    }

    function clearGhost() { root.querySelectorAll('.wp-drop-preview').forEach((element) => element.remove()); }
    function showGhost(day, candidate, title, valid) {
      clearGhost();
      const ghost = documentRef.createElement('div'); ghost.className = `wp-drop-preview ${valid.ok ? '' : 'is-conflict'}`;
      ghost.style.top = `${position(candidate.start)}px`; ghost.style.height = `${Math.max(22, durationHeight(candidate.end - candidate.start))}px`;
      const safeInterval = candidate.start >= 0 && candidate.end <= 1440 ? intervalLabel(candidate) : t('超出可安排时间');
      setHtml(ghost, `<strong>${escape(title)}</strong><br>${safeInterval}${valid.ok ? '' : t('<br>无法放入此处')}`);
      day.appendChild(ghost);
      if (!valid.ok) notify(valid.message, 'error'); else notify(h`放开鼠标，安排到 ${candidate.date} ${intervalLabel(candidate)}`);
    }
    function candidateAt(event, day) {
      const rect = day.getBoundingClientRect(), task = taskById(drag.taskId);
      const duration = drag.blockId ? state.blocks.find((item) => item.id === drag.blockId).end - state.blocks.find((item) => item.id === drag.blockId).start : task.duration;
      const start = Math.round((state.config.dayStart + (event.clientY - rect.top) / hourHeight * 60 - drag.offset) / 5) * 5;
      return { id: drag.blockId || uid(), taskId: task.id, date: day.dataset.date, start, end: start + duration };
    }

    on(root, 'submit', async (event) => {
      if (!event.target.matches('.wp-task-entry')) return;
      event.preventDefault(); const form = event.target, title = form.elements.taskTitle.value.trim(), duration = Number(form.elements.duration.value);
      if (!title) return;
      if (await commit((next) => next.tasks.push({ id: uid(), title, duration, done: false, important: false, urgent: false, notes: '', week: next.selectedWeek }), t('待办已添加'))) { const current = root.querySelector('.wp-task-entry input'); current.value = ''; current.focus(); }
    });
    on(root, 'click', (event) => {
      const noteLink = event.target.closest('a[data-note-link]');
      if (noteLink) {
        event.stopPropagation();
        if (Date.now() < suppressClickUntil) { event.preventDefault(); return; }
        // Let Obsidian and the browser handle ordinary external anchors natively.
        if (noteLink.dataset.noteLink === 'external' && !options.onOpenExternalLink) return;
        event.preventDefault(); void openNoteLink(noteLink);
        return;
      }
      if (Date.now() < suppressClickUntil) return;
      const notesFieldElement = event.target.closest('.wp-notes-field');
      if (notesFieldElement) {
        if (event.target.closest('[data-notes-toggle]')) {
          event.preventDefault();
          const editing = notesFieldElement.dataset.editing !== 'true';
          setNotesEditing(notesFieldElement, editing);
          if (!editing) notesFieldElement.querySelector('[data-notes-toggle]').focus({ preventScroll: true });
          return;
        }
        if (event.target.closest('.wp-notes-preview,[data-notes-label]')) {
          event.preventDefault(); setNotesEditing(notesFieldElement, true); return;
        }
      }
      const quickDelete = event.target.closest('[data-quick-delete-task]');
      if (quickDelete) { event.preventDefault(); event.stopPropagation(); void deleteTask(quickDelete.dataset.quickDeleteTask); return; }
      const viewButton = event.target.closest('[data-view]');
      if (viewButton) { switchView(viewButton.dataset.view); return; }
      const dateButton = event.target.closest('[data-open-date]');
      if (dateButton) { openDate(dateButton.dataset.openDate); return; }
      const weekButton = event.target.closest('[data-open-week]');
      if (weekButton) {
        commit((next) => { next.selectedWeek = engine.dateToWeek(next.config, weekButton.dataset.openWeek); }, '').then((saved) => { if (saved) switchView('week'); });
        return;
      }
      const flag = event.target.closest('[data-flag-task],[data-flag-course]');
      if (flag) {
        event.preventDefault(); event.stopPropagation();
        void toggleImportance(flag.dataset.flagTask, flag.dataset.flagCourse);
        return;
      }
      const button = event.target.closest('[data-action]');
      if (button) {
        const action = button.dataset.action;
        if (action === 'courses') openCourses(); else if (action === 'backup') openBackup();
        else if (action === 'toggle-sidebar') { sidebarHidden = !sidebarHidden; savePreferences(); render(); root.querySelector('[data-action=toggle-sidebar]')?.focus({ preventScroll:true }); }
        else if (action === 'import-courses') openCourseImport();
        else if (action === 'undo') { void undo(); }
        else if (action === 'routines') openRoutines();
        else if (action === 'apply-routines') { void applyRoutineSelection(); }
        else if (action === 'select-tasks') { selectionMode = !selectionMode; selectedTasks.clear(); render(); }
        else if (action === 'select-all') {
          const ids = engine.tasksForWeek(state, state.selectedWeek, { includeDone: false }).map((task) => task.id);
          if (ids.length && ids.every((id) => selectedTasks.has(id))) selectedTasks.clear();
          else ids.forEach((id) => selectedTasks.add(id));
          render();
        }
        else if (action === 'postpone-selected') openPostpone([...selectedTasks]);
        else if (viewMode === 'month') {
          const first = state.config.firstMonday.slice(0, 7), last = engine.addDays(state.config.firstMonday, state.config.weeks * 7 - 1).slice(0, 7);
          const month = action === 'current' ? today().slice(0, 7) : shiftMonth(monthCursor, action === 'previous' ? -1 : 1);
          monthCursor = month < first ? first : month > last ? last : month;
          render();
        }
        else commit((next) => { next.selectedWeek = action === 'current' ? engine.currentWeek(next.config) : next.selectedWeek + (action === 'next' ? 1 : -1); }, '');
        return;
      }
      const edit = event.target.closest('[data-edit-task]'), schedule = event.target.closest('[data-schedule-task]');
      if (edit) { openTaskEditor(edit.dataset.editTask); return; }
      if (schedule) { openTaskEditor(schedule.dataset.scheduleTask, true); return; }
      if (event.target.closest('[data-done],[data-complete-task],[data-resize]')) return;
      const block = event.target.closest('[data-block]');
      if (block && !drag && !resize) { const item = state.blocks.find((item) => item.id === block.dataset.block); if (item) openTaskEditor(item.taskId, true); return; }
      const course = event.target.closest('[data-course]'); if (course) showCourse(course.dataset.course);
    });
    on(root, 'dblclick', (event) => {
      if (event.target.closest('a[data-note-link]')) return;
      const monthDay = event.target.closest('[data-month-date]');
      if (monthDay && !event.target.closest('button') && !drag && !resize && dateInSemester(monthDay.dataset.monthDate)) {
        openTaskEditor(null, true, firstFreeOn(monthDay.dataset.monthDate));
        return;
      }
      if (!event.target.matches('.wp-day') || drag || resize) return;
      const day = event.target, rect = day.getBoundingClientRect();
      const start = Math.round((state.config.dayStart + (event.clientY - rect.top) / hourHeight * 60) / 5) * 5;
      openTaskEditor(null, true, { date: day.dataset.date, start, end: Math.min(start + 60, state.config.dayEnd) });
    });
    on(root, 'keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'z' && !event.target.closest('input,textarea,select,[contenteditable=true]') && !root.querySelector('dialog[open]') && undoStack.length) {
        event.preventDefault(); event.stopPropagation(); void undo(); return;
      }
      if (!['Enter',' '].includes(event.key) || event.target.closest('button,input,select,textarea,a')) return;
      const course = event.target.closest('[data-course]'), block = event.target.closest('[data-block]');
      if (course) { event.preventDefault(); showCourse(course.dataset.course); }
      else if (block) { event.preventDefault(); const item = state.blocks.find((item) => item.id === block.dataset.block); openTaskEditor(item.taskId, true); }
    });
    on(root, 'change', (event) => {
      if (event.target.matches('[data-language]')) {
        translations.setLocale(event.target.value);
        try { windowRef.localStorage.setItem(languageKey, translations.locale); } catch (_) {}
        engine = options.engine.withLocale ? options.engine.withLocale(translations.locale) : options.engine;
        courseImport = courseImportBase.withLocale ? courseImportBase.withLocale(translations.locale) : courseImportBase;
        DAYS = getDays(); QUADRANTS = getQuadrants(); status = ''; statusKind = '';
        options.onLocaleChange?.(translations.locale); render(); return;
      }
      if (event.target.matches('[data-density]')) { density = event.target.value === 'comfortable' ? 'comfortable' : 'standard'; savePreferences(); const scroller=root.querySelector('[data-surface=week]'); if(scroller) scroller.scrollTop=0; fitGrid(); return; }
      if (event.target.matches('[data-select-task]')) {
        const id = event.target.dataset.selectTask;
        if (event.target.checked) selectedTasks.add(id); else selectedTasks.delete(id);
        render(); return;
      }
      if (event.target.matches('[data-sidebar-week]')) { const week = Number(event.target.value); commit((next) => { next.selectedWeek = week; }, ''); return; }
      if (event.target.matches('[data-show-completed]')) { showCompleted = event.target.checked; render(); return; }
      if (event.target.matches('[data-done]')) { const id = event.target.dataset.done, done = event.target.checked; commit((next) => { next.tasks.find((task) => task.id === id).done = done; }, done ? t('事项已完成') : t('事项已恢复')).then((success) => { if (!success && event.target.isConnected) event.target.checked = !done; }); }
    });
    function setNotesEditing(fieldElement, editing) {
      const area = fieldElement.querySelector('textarea[name="notes"]');
      if (!area || composingNotes.has(area)) return;
      const preview = fieldElement.querySelector('.wp-notes-preview');
      const toggle = fieldElement.querySelector('[data-notes-toggle]');
      fieldElement.dataset.editing = String(editing);
      setHtml(preview, notesContent(area.value));
      area.hidden = !editing;
      preview.hidden = editing;
      toggle.textContent = editing ? t('完成编辑') : t('编辑');
      toggle.setAttribute('aria-label', editing ? t('完成备注编辑') : t('编辑备注'));
      if (editing) area.focus({ preventScroll: true });
    }
    on(root, 'pointerdown', (event) => {
      // Keep the editor open until its toggle handles the click, including on touch.
      if (event.target.closest('[data-notes-toggle]')) event.preventDefault();
    });
    on(root, 'input', (event) => {
      if (!event.target.matches('.wp-notes-field textarea[name="notes"]')) return;
      const preview = event.target.closest('.wp-notes-field').querySelector('.wp-notes-preview');
      setHtml(preview, notesContent(event.target.value));
    });
    on(root, 'focusout', (event) => {
      if (!event.target.matches('.wp-notes-field textarea[name="notes"]')) return;
      const fieldElement = event.target.closest('.wp-notes-field');
      if (event.relatedTarget === fieldElement.querySelector('[data-notes-toggle]')) return;
      setNotesEditing(fieldElement, false);
    });
    on(root, 'compositionstart', (event) => {
      if (event.target.matches('.wp-notes-field textarea[name="notes"]')) composingNotes.add(event.target);
    });
    on(root, 'compositionend', (event) => {
      if (!event.target.matches('.wp-notes-field textarea[name="notes"]')) return;
      composingNotes.delete(event.target);
      if (documentRef.activeElement !== event.target) setNotesEditing(event.target.closest('.wp-notes-field'), false);
    });
    on(root, 'dragstart', (event) => {
      const element = event.target.closest('[data-drag-task],[data-block]');
      if (!element || saving || resize || event.target.closest('[data-flag-task],[data-flag-course],[data-complete-task],input,a[data-note-link]')) { event.preventDefault(); return; }
      const taskId = element.dataset.dragTask || state.blocks.find((item) => item.id === element.dataset.block)?.taskId;
      const block = blockByTask(taskId);
      drag = { taskId, blockId: block ? block.id : null, offset: block && element.dataset.block ? Math.max(0, (event.clientY - element.getBoundingClientRect().top) / hourHeight * 60) : 0 };
      event.dataTransfer.setData('text/plain', drag.taskId); event.dataTransfer.effectAllowed = 'move'; root.classList.add('is-dragging');
      if (block && viewMode !== 'matrix') root.querySelector('.wp-sidebar').classList.add('is-return-target');
    });
    on(root, 'dragover', (event) => {
      if (!drag) return;
      const quadrant = event.target.closest('[data-quadrant]');
      if (quadrant) {
        event.preventDefault(); event.dataTransfer.dropEffect = 'move';
        root.querySelectorAll('.wp-quadrant.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
        quadrant.classList.add('is-drag-over');
        return;
      }
      const monthDay = event.target.closest('[data-month-date]');
      if (monthDay) { if (dateInSemester(monthDay.dataset.monthDate)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } return; }
      const day = event.target.closest('.wp-day'), sidebar = event.target.closest('.wp-sidebar');
      if (sidebar && drag.blockId && viewMode !== 'matrix') { event.preventDefault(); clearGhost(); notify(t('放开鼠标，移回待办清单')); return; }
      if (!day) return;
      event.preventDefault(); event.dataTransfer.dropEffect = 'move';
      const candidate = candidateAt(event, day), valid = engine.validatePlacement(state, state.config, candidate, { ignoreBlockId: drag.blockId });
      showGhost(day, candidate, taskById(drag.taskId).title, valid);
    });
    on(root, 'drop', (event) => {
      if (!drag) return;
      suppressClickUntil = Date.now() + 350;
      const currentDrag = drag, sidebar = event.target.closest('.wp-sidebar'), day = event.target.closest('.wp-day');
      event.preventDefault();
      const quadrant = event.target.closest('[data-quadrant]'), monthDay = event.target.closest('[data-month-date]');
      if (quadrant) {
        const category = QUADRANTS.find((item) => item.id === quadrant.dataset.quadrant);
        if (category) commit((next) => { const task = next.tasks.find((item) => item.id === currentDrag.taskId); task.important = category.important; task.urgent = category.urgent; }, t('事项分类已保存'));
      }
      else if (monthDay && dateInSemester(monthDay.dataset.monthDate)) {
        const block = state.blocks.find((item) => item.id === currentDrag.blockId);
        if (block) {
          const candidate = { ...block, date: monthDay.dataset.monthDate };
          const valid = engine.validatePlacement(state, state.config, candidate, { ignoreBlockId: block.id });
          if (valid.ok) commit((next) => { next.blocks.find((item) => item.id === block.id).date = candidate.date; }, t('已改期，原时间与时长保留'));
          else notify(valid.message, 'error');
        } else openTaskEditor(currentDrag.taskId, true, firstFreeOn(monthDay.dataset.monthDate, taskById(currentDrag.taskId)));
      }
      else if (sidebar && drag.blockId && viewMode !== 'matrix') commit((next) => { next.blocks = next.blocks.filter((item) => item.id !== currentDrag.blockId); }, t('已移回待办清单'));
      else if (day) {
        const candidate = candidateAt(event, day), valid = engine.validatePlacement(state, state.config, candidate, { ignoreBlockId: drag.blockId });
        if (!valid.ok) notify(valid.message, 'error');
        else commit((next) => { next.blocks = next.blocks.filter((item) => item.id !== candidate.id); next.blocks.push(candidate); }, t('时间已安排'));
      }
      drag = null; clearGhost(); root.classList.remove('is-dragging'); root.querySelector('.wp-sidebar')?.classList.remove('is-return-target');
      root.querySelectorAll('.wp-quadrant.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
      applyExternalIfIdle();
    });
    on(root, 'dragleave', (event) => { const quadrant = event.target.closest('[data-quadrant]'); if (quadrant && !quadrant.contains(event.relatedTarget)) quadrant.classList.remove('is-drag-over'); });
    on(root, 'dragend', () => { suppressClickUntil = Date.now() + 350; drag = null; clearGhost(); root.classList.remove('is-dragging'); root.querySelector('.wp-sidebar')?.classList.remove('is-return-target'); root.querySelectorAll('.wp-quadrant.is-drag-over').forEach((el) => el.classList.remove('is-drag-over')); applyExternalIfIdle(); });
    on(root, 'pointerdown', (event) => {
      const handle = event.target.closest('[data-resize]'); if (!handle || saving) return;
      event.preventDefault(); event.stopPropagation();
      const block = state.blocks.find((item) => item.id === handle.dataset.resize);
      resize = { block: copy(block), originY: event.clientY, candidate: copy(block), element: handle.closest('.wp-block'), pointerId: event.pointerId };
    });
    on(documentRef, 'pointermove', (event) => {
      if (!resize || event.pointerId !== resize.pointerId) return;
      event.preventDefault();
      const end = Math.round((resize.block.end + (event.clientY - resize.originY) / hourHeight * 60) / 5) * 5;
      resize.candidate = { ...resize.block, end: Math.max(resize.block.start + 15, Math.min(state.config.dayEnd, end)) };
      const valid = engine.validatePlacement(state, state.config, resize.candidate, { ignoreBlockId: resize.block.id });
      resize.element.style.height = `${durationHeight(resize.candidate.end - resize.candidate.start)}px`;
      resize.element.querySelector('.wp-block-time').textContent = intervalLabel(resize.candidate);
      fitBlock(resize.element);
      resize.element.style.borderLeftColor = valid.ok ? '' : '#ad443f';
      notify(valid.ok ? h`调整为 ${intervalLabel(resize.candidate)}` : valid.message, valid.ok ? '' : 'error');
    }, { passive: false });
    on(documentRef, 'pointerup', (event) => {
      if (!resize || event.pointerId !== resize.pointerId) return;
      suppressClickUntil = Date.now() + 350;
      const active = resize; resize = null;
      const valid = engine.validatePlacement(state, state.config, active.candidate, { ignoreBlockId: active.block.id });
      if (!valid.ok) { render(); notify(valid.message, 'error'); return; }
      commit((next) => { const block = next.blocks.find((item) => item.id === active.block.id); block.end = active.candidate.end; next.tasks.find((item) => item.id === block.taskId).duration = block.end - block.start; }, t('时长已保存')).then((success) => {
        if (!success && !destroyed) { const message = status; render(); notify(message, 'error'); applyExternalIfIdle(); }
      });
    });
    on(documentRef, 'pointercancel', () => { if (resize) { resize = null; render(); applyExternalIfIdle(); } });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => fitGrid()) : null;
    observer?.observe(root);
    render();
    return {
      destroy() { destroyed = true; controller.abort(); observer?.disconnect(); setHtml(root, ''); },
      getState() { return copy(state); },
      updateState(nextState, onApplied) {
        if (destroyed) return false;
        pendingExternal = { state: engine.normalizeState(nextState, nextState.config), onApplied };
        const applied = applyExternalIfIdle();
        if (!applied) notify(t('其它窗口已更新，关闭编辑弹窗或结束拖动后同步。'));
        return applied;
      }
    };
  }
  return { mount };
});
