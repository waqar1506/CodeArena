export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderMarkdown(src) {
  const lines = String(src ?? '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inCode = false;
  let codeBuf = [];
  let listMode = null;

  const closeList = () => {
    if (listMode) {
      out.push(listMode === 'ul' ? '</ul>' : '</ol>');
      listMode = null;
    }
  };
  const inline = (t) =>
    escapeHtml(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');

  for (const raw of lines) {
    if (raw.startsWith('```')) {
      if (inCode) {
        out.push('<pre><code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>');
        codeBuf = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(raw);
      continue;
    }
    const h = raw.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList();
      const lvl = h[1].length + 2;
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      continue;
    }
    const li = raw.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      if (listMode !== 'ul') {
        closeList();
        out.push('<ul>');
        listMode = 'ul';
      }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }
    const ol = raw.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      if (listMode !== 'ol') {
        closeList();
        out.push('<ol>');
        listMode = 'ol';
      }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }
    if (raw.trim() === '') {
      closeList();
      continue;
    }
    closeList();
    out.push(`<p>${inline(raw)}</p>`);
  }
  if (inCode) out.push('<pre><code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>');
  closeList();
  return out.join('\n');
}

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function normalizeOutput(s) {
  return String(s ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');
}

export function outputsMatch(actual, expected) {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

export function sanitizeUsername(u) {
  return /^[a-zA-Z0-9_]{3,24}$/.test(u || '');
}

export function verdictLabel(v) {
  const map = {
    AC: 'Accepted',
    WA: 'Wrong Answer',
    TLE: 'Time Limit Exceeded',
    MLE: 'Memory Limit Exceeded',
    RE: 'Runtime Error',
    CE: 'Compilation Error',
    OLE: 'Output Limit Exceeded',
    IE: 'Internal Error',
  };
  return map[v] || v || '—';
}
