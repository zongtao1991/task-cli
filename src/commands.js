const { v4: uuidv4 } = require('uuid');
const chalk = require('chalk');
const Table = require('cli-table3');
const { readTasks, writeTasks } = require('./storage');

const VALID_PRIORITIES = ['low', 'medium', 'high'];
const VALID_SORT_FIELDS = ['priority', 'due', 'created'];
const PRIORITY_ORDER = { high: 1, medium: 2, low: 3 };
const STATUS_ORDER = { pending: 1, completed: 2 };
const PRIORITY_COLOR = {
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.green,
};

function isValidPriority(priority) {
  return VALID_PRIORITIES.includes(priority);
}

function isValidSortField(field) {
  return VALID_SORT_FIELDS.includes(field);
}

function isValidDate(dateString) {
  if (!dateString) return true;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

function isOverdue(task) {
  if (task.status === 'completed') return false;
  if (!task.due) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(task.due);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate < today;
}

function formatSortInfo(sortField) {
  const sortNames = {
    priority: 'priority',
    due: 'due',
    created: 'created'
  };
  return `排序: status → ${sortNames[sortField] || sortField}`;
}

function compareTasks(a, b, sortField) {
  const statusA = STATUS_ORDER[a.status] || 999;
  const statusB = STATUS_ORDER[b.status] || 999;
  
  if (statusA !== statusB) {
    return statusA - statusB;
  }
  
  switch (sortField) {
    case 'priority':
      const priorityA = PRIORITY_ORDER[a.priority] || 999;
      const priorityB = PRIORITY_ORDER[b.priority] || 999;
      return priorityA - priorityB;
    
    case 'due':
      if (a.due === b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return new Date(a.due) - new Date(b.due);
    
    case 'created':
    default:
      return new Date(a.createdAt) - new Date(b.createdAt);
  }
}

function findTaskById(tasks, id) {
  const exactMatch = tasks.find(t => t.id === id);
  if (exactMatch) {
    return { task: exactMatch, ambiguous: false };
  }
  
  const shortMatches = tasks.filter(t => t.id.startsWith(id));
  if (shortMatches.length === 1) {
    return { task: shortMatches[0], ambiguous: false };
  } else if (shortMatches.length > 1) {
    return { task: null, ambiguous: true, matches: shortMatches };
  }
  
  return { task: null, ambiguous: false };
}

function addTask(title, options) {
  const tasks = readTasks();

  if (!isValidPriority(options.priority)) {
    console.log(chalk.red(`✗ 无效的优先级: ${options.priority}`));
    console.log(chalk.gray(`  可用优先级: ${VALID_PRIORITIES.join(', ')}`));
    return;
  }

  if (!isValidDate(options.due)) {
    console.log(chalk.red(`✗ 无效的截止日期: ${options.due}`));
    console.log(chalk.gray(`  请使用格式: YYYY-MM-DD (例如: 2024-12-31)`));
    return;
  }

  const task = {
    id: uuidv4(),
    title,
    priority: options.priority,
    due: options.due || null,
    status: 'pending',
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  tasks.push(task);
  writeTasks(tasks);

  console.log(chalk.green(`✓ 任务已添加: ${title}`));
  console.log(chalk.gray(`  任务 ID: ${task.id.slice(0, 8)} (可用于操作)`));
}

function listTasks(options) {
  const tasks = readTasks();

  let filtered = tasks;

  if (options.status) {
    if (!['pending', 'completed'].includes(options.status)) {
      console.log(chalk.red(`✗ 无效的状态: ${options.status}`));
      console.log(chalk.gray(`  可用状态: pending, completed`));
      return;
    }
    filtered = filtered.filter(t => t.status === options.status);
  }

  if (options.priority) {
    if (!isValidPriority(options.priority)) {
      console.log(chalk.red(`✗ 无效的优先级: ${options.priority}`));
      console.log(chalk.gray(`  可用优先级: ${VALID_PRIORITIES.join(', ')}`));
      return;
    }
    filtered = filtered.filter(t => t.priority === options.priority);
  }

  const sortField = options.sort || 'created';
  if (!isValidSortField(sortField)) {
    console.log(chalk.red(`✗ 无效的排序字段: ${sortField}`));
    console.log(chalk.gray(`  可用排序字段: ${VALID_SORT_FIELDS.join(', ')}`));
    return;
  }

  filtered.sort((a, b) => compareTasks(a, b, sortField));

  if (filtered.length === 0) {
    console.log(chalk.gray('暂无任务'));
    return;
  }

  console.log(chalk.cyan(`\n${formatSortInfo(sortField)}\n`));

  const table = new Table({
    head: ['#', 'ID', '标题', '优先级', '截止日期', '状态', '创建时间'],
    colWidths: [4, 10, 30, 10, 14, 12, 22],
  });

  filtered.forEach((task, index) => {
    const priorityFn = PRIORITY_COLOR[task.priority] || chalk.white;
    const statusText = task.status === 'completed'
      ? chalk.gray('已完成')
      : chalk.cyan('待处理');
    
    let dueText;
    if (isOverdue(task)) {
      dueText = chalk.red('⚠ ' + task.due);
    } else if (task.due) {
      dueText = task.due;
    } else {
      dueText = '-';
    }

    table.push([
      index + 1,
      task.id.slice(0, 8),
      task.title,
      priorityFn(task.priority),
      dueText,
      statusText,
      new Date(task.createdAt).toLocaleString('zh-CN'),
    ]);
  });

  console.log(table.toString());
  console.log(chalk.gray(`\n提示: 使用短 ID (前8个字符) 即可操作任务`));
}

function completeTask(id) {
  const tasks = readTasks();

  const result = findTaskById(tasks, id);

  if (result.ambiguous) {
    console.log(chalk.yellow(`⚠ 找到多个匹配的任务，请使用更长的 ID:`));
    result.matches.forEach(t => {
      console.log(chalk.gray(`  ${t.id.slice(0, 12)} - ${t.title}`));
    });
    return;
  }

  if (!result.task) {
    console.log(chalk.red(`✗ 未找到任务: ${id}`));
    return;
  }

  const task = result.task;

  if (task.status === 'completed') {
    console.log(chalk.yellow(`任务已经是完成状态`));
    return;
  }

  task.status = 'completed';
  task.completedAt = new Date().toISOString();
  writeTasks(tasks);

  console.log(chalk.green(`✓ 任务已完成: ${task.title}`));
}

function deleteTask(id) {
  const tasks = readTasks();

  const result = findTaskById(tasks, id);

  if (result.ambiguous) {
    console.log(chalk.yellow(`⚠ 找到多个匹配的任务，请使用更长的 ID:`));
    result.matches.forEach(t => {
      console.log(chalk.gray(`  ${t.id.slice(0, 12)} - ${t.title}`));
    });
    return;
  }

  if (!result.task) {
    console.log(chalk.red(`✗ 未找到任务: ${id}`));
    return;
  }

  const index = tasks.findIndex(t => t.id === result.task.id);
  const [removed] = tasks.splice(index, 1);
  writeTasks(tasks);

  console.log(chalk.green(`✓ 任务已删除: ${removed.title}`));
}

module.exports = { addTask, listTasks, completeTask, deleteTask };
