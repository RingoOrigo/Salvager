const Database = require('better-sqlite3');
const db = new Database('economy.db');

db.prepare(`
    CREATE TABLE IF NOT EXISTS Users (
        UserID TEXT PRIMARY KEY,
        DisplayName TEXT,
        Balance INTEGER DEFAULT 0,
        LastSalvage INTEGER DEFAULT 0,
        TotalSalvages INTEGER DEFAULT 0,
        Legendaries INTEGER DEFAULT 0,
        Rares INTEGER DEFAULT 0,
        Failures INTEGER DEFAULT 0,
        Epics INTEGER DEFAULT 0,
        Uncommons INTEGER DEFAULT 0,
        Commons INTEGER DEFAULT 0,
        TrinityBadges INTEGER DEFAULT 0,
        Ontos INTEGER DEFAULT 0,
        Logos INTEGER DEFAULT 0,
        Pneuma INTEGER DEFAULT 0
    )    
`).run();

/* EXAMPLE:
    (1, Common, 50, 1, 100, 1, Random) -> A common salvage with weight 50. 
            Can generate [1, 100] currency and has 1% chance to drop a Random item.
*/
db.prepare(`
    CREATE TABLE IF NOT EXISTS SalvageTable (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        Rarity TEXT,
        Weight INTEGER,
        MinValue INTEGER,
        MaxValue INTEGER,
        ItemWeight INTEGER,
        Item TEXT
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS LootboxTable (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        Rarity TEXT,
        Weight INTEGER,
        ItemWeight INTEGER,
        MinValue INTEGER,
        MaxValue INTEGER,
        Item TEXT,
        Colour TEXT
    )
`).run();

module.exports = db;
