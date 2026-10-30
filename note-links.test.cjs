const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const links = require('./note-links.js');
const external = (href, label = href) => ({ href, label, kind: 'external' });
const internal = (href, label = href) => ({ href, label, kind: 'internal' });

test('extracts external and internal forms in order and deduplicates by href plus kind', () => {
  const text = '先看 https://example.com/a，再看 www.example.org/path；[资料](https://example.com/a) ' +
    'obsidian://open?vault=Main&file=Note [[课程/财务管理]] [[每周计划|本周]] [[每周计划|另一个别名]]';
  assert.deepEqual(links.extractLinks(text), [
    external('https://example.com/a'), external('https://www.example.org/path', 'www.example.org/path'),
    external('obsidian://open?vault=Main&file=Note'), internal('课程/财务管理'), internal('每周计划', '本周')
  ]);
  assert.deepEqual(links.extractLinks('[第一份](https://x.test) [另一名](https://x.test)'), [external('https://x.test', '第一份')]);
});

test('bare URLs remove Chinese and English sentence punctuation and retain matched parentheses', () => {
  const text = '链接：https://zh.wikipedia.org/wiki/Foo_(bar)）。' +
    ' 下一条 https://example.com/a_(b_(c)), ' +
    'https://example.com/path?x=1&y=2！ ' +
    '(https://example.net/a). https://example.org/测试（内容）';
  assert.deepEqual(links.extractLinks(text), [
    external('https://zh.wikipedia.org/wiki/Foo_(bar)'), external('https://example.com/a_(b_(c))'),
    external('https://example.com/path?x=1&y=2'), external('https://example.net/a'), external('https://example.org/测试（内容）')
  ]);
  assert.deepEqual(links.extractLinks('看 https://[::1]:8080/path。'), [external('https://[::1]:8080/path')]);
});

test('Markdown handles brackets in labels and balanced or escaped URL parentheses', () => {
  const text = '[资料（第一版）](https://example.com/Foo_(bar)) ' +
    '[含 [子项] 的标签](https://example.com/a_(b_(c))) ' +
    '[转义\\]标签](https://example.com/a_\\(b\\)) ' +
    '[可选标题](<https://example.com/title> "页面标题")';
  assert.deepEqual(links.extractLinks(text), [
    external('https://example.com/Foo_(bar)', '资料（第一版）'),
    external('https://example.com/a_(b_(c))', '含 [子项] 的标签'),
    external('https://example.com/a_(b)', '转义]标签'), external('https://example.com/title', '可选标题')
  ]);
  assert.ok(links.renderLinkedText('[a](https://x.test/a_(b)) 后续').endsWith('</span></a> 后续'));
});

test('external anchors have safe navigation attributes and complete escaped href titles', () => {
  const html = links.renderLinkedText('[资料 & <说明>](https://example.com/?a=1&b=2)');
  assert.match(html, /^<a class="wp-note-link external-link" href="https:\/\/example\.com\/\?a=1&amp;b=2"/);
  for (const attribute of ['data-note-link="external"', 'data-href="https://example.com/?a=1&amp;b=2"', 'title="https://example.com/?a=1&amp;b=2"', 'target="_blank"', 'rel="noopener noreferrer"', 'draggable="false"']) {
    assert.ok(html.includes(attribute), 'missing safe anchor attribute: ' + attribute);
  }
  assert.ok(html.endsWith('<span>资料 &amp; &lt;说明&gt;</span></a>'));
  assert.equal(links.renderLink(external('www.example.com', '主页')).includes('href="https://www.example.com"'), true);
});

test('internal anchors keep raw note targets as escaped data and never navigate directly', () => {
  const html = links.renderLinkedText('[[课程/笔记#小节|<复习> & "内容"]]');
  assert.match(html, /^<a class="wp-note-link" href="#"/);
  assert.ok(html.includes('data-note-link="internal"'));
  assert.ok(html.includes('data-href="课程/笔记#小节"'));
  assert.ok(html.includes('title="课程/笔记#小节"'));
  assert.ok(html.includes('<span>&lt;复习&gt; &amp; &quot;内容&quot;</span>'));
  assert.ok(html.includes('draggable="false"'));
  assert.ok(!html.includes('target="_blank"'));
  assert.deepEqual(links.extractLinks('[[目标|]] [[目标#段落]]'), [internal('目标'), internal('目标#段落')]);
});

test('dangerous Markdown destinations remain literal and cannot leak nested https URLs', () => {
  const input = '[坏链接](javascript:alert("https://evil.test/path")) ' +
    '[数据](data:text/html,<a href="https://hidden.test">x</a>) ' +
    '[文件](file:///C:/https://hidden2.test) ' +
    '[未知](custom:payload(https://hidden3.test)) 之后 https://safe.test';
  assert.deepEqual(links.extractLinks(input), [external('https://safe.test')]);
  const html = links.renderLinkedText(input);
  assert.equal((html.match(/<a /g) || []).length, 1);
  assert.ok(html.includes('[坏链接](javascript:alert(&quot;https://evil.test/path&quot;))'));
  assert.ok(!html.includes('<a href="https://hidden.test"'));
  assert.deepEqual(links.extractLinks('[未结束](javascript:alert(https://hidden.test)\n下一行 https://safe.test'), [external('https://safe.test')]);
  assert.deepEqual(links.extractLinks('[括号攻击](javascript:alert("))https://nested.test")) 然后 https://safe.test'), [external('https://safe.test')]);
  assert.deepEqual(links.extractLinks('[角括号攻击](<javascript:alert("))https://nested.test")>) 然后 https://safe.test'), [external('https://safe.test')]);
});

test('unknown schemes and URI tricks remain literal including scheme-like wikilinks', () => {
  const input = 'javascript:alert("https://hidden.test") data:text/plain,https://hidden2.test ' +
    'ftp://server/https://hidden3.test file:///C:/note custom://host/www.hidden.test ' +
    '[[javascript:alert(1)]] [[data:text/html,hello]] [[file:///etc/passwd]]';
  assert.deepEqual(links.extractLinks(input), []);
  assert.equal((links.renderLinkedText(input).match(/<a /g) || []).length, 0);
  for (const href of ['javascript:alert(1)', ' JAVASCRIPT:alert(1)', 'java\nscript:alert(1)', 'data:text/html,hi', 'file:///C:/note', 'ftp://host/note', 'custom://open', '//example.com', 'https://', 'obsidian://']) {
    assert.equal(links.renderLink(external(href, '<标签>')), '&lt;标签&gt;');
  }
});

test('all HTML and image syntax is displayed as escaped text without interpreting tags or images', () => {
  const html = links.renderLinkedText('<script>alert("x")</script> <img src=x onerror=alert(1)>\n![图片](https://image.test/a.png) ![[附件.png]]');
  assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('![图片](https://image.test/a.png) ![[附件.png]]'));
  assert.equal((html.match(/<a /g) || []).length, 0);
  assert.ok(!/<(?:script|img)\b/i.test(html));
  const injected = links.renderLink(internal('笔记" data-bad="<script>', '<img onerror="alert(1)">'));
  assert.ok(injected.includes('data-href="笔记&quot; data-bad=&quot;&lt;script&gt;"'));
  assert.ok(injected.includes('<span>&lt;img onerror=&quot;alert(1)&quot;&gt;</span>'));
  assert.ok(!injected.includes(' data-bad="'));
});

test('renderLink revalidates arbitrary objects and renderLinkedText preserves literal whitespace', () => {
  assert.equal(links.renderLink({ kind: 'other', href: 'https://safe.test', label: 'x < y' }), 'x &lt; y');
  assert.equal(links.renderLink({ kind: 'internal', href: 'javascript:alert(1)', label: 'x & y' }), 'x &amp; y');
  assert.equal(links.renderLink(null), '');
  assert.equal(links.renderLinkedText(null), '');
  assert.deepEqual(links.extractLinks(undefined), []);
  assert.equal(links.renderLinkedText('  一行\n\t下一行  & <>'), '  一行\n\t下一行  &amp; &lt;&gt;');
  assert.equal(links.renderLink({ kind: 'external', href: 'https://safe.test', label: '" onclick="alert(1)' }).includes('<span>&quot; onclick=&quot;alert(1)</span>'), true);
});

test('long notes remain usable and the UMD browser global has the same API', () => {
  const input = '备注 '.repeat(3000) + 'https://safe.test [[笔记|别名]]';
  assert.equal(links.extractLinks(input).length, 2);
  const browser = { URL };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'note-links.js'), 'utf8'), browser);
  assert.equal(typeof browser.WeekPlannerNoteLinks.renderLink, 'function');
  assert.equal(browser.WeekPlannerNoteLinks.renderLinkedText('[[笔记]]'), links.renderLinkedText('[[笔记]]'));
});
