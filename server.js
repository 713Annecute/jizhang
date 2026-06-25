const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'expenses.json');

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 数据读写工具
function readData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
      return [];
    }
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('读取数据失败:', err);
    return [];
  }
}

function writeData(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('写入数据失败:', err);
    return false;
  }
}

// ===== API 路由 =====

// 获取所有记录（支持筛选）
app.get('/api/expenses', (req, res) => {
  const { month, year, type, category, startDate, endDate } = req.query;
  let data = readData();

  if (type) data = data.filter(item => item.type === type);
  if (category) data = data.filter(item => item.category === category);
  if (month) data = data.filter(item => new Date(item.date).getMonth() + 1 === parseInt(month));
  if (year) data = data.filter(item => new Date(item.date).getFullYear() === parseInt(year));
  if (startDate) data = data.filter(item => item.date >= startDate);
  if (endDate) data = data.filter(item => item.date <= endDate);

  // 按日期倒序
  data.sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json({ success: true, data, total: data.length });
});

// 获取单条记录
app.get('/api/expenses/:id', (req, res) => {
  const data = readData();
  const item = data.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ success: false, message: '记录不存在' });
  res.json({ success: true, data: item });
});

// 新增记录
app.post('/api/expenses', (req, res) => {
  const { amount, type, category, description, date } = req.body;

  if (!amount || !type || !category || !date) {
    return res.status(400).json({ success: false, message: '请填写必要字段：金额、类型、分类、日期' });
  }

  const newItem = {
    id: uuidv4(),
    amount: parseFloat(amount),
    type, // 'income' 或 'expense'
    category,
    description: description || '',
    date,
    createdAt: new Date().toISOString()
  };

  const data = readData();
  data.push(newItem);
  writeData(data);

  res.status(201).json({ success: true, data: newItem });
});

// 更新记录
app.put('/api/expenses/:id', (req, res) => {
  const data = readData();
  const index = data.findIndex(i => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: '记录不存在' });

  const { amount, type, category, description, date } = req.body;
  data[index] = {
    ...data[index],
    ...(amount !== undefined && { amount: parseFloat(amount) }),
    ...(type !== undefined && { type }),
    ...(category !== undefined && { category }),
    ...(description !== undefined && { description }),
    ...(date !== undefined && { date }),
    updatedAt: new Date().toISOString()
  };

  writeData(data);
  res.json({ success: true, data: data[index] });
});

// 删除记录
app.delete('/api/expenses/:id', (req, res) => {
  let data = readData();
  const index = data.findIndex(i => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: '记录不存在' });

  data.splice(index, 1);
  writeData(data);
  res.json({ success: true, message: '删除成功' });
});

// 获取统计数据
app.get('/api/stats', (req, res) => {
  const { month, year } = req.query;
  let data = readData();

  const now = new Date();
  const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
  const targetYear = year ? parseInt(year) : now.getFullYear();

  data = data.filter(item => {
    const d = new Date(item.date);
    return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
  });

  const totalIncome = data.filter(i => i.type === 'income').reduce((sum, i) => sum + i.amount, 0);
  const totalExpense = data.filter(i => i.type === 'expense').reduce((sum, i) => sum + i.amount, 0);
  const balance = totalIncome - totalExpense;

  // 按分类汇总
  const categoryStats = {};
  data.forEach(item => {
    if (!categoryStats[item.category]) {
      categoryStats[item.category] = { category: item.category, type: item.type, total: 0, count: 0 };
    }
    categoryStats[item.category].total += item.amount;
    categoryStats[item.category].count += 1;
  });

  // 按日汇总
  const dailyStats = {};
  data.forEach(item => {
    if (!dailyStats[item.date]) {
      dailyStats[item.date] = { date: item.date, income: 0, expense: 0 };
    }
    if (item.type === 'income') dailyStats[item.date].income += item.amount;
    else dailyStats[item.date].expense += item.amount;
  });

  res.json({
    success: true,
    data: {
      month: targetMonth + 1,
      year: targetYear,
      totalIncome,
      totalExpense,
      balance,
      categoryStats: Object.values(categoryStats),
      dailyStats: Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date)),
      recordCount: data.length
    }
  });
});

// 导出数据
app.get('/api/export', (req, res) => {
  const data = readData();
  const csvHeader = '日期,类型,分类,描述,金额\n';
  const csvRows = data
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(item => `${item.date},${item.type === 'income' ? '收入' : '支出'},${item.category},${item.description},${item.amount}`)
    .join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=expenses.csv');
  res.send('\uFEFF' + csvHeader + csvRows); // BOM for Excel
});

// 启动服务
app.listen(PORT, () => {
  console.log(`记账本服务已启动: http://localhost:${PORT}`);
});
