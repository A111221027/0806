require('dotenv').config();
console.log('DB URL:', process.env.DATABASE_URL);
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let pool;

async function connectToDatabase() {
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    const connectionConfig = {
      host: dbUrl.hostname,
      user: dbUrl.username,
      password: dbUrl.password,
      database: dbUrl.pathname.substring(1),
      port: dbUrl.port || 3306,
      ssl: { rejectUnauthorized: false },
    };
    pool = mysql.createPool(connectionConfig);
    console.log('MySQL pool created.');
  } catch (error) {
    console.error('資料庫連線錯誤:', error);
  }
}

app.post('/api/orders', async (req, res) => {
  try {
    console.log('收到訂單資料:', req.body);  // 印出收到的資料確認格式
    
    const { items, total_price, table_number } = req.body;

    if (!pool) {
      throw new Error('資料庫連線池尚未建立');
    }

    const connection = await pool.getConnection();

    const [result] = await connection.query(
      'INSERT INTO orders (total_price, created_at, table_number) VALUES (?, NOW(), ?)',
      [total_price, table_number || '未指定']
    );

    const orderId = result.insertId;

    for (const item of items) {
      console.log('新增訂單品項:', item);
      await connection.query(
        'INSERT INTO order_items (order_id, item_name, quantity, custom_options, price) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.item_name, item.quantity, item.custom_options, item.price || 0]
      );
    }

    connection.release();
    res.status(200).json({ message: "訂單成功", order_id: orderId });

  } catch (err) {
    console.error("❌ 新增訂單錯誤：", err);
    res.status(500).json({ message: "新增訂單時發生錯誤", error: err.message, stack: err.stack });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, total_price, created_at FROM orders ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('❌ 讀取訂單錯誤:', error.message);
    res.status(500).json({ message: '讀取訂單失敗。', error: error.message });
  }
});

app.listen(3000, async () => {
  await connectToDatabase();
  console.log('Server is running on http://localhost:3000');
});





