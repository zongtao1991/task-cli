#!/usr/bin/env node

const { program } = require('commander');
const { addTask, listTasks, completeTask, deleteTask } = require('./commands');

program
  .name('task')
  .description('命令行任务管理工具')
  .version('1.0.0');

program
  .command('add <title>')
  .description('添加新任务')
  .option('-p, --priority <level>', '优先级 (low/medium/high)', 'medium')
  .option('-d, --due <date>', '截止日期 (YYYY-MM-DD)')
  .action((title, options) => {
    addTask(title, options);
  });

program
  .command('list')
  .description('列出所有任务（默认排序：status → created）')
  .option('-s, --status <status>', '按状态筛选 (pending/completed)')
  .option('-p, --priority <level>', '按优先级筛选 (low/medium/high)')
  .option('--sort <field>', '次级排序字段 (priority/due/created)，主排序始终为 status', 'created')
  .action((options) => {
    listTasks(options);
  });

program
  .command('done <id>')
  .description('标记任务为完成')
  .action((id) => {
    completeTask(id);
  });

program
  .command('delete <id>')
  .description('删除任务')
  .action((id) => {
    deleteTask(id);
  });

program.parse();
