class DroneManager {
  constructor(db) {
    this.drones = [];
    this.tasks = [];
    this.db = db;
    this.initDrones();
  }

  initDrones() {
    // 初始化一些示例无人机
    const sampleDrones = [
      {
        id: 'DR001',
        name: '配送无人机1号',
        status: 'idle',
        position: { lat: 39.9042, lng: 116.4074 },
        battery: 95,
        capacity: 10,
        light: 0,
        lightThreshold: 50,
        lightAlert: false
      },
      {
        id: 'DR002',
        name: '配送无人机2号',
        status: 'idle',
        position: { lat: 39.9142, lng: 116.4174 },
        battery: 88,
        capacity: 10,
        light: 0,
        lightThreshold: 50,
        lightAlert: false
      },
      {
        id: 'DR003',
        name: '配送无人机3号',
        status: 'idle',
        position: { lat: 39.9242, lng: 116.4274 },
        battery: 75,
        capacity: 10,
        light: 0,
        lightThreshold: 50,
        lightAlert: false
      }
    ];

    sampleDrones.forEach(drone => {
      this.addDrone(drone);
    });
  }

  getAllDrones() {
    return this.drones;
  }

  getDrone(id) {
    return this.drones.find(drone => drone.id === id);
  }

  addDrone(droneData) {
    const newDrone = {
      id: droneData.id || `DR${Date.now().toString().slice(-4)}`,
      name: droneData.name || `无人机${Date.now().toString().slice(-4)}`,
      status: droneData.status || 'idle',
      position: droneData.position || { lat: 39.9042, lng: 116.4074 },
      battery: droneData.battery || 100,
      capacity: droneData.capacity || 10,
      light: droneData.light || 0,
      lightThreshold: droneData.lightThreshold || 50,
      lightAlert: droneData.lightAlert || false,
      currentTask: null,
      createdAt: new Date().toISOString(),
      approachingAlertSent: false, // 是否已发送接近提醒
      inSensorRange: false // 是否在感应范围内
    };
    
    this.drones.push(newDrone);
    this.db.saveDrone(newDrone);
    return newDrone;
  }

  // 更新无人机光照值
  updateDroneLight(droneId, light) {
    const drone = this.getDrone(droneId);
    if (drone) {
      drone.light = light;
      this.checkLightThreshold(drone);
      return true;
    }
    return false;
  }

  // 检查光照是否超过阈值
  checkLightThreshold(drone) {
    if (drone.light > drone.lightThreshold) {
      drone.lightAlert = true;
    } else {
      drone.lightAlert = false;
    }
  }

  // 模拟光照变化
  simulateLightChanges() {
    this.drones.forEach(drone => {
      // 模拟光照在0-100之间变化
      const lightChange = (Math.random() - 0.3) * 10;
      drone.light = Math.max(0, Math.min(100, drone.light + lightChange));
      this.checkLightThreshold(drone);
    });
  }

  updateDronePositions() {
    const arrivedEvents = [];
    const approachingEvents = [];
    
    this.drones.forEach(drone => {
      if (drone.status === 'delivering') {
        // 模拟无人机向目标位置移动
        const task = drone.currentTask;
        if (task && task.destination) {
          const dx = task.destination.lat - drone.position.lat;
          const dy = task.destination.lng - drone.position.lng;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // 检测是否在感应范围内（更大的范围，比如0.002）
          const sensorRange = 0.002;
          const oldInRange = drone.inSensorRange;
          drone.inSensorRange = distance < sensorRange;
          
          // 进入感应范围且未发送过接近提醒
          if (drone.inSensorRange && !oldInRange && !drone.approachingAlertSent) {
            approachingEvents.push({
              droneId: drone.id,
              droneName: drone.name,
              taskId: task.id,
              taskDescription: task.description,
              destination: task.destination,
              distance: distance,
              timestamp: new Date().toISOString()
            });
            drone.approachingAlertSent = true;
          }
          
          if (distance < 0.0005) {
            // 到达目的地，记录事件
            arrivedEvents.push({
              droneId: drone.id,
              droneName: drone.name,
              taskId: task.id,
              taskDescription: task.description,
              destination: task.destination,
              arrivedAt: new Date().toISOString()
            });
            
            // 更新状态
            drone.position = { ...task.destination };
            drone.status = 'idle';
            drone.currentTask = null;
            drone.battery = Math.max(0, drone.battery - 10);
            // 重置提醒标志
            drone.approachingAlertSent = false;
            drone.inSensorRange = false;
          } else {
            // 继续移动
            drone.position.lat += dx * 0.1;
            drone.position.lng += dy * 0.1;
            drone.battery = Math.max(0, drone.battery - 0.5);
          }
        }
      } else {
        // 空闲状态下的轻微位置变化
        drone.position.lat += (Math.random() - 0.5) * 0.0001;
        drone.position.lng += (Math.random() - 0.5) * 0.0001;
        drone.battery = Math.min(100, drone.battery + 0.1);
        // 重置提醒标志
        drone.approachingAlertSent = false;
        drone.inSensorRange = false;
      }
      
      // 每次更新位置时也模拟光照变化
      const lightChange = (Math.random() - 0.3) * 5;
      drone.light = Math.max(0, Math.min(100, drone.light + lightChange));
      this.checkLightThreshold(drone);
    });
    
    return { arrivedEvents, approachingEvents };
  }

  assignTask(droneId, taskData) {
    const drone = this.getDrone(droneId);
    if (!drone) {
      return { success: false, error: '无人机不存在' };
    }
    
    if (drone.status !== 'idle') {
      return { success: false, error: '无人机当前不可用' };
    }
    
    if (drone.battery < 20) {
      return { success: false, error: '无人机电量不足' };
    }
    
    const newTask = {
      id: `TSK${Date.now().toString().slice(-6)}`,
      droneId: droneId,
      type: taskData.type || 'delivery',
      description: taskData.description || '物资配送',
      destination: taskData.destination,
      status: 'assigned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // 更新无人机状态
    drone.status = 'delivering';
    drone.currentTask = newTask;
    
    // 添加任务
    this.tasks.push(newTask);
    this.db.saveTask(newTask);
    
    return { 
      success: true, 
      message: '任务分配成功',
      task: newTask,
      drone: drone
    };
  }

  getAllTasks() {
    return this.tasks;
  }

  getTasksByDroneId(droneId) {
    return this.tasks.filter(task => task.droneId === droneId);
  }
}

module.exports = DroneManager;