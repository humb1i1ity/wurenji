// 光敏传感器管理器类
class LightSensorManager {
  constructor() {
    this.currentLight = 0;
    this.lightThreshold = 50;
    this.lastAlertTime = 0;
    this.alertCooldown = 5000; // 5秒冷却时间，避免频繁警报
  }

  // 获取当前光照值
  getCurrentLight() {
    return this.currentLight;
  }

  // 获取当前阈值
  getLightThreshold() {
    return this.lightThreshold;
  }

  // 更新光照值
  updateLight(light) {
    this.currentLight = Math.max(0, Math.min(100, light));
    return this.currentLight;
  }

  // 更新阈值
  updateThreshold(threshold) {
    this.lightThreshold = Math.max(0, Math.min(100, threshold));
    return this.lightThreshold;
  }

  // 检查是否需要发送警报
  checkAlert() {
    const now = Date.now();
    if (this.currentLight > this.lightThreshold) {
      // 检查是否在冷却时间内
      if (now - this.lastAlertTime > this.alertCooldown) {
        this.lastAlertTime = now;
        return {
          alert: true,
          light: this.currentLight,
          threshold: this.lightThreshold,
          timestamp: new Date().toISOString()
        };
      }
    }
    return { alert: false };
  }

  // 模拟光照变化
  simulateLightChange() {
    // 模拟光照在0-100之间变化
    const lightChange = (Math.random() - 0.3) * 10;
    this.currentLight = Math.max(0, Math.min(100, this.currentLight + lightChange));
    return this.currentLight;
  }

  // 获取完整的传感器数据
  getSensorData() {
    return {
      light: this.currentLight,
      threshold: this.lightThreshold,
      alert: this.currentLight > this.lightThreshold
    };
  }
}

module.exports = LightSensorManager;