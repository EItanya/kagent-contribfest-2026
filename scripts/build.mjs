import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { marked } from 'marked';
import { fileURLToPath } from 'node:url';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import go from 'highlight.js/lib/languages/go';
import bash from 'highlight.js/lib/languages/bash';
import yaml from 'highlight.js/lib/languages/yaml';
import protobuf from 'highlight.js/lib/languages/protobuf';

const root = new URL('../', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');
const guide = await read('participant-guide.md');
const sourceFiles = new Map([
  ['ui/src/api/domain/agents.ts', 'ui/src/api/domain/agents.ts'],
  ['ui/src/api/domain/agents.test.ts', 'ui/src/api/domain/agents.test.ts'],
  ['ui/src/pages/AgentsPage.tsx', 'ui/src/pages/AgentsPage.tsx'],
  ['src/pages/AgentsPage.tsx', 'ui/src/pages/AgentsPage.tsx'],
  ['src/api/index.ts', 'ui/src/api/index.ts'],
  ['ui/src/api/grpc/operations.ts', 'ui/src/api/grpc/operations.ts'],
  ['proto/kagent/api/v1/agents.proto', 'proto/kagent/api/v1/agents.proto'],
  ['go/core/internal/grpcserver/agent.go', 'go/core/internal/grpcserver/agent.go'],
  ['go/core/internal/grpcserver/agent_test.go', 'go/core/internal/grpcserver/agent_test.go'],
]);
const newFiles = new Set([
  'go/core/internal/service/agentstatus/status.go',
  'go/core/internal/service/agentstatus/status_test.go',
]);
const workingDirectories = new Map([
  ['parent', 'Parent of your kagent checkout'],
  ['any', 'Any directory'],
  ['kagent', 'kagent/'],
  ['kagent/ui', 'kagent/ui/'],
  ['kagent/go', 'kagent/go/'],
]);

for (const [language, grammar] of Object.entries({ typescript, go, bash, yaml, protobuf })) {
  hljs.registerLanguage(language, grammar);
}
marked.use({
  renderer: {
    codespan({ text }) {
      const isNew = newFiles.has(text);
      const path = isNew ? 'go/core/internal/service' : sourceFiles.get(text);
      if (!path) return false;
      const url = `https://github.com/kagent-dev/kagent/${isNew ? 'tree' : 'blob'}/main/${path}`;
      const title = isNew ? 'New file; open its parent folder on GitHub' : 'Open source on main on GitHub';
      return `<a class="source-link" href="${url}" target="_blank" rel="noopener noreferrer" title="${title}"><code>${text}</code><i data-lucide="${isNew ? 'folder' : 'arrow-up-right'}" aria-hidden="true"></i></a>`;
    },
    code({ text, lang }) {
      const language = lang?.trim().split(/\s+/)[0].toLowerCase();
      if (!language || !hljs.getLanguage(language)) return false;
      const directory = lang.match(/(?:^|\s)cwd=(\S+)/)?.[1];
      if (['sh', 'bash'].includes(language) && !directory) throw new Error('Shell blocks need explicit cwd metadata.');
      if (directory && !workingDirectories.has(directory)) throw new Error(`Unknown working directory: ${directory}`);
      const context = directory ? `<div class="code-context"><i data-lucide="folder" aria-hidden="true"></i><span>Working directory:</span><strong>${workingDirectories.get(directory)}</strong></div>\n` : '';
      const highlighted = hljs.highlight(text, { language, ignoreIllegals: true }).value;
      return `${context}<pre><code class="hljs language-${language}">${highlighted}\n</code></pre>\n`;
    },
  },
});

const titles = ['What you will build', 'Prepare & warm builds', 'How kagent works', 'Agent lifecycle', 'Run the UI', 'Add the function', 'Write the tests', 'Connect the page', 'Controller status', 'Install finished images', 'Verify live', 'Verify packaged UI'];
const ids = ['feature', 'install', 'kagent', 'lifecycle', 'run-ui', 'function', 'tests', 'page', 'backend', 'deploy-controller', 'verify', 'deploy'];
const parts = guide.split(/^## /m).slice(1);
if (parts.length !== titles.length) throw new Error('Update the chapter map to match the guide.');
const chapters = parts.map((part, index) => {
  const [heading, ...lines] = part.split('\n');
  const content = lines.join('\n').replace(
    /<!-- setup:codespaces -->([\s\S]*?)<!-- setup:local -->([\s\S]*?)<!-- setup:end -->/,
    (_, codespaces, local) => `<div class="setup-options">
<div class="setup-tablist" aria-label="Workshop environment" hidden>
<button type="button" id="setup-tab-codespaces" aria-controls="setup-panel-codespaces">GitHub Codespaces</button>
<button type="button" id="setup-tab-local" aria-controls="setup-panel-local">VS Code (Local)</button>
</div>
<div id="setup-panel-codespaces" class="setup-panel">\n\n${codespaces.trim()}\n\n</div>
<div id="setup-panel-local" class="setup-panel">\n\n${local.trim()}\n\n</div>
</div>\n`,
  );
  return { id: ids[index], title: titles[index], heading: heading.replace(/^\d+\. /, ''), html: marked.parse(content) };
});
const navigation = chapters.map((chapter, index) => `<li><a href="#${chapter.id}" data-chapter="${chapter.id}"><span class="chapter-number">${String(index + 1).padStart(2, '0')}</span><span>${chapter.title}</span><i data-lucide="check" class="chapter-check" aria-hidden="true"></i></a></li>`).join('');
const sections = chapters.map((chapter) => `<section id="${chapter.id}" class="lesson" aria-labelledby="heading-${chapter.id}"><h1 id="heading-${chapter.id}">${chapter.heading}</h1>${chapter.html}</section>`).join('\n');
const template = await read('site/template.html');
const html = template.replace('<!-- NAVIGATION -->', navigation).replace('<!-- LESSONS -->', sections)
  .replaceAll('CHAPTER_COUNT', String(chapters.length))
  .replace('/* STYLES */', await read('site/styles.css')).replace('/* APPLICATION */', await read('site/app.js'));
await mkdir(new URL('dist/assets/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), html);
await copyFile(new URL('participant-guide.md', root), new URL('dist/participant-guide.md', root));
await copyFile(new URL('site/kagent.svg', root), new URL('dist/assets/kagent.svg', root));
await copyFile(new URL('node_modules/lucide/dist/umd/lucide.min.js', root), new URL('dist/assets/lucide.js', root));
for (const weight of [400, 500, 600, 700]) {
  await copyFile(new URL(`node_modules/@fontsource/dm-sans/files/dm-sans-latin-${weight}-normal.woff2`, root), new URL(`dist/assets/dm-sans-${weight}.woff2`, root));
}
console.log(`Built ${chapters.length} chapters: ${fileURLToPath(new URL('dist/index.html', root))}`);