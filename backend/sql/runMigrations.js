const fs = require("fs/promises");
const path = require("path");
const connectToDatabase = require("../config/database");

async function runMigrations() {
    const directory = path.join(__dirname, "migrations");
    const files = (await fs.readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
    const connection = await connectToDatabase();
    try {
        for (const file of files) {
            const sql = await fs.readFile(path.join(directory, file), "utf8");
            const statement = sql.replace(/^\s*\/\s*$/gm, "").trim();
            if (statement) await connection.execute(statement);
        }
    } finally {
        await connection.close();
    }
}

module.exports = runMigrations;
