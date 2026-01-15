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

    this.db.run(dronesTable);
    this.db.run(tasksTable);
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
}

module.exports = Database;