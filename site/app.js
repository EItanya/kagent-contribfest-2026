const lessons = [...document.querySelectorAll('.lesson')];
const links = [...document.querySelectorAll('[data-chapter]')];
const completion = document.querySelector('#complete');
const sidebar = document.querySelector('#sidebar');
const menu = document.querySelector('#menu');
const backdrop = document.querySelector('#backdrop');
const announcement = document.querySelector('#announcement');
document.querySelectorAll('.setup-options').forEach((options) => {
  const tablist = options.querySelector('.setup-tablist');
  const tabs = [...tablist.querySelectorAll('button')];
  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls')));
  function selectTab(selected) {
    tabs.forEach((tab, index) => {
      tab.setAttribute('aria-selected', String(index === selected));
      tab.tabIndex = index === selected ? 0 : -1;
      panels[index].hidden = index !== selected;
    });
  }
  tablist.setAttribute('role', 'tablist');
  tabs.forEach((tab, index) => {
    tab.setAttribute('role', 'tab');
    panels[index].setAttribute('role', 'tabpanel');
    panels[index].setAttribute('aria-labelledby', tab.id);
    panels[index].tabIndex = 0;
    tab.addEventListener('click', () => selectTab(index));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(next);
      tabs[next].focus();
    });
  });
  selectTab(0);
  tablist.hidden = false;
});
let completed = new Set();
try {
  const saved = JSON.parse(localStorage.getItem('kagent-workshop-v1') || '[]');
  if (Array.isArray(saved)) completed = new Set(saved.filter((id) => lessons.some((lesson) => lesson.id === id)));
} catch {}
let current = 0;
function closeMenu() {
  sidebar.dataset.open = 'false';
  menu.setAttribute('aria-expanded', 'false');
  backdrop.hidden = true;
}
function updateProgress() {
  document.querySelector('#progress').value = completed.size;
  document.querySelector('#progress-label').textContent = `${completed.size} / ${lessons.length} complete`;
  completion.checked = completed.has(lessons[current].id);
  links.forEach((link) => { link.dataset.complete = String(completed.has(link.dataset.chapter)); });
}
function celebrateCompletion() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelector('.completion-fireworks')?.remove();
  const bounds = completion.getBoundingClientRect();
  const originX = Math.max(76, Math.min(window.innerWidth - 76, bounds.left + bounds.width / 2));
  const originY = Math.max(60, Math.min(window.innerHeight - 48, bounds.top - 16));
  const fireworks = document.createElement('div');
  fireworks.className = 'completion-fireworks';
  fireworks.setAttribute('aria-hidden', 'true');
  const duration = 1200;
  const stagger = 160;
  fireworks.style.setProperty('--firework-duration', `${duration}ms`);
  const bursts = [
    { x: 0, y: -16, color: 'var(--accent)' },
    { x: -42, y: 0, color: '#22805e' },
    { x: 42, y: -8, color: '#e26c50' },
  ];
  bursts.forEach((burst, burstIndex) => {
    for (let sparkIndex = 0; sparkIndex < 12; sparkIndex += 1) {
      const angle = sparkIndex * Math.PI / 6;
      const spark = document.createElement('span');
      spark.className = 'firework-spark';
      spark.style.left = `${originX + burst.x}px`;
      spark.style.top = `${originY + burst.y}px`;
      spark.style.background = burst.color;
      spark.style.animationDelay = `${burstIndex * stagger}ms`;
      spark.style.setProperty('--spark-x', `${Math.cos(angle) * 32}px`);
      spark.style.setProperty('--spark-y', `${Math.sin(angle) * 32 + 8}px`);
      spark.style.setProperty('--spark-angle', `${angle + Math.PI / 2}rad`);
      fireworks.append(spark);
    }
  });
  document.body.append(fireworks);
  setTimeout(() => fireworks.remove(), duration + stagger * (bursts.length - 1));
}
function navigate(focus = false) {
  const id = location.hash.slice(1);
  current = Math.max(0, lessons.findIndex((lesson) => lesson.id === id));
  lessons.forEach((lesson, index) => { lesson.hidden = index !== current; });
  links.forEach((link, index) => {
    if (index === current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const title = links[current].querySelector('span:nth-child(2)').textContent;
  document.querySelector('#current-title').textContent = title;
  document.title = `${title} · kagent ContribFest`;
  const previous = document.querySelector('#previous');
  const next = document.querySelector('#next');
  previous.hidden = current === 0;
  previous.href = `#${lessons[Math.max(0, current - 1)].id}`;
  next.hidden = current === lessons.length - 1;
  next.href = `#${lessons[Math.min(lessons.length - 1, current + 1)].id}`;
  next.querySelector('span').textContent = links[Math.min(lessons.length - 1, current + 1)].querySelector('span:nth-child(2)').textContent;
  updateProgress();
  closeMenu();
  window.scrollTo(0, 0);
  if (focus) document.querySelector('#content').focus({ preventScroll: true });
}
completion.addEventListener('change', () => {
  const id = lessons[current].id;
  if (completion.checked) {
    completed.add(id);
    celebrateCompletion();
  } else completed.delete(id);
  try { localStorage.setItem('kagent-workshop-v1', JSON.stringify([...completed])); } catch {}
  updateProgress();
});
menu.addEventListener('click', () => {
  const open = sidebar.dataset.open !== 'true';
  sidebar.dataset.open = String(open);
  menu.setAttribute('aria-expanded', String(open));
  backdrop.hidden = !open;
  if (open) document.querySelector('#search').focus();
});
backdrop.addEventListener('click', closeMenu);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && sidebar.dataset.open === 'true') { closeMenu(); menu.focus(); }
});
document.querySelector('#search').addEventListener('input', (event) => {
  const query = event.target.value.trim().toLowerCase();
  links.forEach((link, index) => { link.closest('li').hidden = !lessons[index].textContent.toLowerCase().includes(query) && !link.textContent.toLowerCase().includes(query); });
  document.querySelector('#no-results').hidden = links.some((link) => !link.closest('li').hidden);
});
document.querySelectorAll('pre').forEach((pre) => {
  const code = pre.querySelector('code');
  const button = document.createElement('button');
  button.className = 'copy-button';
  button.type = 'button';
  button.setAttribute('aria-label', 'Copy code');
  button.title = 'Copy code';
  button.innerHTML = '<i data-lucide="copy" aria-hidden="true"></i>';
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent.trim());
      button.innerHTML = '<i data-lucide="check" aria-hidden="true"></i>';
      button.setAttribute('aria-label', 'Copied');
      announcement.textContent = 'Copied';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      button.dataset.error = 'true';
      announcement.textContent = 'Copy unavailable. Code selected.';
    }
    window.lucide?.createIcons();
    setTimeout(() => {
      button.innerHTML = '<i data-lucide="copy" aria-hidden="true"></i>';
      button.setAttribute('aria-label', 'Copy code');
      delete button.dataset.error;
      window.lucide?.createIcons();
    }, 1800);
  });
  pre.append(button);
});
document.querySelectorAll('table').forEach((table) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'table-scroll';
  wrapper.tabIndex = 0;
  wrapper.setAttribute('role', 'region');
  wrapper.setAttribute('aria-label', 'Project components');
  table.replaceWith(wrapper);
  wrapper.append(table);
});
window.addEventListener('hashchange', () => navigate(true));
navigate();
window.lucide?.createIcons();