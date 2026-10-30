(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WeekPlannerNoteLinks = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  function asText(value) { return value == null ? '' : String(value); }
  function escapeHtml(value) {
    return asText(value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }
  function externalHref(value) {
    if (typeof value !== 'string' || !value || /[\s\x00-\x1f\x7f]/.test(value)) return null;
    var href = /^www\./i.test(value) ? 'https://' + value : value;
    if (!/^(?:https?|obsidian):\/\//i.test(href)) return null;
    try {
      var parsed = new URL(href);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.hostname ? href : null;
      if (parsed.protocol === 'obsidian:' && href.slice(href.indexOf('://') + 3)) return href;
    } catch (_) { /* Malformed URLs remain literal text. */ }
    return null;
  }
  function internalHref(value) {
    if (typeof value !== 'string' || !value.trim() || /[\x00-\x1f\x7f]/.test(value)) return null;
    // A wikilink is a note target, never an alternate way to execute a URI scheme.
    if (/^[a-z][a-z0-9+.-]*:/i.test(value.trim()) || value.indexOf('//') === 0) return null;
    return value;
  }
  function renderLink(link) {
    var label = link && typeof link.label === 'string' ? link.label : link && typeof link.href === 'string' ? link.href : '';
    if (!link || (link.kind !== 'external' && link.kind !== 'internal')) return escapeHtml(label);
    var href = link.kind === 'external' ? externalHref(link.href) : internalHref(link.href);
    if (href === null) return escapeHtml(label);
    var attrs = ' class="wp-note-link' + (link.kind === 'external' ? ' external-link' : '') + '" href="' + (link.kind === 'external' ? escapeHtml(href) : '#') + '" data-note-link="' + link.kind + '" data-href="' + escapeHtml(href) + '" title="' + escapeHtml(href) + '"';
    if (link.kind === 'external') attrs += ' target="_blank" rel="noopener noreferrer"';
    return '<a' + attrs + ' draggable="false"><span>' + escapeHtml(label) + '</span></a>';
  }

  function isBoundary(text, index) {
    return index === 0 || !/[a-z0-9_@./:+-]/i.test(text.charAt(index - 1));
  }
  function unescapeMarkdown(text) { return text.replace(/\\([\\`*{}\[\]()#+\-.!_|<>])/g, '$1'); }
  function bracketEnd(text, start, open, close, protectQuoted) {
    var depth = 0, quote = '';
    for (var index = start; index < text.length; index += 1) {
      var character = text.charAt(index);
      if (character === '\\') { index += 1; continue; }
      if (character === '\n' || character === '\r') return -1;
      if (quote) { if (character === quote) quote = ''; continue; }
      if (protectQuoted && (character === '"' || character === "'")) { quote = character; continue; }
      if (character === open) depth += 1;
      else if (character === close) {
        depth -= 1;
        if (depth === 0) return index;
      }
    }
    return -1;
  }
  function lineEnd(text, start) {
    var end = text.indexOf('\n', start);
    return end === -1 ? text.length : end;
  }
  function destination(raw) {
    var value = raw.trim();
    if (value.charAt(0) === '<') {
      var close = value.indexOf('>');
      if (close < 0) return null;
      var tail = value.slice(close + 1).trim();
      if (tail && !/^(?:"[^"\r\n]*"|'[^'\r\n]*')$/.test(tail)) return null;
      return unescapeMarkdown(value.slice(1, close));
    }
    // Optional quoted Markdown titles are ignored; the original URL is the title.
    var title = /^(\S+)\s+(?:"[^"\r\n]*"|'[^'\r\n]*')$/.exec(value);
    return unescapeMarkdown(title ? title[1] : value);
  }
  function markdownAt(text, start) {
    var labelEnd = bracketEnd(text, start, '[', ']');
    if (labelEnd === -1) return null;
    var targetStart = labelEnd + 1;
    while (text.charAt(targetStart) === ' ' || text.charAt(targetStart) === '\t') targetStart += 1;
    if (text.charAt(targetStart) !== '(') return null;
    var targetHead = text.slice(targetStart + 1).replace(/^\s+/, '').replace(/^<\s*/, '');
    var protectedDestination = !/^(?:https?:\/\/|obsidian:\/\/|www\.)/i.test(targetHead);
    var end = bracketEnd(text, targetStart, '(', ')', protectedDestination);
    // Protect an unfinished destination too: nested URLs are not separate links.
    if (end === -1) return { end: lineEnd(text, targetStart), link: null };
    var value = destination(text.slice(targetStart + 1, end));
    var href = value === null ? null : externalHref(value);
    return { end: end + 1, link: href === null ? null : { href: href, label: unescapeMarkdown(text.slice(start + 1, labelEnd)), kind: 'external' } };
  }
  function wikiAt(text, start) {
    if (text.slice(start, start + 2) !== '[[') return null;
    var end = text.indexOf(']]', start + 2);
    if (end === -1 || /[\r\n]/.test(text.slice(start + 2, end))) return null;
    var content = text.slice(start + 2, end);
    var separator = content.indexOf('|');
    var target = separator === -1 ? content : content.slice(0, separator);
    var label = separator === -1 ? target : content.slice(separator + 1) || target;
    var href = internalHref(target);
    return { end: end + 2, link: href === null ? null : { href: href, label: label, kind: 'internal' } };
  }
  function bareEnd(text, start) {
    var index = start;
    while (index < text.length && !/[\s<>"'`\\，。；：！？、…“”‘’]/.test(text.charAt(index))) index += 1;
    return index;
  }
  function protectedSchemeEnd(text, start) {
    var index = start, depth = 0, quote = '';
    for (; index < text.length; index += 1) {
      var character = text.charAt(index);
      if (character === '\n' || character === '\r') break;
      if (character === '\\') { index += 1; continue; }
      if (quote) { if (character === quote) quote = ''; continue; }
      if ((character === '"' || character === "'") && depth > 0) { quote = character; continue; }
      if (character === '(') depth += 1;
      else if (character === ')' && depth > 0) depth -= 1;
      if (depth === 0 && /[\s<>]/.test(character)) break;
    }
    return index;
  }
  function trimBare(value) {
    var pairs = { ')': '(', ']': '[', '}': '{', '）': '（', '］': '［', '｝': '｛', '】': '【', '》': '《', '」': '「', '』': '『' };
    var previous;
    do {
      previous = value;
      value = value.replace(/[.,;:!?。，、；：！？…“”‘’]+$/, '');
      var last = value.charAt(value.length - 1), open = pairs[last];
      if (open) {
        var opened = 0, closed = 0;
        for (var index = 0; index < value.length; index += 1) {
          if (value.charAt(index) === open) opened += 1;
          if (value.charAt(index) === last) closed += 1;
        }
        if (closed > opened) value = value.slice(0, -1);
      }
    } while (value !== previous);
    return value;
  }
  function tokens(text) {
    var result = [], index = 0;
    while (index < text.length) {
      var start = index, parsed;
      if (text.charAt(index) === '!' && text.charAt(index + 1) === '[') {
        parsed = wikiAt(text, index + 1) || markdownAt(text, index + 1);
        if (parsed) { index = parsed.end; continue; } // Images/embeds remain literal.
      }
      if (text.charAt(index) === '[') {
        parsed = wikiAt(text, index) || markdownAt(text, index);
        if (parsed) {
          if (parsed.link) result.push({ start: start, end: parsed.end, link: parsed.link });
          index = parsed.end;
          continue;
        }
      }
      if (isBoundary(text, index)) {
        var rest = text.slice(index);
        var scheme = /^[a-z][a-z0-9+.-]*:/i.exec(rest);
        var allowed = /^(?:https?:\/\/|obsidian:\/\/|www\.)/i.test(rest);
        if (allowed) {
          var end = bareEnd(text, index);
          var raw = trimBare(text.slice(index, end));
          var href = externalHref(raw);
          if (href !== null) result.push({ start: start, end: start + raw.length, link: { href: href, label: raw, kind: 'external' } });
          index = Math.max(index + 1, end);
          continue;
        }
        if (scheme) { index = Math.max(index + 1, protectedSchemeEnd(text, index)); continue; }
      }
      index += 1;
    }
    return result;
  }
  function extractLinks(text) {
    var seen = new Set();
    return tokens(asText(text)).filter(function (token) {
      var key = JSON.stringify([token.link.kind, token.link.href]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(function (token) { return { href: token.link.href, label: token.link.label, kind: token.link.kind }; });
  }
  function renderLinkedText(text) {
    text = asText(text);
    var output = '', cursor = 0;
    tokens(text).forEach(function (token) {
      output += escapeHtml(text.slice(cursor, token.start)) + renderLink(token.link);
      cursor = token.end;
    });
    return output + escapeHtml(text.slice(cursor));
  }
  return { extractLinks: extractLinks, renderLinkedText: renderLinkedText, renderLink: renderLink };
});
