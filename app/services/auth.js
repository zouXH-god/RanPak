const crypto = require("crypto");

const API_TOKEN = crypto.randomBytes(24).toString("hex");

function authMiddleware(req, res, next) {
    if (req.method === "OPTIONS" || req.path === "/api/auth/token") {
        return next();
    }
    if (!req.path.startsWith("/api/")) {
        return next();
    }

    const expected = `Bearer ${API_TOKEN}`;
    if (req.headers.authorization === expected) {
        return next();
    }

    return res.status(401).json({
        code: 401,
        message: "Unauthorized",
        data: null,
    });
}

module.exports = {
    API_TOKEN,
    authMiddleware,
};
