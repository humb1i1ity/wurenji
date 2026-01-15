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
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

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
  
  socket.on('disconnect', () => {
    console.log('客户端已断开连接');
  });
});

// 定期更新无人机位置并广播
setInterval(() => {
  // 更新无人机位置
  const { arrivedEvents, approachingEvents } = droneManager.updateDronePositions();
  io.emit('drones', droneManager.getAllDrones());
  
  // 发送无人机到达事件
  arrivedEvents.forEach(event => {
    io.emit('drone-arrived', event);
  });
  
  // 发送无人机接近提醒事件
  approachingEvents.forEach(event => {
    io.emit('drone-approaching', event);
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
