import jwt from "jsonwebtoken";

const CLIENTS_CONFIG = {
    "client_1": {
        databaseURL: "https://test-3b890-default-rtdb.firebaseio.com/",
        projectId: "client1-xxxxx",
        description: "اول عميل"
    },
};

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyztFTOFHunQKahA99RskXGKx6Sh9CUCLwij8gwHqDd0UUblmJ6DCzzGfAMCXf7iS1P/exec";
const API_SECRET = process.env.API_SECRET_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;

function verifyToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return { valid: false, error: "No token provided" };
    }
    const token = authHeader.replace("Bearer ", "");
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return { valid: true, decoded };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

export default async function handler(req, res) {
    // ===== إعدادات CORS (السماح بالطلبات من أي مكان) =====
    // السماح لأي موقع بالاتصال
    res.setHeader('Access-Control-Allow-Origin', '*');
    // السماح بطرق الطلب هذه
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    // السماح بهذه الـ Headers
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-token');
    // السماح بإرسال Cookies/Credentials
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // معالجة طلب OPTIONS (اللي بيتبعت قبل أي طلب للتحقق من CORS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    // ===== انتهى إعدادات CORS =====

    // باقي الكود القديم هنا...
    if (req.method === "GET") {
        const tokenCheck = verifyToken(req);
        if (!tokenCheck.valid) {
            return res.status(401).json({
                success: false,
                message: tokenCheck.error || "Unauthorized"
            });
        }
        
        const clientId = tokenCheck.decoded.clientId;
        const clientConfig = CLIENTS_CONFIG[clientId];
        
        return res.status(200).json({
            success: true,
            message: "Authenticated successfully",
            clientId: clientId,
            databaseURL: clientConfig?.databaseURL || null,
            projectId: clientConfig?.projectId || null,
            licenseData: tokenCheck.decoded.licenseData || {},
            limits: tokenCheck.decoded.limits || {},
            pages: tokenCheck.decoded.pages || {}
        });
    }
    
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }
    
    const token = req.headers["x-api-token"];
    if (!token || token !== API_SECRET) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    
    try {
        const { code } = req.body;
        if (!code || !code.trim()) {
            return res.status(400).json({ success: false, message: "License code is required" });
        }
        
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?code=${encodeURIComponent(code.trim())}`);
        if (!response.ok) {
            throw new Error("Failed to connect to Google Script");
        }
        
        const result = await response.json();
        if (!result.success) {
            return res.status(404).json({ success: false, message: "License not found" });
        }
        
        let clientId = "client_1";
        if (result.data && result.data.clientId) {
            clientId = result.data.clientId;
        }
        
        if (!CLIENTS_CONFIG[clientId]) {
            return res.status(400).json({ success: false, message: "Client configuration not found" });
        }
        
        const jwtToken = jwt.sign(
            {
                clientId: clientId,
                licenseData: result.data || {},
                limits: result.limits || {},
                pages: result.pages || {}
            },
            JWT_SECRET,
            { expiresIn: "30d" }
        );
        
        return res.status(200).json({
            success: true,
            token: jwtToken,
            expiresIn: "30d",
            clientId: clientId
        });
        
    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
}
