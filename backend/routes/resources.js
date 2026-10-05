const express = require("express");
const oracledb = require("oracledb");
const connectToDatabase = require("../config/database");
const authenticateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");

const router = express.Router();
const protectedRouter = express.Router();
protectedRouter.use(authenticateToken);

async function withConnection(work) {
    const connection = await connectToDatabase();
    try {
        return await work(connection);
    } finally {
        await connection.close();
    }
}

router.get("/museums", async (req, res) => {
    const search = `%${String(req.query.search || "").trim().toLowerCase()}%`;
    try {
        const museums = await withConnection((db) => db.execute(
                `SELECT M.MUSEUM_ID AS "id", M.NAME AS "name", M.LOCATION AS "location",
                    M.DESCRIPTION AS "description", M.PHONE AS "phone", M.EMAIL AS "email", M.WEBSITE_URL AS "websiteUrl",
                    M.OPENING_TIME AS "openingTime",
                    M.CLOSING_TIME AS "closingTime", M.STATUS AS "status",
                    (SELECT COUNT(*) FROM EXHIBITIONS E WHERE E.MUSEUM_ID = M.MUSEUM_ID AND E.STATUS <> 'CANCELLED') AS "exhibitionCount",
                    (SELECT NVL(ROUND(AVG(R.RATING), 1), 0) FROM REVIEWS R WHERE R.MUSEUM_ID = M.MUSEUM_ID) AS "rating"
                 FROM MUSEUMS M
                 WHERE M.STATUS = 'ACTIVE' AND (LOWER(M.NAME) LIKE :search OR LOWER(M.LOCATION) LIKE :search)
                 ORDER BY M.NAME`,
            { search }
        ));
        return res.json({ museums: museums.rows });
    } catch (error) {
        console.error("Museum listing error:", error);
        return res.status(500).json({ message: "Unable to load museums." });
    }
});

router.get("/museums/:id", async (req, res) => {
    try {
        const data = await withConnection(async (db) => {
            const museum = await db.execute(
                `SELECT MUSEUM_ID AS "id", NAME AS "name", LOCATION AS "location", DESCRIPTION AS "description",
                        M.PHONE AS "phone", M.EMAIL AS "email", M.WEBSITE_URL AS "websiteUrl",
                        OPENING_TIME AS "openingTime", CLOSING_TIME AS "closingTime", STATUS AS "status"
                 FROM MUSEUMS WHERE MUSEUM_ID = :id`,
                { id: req.params.id }
            );
            const exhibitions = await db.execute(
                `SELECT EXHIBITION_ID AS "id", TITLE AS "title", DESCRIPTION AS "description",
                        TO_CHAR(START_DATE, 'YYYY-MM-DD') AS "startDate",
                        TO_CHAR(END_DATE, 'YYYY-MM-DD') AS "endDate", TICKET_PRICE AS "ticketPrice", STATUS AS "status"
                 FROM EXHIBITIONS WHERE MUSEUM_ID = :id ORDER BY START_DATE`,
                { id: req.params.id }
            );
            const artworks = await db.execute(
                `SELECT A.ARTWORK_ID AS "id", A.TITLE AS "title", A.ARTIST_NAME AS "artistName",
                    A.CREATION_YEAR AS "creationYear", A.CATEGORY AS "category", A.DESCRIPTION AS "description",
                    E.TITLE AS "exhibitionTitle"
                 FROM ARTWORKS A JOIN EXHIBITIONS E ON E.EXHIBITION_ID = A.EXHIBITION_ID
                 WHERE E.MUSEUM_ID = :id ORDER BY A.TITLE`,
                { id: req.params.id }
            );
            const reviews = await db.execute(
                `SELECT R.REVIEW_ID AS "id", U.NAME AS "visitorName", R.RATING AS "rating",
                        R.REVIEW_TEXT AS "comment", R.CREATED_AT AS "createdAt"
                 FROM REVIEWS R JOIN USERS U ON U.USER_ID = R.USER_ID
                 WHERE R.MUSEUM_ID = :id ORDER BY R.CREATED_AT DESC`,
                { id: req.params.id }
            );
            return { museum: museum.rows[0], exhibitions: exhibitions.rows, artworks: artworks.rows, reviews: reviews.rows };
        });
        if (!data.museum) return res.status(404).json({ message: "Museum not found." });
        return res.json(data);
    } catch (error) {
        console.error("Museum detail error:", error);
        return res.status(500).json({ message: "Unable to load museum." });
    }
});

router.get("/exhibitions", async (req, res) => {
    const search = `%${String(req.query.search || "").trim().toLowerCase()}%`;
    const museumId = Number(req.query.museumId);
    try {
        const data = await withConnection((db) => db.execute(
            `SELECT E.EXHIBITION_ID AS "id", E.TITLE AS "title", E.DESCRIPTION AS "description",
                    E.MUSEUM_ID AS "museumId", M.NAME AS "museumName",
                    TO_CHAR(E.START_DATE, 'YYYY-MM-DD') AS "startDate",
                    TO_CHAR(E.END_DATE, 'YYYY-MM-DD') AS "endDate",
                    E.TICKET_PRICE AS "ticketPrice", E.STATUS AS "status"
             FROM EXHIBITIONS E JOIN MUSEUMS M ON M.MUSEUM_ID = E.MUSEUM_ID
             WHERE E.STATUS <> 'CANCELLED'
               AND (LOWER(E.TITLE) LIKE :search OR LOWER(E.DESCRIPTION) LIKE :search)
               AND (:museumId IS NULL OR E.MUSEUM_ID = :museumId)
             ORDER BY E.START_DATE`,
            { search, museumId: Number.isInteger(museumId) ? museumId : null }
        ));
        return res.json({ exhibitions: data.rows });
    } catch (error) {
        console.error("Exhibition listing error:", error);
        return res.status(500).json({ message: "Unable to load exhibitions." });
    }
});

router.get("/exhibitions/:id", async (req, res) => {
    try {
        const data = await withConnection(async (db) => {
            const exhibition = await db.execute(
                `SELECT E.EXHIBITION_ID AS "id", E.TITLE AS "title", E.DESCRIPTION AS "description",
                        E.MUSEUM_ID AS "museumId", M.NAME AS "museumName",
                        TO_CHAR(E.START_DATE, 'YYYY-MM-DD') AS "startDate",
                        TO_CHAR(E.END_DATE, 'YYYY-MM-DD') AS "endDate", E.TICKET_PRICE AS "ticketPrice", E.STATUS AS "status"
                 FROM EXHIBITIONS E JOIN MUSEUMS M ON M.MUSEUM_ID = E.MUSEUM_ID WHERE E.EXHIBITION_ID = :id`,
                { id: req.params.id }
            );
            const artworks = await db.execute(
                `SELECT ARTWORK_ID AS "id", TITLE AS "title", ARTIST_NAME AS "artistName",
                        CREATION_YEAR AS "creationYear", CATEGORY AS "category", DESCRIPTION AS "description",
                        IMAGE_URL AS "imageUrl"
                 FROM ARTWORKS WHERE EXHIBITION_ID = :id ORDER BY TITLE`,
                { id: req.params.id }
            );
            return { exhibition: exhibition.rows[0], artworks: artworks.rows };
        });
        if (!data.exhibition) return res.status(404).json({ message: "Exhibition not found." });
        return res.json(data);
    } catch (error) {
        console.error("Exhibition detail error:", error);
        return res.status(500).json({ message: "Unable to load exhibition." });
    }
});

router.get("/artworks", async (req, res) => {
    const search = `%${String(req.query.search || "").trim().toLowerCase()}%`;
    try {
        const data = await withConnection((db) => db.execute(
            `SELECT A.ARTWORK_ID AS "id", A.TITLE AS "title", A.ARTIST_NAME AS "artistName",
                    A.CREATION_YEAR AS "creationYear", A.CATEGORY AS "category", A.DESCRIPTION AS "description",
                    E.TITLE AS "exhibitionTitle", M.NAME AS "museumName", A.IMAGE_URL AS "imageUrl"
             FROM ARTWORKS A JOIN EXHIBITIONS E ON E.EXHIBITION_ID = A.EXHIBITION_ID
             JOIN MUSEUMS M ON M.MUSEUM_ID = E.MUSEUM_ID
             WHERE LOWER(A.TITLE) LIKE :search OR LOWER(A.ARTIST_NAME) LIKE :search OR LOWER(A.CATEGORY) LIKE :search
             ORDER BY A.TITLE`,
            { search }
        ));
        return res.json({ artworks: data.rows });
    } catch (error) {
        console.error("Artwork listing error:", error);
        return res.status(500).json({ message: "Unable to load artworks." });
    }
});

protectedRouter.post("/bookings", async (req, res) => {
    const exhibitionId = Number(req.body.exhibitionId);
    const visitDate = String(req.body.visitDate || "");
    if (!Number.isInteger(exhibitionId) || !/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
        return res.status(400).json({ message: "A valid exhibition and visit date are required." });
    }
    try {
        const booking = await withConnection(async (db) => {
            const check = await db.execute(
                `SELECT E.TICKET_PRICE, E.STATUS, E.START_DATE, E.END_DATE, U.STATUS AS USER_STATUS
                 FROM EXHIBITIONS E CROSS JOIN USERS U
                 WHERE E.EXHIBITION_ID = :exhibitionId AND U.USER_ID = :userId`,
                { exhibitionId, userId: req.user.userId }
            );
            if (!check.rows.length) throw Object.assign(new Error("Exhibition or user not found."), { status: 404 });
            const item = check.rows[0];
            const dateCheck = await db.execute(
                `SELECT COUNT(*) AS "count" FROM EXHIBITIONS
                 WHERE EXHIBITION_ID = :exhibitionId
                                     AND TO_DATE(:visitDate, 'YYYY-MM-DD') >= TRUNC(SYSDATE)
                                     AND TO_DATE(:visitDate, 'YYYY-MM-DD') BETWEEN TRUNC(START_DATE) AND TRUNC(END_DATE)
                   AND STATUS <> 'CANCELLED'`,
                { exhibitionId, visitDate }
            );
            if (item.USER_STATUS !== "ACTIVE" || item.STATUS === "CANCELLED" || !dateCheck.rows[0].count) {
                throw Object.assign(new Error("This exhibition is not available for the selected date."), { status: 422 });
            }
            const result = await db.execute(
                `INSERT INTO TICKETS (USER_ID, EXHIBITION_ID, VISIT_DATE, PRICE, STATUS)
                 VALUES (:userId, :exhibitionId, TO_DATE(:visitDate, 'YYYY-MM-DD'), :price, 'PENDING')
                 RETURNING TICKET_ID INTO :ticketId`,
                { userId: req.user.userId, exhibitionId, visitDate, price: item.TICKET_PRICE, ticketId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
                { autoCommit: true }
            );
            return { ticketId: result.outBinds.ticketId[0], status: "PENDING", price: item.TICKET_PRICE, visitDate };
        });
        return res.status(201).json(booking);
    } catch (error) {
        console.error("Booking error:", error);
        return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to create booking." });
    }
});

protectedRouter.get("/bookings/my", async (req, res) => {
    try {
        const data = await withConnection((db) => db.execute(
            `SELECT T.TICKET_ID AS "id", T.STATUS AS "status", T.PRICE AS "price",
                    TO_CHAR(T.VISIT_DATE, 'YYYY-MM-DD') AS "visitDate", T.BOOKED_AT AS "bookedAt",
                    E.TITLE AS "exhibitionTitle", M.NAME AS "museumName"
             FROM TICKETS T JOIN EXHIBITIONS E ON E.EXHIBITION_ID = T.EXHIBITION_ID
             JOIN MUSEUMS M ON M.MUSEUM_ID = E.MUSEUM_ID
             WHERE T.USER_ID = :userId ORDER BY T.BOOKED_AT DESC`,
            { userId: req.user.userId }
        ));
        return res.json({ bookings: data.rows });
    } catch (error) {
        console.error("Booking history error:", error);
        return res.status(500).json({ message: "Unable to load bookings." });
    }
});

protectedRouter.get("/reviews/my", async (req, res) => {
    try {
        const data = await withConnection((db) => db.execute(
            `SELECT R.REVIEW_ID AS "id", R.MUSEUM_ID AS "museumId", M.NAME AS "museumName",
                    R.RATING AS "rating", R.REVIEW_TEXT AS "comment", R.CREATED_AT AS "createdAt"
             FROM REVIEWS R JOIN MUSEUMS M ON M.MUSEUM_ID = R.MUSEUM_ID
             WHERE R.USER_ID = :userId ORDER BY R.CREATED_AT DESC`,
            { userId: req.user.userId }
        ));
        return res.json({ reviews: data.rows });
    } catch (error) {
        console.error("Review listing error:", error);
        return res.status(500).json({ message: "Unable to load reviews." });
    }
});

protectedRouter.put("/reviews/:id", async (req, res) => {
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || "").trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !comment) return res.status(400).json({ message: "Rating and review text are required." });
    try {
        const result = await withConnection((db) => db.execute(
            "UPDATE REVIEWS SET RATING = :rating, REVIEW_TEXT = :reviewText WHERE REVIEW_ID = :id AND USER_ID = :userId",
            { rating, reviewText: comment, id: req.params.id, userId: req.user.userId }, { autoCommit: true }
        ));
        if (!result.rowsAffected) return res.status(404).json({ message: "Review not found." });
        return res.json({ message: "Review updated." });
    } catch (error) {
        console.error("Review update error:", error);
        return res.status(500).json({ message: "Unable to update review." });
    }
});

protectedRouter.delete("/reviews/:id", async (req, res) => {
    try {
        const result = await withConnection((db) => db.execute("DELETE FROM REVIEWS WHERE REVIEW_ID = :id AND USER_ID = :userId", { id: req.params.id, userId: req.user.userId }, { autoCommit: true }));
        if (!result.rowsAffected) return res.status(404).json({ message: "Review not found." });
        return res.json({ message: "Review deleted." });
    } catch (error) {
        console.error("Review deletion error:", error);
        return res.status(500).json({ message: "Unable to delete review." });
    }
});

protectedRouter.post("/payments", async (req, res) => {
    const ticketId = Number(req.body.ticketId);
    const paymentMethod = String(req.body.paymentMethod || "CARD").toUpperCase();
    if (!Number.isInteger(ticketId) || !["CARD", "MOBILE_BANKING"].includes(paymentMethod)) {
        return res.status(400).json({ message: "A valid ticket and payment method are required." });
    }
    try {
        const payment = await withConnection(async (db) => {
            const ticket = await db.execute(
                "SELECT TICKET_ID, PRICE FROM TICKETS WHERE TICKET_ID = :ticketId AND USER_ID = :userId AND STATUS = 'PENDING'",
                { ticketId, userId: req.user.userId }
            );
            if (!ticket.rows.length) throw Object.assign(new Error("Pending ticket not found."), { status: 404 });
            const transactionId = `MUSEUM-${Date.now()}-${ticketId}`;
            await db.execute(
                `INSERT INTO PAYMENTS (TICKET_ID, AMOUNT, PAYMENT_METHOD, TRANSACTION_ID, STATUS)
                 VALUES (:ticketId, :amount, :paymentMethod, :transactionId, 'SUCCESS')`,
                { ticketId, amount: ticket.rows[0].PRICE, paymentMethod, transactionId }
            );
            await db.execute("UPDATE TICKETS SET STATUS = 'CONFIRMED' WHERE TICKET_ID = :ticketId", { ticketId }, { autoCommit: true });
            return { ticketId, status: "SUCCESS", transactionId };
        });
        return res.status(201).json(payment);
    } catch (error) {
        console.error("Payment error:", error);
        return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to process payment." });
    }
});

protectedRouter.post("/reviews", async (req, res) => {
    const museumId = Number(req.body.museumId);
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || "").trim();
    if (!Number.isInteger(museumId) || rating < 1 || rating > 5 || !comment) return res.status(400).json({ message: "Museum, rating and comment are required." });
    try {
        await withConnection((db) => db.execute(
            `INSERT INTO REVIEWS (USER_ID, MUSEUM_ID, RATING, REVIEW_TEXT) VALUES (:userId, :museumId, :rating, :reviewText)`,
            { userId: req.user.userId, museumId, rating, reviewText: comment },
            { autoCommit: true }
        ));
        return res.status(201).json({ message: "Review submitted." });
    } catch (error) {
        console.error("Review error:", error);
        return res.status(500).json({ message: "Unable to submit review." });
    }
});

router.use(protectedRouter);

router.delete("/museum-manager/reviews/:id", authenticateToken, async (req, res) => {
    if (req.user.role !== "MUSEUM_MANAGER") return res.status(403).json({ message: "Museum manager access is required." });
    try {
        const result = await withConnection((db) => db.execute(
            `DELETE FROM REVIEWS R WHERE R.REVIEW_ID = :reviewId AND EXISTS (
                 SELECT 1 FROM MUSEUMS M WHERE M.MUSEUM_ID = R.MUSEUM_ID AND M.OWNER_USER_ID = :userId
             )`,
            { reviewId: req.params.id, userId: req.user.userId },
            { autoCommit: true }
        ));
        if (!result.rowsAffected) return res.status(404).json({ message: "Review not found in your museum." });
        return res.json({ message: "Review deleted." });
    } catch (error) {
        console.error("Museum review deletion error:", error);
        return res.status(500).json({ message: "Unable to delete review." });
    }
});

router.put("/museum-manager/profile", authenticateToken, async (req, res) => {
    if (req.user.role !== "MUSEUM_MANAGER") return res.status(403).json({ message: "Museum manager access is required." });
    const name = String(req.body.name || "").trim();
    const location = String(req.body.location || "").trim();
    const description = String(req.body.description || "").trim();
    const phone = String(req.body.phone || "").trim();
    const email = String(req.body.email || "").trim();
    const websiteUrl = String(req.body.websiteUrl || "").trim();
    const openingTime = String(req.body.openingTime || "").trim();
    const closingTime = String(req.body.closingTime || "").trim();
    if (!name || !location) return res.status(400).json({ message: "Museum name and location are required." });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid museum email." });
    if (websiteUrl && !/^https?:\/\/\S+$/i.test(websiteUrl)) return res.status(400).json({ message: "Website must start with http:// or https://." });
    try {
        const result = await withConnection((db) => db.execute(
            `UPDATE MUSEUMS SET NAME = :name, LOCATION = :location, DESCRIPTION = :description,
             PHONE = :phone, EMAIL = :email, WEBSITE_URL = :websiteUrl,
             OPENING_TIME = :openingTime, CLOSING_TIME = :closingTime
             WHERE OWNER_USER_ID = :userId`,
            { name, location, description, phone: phone || null, email: email || null, websiteUrl: websiteUrl || null, openingTime: openingTime || null, closingTime: closingTime || null, userId: req.user.userId },
            { autoCommit: true }
        ));
        if (!result.rowsAffected) return res.status(404).json({ message: "Museum profile not found." });
        return res.json({ message: "Museum profile updated." });
    } catch (error) {
        console.error("Museum profile update error:", error);
        return res.status(500).json({ message: "Unable to update museum profile." });
    }
});

router.patch("/museum-manager/status", authenticateToken, async (req, res) => {
    if (req.user.role !== "MUSEUM_MANAGER") return res.status(403).json({ message: "Museum manager access is required." });
    const status = String(req.body.status || "").toUpperCase();
    if (!["ACTIVE", "INACTIVE"].includes(status)) return res.status(400).json({ message: "Museum status must be ACTIVE or INACTIVE." });
    try {
        const result = await withConnection((db) => db.execute(
            "UPDATE MUSEUMS SET STATUS = :status WHERE OWNER_USER_ID = :userId",
            { status, userId: req.user.userId },
            { autoCommit: true }
        ));
        if (!result.rowsAffected) return res.status(404).json({ message: "Museum profile not found." });
        return res.json({ message: `Museum ${status === "ACTIVE" ? "activated" : "deactivated"} successfully.` });
    } catch (error) {
        console.error("Museum status update error:", error);
        return res.status(500).json({ message: "Unable to update museum status." });
    }
});

router.post("/museum-manager/artworks", authenticateToken, async (req, res) => {
    if (req.user.role !== "MUSEUM_MANAGER") return res.status(403).json({ message: "Museum manager access is required." });
    const title = String(req.body.title || "").trim();
    const artistName = String(req.body.artistName || "").trim();
    const category = String(req.body.category || "").trim();
    const description = String(req.body.description || "").trim();
    const exhibitionId = Number(req.body.exhibitionId);
    const creationYear = req.body.creationYear ? Number(req.body.creationYear) : null;
    if (!title || !artistName || !Number.isInteger(exhibitionId) || (creationYear !== null && (!Number.isInteger(creationYear) || creationYear < 1))) {
        return res.status(400).json({ message: "Title, artist, and exhibition are required." });
    }
    try {
        const result = await withConnection(async (db) => {
            const exhibition = await db.execute(
                `SELECT E.EXHIBITION_ID FROM EXHIBITIONS E JOIN MUSEUMS M ON M.MUSEUM_ID = E.MUSEUM_ID
                 WHERE E.EXHIBITION_ID = :exhibitionId AND M.OWNER_USER_ID = :userId`,
                { exhibitionId, userId: req.user.userId }
            );
            if (!exhibition.rows.length) return null;
            return db.execute(
                `INSERT INTO ARTWORKS (EXHIBITION_ID, TITLE, ARTIST_NAME, CREATION_YEAR, CATEGORY, DESCRIPTION, IMAGE_URL)
                 VALUES (:exhibitionId, :title, :artistName, :creationYear, :category, :description, :imageUrl)
                 RETURNING ARTWORK_ID INTO :artworkId`,
                { exhibitionId, title, artistName, creationYear, category, description, imageUrl: String(req.body.imageUrl || "").trim() || null, artworkId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
                { autoCommit: true }
            );
        });
        if (!result) return res.status(404).json({ message: "Exhibition not found in your museum." });
        return res.status(201).json({ artwork: { id: result.outBinds.artworkId[0], title } });
    } catch (error) {
        console.error("Create artwork error:", error);
        return res.status(500).json({ message: "Unable to create artwork." });
    }
});

router.put("/museum-manager/artworks/:id", authenticateToken, async (req, res) => {
    if (req.user.role !== "MUSEUM_MANAGER") return res.status(403).json({ message: "Museum manager access is required." });
    const exhibitionId = Number(req.body.exhibitionId);
    const creationYear = req.body.creationYear ? Number(req.body.creationYear) : null;
    try {
        const result = await withConnection(async (db) => db.execute(
            `UPDATE ARTWORKS A SET EXHIBITION_ID = :exhibitionId, TITLE = :title, ARTIST_NAME = :artistName,
             CREATION_YEAR = :creationYear, CATEGORY = :category, DESCRIPTION = :description, IMAGE_URL = :imageUrl
             WHERE A.ARTWORK_ID = :artworkId AND EXISTS (
                 SELECT 1 FROM EXHIBITIONS E JOIN MUSEUMS M ON M.MUSEUM_ID = E.MUSEUM_ID
                 WHERE E.EXHIBITION_ID = :exhibitionId AND M.OWNER_USER_ID = :userId
             )`,
            { exhibitionId, title: String(req.body.title || "").trim(), artistName: String(req.body.artistName || "").trim(), creationYear, category: String(req.body.category || "").trim(), description: String(req.body.description || "").trim(), imageUrl: String(req.body.imageUrl || "").trim() || null, artworkId: req.params.id, userId: req.user.userId },
            { autoCommit: true }
        ));
        if (!result.rowsAffected) return res.status(404).json({ message: "Artwork not found in your museum." });
        return res.json({ message: "Artwork updated." });
    } catch (error) {
        console.error("Update artwork error:", error);
        return res.status(500).json({ message: "Unable to update artwork." });
    }
});

router.delete("/museum-manager/artworks/:id", authenticateToken, async (req, res) => {
    if (req.user.role !== "MUSEUM_MANAGER") return res.status(403).json({ message: "Museum manager access is required." });
    try {
        const result = await withConnection(async (db) => db.execute(
            `DELETE FROM ARTWORKS A WHERE A.ARTWORK_ID = :artworkId AND EXISTS (
                 SELECT 1 FROM EXHIBITIONS E JOIN MUSEUMS M ON M.MUSEUM_ID = E.MUSEUM_ID
                 WHERE E.EXHIBITION_ID = A.EXHIBITION_ID AND M.OWNER_USER_ID = :userId
             )`,
            { artworkId: req.params.id, userId: req.user.userId },
            { autoCommit: true }
        ));
        if (!result.rowsAffected) return res.status(404).json({ message: "Artwork not found in your museum." });
        return res.json({ message: "Artwork deleted." });
    } catch (error) {
        console.error("Delete artwork error:", error);
        return res.status(500).json({ message: "Unable to delete artwork." });
    }
});

router.post("/museum-manager/exhibitions", authenticateToken, async (req, res) => {
    if (req.user.role !== "MUSEUM_MANAGER") return res.status(403).json({ message: "Museum manager access is required." });
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const startDate = String(req.body.startDate || "");
    const endDate = String(req.body.endDate || "");
    const ticketPrice = Number(req.body.ticketPrice);
    const coverImage = String(req.body.coverImage || "").trim();
    const status = String(req.body.status || "OPEN").toUpperCase();
    if (!title || !startDate || !endDate || !Number.isFinite(ticketPrice) || ticketPrice < 0 || !["OPEN", "CLOSED", "CANCELLED"].includes(status)) {
        return res.status(400).json({ message: "Title, dates, a valid ticket price, and status are required." });
    }
    if (endDate < startDate) return res.status(400).json({ message: "End date must be on or after the start date." });
    try {
        const result = await withConnection(async (db) => {
            const museum = await db.execute("SELECT MUSEUM_ID FROM MUSEUMS WHERE OWNER_USER_ID = :userId", { userId: req.user.userId });
            if (!museum.rows.length) throw Object.assign(new Error("Museum profile not found."), { status: 404 });
            const inserted = await db.execute(
                `INSERT INTO EXHIBITIONS (MUSEUM_ID, TITLE, DESCRIPTION, START_DATE, END_DATE, TICKET_PRICE, COVER_IMAGE, STATUS)
                 VALUES (:museumId, :title, :description, TO_DATE(:startDate, 'YYYY-MM-DD'), TO_DATE(:endDate, 'YYYY-MM-DD'), :ticketPrice, :coverImage, :status)
                 RETURNING EXHIBITION_ID INTO :exhibitionId`,
                {
                    museumId: museum.rows[0].MUSEUM_ID, title, description, startDate, endDate, ticketPrice, coverImage: coverImage || null, status,
                    exhibitionId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                },
                { autoCommit: true }
            );
            return { id: inserted.outBinds.exhibitionId[0], title, startDate, endDate, ticketPrice, coverImage, status };
        });

        return res.status(201).json({ exhibition: result });
    } catch (error) {
        console.error("Create exhibition error:", error);
        return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to create exhibition." });
    }
});

router.put("/museum-manager/exhibitions/:id", authenticateToken, async (req, res) => {
    if (req.user.role !== "MUSEUM_MANAGER") return res.status(403).json({ message: "Museum manager access is required." });
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const startDate = String(req.body.startDate || "");
    const endDate = String(req.body.endDate || "");
    const ticketPrice = Number(req.body.ticketPrice);
    const coverImage = String(req.body.coverImage || "").trim();
    const status = String(req.body.status || "OPEN").toUpperCase();
    if (!title || !startDate || !endDate || !Number.isFinite(ticketPrice) || ticketPrice < 0 || endDate < startDate || !["OPEN", "CLOSED", "CANCELLED"].includes(status)) {
        return res.status(400).json({ message: "Enter valid exhibition details and dates." });
    }
    try {
        const result = await withConnection(async (db) => db.execute(
            `UPDATE EXHIBITIONS SET TITLE = :title, DESCRIPTION = :description,
             START_DATE = TO_DATE(:startDate, 'YYYY-MM-DD'), END_DATE = TO_DATE(:endDate, 'YYYY-MM-DD'),
             TICKET_PRICE = :ticketPrice, COVER_IMAGE = :coverImage, STATUS = :status
             WHERE EXHIBITION_ID = :exhibitionId
             AND MUSEUM_ID = (SELECT MUSEUM_ID FROM MUSEUMS WHERE OWNER_USER_ID = :userId)`,
            { title, description, startDate, endDate, ticketPrice, coverImage: coverImage || null, status, exhibitionId: req.params.id, userId: req.user.userId },
            { autoCommit: true }
        ));
        if (!result.rowsAffected) return res.status(404).json({ message: "Exhibition not found in your museum." });
        return res.json({ message: "Exhibition updated." });
    } catch (error) {
        console.error("Update exhibition error:", error);
        return res.status(500).json({ message: "Unable to update exhibition." });
    }
});

router.delete("/museum-manager/exhibitions/:id", authenticateToken, async (req, res) => {
    if (req.user.role !== "MUSEUM_MANAGER") return res.status(403).json({ message: "Museum manager access is required." });
    try {
        const result = await withConnection(async (db) => db.execute(
            `DELETE FROM EXHIBITIONS WHERE EXHIBITION_ID = :exhibitionId
             AND MUSEUM_ID = (SELECT MUSEUM_ID FROM MUSEUMS WHERE OWNER_USER_ID = :userId)`,
            { exhibitionId: req.params.id, userId: req.user.userId },
            { autoCommit: true }
        ));
        if (!result.rowsAffected) return res.status(404).json({ message: "Exhibition not found in your museum." });
        return res.json({ message: "Exhibition deleted." });
    } catch (error) {
        console.error("Delete exhibition error:", error);
        if (error.errorNum === 2292) return res.status(409).json({ message: "This exhibition has related artworks or tickets and cannot be deleted. Mark it closed instead." });
        return res.status(500).json({ message: "Unable to delete exhibition." });
    }
});

router.get("/museum-manager/tickets", authenticateToken, async (req, res) => {
    if (req.user.role !== "MUSEUM_MANAGER") return res.status(403).json({ message: "Museum manager access is required." });
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(10, Number(req.query.pageSize) || 20));
    const search = String(req.query.search || "").trim().toLowerCase();
    const status = String(req.query.status || "").toUpperCase();
    const paymentStatus = String(req.query.paymentStatus || "").toUpperCase();
    const exhibitionId = Number(req.query.exhibitionId);
    const date = String(req.query.date || "");
    const binds = {
        userId: req.user.userId,
        searchName: `%${search}%`,
        searchEmail: `%${search}%`,
        searchExhibition: `%${search}%`,
        searchTicket: `%${search}%`,
        rowStart: (page - 1) * pageSize + 1,
        rowEnd: page * pageSize,
    };
    const conditions = [
        "M.OWNER_USER_ID = :userId",
        "(:searchName = '%%' OR LOWER(U.NAME) LIKE :searchName OR LOWER(U.EMAIL) LIKE :searchEmail OR LOWER(E.TITLE) LIKE :searchExhibition OR TO_CHAR(T.TICKET_ID) LIKE :searchTicket)",
    ];
    if (["PENDING", "CONFIRMED", "CANCELLED"].includes(status)) { conditions.push("T.STATUS = :status"); binds.status = status; }
    if (["SUCCESS", "PROCESSING", "FAILED", "REFUNDED"].includes(paymentStatus)) { conditions.push("NVL(P.STATUS, 'PENDING') = :paymentStatus"); binds.paymentStatus = paymentStatus; }
    if (Number.isInteger(exhibitionId)) { conditions.push("E.EXHIBITION_ID = :exhibitionId"); binds.exhibitionId = exhibitionId; }
    if (date === "today") conditions.push("TRUNC(T.VISIT_DATE) = TRUNC(SYSDATE)");
    if (date === "tomorrow") conditions.push("TRUNC(T.VISIT_DATE) = TRUNC(SYSDATE + 1)");
    if (date === "week") conditions.push("T.VISIT_DATE >= TRUNC(SYSDATE, 'IW') AND T.VISIT_DATE < TRUNC(SYSDATE, 'IW') + 7");
    if (date === "month") conditions.push("T.VISIT_DATE >= TRUNC(SYSDATE, 'MM') AND T.VISIT_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'MM'), 1)");
    try {
        const result = await withConnection(async (db) => {
            const from = `FROM TICKETS T JOIN USERS U ON U.USER_ID = T.USER_ID
                JOIN EXHIBITIONS E ON E.EXHIBITION_ID = T.EXHIBITION_ID
                JOIN MUSEUMS M ON M.MUSEUM_ID = E.MUSEUM_ID
                LEFT JOIN (SELECT PAYMENT_ID, TICKET_ID, STATUS, PAYMENT_METHOD, TRANSACTION_ID,
                                  ROW_NUMBER() OVER (PARTITION BY TICKET_ID ORDER BY PAYMENT_ID DESC) AS PAYMENT_ROW
                           FROM PAYMENTS) P ON P.TICKET_ID = T.TICKET_ID AND P.PAYMENT_ROW = 1
                WHERE ${conditions.join(" AND ")}`;
            const countBinds = { ...binds };
            delete countBinds.rowStart;
            delete countBinds.rowEnd;
            const count = await db.execute(`SELECT COUNT(*) AS "total" ${from}`, countBinds);
            const tickets = await db.execute(
                `SELECT * FROM (SELECT T.TICKET_ID AS "ticketId", U.NAME AS "visitorName", U.EMAIL AS "visitorEmail",
                        U.PHONE AS "visitorPhone", E.EXHIBITION_ID AS "exhibitionId", E.TITLE AS "exhibitionTitle",
                        M.NAME AS "museumName", TO_CHAR(T.VISIT_DATE, 'YYYY-MM-DD') AS "visitDate",
                        TO_CHAR(T.BOOKED_AT, 'YYYY-MM-DD HH24:MI') AS "bookedAt", T.PRICE AS "amount",
                        T.STATUS AS "status", NVL(P.STATUS, 'PENDING') AS "paymentStatus",
                        P.PAYMENT_METHOD AS "paymentMethod", P.TRANSACTION_ID AS "transactionId",
                        ROW_NUMBER() OVER (ORDER BY T.BOOKED_AT DESC) AS "rowNumber"
                 ${from}) WHERE "rowNumber" BETWEEN :rowStart AND :rowEnd`,
                binds
            );
            const stats = await db.execute(
                `SELECT COUNT(*) AS "total", NVL(SUM(CASE WHEN TRUNC(T.VISIT_DATE) = TRUNC(SYSDATE) THEN 1 ELSE 0 END), 0) AS "today",
                    NVL(SUM(CASE WHEN T.STATUS = 'CONFIRMED' THEN 1 ELSE 0 END), 0) AS "confirmed",
                    NVL(SUM(CASE WHEN T.STATUS = 'PENDING' THEN 1 ELSE 0 END), 0) AS "pending",
                    NVL(SUM(CASE WHEN T.STATUS = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS "cancelled"
                 FROM TICKETS T JOIN EXHIBITIONS E ON E.EXHIBITION_ID = T.EXHIBITION_ID
                 JOIN MUSEUMS M ON M.MUSEUM_ID = E.MUSEUM_ID WHERE M.OWNER_USER_ID = :userId`,
                { userId: req.user.userId }
            );
            const exhibitions = await db.execute(
                `SELECT E.EXHIBITION_ID AS "id", E.TITLE AS "title" FROM EXHIBITIONS E
                 JOIN MUSEUMS M ON M.MUSEUM_ID = E.MUSEUM_ID WHERE M.OWNER_USER_ID = :userId ORDER BY E.TITLE`,
                { userId: req.user.userId }
            );
            return { tickets: tickets.rows, total: Number(count.rows[0].total), stats: stats.rows[0], exhibitions: exhibitions.rows };
        });
        return res.json({ ...result, page, pageSize, totalPages: Math.max(1, Math.ceil(result.total / pageSize)) });
    } catch (error) {
        console.error("Museum ticket management error:", error);
        return res.status(500).json({ message: "Unable to load museum tickets." });
    }
});

router.get("/museum-manager/dashboard", authenticateToken, async (req, res) => {
    if (req.user.role !== "MUSEUM_MANAGER") return res.status(403).json({ message: "Museum manager access is required." });
    try {
        const data = await withConnection(async (db) => {
            const museum = await db.execute(
                `SELECT M.MUSEUM_ID AS "id", M.NAME AS "name", M.LOCATION AS "location", M.DESCRIPTION AS "description",
                        M.PHONE AS "phone", M.EMAIL AS "email", M.WEBSITE_URL AS "websiteUrl",
                        M.OPENING_TIME AS "openingTime", M.CLOSING_TIME AS "closingTime", M.STATUS AS "status",
                        M.CREATED_AT AS "createdAt"
                    , U.NAME AS "ownerName", U.EMAIL AS "ownerEmail", U.ROLE AS "ownerRole"
                 FROM MUSEUMS M JOIN USERS U ON U.USER_ID = M.OWNER_USER_ID WHERE M.OWNER_USER_ID = :userId`,
                { userId: req.user.userId }
            );
            if (!museum.rows.length) throw Object.assign(new Error("Museum profile not found."), { status: 404 });
            const museumId = museum.rows[0].id;
            const exhibitions = await db.execute(
                `SELECT E.EXHIBITION_ID AS "id", E.TITLE AS "title", E.DESCRIPTION AS "description",
                        TO_CHAR(E.START_DATE, 'YYYY-MM-DD') AS "startDate", TO_CHAR(E.END_DATE, 'YYYY-MM-DD') AS "endDate",
                        E.TICKET_PRICE AS "ticketPrice", E.COVER_IMAGE AS "coverImage", E.STATUS AS "status"
                 FROM EXHIBITIONS E WHERE E.MUSEUM_ID = :museumId ORDER BY E.START_DATE DESC`,
                { museumId }
            );
            const artworks = await db.execute(
                `SELECT A.ARTWORK_ID AS "id", A.EXHIBITION_ID AS "exhibitionId", A.TITLE AS "title", A.ARTIST_NAME AS "artistName",
                        A.CREATION_YEAR AS "creationYear", A.CATEGORY AS "category", A.DESCRIPTION AS "description",
                        E.TITLE AS "exhibitionTitle", A.IMAGE_URL AS "imageUrl"
                 FROM ARTWORKS A JOIN EXHIBITIONS E ON E.EXHIBITION_ID = A.EXHIBITION_ID
                 WHERE E.MUSEUM_ID = :museumId ORDER BY A.TITLE`,
                { museumId }
            );
            const bookings = await db.execute(
                `SELECT T.TICKET_ID AS "ticketId", U.NAME AS "visitorName", E.TITLE AS "exhibitionTitle",
                        TO_CHAR(T.VISIT_DATE, 'YYYY-MM-DD') AS "visitDate", T.STATUS AS "status",
                        T.PRICE AS "price"
                 FROM TICKETS T
                 JOIN USERS U ON U.USER_ID = T.USER_ID
                 JOIN EXHIBITIONS E ON E.EXHIBITION_ID = T.EXHIBITION_ID
                 WHERE E.MUSEUM_ID = :museumId
                 ORDER BY T.VISIT_DATE DESC, T.BOOKED_AT DESC`,
                { museumId }
            );
            const reviews = await db.execute(
                `SELECT R.REVIEW_ID AS "id", U.NAME AS "visitorName", R.RATING AS "rating",
                        R.REVIEW_TEXT AS "comment", R.CREATED_AT AS "createdAt"
                 FROM REVIEWS R JOIN USERS U ON U.USER_ID = R.USER_ID
                 WHERE R.MUSEUM_ID = :museumId
                 ORDER BY R.CREATED_AT DESC`,
                { museumId }
            );
            const paymentStats = await db.execute(
                `SELECT
                    (SELECT NVL(SUM(P.AMOUNT), 0) FROM PAYMENTS P JOIN TICKETS T ON T.TICKET_ID = P.TICKET_ID
                     JOIN EXHIBITIONS E ON E.EXHIBITION_ID = T.EXHIBITION_ID
                     WHERE E.MUSEUM_ID = :museumId AND P.STATUS = 'SUCCESS' AND TRUNC(P.PAYMENT_DATE) = TRUNC(SYSDATE)) AS "todayRevenue",
                    (SELECT NVL(SUM(P.AMOUNT), 0) FROM PAYMENTS P JOIN TICKETS T ON T.TICKET_ID = P.TICKET_ID
                     JOIN EXHIBITIONS E ON E.EXHIBITION_ID = T.EXHIBITION_ID
                     WHERE E.MUSEUM_ID = :museumId AND P.STATUS = 'SUCCESS'
                       AND P.PAYMENT_DATE >= TRUNC(SYSDATE, 'MM')) AS "monthRevenue",
                    (SELECT COUNT(*) FROM TICKETS T JOIN EXHIBITIONS E ON E.EXHIBITION_ID = T.EXHIBITION_ID
                     WHERE E.MUSEUM_ID = :museumId) AS "totalTickets",
                    (SELECT COUNT(*) FROM PAYMENTS P JOIN TICKETS T ON T.TICKET_ID = P.TICKET_ID
                     JOIN EXHIBITIONS E ON E.EXHIBITION_ID = T.EXHIBITION_ID
                     WHERE E.MUSEUM_ID = :museumId AND P.STATUS = 'SUCCESS') AS "paid",
                    (SELECT COUNT(*) FROM TICKETS T JOIN EXHIBITIONS E ON E.EXHIBITION_ID = T.EXHIBITION_ID
                     WHERE E.MUSEUM_ID = :museumId AND T.STATUS = 'PENDING') AS "pending",
                    (SELECT COUNT(*) FROM PAYMENTS P JOIN TICKETS T ON T.TICKET_ID = P.TICKET_ID
                     JOIN EXHIBITIONS E ON E.EXHIBITION_ID = T.EXHIBITION_ID
                     WHERE E.MUSEUM_ID = :museumId AND P.STATUS = 'REFUNDED') AS "refunded"
                 FROM DUAL`,
                { museumId }
            );
            const stats = await db.execute(
                `SELECT
                    (SELECT COUNT(*) FROM EXHIBITIONS WHERE MUSEUM_ID = :museumId) AS "exhibitions",
                    (SELECT COUNT(*) FROM ARTWORKS A JOIN EXHIBITIONS E ON E.EXHIBITION_ID = A.EXHIBITION_ID WHERE E.MUSEUM_ID = :museumId) AS "artworks",
                    (SELECT COUNT(*) FROM TICKETS T JOIN EXHIBITIONS E ON E.EXHIBITION_ID = T.EXHIBITION_ID WHERE E.MUSEUM_ID = :museumId) AS "tickets",
                    (SELECT COUNT(*) FROM TICKETS T JOIN EXHIBITIONS E ON E.EXHIBITION_ID = T.EXHIBITION_ID WHERE E.MUSEUM_ID = :museumId AND T.STATUS = 'CONFIRMED') AS "bookings",
                    (SELECT NVL(SUM(P.AMOUNT), 0) FROM PAYMENTS P JOIN TICKETS T ON T.TICKET_ID = P.TICKET_ID JOIN EXHIBITIONS E ON E.EXHIBITION_ID = T.EXHIBITION_ID WHERE E.MUSEUM_ID = :museumId AND P.STATUS = 'SUCCESS') AS "revenue"
                 FROM DUAL`,
                { museumId }
            );
            return { museum: museum.rows[0], exhibitions: exhibitions.rows, artworks: artworks.rows, bookings: bookings.rows, reviews: reviews.rows, paymentStats: paymentStats.rows[0], stats: stats.rows[0] };
        });

        return res.json(data);
    } catch (error) {
        console.error("Museum manager dashboard error:", error);
        return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to load museum dashboard." });
    }
});

router.get("/admin/stats", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const data = await withConnection((db) => db.execute(
            `SELECT
              (SELECT COUNT(*) FROM USERS) AS "users",
              (SELECT COUNT(*) FROM MUSEUMS) AS "museums",
              (SELECT COUNT(*) FROM EXHIBITIONS) AS "exhibitions",
              (SELECT COUNT(*) FROM TICKETS) AS "tickets",
              (SELECT NVL(SUM(AMOUNT), 0) FROM PAYMENTS WHERE STATUS = 'SUCCESS') AS "revenue"
             FROM DUAL`,
            {}
        ));
        return res.json({ stats: data.rows[0] });
    } catch (error) {
        console.error("Admin stats error:", error);
        return res.status(500).json({ message: "Unable to load statistics." });
    }
});

module.exports = router;
