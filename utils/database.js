const Database = require('better-sqlite3');
const db = new Database('economy.db');

db.prepare(`
    CREATE TABLE IF NOT EXISTS Users (
        UserID TEXT PRIMARY KEY,
        Balance INTEGER DEFAULT 0,
        LastSalvage INTEGER DEFAULT 0,
        TotalSalvages INTEGER DEFAULT 0,
        Legendaries INTEGER DEFAULT 0,
        Failures INTEGER DEFAULT 0,
        Epics INTEGER DEFAULT 0,
        Uncommons INTEGER DEFAULT 0,
        Commons INTEGER DEFAULT 0
    )    
`).run();

module.exports = db;
