const sqlite3 = require('sqlite3').verbose();

class Database {
  constructor() {
    this.db = new sqlite3.Database('./drone_system.db', (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
      } else {
        console.log('已连接到SQLite数据库');
        this.createTables();
      }
    });
  }

  createTables() {
    // 创建无人机表
    const dronesTable = `
      CREATE TABLE IF NOT EXISTS drones (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        position TEXT,
        battery INTEGER,
        capacity INTEGER,
        createdAt TEXT
      );
    `;

    // 创建任务表
    const tasksTable = `
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        droneId TEXT,
        type TEXT,
        description TEXT,
        destination TEXT,
        status TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY (droneId) REFERENCES drones(id)
      );
    `;

    // 创建用户表
    const usersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT,
        position TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        createdAt TEXT
      );
    `;

    // 创建商家表
    const merchantsTable = `
      CREATE TABLE IF NOT EXISTS merchants (
        id TEXT PRIMARY KEY,
        userId TEXT UNIQUE,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT,
        position TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        createdAt TEXT,
        FOREIGN KEY (userId) REFERENCES users(id)
      );
    `;

    // 创建商品表
    const productsTable = `
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        merchantId TEXT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        image TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY (merchantId) REFERENCES merchants(id)
      );
    `;

    // 创建订单表
    const ordersTable = `
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        userId TEXT,
        merchantId TEXT,
        totalPrice REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        deliveryAddress TEXT,
        deliveryPosition TEXT,
        paymentMethod TEXT NOT NULL,
        paymentStatus TEXT NOT NULL DEFAULT 'pending',
        estimatedDeliveryTime INTEGER,
        actualDeliveryTime INTEGER,
        mealStatus TEXT NOT NULL DEFAULT 'not_started',
        mealReadyTime INTEGER,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (merchantId) REFERENCES merchants(id)
      );
    `;

    // 创建订单项表
    const orderItemsTable = `
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        orderId TEXT,
        productId TEXT,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY (orderId) REFERENCES orders(id),
        FOREIGN KEY (productId) REFERENCES products(id)
      );
    `;

    // 创建无人机配送表
    const droneDeliveriesTable = `
      CREATE TABLE IF NOT EXISTS drone_deliveries (
        id TEXT PRIMARY KEY,
        orderId TEXT,
        droneId TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        pickupPosition TEXT,
        dropoffPosition TEXT,
        route TEXT,
        currentPosition TEXT,
        estimatedTime INTEGER,
        actualTime INTEGER,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY (orderId) REFERENCES orders(id),
        FOREIGN KEY (droneId) REFERENCES drones(id)
      );
    `;

    this.db.run(dronesTable);
    this.db.run(tasksTable);
    this.db.run(usersTable);
    this.db.run(merchantsTable);
    this.db.run(productsTable);
    this.db.run(ordersTable);
    this.db.run(orderItemsTable);
    this.db.run(droneDeliveriesTable);
    
    // 初始化示例数据
    this.initSampleData();
  }

  // 初始化示例数据
  initSampleData() {
    const now = new Date().toISOString();
    
    // 检查是否已有用户数据
    this.db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
      if (err) {
        console.error('检查用户数据失败:', err.message);
        return;
      }
      
      if (row.count === 0) {
        // 添加示例用户
        const users = [
          {
            id: 'US001',
            username: 'user1',
            password: 'password1',
            name: '张三',
            phone: '13800138001',
            address: '北京市朝阳区建国路1号',
            position: { lat: 39.9088, lng: 116.4044 },
            role: 'user',
            createdAt: now
          },
          {
            id: 'US002',
            username: 'merchant1',
            password: 'password1',
            name: '李四',
            phone: '13900139001',
            address: '北京市海淀区中关村大街1号',
            position: { lat: 39.9834, lng: 116.3159 },
            role: 'merchant',
            createdAt: now
          }
        ];
        
        users.forEach(user => {
          this.saveUser(user);
        });
        
        // 添加示例商家
        const merchants = [
          {
            id: 'ME001',
            userId: 'US002',
            name: '美味餐厅',
            phone: '13900139001',
            address: '北京市海淀区中关村大街1号',
            position: { lat: 39.9834, lng: 116.3159 },
            status: 'active',
            createdAt: now
          }
        ];
        
        merchants.forEach(merchant => {
          this.saveMerchant(merchant);
        });
        
        // 添加示例商品
        const products = [
          {
            id: 'PR001',
            merchantId: 'ME001',
            name: '宫保鸡丁',
            description: '传统川菜，鸡肉鲜嫩，花生香脆',
            price: 28.00,
            image: '',
            status: 'active',
            createdAt: now,
            updatedAt: now
          },
          {
            id: 'PR002',
            merchantId: 'ME001',
            name: '鱼香肉丝',
            description: '经典川菜，酸甜可口，香气四溢',
            price: 25.00,
            image: '',
            status: 'active',
            createdAt: now,
            updatedAt: now
          },
          {
            id: 'PR003',
            merchantId: 'ME001',
            name: '麻婆豆腐',
            description: '麻辣鲜香，豆腐嫩滑',
            price: 20.00,
            image: '',
            status: 'active',
            createdAt: now,
            updatedAt: now
          },
          {
            id: 'PR004',
            merchantId: 'ME001',
            name: '糖醋排骨',
            description: '外酥里嫩，酸甜开胃',
            price: 35.00,
            image: '',
            status: 'active',
            createdAt: now,
            updatedAt: now
          },
          {
            id: 'PR005',
            merchantId: 'ME001',
            name: '西红柿鸡蛋面',
            description: '家常面食，营养丰富',
            price: 18.00,
            image: '',
            status: 'active',
            createdAt: now,
            updatedAt: now
          }
        ];
        
        products.forEach(product => {
          this.saveProduct(product);
        });
        
        // 添加示例订单
        const orders = [
          {
            id: 'OR001',
            userId: 'US001',
            merchantId: 'ME001',
            totalPrice: 53.00,
            status: 'delivering',
            deliveryAddress: '北京市朝阳区建国路1号',
            deliveryPosition: { lat: 39.9088, lng: 116.4044 },
            paymentMethod: 'online',
            paymentStatus: 'completed',
            estimatedDeliveryTime: Date.now() + 300000, // 5分钟后
            actualDeliveryTime: null,
            mealStatus: 'completed',
            mealReadyTime: Date.now(),
            createdAt: now,
            updatedAt: now
          }
        ];
        
        orders.forEach(order => {
          this.saveOrder(order);
        });
        
        // 添加示例订单项
        const orderItems = [
          {
            id: 'OI001',
            orderId: 'OR001',
            productId: 'PR001',
            quantity: 1,
            price: 28.00
          },
          {
            id: 'OI002',
            orderId: 'OR001',
            productId: 'PR002',
            quantity: 1,
            price: 25.00
          }
        ];
        
        orderItems.forEach(item => {
          this.saveOrderItem(item);
        });
        
        // 添加示例无人机配送记录
        const droneDeliveries = [
          {
            id: 'DE001',
            orderId: 'OR001',
            droneId: 'DR001',
            status: 'delivering',
            pickupPosition: { lat: 39.9834, lng: 116.3159 }, // 商家位置
            dropoffPosition: { lat: 39.9088, lng: 116.4044 }, // 用户位置
            route: [
              { lat: 39.9834, lng: 116.3159 },
              { lat: 39.9534, lng: 116.3659 },
              { lat: 39.9288, lng: 116.3944 },
              { lat: 39.9088, lng: 116.4044 }
            ],
            currentPosition: { lat: 39.9288, lng: 116.3944 }, // 当前位置
            estimatedTime: 300, // 预计300秒到达
            actualTime: null,
            createdAt: now,
            updatedAt: now
          }
        ];
        
        droneDeliveries.forEach(delivery => {
          this.saveDroneDelivery(delivery);
        });
        
        console.log('示例数据初始化完成');
      }
    });
  }

  saveDrone(drone) {
    const sql = `
      INSERT OR REPLACE INTO drones (id, name, status, position, battery, capacity, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    this.db.run(sql, [
      drone.id,
      drone.name,
      drone.status,
      JSON.stringify(drone.position),
      drone.battery,
      drone.capacity,
      drone.createdAt
    ]);
  }

  saveTask(task) {
    const sql = `
      INSERT OR REPLACE INTO tasks (id, droneId, type, description, destination, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    this.db.run(sql, [
      task.id,
      task.droneId,
      task.type,
      task.description,
      JSON.stringify(task.destination),
      task.status,
      task.createdAt,
      task.updatedAt
    ]);
  }

  getAllDrones(callback) {
    const sql = 'SELECT * FROM drones';
    this.db.all(sql, [], (err, rows) => {
      if (err) {
        callback(err, null);
      } else {
        const drones = rows.map(row => ({
          ...row,
          position: JSON.parse(row.position)
        }));
        callback(null, drones);
      }
    });
  }

  getAllTasks(callback) {
    const sql = 'SELECT * FROM tasks';
    this.db.all(sql, [], (err, rows) => {
      if (err) {
        callback(err, null);
      } else {
        const tasks = rows.map(row => ({
          ...row,
          destination: JSON.parse(row.destination)
        }));
        callback(null, tasks);
      }
    });
  }

  // 用户相关方法
  saveUser(user) {
    const sql = `
      INSERT OR REPLACE INTO users (id, username, password, name, phone, address, position, role, createdAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    this.db.run(sql, [
      user.id,
      user.username,
      user.password,
      user.name,
      user.phone,
      user.address,
      JSON.stringify(user.position),
      user.role,
      user.createdAt
    ]);
  }

  getUser(id, callback) {
    const sql = 'SELECT * FROM users WHERE id = ?';
    this.db.get(sql, [id], (err, row) => {
      if (err) {
        callback(err, null);
      } else if (row) {
        callback(null, {
          ...row,
          position: JSON.parse(row.position)
        });
      } else {
        callback(null, null);
      }
    });
  }

  getUserByUsername(username, callback) {
    const sql = 'SELECT * FROM users WHERE username = ?';
    this.db.get(sql, [username], (err, row) => {
      if (err) {
        callback(err, null);
      } else if (row) {
        callback(null, {
          ...row,
          position: JSON.parse(row.position)
        });
      } else {
        callback(null, null);
      }
    });
  }

  // 商家相关方法
  saveMerchant(merchant) {
    const sql = `
      INSERT OR REPLACE INTO merchants (id, userId, name, phone, address, position, status, createdAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    this.db.run(sql, [
      merchant.id,
      merchant.userId,
      merchant.name,
      merchant.phone,
      merchant.address,
      JSON.stringify(merchant.position),
      merchant.status,
      merchant.createdAt
    ]);
  }

  getMerchant(id, callback) {
    const sql = 'SELECT * FROM merchants WHERE id = ?';
    this.db.get(sql, [id], (err, row) => {
      if (err) {
        callback(err, null);
      } else if (row) {
        callback(null, {
          ...row,
          position: JSON.parse(row.position)
        });
      } else {
        callback(null, null);
      }
    });
  }

  getMerchantByUserId(userId, callback) {
    const sql = 'SELECT * FROM merchants WHERE userId = ?';
    this.db.get(sql, [userId], (err, row) => {
      if (err) {
        callback(err, null);
      } else if (row) {
        callback(null, {
          ...row,
          position: JSON.parse(row.position)
        });
      } else {
        callback(null, null);
      }
    });
  }

  getAllMerchants(callback) {
    const sql = 'SELECT * FROM merchants';
    this.db.all(sql, [], (err, rows) => {
      if (err) {
        callback(err, null);
      } else {
        const merchants = rows.map(row => ({
          ...row,
          position: JSON.parse(row.position)
        }));
        callback(null, merchants);
      }
    });
  }

  // 商品相关方法
  saveProduct(product) {
    const sql = `
      INSERT OR REPLACE INTO products (id, merchantId, name, description, price, image, status, createdAt, updatedAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    this.db.run(sql, [
      product.id,
      product.merchantId,
      product.name,
      product.description,
      product.price,
      product.image,
      product.status,
      product.createdAt,
      product.updatedAt
    ]);
  }

  getProduct(id, callback) {
    const sql = 'SELECT * FROM products WHERE id = ?';
    this.db.get(sql, [id], callback);
  }

  getProductsByMerchantId(merchantId, callback) {
    const sql = 'SELECT * FROM products WHERE merchantId = ?';
    this.db.all(sql, [merchantId], callback);
  }

  getAllProducts(callback) {
    const sql = 'SELECT * FROM products WHERE status = ?';
    this.db.all(sql, ['active'], callback);
  }

  // 订单相关方法
  saveOrder(order) {
    const sql = `
      INSERT OR REPLACE INTO orders (id, userId, merchantId, totalPrice, status, deliveryAddress, deliveryPosition, 
      paymentMethod, paymentStatus, estimatedDeliveryTime, actualDeliveryTime, mealStatus, mealReadyTime, createdAt, updatedAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    this.db.run(sql, [
      order.id,
      order.userId,
      order.merchantId,
      order.totalPrice,
      order.status,
      order.deliveryAddress,
      JSON.stringify(order.deliveryPosition),
      order.paymentMethod,
      order.paymentStatus,
      order.estimatedDeliveryTime,
      order.actualDeliveryTime,
      order.mealStatus || 'not_started',
      order.mealReadyTime,
      order.createdAt,
      order.updatedAt
    ]);
  }

  getOrder(id, callback) {
    const sql = 'SELECT * FROM orders WHERE id = ?';
    this.db.get(sql, [id], (err, row) => {
      if (err) {
        callback(err, null);
      } else if (row) {
        callback(null, {
          ...row,
          deliveryPosition: JSON.parse(row.deliveryPosition)
        });
      } else {
        callback(null, null);
      }
    });
  }

  getOrdersByUserId(userId, callback) {
    const sql = 'SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC';
    this.db.all(sql, [userId], (err, rows) => {
      if (err) {
        callback(err, null);
      } else {
        const orders = rows.map(row => ({
          ...row,
          deliveryPosition: JSON.parse(row.deliveryPosition)
        }));
        callback(null, orders);
      }
    });
  }

  getOrdersByMerchantId(merchantId, callback) {
    const sql = 'SELECT * FROM orders WHERE merchantId = ? ORDER BY createdAt DESC';
    this.db.all(sql, [merchantId], (err, rows) => {
      if (err) {
        callback(err, null);
      } else {
        const orders = rows.map(row => ({
          ...row,
          deliveryPosition: JSON.parse(row.deliveryPosition)
        }));
        callback(null, orders);
      }
    });
  }

  // 订单项相关方法
  saveOrderItem(orderItem) {
    const sql = `
      INSERT OR REPLACE INTO order_items (id, orderId, productId, quantity, price) 
      VALUES (?, ?, ?, ?, ?)
    `;
    
    this.db.run(sql, [
      orderItem.id,
      orderItem.orderId,
      orderItem.productId,
      orderItem.quantity,
      orderItem.price
    ]);
  }

  getOrderItemsByOrderId(orderId, callback) {
    const sql = 'SELECT * FROM order_items WHERE orderId = ?';
    this.db.all(sql, [orderId], callback);
  }

  // 无人机配送相关方法
  saveDroneDelivery(droneDelivery) {
    const sql = `
      INSERT OR REPLACE INTO drone_deliveries (id, orderId, droneId, status, pickupPosition, dropoffPosition, 
      route, currentPosition, estimatedTime, actualTime, createdAt, updatedAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    this.db.run(sql, [
      droneDelivery.id,
      droneDelivery.orderId,
      droneDelivery.droneId,
      droneDelivery.status,
      JSON.stringify(droneDelivery.pickupPosition),
      JSON.stringify(droneDelivery.dropoffPosition),
      JSON.stringify(droneDelivery.route),
      JSON.stringify(droneDelivery.currentPosition),
      droneDelivery.estimatedTime,
      droneDelivery.actualTime,
      droneDelivery.createdAt,
      droneDelivery.updatedAt
    ]);
  }

  getDroneDelivery(id, callback) {
    const sql = 'SELECT * FROM drone_deliveries WHERE id = ?';
    this.db.get(sql, [id], (err, row) => {
      if (err) {
        callback(err, null);
      } else if (row) {
        callback(null, {
          ...row,
          pickupPosition: JSON.parse(row.pickupPosition),
          dropoffPosition: JSON.parse(row.dropoffPosition),
          route: JSON.parse(row.route),
          currentPosition: JSON.parse(row.currentPosition)
        });
      } else {
        callback(null, null);
      }
    });
  }

  getDroneDeliveriesByOrderId(orderId, callback) {
    const sql = 'SELECT * FROM drone_deliveries WHERE orderId = ?';
    this.db.all(sql, [orderId], (err, rows) => {
      if (err) {
        callback(err, null);
      } else {
        const deliveries = rows.map(row => ({
          ...row,
          pickupPosition: JSON.parse(row.pickupPosition),
          dropoffPosition: JSON.parse(row.dropoffPosition),
          route: JSON.parse(row.route),
          currentPosition: JSON.parse(row.currentPosition)
        }));
        callback(null, deliveries);
      }
    });
  }

  getDroneDeliveriesByDroneId(droneId, callback) {
    const sql = 'SELECT * FROM drone_deliveries WHERE droneId = ?';
    this.db.all(sql, [droneId], (err, rows) => {
      if (err) {
        callback(err, null);
      } else {
        const deliveries = rows.map(row => ({
          ...row,
          pickupPosition: JSON.parse(row.pickupPosition),
          dropoffPosition: JSON.parse(row.dropoffPosition),
          route: JSON.parse(row.route),
          currentPosition: JSON.parse(row.currentPosition)
        }));
        callback(null, deliveries);
      }
    });
  }
}

module.exports = Database;