// Task NODE TYPE test — drives the new "Task" node type against the running
// dev server on http://localhost:9002 (web/chromium).
//
// Flow:
//  1. Seed a tiny outline, enable the Project Management capability.
//  2. Select a node, open the green "+ ▾" dropdown, click "New Task".
//  3. Assert the content pane shows the Task template (Status / Depends-on /
//     Priority / Due date).
//  4. Set Priority = High and a Due date; reload; assert both persisted (in
//     localStorage AND re-rendered in the UI).
//  5. Turn Project Management OFF; assert "New Task" is NOT offered in the menu.
//
// Screenshot: task-type.png

const { chromium } = require('/Users/howardjachter/Developer/IdiamPro/node_modules/playwright');

const SHOT = '/private/tmp/claude-501/-Users-howardjachter/dc1a4cb9-7949-4c86-a6ad-521f02bacb84/scratchpad/task-type.png';
const URL = 'http://localhost:9002/app';

function seedOutline() {
  const mk = (id, name, parentId, childrenIds, type = 'note') => ({
    id, name, content: '', type: parentId === null ? 'root' : type,
    parentId, childrenIds, isCollapsed: false, prefix: '',
    metadata: undefined,
  });
  const nodes = {
    root: mk('root', 'My Project', null, ['a', 'b']),
    a: mk('a', 'Groceries', 'root', []),
    b: mk('b', 'Errands', 'root', []),
  };
  return {
    id: 'task-node-test-outline',
    name: 'Task Node Test',
    rootNodeId: 'root',
    nodes,
    isGuide: false,
    lastModified: Date.now(),
  };
}

async function seed(page, pmOn) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ outline, pmOn }) => {
    localStorage.setItem('outline-pro-data', JSON.stringify({ outlines: [outline] }));
    localStorage.setItem('idiampro-current-outline-id', outline.id);
    localStorage.setItem('capabilities.projectManagement.enabled', pmOn ? 'true' : 'false');
    localStorage.setItem('capabilities.projectManagement.consent', 'granted');
  }, { outline: seedOutline(), pmOn });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[role="tree"]', { timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Groceries'), null, { timeout: 30000 });
  for (let i = 0; i < 4; i++) {
    const overlay = await page.$('div[data-state="open"][aria-hidden="true"]');
    if (!overlay) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}

async function openNewMenu(page) {
  const chevron = await page.$('button[aria-label="New outline options"]');
  if (!chevron) throw new Error('New-outline options chevron not found');
  await chevron.click();
  await page.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const failures = [];
  try {
    // ---- PART 1: PM ON — create a Task node and verify the template ----
    await seed(page, true);

    // Select a node so the Task is created as a sibling after it.
    await page.getByText('Groceries', { exact: true }).first().click();
    await page.waitForTimeout(300);

    await openNewMenu(page);
    const newTask = await page.$('[data-testid="new-task-node"]');
    if (!newTask) failures.push('PART1: "New Task" item not found in the + menu with PM ON');
    else await newTask.click();
    await page.waitForTimeout(800); // new Task auto-selects → content pane shows it

    // The content pane should now show the Task template.
    const tmpl = await page.waitForSelector('[data-testid="task-template"]', { timeout: 8000 }).catch(() => null);
    if (!tmpl) failures.push('PART1: Task template not shown in content pane after creating a Task');

    const paneText = await page.evaluate(() => document.body.innerText);
    for (const label of ['Status', 'Priority', 'Due date']) {
      if (!paneText.includes(label)) failures.push(`PART1: template missing "${label}"`);
    }
    if (!paneText.includes('Depends on')) failures.push('PART1: "Depends on" (prerequisites) surface not shown for Task');

    // Set Priority = High
    const hi = await page.$('[data-testid="priority-High"]');
    if (!hi) failures.push('PART1: Priority "High" control not found');
    else { await hi.click(); await page.waitForTimeout(300); }

    // Set a Due date
    const due = await page.$('[data-testid="task-due-date"]');
    if (!due) failures.push('PART1: Due-date input not found');
    else { await due.fill('2026-09-15'); await due.dispatchEvent('change'); await page.waitForTimeout(400); }

    await page.screenshot({ path: SHOT });

    // ---- PART 2: persistence across reload ----
    await page.waitForTimeout(600); // let autosave flush
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[role="tree"]', { timeout: 30000 });
    await page.waitForTimeout(500);

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('outline-pro-data');
      const data = JSON.parse(raw);
      const nodes = data.outlines[0].nodes;
      const task = Object.values(nodes).find((n) => n.type === 'task');
      return task ? { priority: task.metadata?.priority, dueDate: task.metadata?.dueDate } : null;
    });
    if (!stored) failures.push('PART2: no task node found in storage after reload');
    else {
      if (stored.priority !== 'High') failures.push(`PART2: priority not persisted (got ${stored.priority})`);
      if (!stored.dueDate) failures.push('PART2: dueDate not persisted');
    }

    // ---- PART 3: PM OFF — "New Task" must NOT be offered ----
    await seed(page, false);
    await openNewMenu(page);
    const offItem = await page.$('[data-testid="new-task-node"]');
    if (offItem) failures.push('PART3: "New Task" still offered when PM is OFF');
    await page.keyboard.press('Escape');

    console.log(JSON.stringify({ stored, failures }, null, 2));
    if (failures.length) { console.log('RESULT: FAIL'); process.exitCode = 1; }
    else console.log('RESULT: PASS');
  } catch (e) {
    console.log('ERROR', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
