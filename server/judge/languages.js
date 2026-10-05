export const LANGUAGES = {
  cpp: { id: 'cpp', label: 'C++17 (g++)', ext: 'cpp', compiled: true },
  python: { id: 'python', label: 'Python 3.11', ext: 'py', compiled: false },
  java: { id: 'java', label: 'Java 16', ext: 'java', compiled: true },
  javascript: { id: 'javascript', label: 'Node.js 26', ext: 'js', compiled: false },
};

export function getLanguage(id) {
  return LANGUAGES[id] || null;
}

export function detectJavaClass(source) {
  const pub = source.match(/public\s+(?:final\s+|abstract\s+)*class\s+([A-Za-z_$][\w$]*)/);
  if (pub) return pub[1];
  const any = source.match(/(?:^|\n)\s*(?:public\s+)?(?:final\s+|abstract\s+)*class\s+([A-Za-z_$][\w$]*)/);
  if (any) return any[1];
  return 'Main';
}

export function sourceFileName(langId, source) {
  const lang = LANGUAGES[langId];
  if (!lang) return 'main.txt';
  if (langId === 'java') return detectJavaClass(source) + '.java';
  if (langId === 'javascript') {
    const esm = /^\s*(import\s+[^'"]|import\s+['"]|export\s+(default|const|let|var|function|class))/m.test(source);
    return esm ? 'main.mjs' : 'main.cjs';
  }
  return 'main.' + lang.ext;
}

export function compileCommand(langId, files) {
  if (langId === 'cpp') {
    return { cmd: 'g++', args: ['-O2', '-std=c++1z', '-o', 'main.exe', files.source] };
  }
  if (langId === 'java') {
    return { cmd: 'javac', args: ['-encoding', 'UTF-8', '-d', '.', files.source] };
  }
  return null;
}

export function runCommand(langId, files, limits) {
  if (langId === 'cpp') return { cmd: 'main.exe', args: [] };
  if (langId === 'python') return { cmd: 'python', args: ['-u', '-X', 'utf8', files.source] };
  if (langId === 'javascript') {
    return { cmd: 'node', args: [`--max-old-space-size=${limits.memoryMb}`, '--stack-size=2000', files.source] };
  }
  if (langId === 'java') {
    const cls = files.source.replace(/\.java$/, '');
    return {
      cmd: 'java',
      args: [`-Xmx${Math.max(32, limits.memoryMb - 64)}m`, '-Xss16m', '-XX:+UseSerialGC', '-cp', '.', cls],
    };
  }
  throw new Error('Unknown language: ' + langId);
}
