const oracledb = require("oracledb");
require("dotenv").config();

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function connectToDatabase() {
    try {
        const connection = await oracledb.getConnection({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: process.env.DB_CONNECT_STRING
        });

        console.log("Connected to Oracle Database!");

        return connection;
    } catch (error) {
        console.error("Oracle connection failed:");
        console.error(error);

        throw error;
    }
}

module.exports = connectToDatabase;