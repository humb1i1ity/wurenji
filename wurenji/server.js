const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const DroneManager = require('./droneManager');
const Database = require('./database');
const LightSensorManager = require('./lightSensorManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 初始化数据库、无人机管理器和光敏传感器管理器
const db = new Database();
const droneManager = new DroneManager(db);
const lightSensorManager = new LightSensorManager();

// 提供静态文件
app.use(express.static(__dirname));
app.use(express.json());

// 辅助函数
const generateId = () => {
  return Math.random().toString(36).substr(2, 9).toUpperCase();
};

// 简单的密码加密（实际项目中应使用bcrypt等安全算法）
const encryptPassword = (password) => {
  return password; // 简化处理，实际项目中应加密
};

// 检查密码是否匹配
const checkPassword = (password, storedPassword) => {
  return password === storedPassword; // 简化处理，实际项目中应解密比较
};

// 获取当前时间戳
const getTimestamp = () => {
  return new Date().toISOString();
};

// 验证用户是否登录（简化版本）
const authenticateUser = (req, res, next) => {
  const userId = req.headers['user-id'];
  if (userId) {
    req.userId = userId;
    next();
  } else {
    res.status(401).json({ error: '未授权' });
  }
};

// 验证用户是否为商家
const authenticateMerchant = (req, res, next) => {
  const userId = req.headers['user-id'];
  if (userId) {
    db.getMerchantByUserId(userId, (err, merchant) => {
      if (err || !merchant) {
        res.status(403).json({ error: '您不是商家' });
      } else {
        req.merchantId = merchant.id;
        next();
      }
    });
  } else {
    res.status(401).json({ error: '未授权' });
  }
};

// API路由
// 无人机相关API
app.get('/api/drones', (req, res) => {
  res.json(droneManager.getAllDrones());
});

app.get('/api/drones/:id', (req, res) => {
  const drone = droneManager.getDrone(req.params.id);
  if (drone) {
    res.json(drone);
  } else {
    res.status(404).json({ error: '无人机不存在' });
  }
});

app.post('/api/drones', (req, res) => {
  const drone = droneManager.addDrone(req.body);
  res.status(201).json(drone);
});

app.post('/api/drones/:id/task', (req, res) => {
  const result = droneManager.assignTask(req.params.id, req.body);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.get('/api/tasks', (req, res) => {
  res.json(droneManager.getAllTasks());
});

// 光敏传感器相关API
app.get('/api/light', (req, res) => {
  res.json(lightSensorManager.getSensorData());
});

app.post('/api/light', (req, res) => {
  if (req.body.light !== undefined) {
    const light = lightSensorManager.updateLight(req.body.light);
    res.json({ light: light });
  } else {
    res.status(400).json({ error: '缺少光照值参数' });
  }
});

app.get('/api/light/threshold', (req, res) => {
  res.json({ threshold: lightSensorManager.getLightThreshold() });
});

app.post('/api/light/threshold', (req, res) => {
  if (req.body.threshold !== undefined) {
    const threshold = lightSensorManager.updateThreshold(req.body.threshold);
    res.json({ threshold: threshold });
  } else {
    res.status(400).json({ error: '缺少阈值参数' });
  }
});

// 用户认证API
// 注册
app.post('/api/register', (req, res) => {
  const { username, password, name, phone, address, position, role } = req.body;
  
  db.getUserByUsername(username, (err, existingUser) => {
    if (existingUser) {
      res.status(400).json({ error: '用户名已存在' });
    } else {
      const user = {
        id: generateId(),
        username,
        password: encryptPassword(password),
        name,
        phone,
        address,
        position: position || { lat: 39.9042, lng: 116.4074 },
        role: role || 'user',
        createdAt: getTimestamp()
      };
      
      db.saveUser(user);
      
      // 如果是商家，创建商家记录
      if (role === 'merchant') {
        const merchant = {
          id: generateId(),
          userId: user.id,
          name: name,
          phone: phone,
          address: address,
          position: position || { lat: 39.9042, lng: 116.4074 },
          status: 'active',
          createdAt: getTimestamp()
        };
        db.saveMerchant(merchant);
      }
      
      res.status(201).json({ success: true, user: user });
    }
  });
});

// 登录
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.getUserByUsername(username, (err, user) => {
    if (err || !user) {
      res.status(401).json({ error: '用户名或密码错误' });
    } else {
      if (checkPassword(password, user.password)) {
        // 登录成功
        res.json({ success: true, user: user });
      } else {
        res.status(401).json({ error: '用户名或密码错误' });
      }
    }
  });
});

// 获取用户信息
app.get('/api/user', authenticateUser, (req, res) => {
  db.getUser(req.userId, (err, user) => {
    if (err || !user) {
      res.status(404).json({ error: '用户不存在' });
    } else {
      res.json(user);
    }
  });
});

// 商家API
// 获取商家信息
app.get('/api/merchant', authenticateMerchant, (req, res) => {
  db.getMerchant(req.merchantId, (err, merchant) => {
    if (err || !merchant) {
      res.status(404).json({ error: '商家不存在' });
    } else {
      res.json(merchant);
    }
  });
});

// 获取所有商家
app.get('/api/merchants', (req, res) => {
  db.getAllMerchants((err, merchants) => {
    if (err) {
      res.status(500).json({ error: '获取商家列表失败' });
    } else {
      res.json(merchants);
    }
  });
});

// 商品API
// 添加商品
app.post('/api/products', authenticateMerchant, (req, res) => {
  const { name, description, price, image, status } = req.body;
  
  const product = {
    id: generateId(),
    merchantId: req.merchantId,
    name,
    description,
    price,
    image: image || '',
    status: status || 'active',
    createdAt: getTimestamp(),
    updatedAt: getTimestamp()
  };
  
  db.saveProduct(product);
  res.status(201).json(product);
});

// 获取商家的商品列表
app.get('/api/merchant/products', authenticateMerchant, (req, res) => {
  db.getProductsByMerchantId(req.merchantId, (err, products) => {
    if (err) {
      res.status(500).json({ error: '获取商品列表失败' });
    } else {
      res.json(products);
    }
  });
});

// 获取所有商品
app.get('/api/products', (req, res) => {
  db.getAllProducts((err, products) => {
    if (err) {
      res.status(500).json({ error: '获取商品列表失败' });
    } else {
      res.json(products);
    }
  });
});

// 获取单个商品
app.get('/api/products/:id', (req, res) => {
  db.getProduct(req.params.id, (err, product) => {
    if (err || !product) {
      res.status(404).json({ error: '商品不存在' });
    } else {
      res.json(product);
    }
  });
});

// 订单API
// 创建订单
app.post('/api/orders', authenticateUser, (req, res) => {
  const { merchantId, items, totalPrice, deliveryAddress, deliveryPosition, paymentMethod } = req.body;
  
  // 创建订单
  const order = {
    id: generateId(),
    userId: req.userId,
    merchantId,
    totalPrice,
    status: 'pending',
    deliveryAddress,
    deliveryPosition,
    paymentMethod,
    paymentStatus: 'pending',
    estimatedDeliveryTime: null,
    actualDeliveryTime: null,
    createdAt: getTimestamp(),
    updatedAt: getTimestamp()
  };
  
  db.saveOrder(order);
  
  // 保存订单项
  items.forEach(item => {
    const orderItem = {
      id: generateId(),
      orderId: order.id,
      productId: item.productId,
      quantity: item.quantity,
      price: item.price
    };
    db.saveOrderItem(orderItem);
  });
  
  // 分配无人机配送
  const idleDrones = droneManager.getAllDrones().filter(drone => drone.status === 'idle' && drone.battery > 20);
  if (idleDrones.length > 0) {
    // 简单选择第一个空闲无人机
    const selectedDrone = idleDrones[0];
    
    // 创建无人机配送任务
    const droneDelivery = {
      id: generateId(),
      orderId: order.id,
      droneId: selectedDrone.id,
      status: 'pending',
      pickupPosition: deliveryPosition, // 简化处理，实际应该是商家位置
      dropoffPosition: deliveryPosition,
      route: [deliveryPosition, deliveryPosition], // 简化处理，实际应该是规划的路线
      currentPosition: selectedDrone.position,
      estimatedTime: 300, // 5分钟，简化处理
      actualTime: null,
      createdAt: getTimestamp(),
      updatedAt: getTimestamp()
    };
    
    db.saveDroneDelivery(droneDelivery);
    
    // 分配任务给无人机
    droneManager.assignTask(selectedDrone.id, {
      type: 'delivery',
      description: `配送订单 ${order.id}`,
      destination: deliveryPosition
    });
  }
  
  res.status(201).json(order);
});

// 获取用户订单列表
app.get('/api/orders', authenticateUser, (req, res) => {
  db.getOrdersByUserId(req.userId, (err, orders) => {
    if (err) {
      res.status(500).json({ error: '获取订单列表失败' });
    } else {
      res.json(orders);
    }
  });
});

// 获取商家订单列表
app.get('/api/merchant/orders', authenticateMerchant, (req, res) => {
  db.getOrdersByMerchantId(req.merchantId, (err, orders) => {
    if (err) {
      res.status(500).json({ error: '获取订单列表失败' });
    } else {
      res.json(orders);
    }
  });
});

// 更新订单状态
app.put('/api/orders/:id/status', authenticateMerchant, (req, res) => {
  const { status } = req.body;
  db.getOrder(req.params.id, (err, order) => {
    if (err || !order) {
      res.status(404).json({ error: '订单不存在' });
    } else {
      order.status = status;
      order.updatedAt = getTimestamp();
      db.saveOrder(order);
      res.json(order);
    }
  });
});

// 更新订单出餐状态
app.put('/api/orders/:id/meal-status', authenticateMerchant, (req, res) => {
  const { mealStatus } = req.body;
  db.getOrder(req.params.id, (err, order) => {
    if (err || !order) {
      res.status(404).json({ error: '订单不存在' });
    } else {
      order.mealStatus = mealStatus;
      order.updatedAt = getTimestamp();
      
      // 如果出餐状态为已完成，记录出餐完成时间
      if (mealStatus === 'completed') {
        order.mealReadyTime = Date.now();
        // 自动分配无人机配送
        droneManager.addOrder({
          id: order.id,
          merchantPosition: order.merchantPosition || { lat: 39.9042, lng: 116.4074 },
          deliveryPosition: order.deliveryPosition
        });
      }
      
      db.saveOrder(order);
      io.emit(`order-update-${order.id}`, order);
      res.json(order);
    }
  });
});

// 获取订单详情
app.get('/api/orders/:id', authenticateUser, (req, res) => {
  db.getOrder(req.params.id, (err, order) => {
    if (err || !order) {
      res.status(404).json({ error: '订单不存在' });
    } else {
      // 检查订单是否属于当前用户或商家
      db.getUser(req.userId, (err, user) => {
        if (user.role === 'admin' || order.userId === req.userId) {
          // 获取订单项
          db.getOrderItemsByOrderId(order.id, (err, items) => {
            if (err) {
              res.status(500).json({ error: '获取订单项失败' });
            } else {
              res.json({ ...order, items });
            }
          });
        } else {
          res.status(403).json({ error: '无权访问该订单' });
        }
      });
    }
  });
});

// 无人机配送API
// 获取订单的无人机配送信息
app.get('/api/orders/:id/delivery', (req, res) => {
  db.getDroneDeliveriesByOrderId(req.params.id, (err, deliveries) => {
    if (err) {
      res.status(500).json({ error: '获取配送信息失败' });
    } else {
      res.json(deliveries);
    }
  });
});

// WebSocket连接处理
io.on('connection', (socket) => {
  console.log('客户端已连接');
  
  // 发送初始无人机数据
  socket.emit('drones', droneManager.getAllDrones());
  socket.emit('tasks', droneManager.getAllTasks());
  
  // 发送初始光敏传感器数据
  socket.emit('light-data', lightSensorManager.getSensorData());
  
  // 监听任务分配
  socket.on('assign-task', (data) => {
    const result = droneManager.assignTask(data.droneId, data.task);
    if (result.success) {
      io.emit('tasks', droneManager.getAllTasks());
      io.emit('drones', droneManager.getAllDrones());
    }
    socket.emit('task-assign-result', result);
  });
  
  // 监听无人机光照数据更新（保持原有功能，兼容无人机系统）
  socket.on('update-light', (data) => {
    if (data.droneId) {
      // 无人机光照数据更新
      const { droneId, light } = data;
      const success = droneManager.updateDroneLight(droneId, light);
      if (success) {
        // 广播更新后的无人机数据
        io.emit('drones', droneManager.getAllDrones());
        
        // 检查是否需要发送光照警报
        const drone = droneManager.getDrone(droneId);
        if (drone && drone.lightAlert) {
          io.emit('light-alert', {
            droneId: drone.id,
            droneName: drone.name,
            light: drone.light,
            threshold: drone.lightThreshold,
            timestamp: new Date().toISOString()
          });
        }
      }
    } else {
      // 独立光敏传感器数据更新
      if (data.light !== undefined) {
        lightSensorManager.updateLight(data.light);
        io.emit('light-data', lightSensorManager.getSensorData());
      }
    }
  });
  
  // 监听光照阈值更新
  socket.on('update-light-threshold', (data) => {
    if (data.droneId) {
      // 无人机光照阈值更新
      const { droneId, threshold } = data;
      const drone = droneManager.getDrone(droneId);
      if (drone) {
        drone.lightThreshold = threshold;
        droneManager.checkLightThreshold(drone);
        io.emit('drones', droneManager.getAllDrones());
      }
    } else {
      // 独立光敏传感器阈值更新
      if (data.threshold !== undefined) {
        lightSensorManager.updateThreshold(data.threshold);
        io.emit('light-data', lightSensorManager.getSensorData());
      }
    }
  });
  
  // 监听订单状态更新
  socket.on('update-order-status', (data) => {
    const { orderId, status } = data;
    db.getOrder(orderId, (err, order) => {
      if (order) {
        order.status = status;
        order.updatedAt = getTimestamp();
        db.saveOrder(order);
        io.emit(`order-update-${orderId}`, order);
        io.emit('orders', droneManager.getAllOrders()); // 简化处理，实际应该获取所有订单
      }
    });
  });
  
  socket.on('disconnect', () => {
    console.log('客户端已断开连接');
  });
});

// 定期更新无人机位置并广播
setInterval(() => {
  // 更新无人机位置
  const { arrivedEvents, approachingEvents, deliveryUpdates } = droneManager.updateDronePositions();
  io.emit('drones', droneManager.getAllDrones());
  
  // 发送无人机到达事件
  arrivedEvents.forEach(event => {
    io.emit('drone-arrived', event);
  });
  
  // 发送无人机接近提醒事件
  approachingEvents.forEach(event => {
    io.emit('drone-approaching', event);
  });
  
  // 发送配送更新事件
  deliveryUpdates.forEach(update => {
    // 广播给所有客户端
    io.emit('delivery-update', update);
    // 单独发送给订单相关用户
    if (update.orderId) {
      io.emit(`delivery-update-${update.orderId}`, update);
    }
    
    // 如果订单已送达，更新订单状态
    if (update.status === 'delivered' && update.orderId) {
      db.getOrder(update.orderId, (err, order) => {
        if (order) {
          order.status = 'delivered';
          order.updatedAt = new Date().toISOString();
          order.actualDeliveryTime = Date.now();
          db.saveOrder(order);
          io.emit(`order-update-${update.orderId}`, order);
        }
      });
    }
  });
  
  // 更新独立光敏传感器数据
  lightSensorManager.simulateLightChange();
  io.emit('light-data', lightSensorManager.getSensorData());
  
  // 检查是否有无人机在感应范围内且光敏传感器检测到遮光
  const drones = droneManager.getAllDrones();
  const lightData = lightSensorManager.getSensorData();
  
  // 检查光敏传感器是否检测到遮光（光照值低于阈值，这里假设低于阈值表示遮光）
  const isShaded = lightData.light < lightData.threshold;
  
  // 检查在感应范围内的无人机
  const dronesInRange = drones.filter(drone => drone.inSensorRange);
  
  // 如果检测到遮光且有无人机在感应范围内，发送已到达消息
  if (isShaded && dronesInRange.length > 0) {
    dronesInRange.forEach(drone => {
      io.emit('drone-reached-via-light', {
        droneId: drone.id,
        droneName: drone.name,
        light: lightData.light,
        threshold: lightData.threshold,
        inSensorRange: drone.inSensorRange,
        timestamp: new Date().toISOString()
      });
    });
  }
  
  // 检查是否有无人机触发了光照警报，单独发送警报事件
  const alertDrones = drones.filter(drone => drone.lightAlert);
  if (alertDrones.length > 0) {
    alertDrones.forEach(drone => {
      io.emit('light-alert', {
        droneId: drone.id,
        droneName: drone.name,
        light: drone.light,
        threshold: drone.lightThreshold,
        timestamp: new Date().toISOString()
      });
    });
  }
  
  // 检查独立光敏传感器是否需要发送警报
  const alertResult = lightSensorManager.checkAlert();
  if (alertResult.alert) {
    io.emit('light-alert', {
      light: alertResult.light,
      threshold: alertResult.threshold,
      timestamp: alertResult.timestamp
    });
  }
}, 1000);

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
