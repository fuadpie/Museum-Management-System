const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const oracledb = require("oracledb");
const connectToDatabase = require("../config/database");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();
const resetTokens = new Map();

async function withConnection(work) {
    const connection = await connectToDatabase();
    try {
        return await work(connection);
    } finally {
        await connection.close();
    }
}

function createToken(user) {
    return jwt.sign(
        { userId: user.USER_ID, email: user.EMAIL, role: user.ROLE },
        process.env.JWT_SECRET,
        { expiresIn: "8h" }
    );
}

router.post("/register", async (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const phone = String(req.body.phone || "").trim();
    const birthDate = String(req.body.birthDate || "").trim();
    const city = String(req.body.city || "").trim();
    const country = String(req.body.country || "").trim();
    const interests = String(req.body.interests || "").trim();

    if (!name || !email || password.length < 8) {
        return res.status(400).json({ message: "Name, a valid email and an 8-character password are required." });
    }

    let connection;
    try {
        connection = await connectToDatabase();
        const existing = await connection.execute(
            "SELECT USER_ID FROM USERS WHERE LOWER(EMAIL) = :email",
            { email }
        );
        if (existing.rows.length) {
            return res.status(409).json({ message: "Email is already registered." });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const insertResult = await connection.execute(
            `INSERT INTO USERS (NAME, EMAIL, PASSWORD_HASH, PHONE, BIRTH_DATE, CITY, COUNTRY, INTERESTS, ROLE, STATUS)
             VALUES (:name, :email, :passwordHash, :phone, ${birthDate ? "TO_DATE(:birthDate, 'YYYY-MM-DD')" : "NULL"}, :city, :country, :interests, 'USER', 'ACTIVE')`,
            {
                name,
                email,
                passwordHash,
                phone,
                birthDate: birthDate || null,
                city,
                country,
                interests,
                userId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
            },
            { autoCommit: true }
        );
        const user = {
            USER_ID: insertResult.outBinds.userId[0],
            NAME: name,
            EMAIL: email,
            ROLE: "USER",
        };
        return res.status(201).json({
            message: "Registration successful.",
            token: createToken(user),
            user: { id: user.USER_ID, name: user.NAME, email: user.EMAIL, role: user.ROLE },
        });

        router.post("/register-museum", async (req, res) => {
            const name = String(req.body.name || "").trim();
            const email = String(req.body.email || "").trim().toLowerCase();
            const password = String(req.body.password || "");
            const museumName = String(req.body.museumName || "").trim();
            const location = String(req.body.location || "").trim();
            const description = String(req.body.museumDescription || "").trim();
            if (!name || !email || password.length < 8 || !museumName || !location) {
                return res.status(400).json({ message: "Owner name, email, password, museum name and location are required." });
            }
            let connection;
            try {
                connection = await connectToDatabase();
                const existing = await connection.execute("SELECT USER_ID FROM USERS WHERE LOWER(EMAIL) = :email", { email });
                if (existing.rows.length) return res.status(409).json({ message: "Email is already registered." });
                const passwordHash = await bcrypt.hash(password, 12);
                const userResult = await connection.execute(
                    `INSERT INTO USERS (NAME, EMAIL, PASSWORD_HASH, ROLE, STATUS)
                     VALUES (:name, :email, :passwordHash, 'MUSEUM_MANAGER', 'ACTIVE')
                     RETURNING USER_ID INTO :userId`,
                    { name, email, passwordHash, userId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
                );
                const userId = userResult.outBinds.userId[0];
                await connection.execute(
                    `INSERT INTO MUSEUMS (OWNER_USER_ID, NAME, LOCATION, DESCRIPTION, STATUS)
                     VALUES (:userId, :museumName, :location, :description, 'ACTIVE')`,
                    { userId, museumName, location, description },
                    { autoCommit: true }
                );
                const user = { USER_ID: userId, NAME: name, EMAIL: email, ROLE: "MUSEUM_MANAGER" };
                return res.status(201).json({ message: "Museum account created.", token: createToken(user), user: { id: userId, name, email, role: user.ROLE } });
            } catch (error) {
                console.error("Museum registration error:", error);
                return res.status(500).json({ message: "Unable to register museum." });
            } finally {
                if (connection) await connection.close();
            }
        });
    } catch (error) {
        console.error("Registration error:", error);
        return res.status(500).json({ message: "Server error during registration." });
    } finally {
        if (connection) await connection.close();
    }
});

router.post("/login", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const requestedRole = String(req.body.role || "USER").toUpperCase();
    if (!["USER", "STAFF", "ADMIN", "MUSEUM_MANAGER"].includes(requestedRole)) {
        return res.status(400).json({ message: "Invalid account type." });
    }
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    let connection;
    try {
        connection = await connectToDatabase();
        const result = await connection.execute(
            `SELECT USER_ID, NAME, EMAIL, PASSWORD_HASH, ROLE, STATUS
             FROM USERS WHERE LOWER(EMAIL) = :email`,
            { email }
        );
        if (!result.rows.length || !(await bcrypt.compare(password, result.rows[0].PASSWORD_HASH))) {
            return res.status(401).json({ message: "Invalid email or password." });
        }
        const user = result.rows[0];
        if (user.STATUS !== "ACTIVE" || user.ROLE !== requestedRole) {
            return res.status(403).json({ message: `This account is not registered as ${requestedRole.toLowerCase()}.` });
        }
        return res.json({
            message: "Login successful.",
            token: createToken(user),
            user: { id: user.USER_ID, name: user.NAME, email: user.EMAIL, role: user.ROLE },
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ message: "Server error during login." });
    } finally {
        if (connection) await connection.close();
    }
});

router.get("/me", authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await connectToDatabase();
        const result = await connection.execute(
            "SELECT USER_ID, NAME, EMAIL, PHONE, CITY, COUNTRY, INTERESTS, ROLE, STATUS, CREATED_AT FROM USERS WHERE USER_ID = :userId",
            { userId: req.user.userId }
        );
        if (!result.rows.length) return res.status(404).json({ message: "User not found." });
        const user = result.rows[0];
        return res.json({ user: { id: user.USER_ID, name: user.NAME, email: user.EMAIL, phone: user.PHONE, city: user.CITY, country: user.COUNTRY, interests: user.INTERESTS, role: user.ROLE, status: user.STATUS, createdAt: user.CREATED_AT } });
    } catch (error) {
        console.error("Profile error:", error);
        return res.status(500).json({ message: "Server error while retrieving profile." });
    } finally {
        if (connection) await connection.close();
    }
});

router.get("/profile", authenticateToken, (req, res) => res.redirect(307, "/api/auth/me"));

router.put("/profile", authenticateToken, async (req, res) => {
    const name = String(req.body.name || "").trim();
    const phone = String(req.body.phone || "").trim();
    const city = String(req.body.city || "").trim();
    const country = String(req.body.country || "").trim();
    const interests = String(req.body.interests || "").trim();
    if (!name) return res.status(400).json({ message: "Name is required." });
    try {
        await withConnection((db) => db.execute(
            `UPDATE USERS SET NAME = :name, PHONE = :phone, CITY = :city, COUNTRY = :country, INTERESTS = :interests
             WHERE USER_ID = :userId`,
            { name, phone, city, country, interests, userId: req.user.userId },
            { autoCommit: true }
        ));
        return res.json({ message: "Profile updated." });
    } catch (error) {
        console.error("Profile update error:", error);
        return res.status(500).json({ message: "Unable to update profile." });
    }
});

router.put("/password", authenticateToken, async (req, res) => {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    if (newPassword.length < 8) return res.status(400).json({ message: "New password must be at least 8 characters." });
    let connection;
    try {
        connection = await connectToDatabase();
        const result = await connection.execute("SELECT PASSWORD_HASH FROM USERS WHERE USER_ID = :userId", { userId: req.user.userId });
        if (!result.rows.length || !(await bcrypt.compare(currentPassword, result.rows[0].PASSWORD_HASH))) return res.status(401).json({ message: "Current password is incorrect." });
        await connection.execute("UPDATE USERS SET PASSWORD_HASH = :passwordHash WHERE USER_ID = :userId", { passwordHash: await bcrypt.hash(newPassword, 12), userId: req.user.userId }, { autoCommit: true });
        return res.json({ message: "Password changed successfully." });
    } catch (error) {
        console.error("Password change error:", error);
        return res.status(500).json({ message: "Unable to change password." });
    } finally {
        if (connection) await connection.close();
    }
});

router.post("/forgot-password", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Email is required." });
    try {
        const result = await (async () => {
            const connection = await connectToDatabase();
            try { return await connection.execute("SELECT USER_ID FROM USERS WHERE LOWER(EMAIL) = :email AND STATUS = 'ACTIVE'", { email }); }
            finally { await connection.close(); }
        })();
        const response = { message: "If an active account exists, reset instructions have been created." };
        if (result.rows.length) {
            const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            resetTokens.set(token, { userId: result.rows[0].USER_ID, expires: Date.now() + 15 * 60 * 1000 });
            response.resetToken = token;
        }
        return res.json(response);
    } catch (error) {
        console.error("Forgot password error:", error);
        return res.status(500).json({ message: "Unable to start password reset." });
    }
});

router.post("/reset-password", async (req, res) => {
    const token = String(req.body.token || "");
    const password = String(req.body.password || "");
    const reset = resetTokens.get(token);
    if (!reset || reset.expires < Date.now() || password.length < 8) return res.status(400).json({ message: "Reset token is invalid or expired." });
    try {
        await (async () => {
            const connection = await connectToDatabase();
            try { await connection.execute("UPDATE USERS SET PASSWORD_HASH = :passwordHash WHERE USER_ID = :userId", { passwordHash: await bcrypt.hash(password, 12), userId: reset.userId }, { autoCommit: true }); }
            finally { await connection.close(); }
        })();
        resetTokens.delete(token);
        return res.json({ message: "Password reset successfully." });
    } catch (error) {
        console.error("Reset password error:", error);
        return res.status(500).json({ message: "Unable to reset password." });
    }
});

module.exports = router;
