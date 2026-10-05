const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const authRoutes = require("./routes/auth");
const resourceRoutes = require("./routes/resources");
const runMigrations = require("./sql/runMigrations");

const app = express();

const PORT = 5000;


// Middleware
app.use(cors({
    origin: "http://localhost:5173"
}));

app.use(express.json());


// Routes
app.get("/", (req, res) => {
    res.send("Backend server is running!");
});

app.use("/api/auth", authRoutes);
app.use("/api", resourceRoutes);


// Start server
async function startServer() {
    try {
        await runMigrations();

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("Server could not start:", error.message);
        process.exitCode = 1;
    }
}

startServer();