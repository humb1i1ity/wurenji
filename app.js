// 无人机监测系统前端应用
class DroneMonitoringApp {
  constructor() {
    this.socket = null;
    this.drones = [];
    this.tasks = [];
    this.mapBounds = {
      minLat: 39.88,
      maxLat: 39.95,
      minLng: 116.38,
      maxLng: 116.45
    };
    this.init();
  }

  init() {
    this.connectSocket();
    this.bindEvents();
    this.updateCurrentTime();
    setInterval(() => this.updateCurrentTime(), 1000);
  }

  // 连接WebSocket服务器
  connectSocket() {
    this.socket = io();
    
    this.socket.on('connect', () => {
      document.getElementById('connection-status').className = 'status-connected';
      document.getElementById('connection-status').textContent = '已连接';
    });
    
    this.socket.on('disconnect', () => {
      document.getElementById('connection-status').className = 'status-disconnected';
      document.getElementById('connection-status').textContent = '已断开';
    });
    
    // 接收无人机数据
    this.socket.on('drones', (drones) => {
      this.drones = drones;
      this.renderDrones();
      this.renderMap();
      this.updateDroneSelect();
    });
    
    // 接收任务数据
    this.socket.on('tasks', (tasks) => {
      this.tasks = tasks;
      this.renderTasks();
    });
    
    // 任务分配结果
    this.socket.on('task-assign-result', (result) => {
      if (result.success) {
        alert('任务分配成功！');
        this.closeTaskModal();
      } else {
        alert('任务分配失败：' + result.error);
      }
    });
    
    // 无人机到达目的地提醒
    this.socket.on('drone-arrived', (event) => {
      this.showArrivedNotification(event);
    });
    
    // 光照警报
    this.socket.on('light-alert', (alertData) => {
      console.log('光照警报:', alertData);
      this.showLightAlert(alertData);
    });
  }

  // 绑定事件监听
  bindEvents() {
    // 任务分配按钮
    document.getElementById('assign-task-btn').addEventListener('click', () => {
      this.openTaskModal();
    });
    
    // 模态框关闭按钮
    document.querySelector('.close').addEventListener('click', () => {
      this.closeTaskModal();
    });
    
    // 取消按钮
    document.getElementById('cancel-btn').addEventListener('click', () => {
      this.closeTaskModal();
    });
    
    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
      const modal = document.getElementById('task-modal');
      if (e.target === modal) {
        this.closeTaskModal();
      }
    });
    
    // 任务表单提交
    document.getElementById('task-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitTask();
    });
  }

  // 更新当前时间
  updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    document.getElementById('current-time').textContent = timeString;
  }

  // 渲染无人机列表
  renderDrones() {
    const droneList = document.getElementById('drone-list');
    const droneCount = document.getElementById('drone-count');
    
    droneCount.textContent = this.drones.length;
    
    droneList.innerHTML = this.drones.map(drone => `
      <div class="drone-item">
        <div class="drone-info">
          <div class="drone-id">${drone.id}</div>
          <div class="drone-name">${drone.name}</div>
          <div class="drone-stats">
            <div class="stat-item">
              <span>电量:</span>
              <div class="battery-bar">
                <div class="battery-level ${drone.battery < 20 ? 'low' : ''}" 
                     style="width: ${drone.battery}%"></div>
              </div>
              <span>${drone.battery}%</span>
            </div>
            <div class="stat-item">
              <span>状态:</span>
              <span class="status-badge status-${drone.status}">${this.getStatusText(drone.status)}</span>
            </div>
            <div class="stat-item">
              <span>光照:</span>
              <div class="light-bar">
                <div class="light-level ${drone.lightAlert ? 'high' : ''}" 
                     style="width: ${drone.light}%"></div>
              </div>
              <span>${drone.light.toFixed(1)} / ${drone.lightThreshold}</span>
            </div>
          </div>
        </div>
        <div class="drone-position">
          <div class="position-lat">${drone.position.lat.toFixed(4)}</div>
          <div class="position-lng">${drone.position.lng.toFixed(4)}</div>
        </div>
      </div>
    `).join('');
  }

  // 渲染地图上的无人机
  renderMap() {
    const mapContainer = document.getElementById('map');
    
    // 清除现有标记
    const existingMarkers = mapContainer.querySelectorAll('.map-drone');
    existingMarkers.forEach(marker => marker.remove());
    
    // 添加新标记
    this.drones.forEach(drone => {
      const marker = document.createElement('div');
      marker.className = 'map-drone';
      
      // 计算地图上的位置
      const x = this.lngToX(drone.position.lng);
      const y = this.latToY(drone.position.lat);
      
      marker.style.left = `${x}%`;
      marker.style.top = `${y}%`;
      
      // 根据状态设置标记样式
      let markerClass = 'idle';
      if (drone.status === 'delivering') {
        markerClass = 'delivering';
      } else if (drone.battery < 20) {
        markerClass = 'low-battery';
      }
      
      // 如果有光照警报，添加警报标记
      const alertClass = drone.lightAlert ? ' light-alert' : '';
      
      marker.innerHTML = `
        <div class="drone-marker ${markerClass}${alertClass}"></div>
        <div class="drone-tooltip">
          <div>${drone.name}</div>
          <div>ID: ${drone.id}</div>
          <div>状态: ${this.getStatusText(drone.status)}</div>
          <div>电量: ${drone.battery}%</div>
          <div>光照: ${drone.light.toFixed(1)} / ${drone.lightThreshold}</div>
          ${drone.lightAlert ? '<div class="light-alert-text">⚠️ 光照过高！</div>' : ''}
        </div>
      `;
      
      mapContainer.appendChild(marker);
    });
  }

  // 渲染任务列表
  renderTasks() {
    const taskList = document.getElementById('task-list');
    
    if (this.tasks.length === 0) {
      taskList.innerHTML = '<div class="no-tasks">暂无任务</div>';
      return;
    }
    
    taskList.innerHTML = this.tasks.map(task => {
      const drone = this.drones.find(d => d.id === task.droneId);
      return `
        <div class="task-item">
          <div class="task-header">
            <div class="task-id">${task.id}</div>
            <div class="task-status ${task.status}">${this.getTaskStatusText(task.status)}</div>
          </div>
          <div class="task-desc">${task.description}</div>
          <div class="task-dest">
            目标: ${task.destination.lat.toFixed(4)}, ${task.destination.lng.toFixed(4)}
          </div>
          <div class="task-drone">
            执行无人机: ${drone ? drone.name : '未知'}
          </div>
          <div class="task-time">
            创建时间: ${new Date(task.createdAt).toLocaleString('zh-CN')}
          </div>
        </div>
      `;
    }).join('');
  }

  // 打开任务分配模态框
  openTaskModal() {
    document.getElementById('task-modal').classList.add('show');
    this.updateDroneSelect();
  }

  // 关闭任务分配模态框
  closeTaskModal() {
    document.getElementById('task-modal').classList.remove('show');
    document.getElementById('task-form').reset();
  }

  // 更新无人机选择下拉框
  updateDroneSelect() {
    const select = document.getElementById('drone-select');
    const idleDrones = this.drones.filter(drone => drone.status === 'idle' && drone.battery >= 20);
    
    select.innerHTML = '';
    
    if (idleDrones.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '暂无可用无人机';
      option.disabled = true;
      select.appendChild(option);
      return;
    }
    
    idleDrones.forEach(drone => {
      const option = document.createElement('option');
      option.value = drone.id;
      option.textContent = `${drone.name} (${drone.battery}%)`;
      select.appendChild(option);
    });
  }

  // 提交任务
  submitTask() {
    const droneId = document.getElementById('drone-select').value;
    const description = document.getElementById('task-description').value;
    const lat = parseFloat(document.getElementById('dest-lat').value);
    const lng = parseFloat(document.getElementById('dest-lng').value);
    
    if (!droneId || !description || isNaN(lat) || isNaN(lng)) {
      alert('请填写完整的任务信息');
      return;
    }
    
    const task = {
      description: description,
      destination: {
        lat: lat,
        lng: lng
      }
    };
    
    this.socket.emit('assign-task', {
      droneId: droneId,
      task: task
    });
  }

  // 坐标转换：经度转X百分比
  lngToX(lng) {
    return ((lng - this.mapBounds.minLng) / (this.mapBounds.maxLng - this.mapBounds.minLng)) * 100;
  }

  // 坐标转换：纬度转Y百分比
  latToY(lat) {
    return ((this.mapBounds.maxLat - lat) / (this.mapBounds.maxLat - this.mapBounds.minLat)) * 100;
  }

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      idle: '空闲',
      delivering: '配送中',
      charging: '充电中'
    };
    return statusMap[status] || status;
  }

  // 获取任务状态文本
  getTaskStatusText(status) {
    const statusMap = {
      assigned: '已分配',
      in_progress: '进行中',
      completed: '已完成',
      failed: '失败'
    };
    return statusMap[status] || status;
  }
  
  // 显示无人机到达通知
  showArrivedNotification(event) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = 'notification notification-success';
    
    notification.innerHTML = `
      <div class="notification-icon">✓</div>
      <div class="notification-content">
        <div class="notification-title">无人机已到达目的地</div>
        <div class="notification-message">
          <strong>${event.droneName}</strong> 已完成任务 <strong>${event.taskId}</strong>
        </div>
        <div class="notification-detail">
          ${event.taskDescription} - 到达坐标: ${event.destination.lat.toFixed(4)}, ${event.destination.lng.toFixed(4)}
        </div>
      </div>
      <button class="notification-close">&times;</button>
    `;
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 自动关闭通知（5秒后）
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
    
    // 点击关闭按钮
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      notification.classList.add('fade-out');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    });
    
    // 播放提示音（如果浏览器支持）
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
      audio.play();
    } catch (e) {
      // 忽略音频播放错误
    }
  }
  
  // 显示光照警报
  showLightAlert(alertData) {
    // 显示浏览器通知
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('光照警报', {
          body: `${alertData.droneName} (${alertData.droneId}) 光照过高: ${alertData.light.toFixed(1)} > ${alertData.threshold}`,
          icon: '/favicon.ico'
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('光照警报', {
              body: `${alertData.droneName} (${alertData.droneId}) 光照过高: ${alertData.light.toFixed(1)} > ${alertData.threshold}`,
              icon: '/favicon.ico'
            });
          }
        });
      }
    }
    
    // 显示页面内警报
    this.showAlertModal(alertData);
  }
  
  // 显示警报模态框
  showAlertModal(alertData) {
    // 检查是否已有模态框
    let modal = document.getElementById('light-alert-modal');
    if (!modal) {
      // 创建模态框
      modal = document.createElement('div');
      modal.id = 'light-alert-modal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content alert-modal">
          <div class="modal-header">
            <h3>⚠️ 光照警报</h3>
            <span class="close">&times;</span>
          </div>
          <div class="modal-body">
            <div id="alert-content"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" id="alert-ok-btn">确认</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      // 绑定事件
      modal.querySelector('.close').addEventListener('click', () => {
        modal.classList.remove('show');
      });
      document.getElementById('alert-ok-btn').addEventListener('click', () => {
        modal.classList.remove('show');
      });
      window.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('show');
        }
      });
    }
    
    // 更新警报内容
    const content = `
      <div class="alert-item">
        <div class="alert-drone">${alertData.droneName} (${alertData.droneId})</div>
        <div class="alert-message">当前光照值超过阈值！</div>
        <div class="alert-details">
          <div>当前光照: <strong>${alertData.light.toFixed(1)}</strong></div>
          <div>阈值: <strong>${alertData.threshold}</strong></div>
          <div>时间: ${new Date(alertData.timestamp).toLocaleString('zh-CN')}</div>
        </div>
      </div>
    `;
    document.getElementById('alert-content').innerHTML = content;
    
    // 显示模态框
    modal.classList.add('show');
  }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
  new DroneMonitoringApp();
});