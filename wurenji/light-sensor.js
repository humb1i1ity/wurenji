// 光敏传感器监测系统前端应用
class LightSensorApp {
  constructor() {
    this.socket = null;
    this.currentLight = 0;
    this.lightThreshold = 50;
    this.alerts = [];
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
    
    // 接收实时光照数据
    this.socket.on('light-data', (data) => {
      this.updateLightData(data);
    });
    
    // 接收光照警报
    this.socket.on('light-alert', (alertData) => {
      this.handleLightAlert(alertData);
    });
  }

  // 绑定事件监听
  bindEvents() {
    // 阈值滑块事件
    const thresholdSlider = document.getElementById('threshold-slider');
    const thresholdInput = document.getElementById('threshold-input');
    
    thresholdSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      thresholdInput.value = value;
      this.updateThreshold(value);
    });
    
    thresholdInput.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      if (!isNaN(value) && value >= 0 && value <= 100) {
        thresholdSlider.value = value;
        this.updateThreshold(value);
      }
    });
    
    // 模态框事件
    const alertModal = document.getElementById('alert-modal');
    const closeBtn = alertModal.querySelector('.close');
    const okBtn = document.getElementById('modal-ok-btn');
    
    closeBtn.addEventListener('click', () => {
      alertModal.classList.remove('show');
    });
    
    okBtn.addEventListener('click', () => {
      alertModal.classList.remove('show');
    });
    
    window.addEventListener('click', (e) => {
      if (e.target === alertModal) {
        alertModal.classList.remove('show');
      }
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

  // 更新光照数据
  updateLightData(data) {
    this.currentLight = data.light;
    
    // 更新光照值显示
    const currentLightElement = document.getElementById('current-light');
    currentLightElement.textContent = this.currentLight.toFixed(1);
    
    // 更新光照条
    const lightLevelElement = document.getElementById('light-level');
    lightLevelElement.style.width = `${this.currentLight}%`;
    
    // 根据是否超过阈值更新样式
    if (this.currentLight > this.lightThreshold) {
      lightLevelElement.classList.add('high');
    } else {
      lightLevelElement.classList.remove('high');
    }
  }

  // 更新阈值
  updateThreshold(threshold) {
    this.lightThreshold = threshold;
    this.socket.emit('update-light-threshold', { threshold: threshold });
    
    // 更新光照条样式
    const lightLevelElement = document.getElementById('light-level');
    if (this.currentLight > this.lightThreshold) {
      lightLevelElement.classList.add('high');
    } else {
      lightLevelElement.classList.remove('high');
    }
  }

  // 处理光照警报
  handleLightAlert(alertData) {
    // 添加到警报列表
    this.alerts.unshift(alertData);
    if (this.alerts.length > 20) {
      this.alerts.pop();
    }
    
    // 更新警报列表显示
    this.renderAlerts();
    
    // 显示浏览器通知
    this.showBrowserNotification(alertData);
    
    // 显示模态框
    this.showAlertModal(alertData);
  }

  // 显示浏览器通知
  showBrowserNotification(alertData) {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('光照警报', {
          body: `光照值超过阈值: ${alertData.light.toFixed(1)} > ${alertData.threshold}`,
          icon: '/favicon.ico'
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('光照警报', {
              body: `光照值超过阈值: ${alertData.light.toFixed(1)} > ${alertData.threshold}`,
              icon: '/favicon.ico'
            });
          }
        });
      }
    }
  }

  // 显示警报模态框
  showAlertModal(alertData) {
    const modal = document.getElementById('alert-modal');
    const content = `
      <div class="alert-item">
        <div class="alert-message">光照值超过阈值！</div>
        <div class="alert-details">
          <div>当前光照: <strong>${alertData.light.toFixed(1)}</strong></div>
          <div>设定阈值: <strong>${alertData.threshold}</strong></div>
          <div>时间: ${new Date(alertData.timestamp).toLocaleString('zh-CN')}</div>
        </div>
      </div>
    `;
    document.getElementById('modal-alert-content').innerHTML = content;
    modal.classList.add('show');
  }

  // 渲染警报列表
  renderAlerts() {
    const alertList = document.getElementById('alert-list');
    const alertCount = document.getElementById('alert-count');
    
    alertCount.textContent = this.alerts.length;
    
    if (this.alerts.length === 0) {
      alertList.innerHTML = '<div class="no-alerts">暂无警报记录</div>';
      return;
    }
    
    alertList.innerHTML = this.alerts.map(alert => `
      <div class="alert-item">
        <div class="alert-header">
          <div class="alert-time">${new Date(alert.timestamp).toLocaleString('zh-CN')}</div>
        </div>
        <div class="alert-message">光照值超过阈值！</div>
        <div class="alert-details">
          <div>光照值: ${alert.light.toFixed(1)} | 阈值: ${alert.threshold}</div>
        </div>
      </div>
    `).join('');
  }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
  new LightSensorApp();
});