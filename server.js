const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, 'expenses.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, status, body, contentType = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), 'application/json; charset=utf-8');
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error('请求内容过大'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
      return [];
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (err) {
    console.error('读取数据失败:', err);
    return [];
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function serveFile(res, fileName) {
  const safePath = path.normalize(fileName).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ROOT_DIR, safePath);

  if (!filePath.startsWith(ROOT_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return send(res, 404, 'Not Found', 'text/plain; charset=utf-8');
  }

  const ext = path.extname(filePath);
  const type = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*'
  });
  fs.createReadStream(filePath).pipe(res);
}

function getFilteredExpenses(query) {
  let data = readData();
  const month = query.get('month');
  const year = query.get('year');
  const type = query.get('type');
  const category = query.get('category');
  const startDate = query.get('startDate');
  const endDate = query.get('endDate');

  if (type) data = data.filter(item => item.type === type);
  if (category) data = data.filter(item => item.category === category);
  if (month) data = data.filter(item => new Date(item.date).getMonth() + 1 === parseInt(month, 10));
  if (year) data = data.filter(item => new Date(item.date).getFullYear() === parseInt(year, 10));
  if (startDate) data = data.filter(item => item.date >= startDate);
  if (endDate) data = data.filter(item => item.date <= endDate);

  return data.sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    return send(res, 204, '');
  }

  if (req.method === 'GET' && pathname === '/api/expenses') {
    const data = getFilteredExpenses(url.searchParams);
    return sendJson(res, 200, { success: true, data, total: data.length });
  }

  if (req.method === 'GET' && pathname.startsWith('/api/expenses/')) {
    const id = decodeURIComponent(pathname.split('/').pop());
    const item = readData().find(entry => entry.id === id);
    if (!item) return sendJson(res, 404, { success: false, message: '记录不存在' });
    return sendJson(res, 200, { success: true, data: item });
  }

  if (req.method === 'POST' && pathname === '/api/expenses') {
    const body = await readJsonBody(req);
    const { amount, type, category, description, date } = body;

    if (!amount || !type || !category || !date) {
      return sendJson(res, 400, { success: false, message: '请填写必要字段：金额、类型、分类、日期' });
    }

    const newItem = {
      id: randomUUID(),
      amount: parseFloat(amount),
      type,
      category,
      description: description || '',
      date,
      createdAt: new Date().toISOString()
    };
    const data = readData();
    data.push(newItem);
    writeData(data);
    return sendJson(res, 201, { success: true, data: newItem });
  }

  if (req.method === 'PUT' && pathname.startsWith('/api/expenses/')) {
    const id = decodeURIComponent(pathname.split('/').pop());
    const body = await readJsonBody(req);
    const data = readData();
    const index = data.findIndex(entry => entry.id === id);

    if (index === -1) return sendJson(res, 404, { success: false, message: '记录不存在' });

    data[index] = {
      ...data[index],
      ...(body.amount !== undefined && { amount: parseFloat(body.amount) }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.date !== undefined && { date: body.date }),
      updatedAt: new Date().toISOString()
    };

    writeData(data);
    return sendJson(res, 200, { success: true, data: data[index] });
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/expenses/')) {
    const id = decodeURIComponent(pathname.split('/').pop());
    const data = readData();
    const index = data.findIndex(entry => entry.id === id);

    if (index === -1) return sendJson(res, 404, { success: false, message: '记录不存在' });

    data.splice(index, 1);
    writeData(data);
    return sendJson(res, 200, { success: true, message: '删除成功' });
  }

  if (req.method === 'GET' && pathname === '/api/stats') {
    let data = readData();
    const now = new Date();
    const targetMonth = url.searchParams.get('month') ? parseInt(url.searchParams.get('month'), 10) - 1 : now.getMonth();
    const targetYear = url.searchParams.get('year') ? parseInt(url.searchParams.get('year'), 10) : now.getFullYear();

    data = data.filter(item => {
      const d = new Date(item.date);
      return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });

    const totalIncome = data.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = data.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
    const categoryStats = {};
    const dailyStats = {};

    data.forEach(item => {
      if (!categoryStats[item.category]) {
        categoryStats[item.category] = { category: item.category, type: item.type, total: 0, count: 0 };
      }
      categoryStats[item.category].total += item.amount;
      categoryStats[item.category].count += 1;

      if (!dailyStats[item.date]) {
        dailyStats[item.date] = { date: item.date, income: 0, expense: 0 };
      }
      if (item.type === 'income') dailyStats[item.date].income += item.amount;
      else dailyStats[item.date].expense += item.amount;
    });

    return sendJson(res, 200, {
      success: true,
      data: {
        month: targetMonth + 1,
        year: targetYear,
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        categoryStats: Object.values(categoryStats),
        dailyStats: Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date)),
        recordCount: data.length
      }
    });
  }

  if (req.method === 'GET' && pathname === '/api/export') {
    const data = readData();
    const csvHeader = '日期,类型,分类,描述,金额\n';
    const csvRows = data
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(item => `${item.date},${item.type === 'income' ? '收入' : '支出'},${item.category},${item.description},${item.amount}`)
      .join('\n');

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename=expenses.csv',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end('\uFEFF' + csvHeader + csvRows);
  }

  return sendJson(res, 404, { success: false, message: '接口不存在' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/health') {
      return sendJson(res, 200, {
        success: true,
        message: '服务运行正常',
        indexFileExists: fs.existsSync(path.join(ROOT_DIR, 'index.html')),
        dataFileExists: fs.existsSync(DATA_FILE)
      });
    }

    if (url.pathname.startsWith('/api/')) {
      return await handleApi(req, res, url);
    }

    if (url.pathname === '/') {
      return serveFile(res, 'index.html');
    }

    return serveFile(res, url.pathname.slice(1));
  } catch (err) {
    console.error('服务错误:', err);
    return sendJson(res, 500, { success: false, message: '服务器内部错误' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`记账本服务已启动，端口：${PORT}`);
});
