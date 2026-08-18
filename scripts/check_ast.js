import fs from 'fs';
import path from 'path';
import parser from '@babel/parser';
import _traverse from '@babel/traverse';
const traverse = _traverse.default || _traverse;

const globals = new Set([
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage',
  'fetch', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'encodeURIComponent', 'decodeURIComponent', 'btoa', 'atob',
  'Math', 'JSON', 'Date', 'Promise', 'Array', 'Object', 'String', 'Number', 'Boolean',
  'Error', 'RegExp', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'parseInt', 'parseFloat',
  'isNaN', 'isFinite', 'alert', 'confirm', 'prompt', 'location', 'history',
  'FormData', 'Blob', 'File', 'FileReader', 'URL', 'URLSearchParams', 'Headers', 'Request', 'Response',
  'Event', 'CustomEvent', 'MessagePort', 'WebSocket', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver',
  'React', 'process', 'global', 'module', 'require', 'exports', '__dirname', '__filename'
]);

function getAllFiles(dir, allFiles = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, allFiles);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      allFiles.push(fullPath);
    }
  }
  return allFiles;
}

const files = getAllFiles('resources/js');
let totalErrors = 0;
console.log(`[AST Scope Audit] Analyzing ${files.length} React / JSX files for missing imports and undeclared identifiers...`);

for (const file of files) {
  const code = fs.readFileSync(file, 'utf-8');
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx']
    });
  } catch (err) {
    console.error(`❌ Parse error in ${file}:`, err.message);
    totalErrors++;
    continue;
  }

  const undeclared = new Set();

  traverse(ast, {
    JSXIdentifier(p) {
      if (p.parent.type === 'JSXOpeningElement' && p.parent.name === p.node) {
        const name = p.node.name;
        if (/^[A-Z]/.test(name)) {
          if (!p.scope.hasBinding(name) && !globals.has(name)) {
            undeclared.add(name);
          }
        }
      } else if (p.parent.type === 'JSXMemberExpression' && p.parent.object === p.node) {
        const name = p.node.name;
        if (/^[A-Z]/.test(name)) {
          if (!p.scope.hasBinding(name) && !globals.has(name)) {
            undeclared.add(name);
          }
        }
      }
    },
    Identifier(p) {
      if (p.isReferencedIdentifier()) {
        const name = p.node.name;
        if (!p.scope.hasBinding(name) && !globals.has(name)) {
          undeclared.add(name);
        }
      }
    }
  });

  if (undeclared.size > 0) {
    console.error(`❌ ${file}:`);
    for (const name of undeclared) {
      console.error(`   -> Undeclared reference: <${name}>`);
      totalErrors++;
    }
  }
}

if (totalErrors === 0) {
  console.log(`✅ [AST Scope Audit PASSED]: 100% of all ${files.length} files have zero missing imports or undefined variables.\n`);
  process.exit(0);
} else {
  console.error(`\n💥 [AST Scope Audit FAILED]: Found ${totalErrors} undeclared references!\n`);
  process.exit(1);
}
