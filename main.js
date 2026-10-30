'use strict';

const { Plugin, ItemView, Notice, getLanguage, sanitizeHTMLToDom } = require('obsidian');
const languageKey = 'one-week:language';
let savedLanguage;
try { savedLanguage = window.localStorage?.getItem(languageKey); } catch (_) {}
const translations = require('./i18n.js').create(savedLanguage || (typeof getLanguage === 'function' ? getLanguage() : 'zh'));
const t = translations.t, h = translations.html;
const { mount } = require('./app.js');
let engine = require('./engine.js').withLocale(translations.locale);
const semester = require('./default-semester.js').create(engine);

const VIEW_TYPE = 'baiyi-weekly-planner';

function validateStoredState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(t('日程数据必须是 JSON 对象。'));
  }
  if (raw.schemaVersion !== 1) {
    throw new Error(t('日程数据版本不受支持，请使用对应版本的备份。'));
  }
  if (!raw.config || typeof raw.config !== 'object' || Array.isArray(raw.config)
      || !Array.isArray(raw.tasks) || !Array.isArray(raw.blocks)
      || !Number.isInteger(raw.selectedWeek)) {
    throw new Error(t('日程数据结构不完整，请恢复原有 JSON 备份。'));
  }
  return engine.normalizeState(raw, semester);
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function localDate() {
  return engine.formatDate(new Date());
}

function backupTimestamp() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}${fields.month}${fields.day}-${fields.hour}${fields.minute}${fields.second}`;
}

class WeeklyPlannerView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.planner = null;
    this.receiveState = null;
    this.openGeneration = 0;
    this.closed = true;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return t('我的一周'); }
  getIcon() { return 'calendar-days'; }

  async onOpen() {
    const generation = ++this.openGeneration;
    this.closed = false;
    this.plugin.liveViews.delete(this);
    this.receiveState = null;
    if (this.planner && typeof this.planner.destroy === 'function') {
      this.planner.destroy();
    }
    this.planner = null;
    this.contentEl.style.padding = '0';
    this.contentEl.style.overflow = 'hidden';
    this.contentEl.empty();
    let root;
    try {
      // A reopened view must include writes that were pending when it opened.
      let pending;
      do {
        pending = this.plugin.saveQueue;
        await pending;
        if (this.closed || generation !== this.openGeneration) return;
      } while (pending !== this.plugin.saveQueue);

      root = this.contentEl.createDiv({ cls: 'weekly-planner-root' });
      if (this.plugin.storageBlocked) {
        root.createEl('h2', { text: t('原有日程需要修复') });
        root.createEl('p', { text: this.plugin.storageError });
        root.createEl('p', { text: t('为保护已有安排，当前禁止保存。请关闭插件，将有效 JSON 备份恢复为下面的文件，再重新启用插件。') });
        root.createEl('code', { text: this.plugin.dataPath });
        return;
      }
      let localRevision = this.plugin.revision;
      this.planner = mount(root, {
        state: engine.normalizeState(this.plugin.state, semester),
        engine,
        locale: translations.locale,
        sanitizeHTML: sanitizeHTMLToDom,
        onLocaleChange: locale => { translations.setLocale(locale); engine = engine.withLocale(locale); },
        onOpenInternalLink: (href) => this.app.workspace.openLinkText(href, '', true),
        preferencesKey: `${this.plugin.manifest.id}:ui:${this.app.vault.adapter.getBasePath?.() || this.app.vault.getName?.() || 'vault'}`,
        onSave: async (nextState) => {
          const savingRevision = localRevision;
          const savedState = await this.plugin.saveState(nextState, savingRevision, this);
          localRevision = savingRevision + 1;
          return savedState;
        },
        onExport: (state) => this.plugin.exportBackup(state),
        onCheckRollover: () => this.plugin.checkRollover(),
      });
      const planner = this.planner;
      this.receiveState = (nextState, revision) => {
        if (this.closed || generation !== this.openGeneration || this.planner !== planner) return;
        planner.updateState(JSON.parse(JSON.stringify(nextState)), () => {
          // Busy views retain their old revision until their draft is safe to refresh.
          if (!this.closed && generation === this.openGeneration && this.planner === planner) {
            localRevision = revision;
          }
        });
      };
      this.plugin.liveViews.add(this);
    } catch (error) {
      if (this.closed || generation !== this.openGeneration) return;
      root = root || this.contentEl.createDiv({ cls: 'weekly-planner-root' });
      root.empty();
      root.createEl('h2', { text: t('暂时无法打开我的一周') });
      root.createEl('p', { text: messageOf(error) });
      new Notice(t('我的一周未能打开，已有日程数据已保留。'), 7000);
    }
  }

  async onClose() {
    this.closed = true;
    this.openGeneration += 1;
    this.plugin.liveViews.delete(this);
    this.receiveState = null;
    if (this.planner && typeof this.planner.destroy === 'function') {
      this.planner.destroy();
    }
    this.planner = null;
    this.contentEl.empty();
  }
}

class WeeklyPlannerPlugin extends Plugin {
  constructor(...args) {
    super(...args);
    this.state = null;
    this.revision = 0;
    this.liveViews = new Set();
    this.storageBlocked = false;
    this.storageError = '';
    this.saveQueue = Promise.resolve();
    this.exportQueue = Promise.resolve();
    this.openingPlanner = null;
    this.rolloverCheck = null;
    this.rolloverTimer = null;
    this.unloaded = false;
  }

  get dataPath() {
    const directory = this.manifest.dir
      || `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
    return `${directory.replace(/\\/g, '/').replace(/\/$/, '')}/data.json`;
  }

  async onload() {
    this.unloaded = false;
    this.revision = 0;
    try {
      const exists = await this.app.vault.adapter.exists(this.dataPath);
      if (exists) {
        this.state = validateStoredState(await this.loadData());
      } else {
        this.state = engine.DEFAULT_STATE(require('./default-semester.js').create(engine, localDate(), translations.locale), localDate());
      }
    } catch (error) {
      this.storageBlocked = true;
      this.storageError = messageOf(error);
      new Notice(h`我的一周未覆盖原有数据：${this.storageError}`, 10000);
    }
    // Catch up even when no planner leaf is open. A write failure leaves the loaded
    // state usable and is retried by later checks instead of blocking storage.
    if (!this.storageBlocked) await this.checkRollover().catch(() => undefined);
    if (this.unloaded) return;
    this.startRolloverChecks();

    this.registerView(VIEW_TYPE, (leaf) => new WeeklyPlannerView(leaf, this));
    this.addRibbonIcon('calendar-days', t('打开我的一周'), () => {
      void this.openPlanner().catch((error) => {
        new Notice(h`无法打开我的一周：${messageOf(error)}`, 7000);
      });
    });
    this.addCommand({
      id: 'open-weekly-planner',
      name: t('打开周计划'),
      callback: () => {
        void this.openPlanner().catch((error) => {
          new Notice(h`无法打开我的一周：${messageOf(error)}`, 7000);
        });
      },
    });
  }

  openPlanner() {
    if (this.unloaded) return Promise.resolve(null);
    if (this.openingPlanner) return this.openingPlanner;
    const operation = (async () => {
      const workspace = this.app.workspace;
      let leaf = workspace.getLeavesOfType(VIEW_TYPE)
        .find((item) => item.getRoot() === workspace.rootSplit);
      let created = false;
      if (!leaf) {
        leaf = workspace.getLeaf('tab');
        created = true;
        await leaf.setViewState({ type: VIEW_TYPE, active: true });
      }
      if (this.unloaded) {
        if (created && leaf.getViewState?.().type === VIEW_TYPE) leaf.detach();
        return null;
      }
      await workspace.revealLeaf(leaf);
      if (!this.unloaded && typeof workspace.requestSaveLayout === 'function') {
        workspace.requestSaveLayout();
      }
      return leaf;
    })();
    this.openingPlanner = operation;
    const clearOpening = () => {
      if (this.openingPlanner === operation) this.openingPlanner = null;
    };
    void operation.then(clearOpening, clearOpening);
    return operation;
  }

  onunload() {
    this.unloaded = true;
    this.liveViews.clear();
    if (this.rolloverTimer !== null) {
      clearInterval(this.rolloverTimer);
      this.rolloverTimer = null;
    }
  }

  startRolloverChecks() {
    if (this.unloaded || this.storageBlocked || this.rolloverTimer !== null) return;
    const run = () => { void this.checkRollover().catch(() => undefined); };
    this.rolloverTimer = setInterval(run, 60000);
    this.registerInterval(this.rolloverTimer);
    if (typeof window !== 'undefined') this.registerDomEvent(window, 'focus', run);
    if (typeof document !== 'undefined') {
      this.registerDomEvent(document, 'visibilitychange', () => {
        if (document.visibilityState === 'visible') run();
      });
    }
  }

  checkRollover() {
    if (this.unloaded || this.storageBlocked || !this.state) return Promise.resolve(null);
    if (this.rolloverCheck) return this.rolloverCheck;
    const operation = this.saveQueue.then(async () => {
      if (this.unloaded || this.storageBlocked || !this.state) return null;
      // Read and calculate inside the write queue, after all earlier user writes.
      const current = validateStoredState(this.state);
      const result = engine.rolloverState(current, localDate());
      const snapshot = validateStoredState(result.state);
      if (JSON.stringify(snapshot) !== JSON.stringify(current)) {
        await this.persistState(snapshot);
        if (result.moved.length) {
          new Notice(h`已将 ${result.moved.length} 个未完成事项顺延到本周待办，请重新安排时间。`, 6000);
        }
      }
      return result;
    });
    this.saveQueue = operation.catch(() => undefined);
    const checked = operation.catch((error) => {
      new Notice(h`未完成事项尚未顺延，原安排已保留，将自动重试：${messageOf(error)}`, 8000);
      throw error;
    });
    this.rolloverCheck = checked;
    const clearCheck = () => {
      if (this.rolloverCheck === checked) this.rolloverCheck = null;
    };
    void checked.then(clearCheck, clearCheck);
    return checked;
  }

  async persistState(snapshot, sourceView) {
    await this.saveData(snapshot);
    this.state = snapshot;
    this.revision += 1;
    this.broadcastState(snapshot, this.revision, sourceView);
    return snapshot;
  }

  broadcastState(snapshot, revision, sourceView) {
    for (const view of this.liveViews) {
      if (view === sourceView || typeof view.receiveState !== 'function') continue;
      try {
        view.receiveState(snapshot, revision);
      } catch (error) {
        // Persistence already succeeded. A broken recipient must not fail this save
        // or stop other views from receiving the new state.
        try { new Notice(t('日程已保存，但另一个视图未能刷新，请重新打开该视图。'), 7000); } catch (_) { /* Keep the successful write successful. */ }
      }
    }
  }

  saveState(nextState, expectedRevision, sourceView) {
    if (this.storageBlocked) {
      return Promise.reject(new Error(t('原有日程数据需要修复，当前禁止保存。')));
    }

    let snapshot;
    try {
      snapshot = validateStoredState(nextState);
    } catch (error) {
      new Notice(h`日程未保存：${messageOf(error)}`, 7000);
      return Promise.reject(error);
    }

    const operation = this.saveQueue.then(async () => {
      if (this.storageBlocked) {
        throw new Error(t('原有日程数据需要修复，当前禁止保存。'));
      }
      if (!Number.isInteger(expectedRevision) || expectedRevision !== this.revision) {
        const error = new Error(t('日程已在另一视图更新，请关闭并重新打开此视图后继续；当前修改未覆盖已有安排。'));
        error.code = 'STALE_VIEW';
        throw error;
      }
      return this.persistState(snapshot, sourceView);
    });
    // A failed write must not prevent a later deliberate retry.
    this.saveQueue = operation.catch(() => undefined);
    return operation.catch((error) => {
      new Notice(error.code === 'STALE_VIEW'
        ? messageOf(error)
        : h`日程未保存，请重试：${messageOf(error)}`, 8000);
      throw error;
    });
  }

  exportBackup(rawState) {
    let snapshot;
    try {
      snapshot = validateStoredState(rawState);
    } catch (error) {
      new Notice(h`备份未导出：${messageOf(error)}`, 7000);
      return Promise.reject(error);
    }
    const operation = this.exportQueue.then(async () => {
      const folder = t('我的一周备份');
      if (!await this.app.vault.adapter.exists(folder)) {
        await this.app.vault.createFolder(folder);
      }
      const stem = h`我的一周-${backupTimestamp()}`;
      const contents = `${JSON.stringify(snapshot, null, 2)}\n`;
      for (let number = 0; number < 1000; number += 1) {
        const path = `${folder}/${stem}${number ? `-${number}` : ''}.json`;
        if (await this.app.vault.adapter.exists(path)) continue;
        try {
          await this.app.vault.create(path, contents);
          return path;
        } catch (error) {
          // A concurrent file creation must not cause an overwrite.
          if (await this.app.vault.adapter.exists(path)) continue;
          throw error;
        }
      }
      throw new Error(t('同一时间的备份文件过多，请稍后重新导出。'));
    });
    this.exportQueue = operation.catch(() => undefined);
    return operation.catch((error) => {
      new Notice(h`备份未导出：${messageOf(error)}`, 8000);
      throw error;
    });
  }
}

module.exports = WeeklyPlannerPlugin;
