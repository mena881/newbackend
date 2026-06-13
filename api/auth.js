// أضف هذا الكود في أعلى الملف، قبل أي شيء
export default async function handler(req, res) {
    // ===== حل مشكلة CORS =====
    // السماح بالطلبات من أي مصدر (للاختبار)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-token');
    
    // معالجة طلب OPTIONS (preflight) الذي يرسله المتصفح
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
import jwt from "jsonwebtoken";

const CLIENTS_CONFIG = {
    "client_1": {
        databaseURL: "https://test-3b890-default-rtdb.firebaseio.com/",
        projectId: "client1-xxxxx",
        description: "اول عميل"
    },

    // أضف عملاء آخرين هنا
    // "client_2": {
    //     databaseURL: "https://client2-default-rtdb.firebaseio.com/",
    //     projectId: "client2-xxxxx",
    //     description: "ثاني عميل"
    // }
};

const GOOGLE_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbyztFTOFHunQKahA99RskXGKx6Sh9CUCLwij8gwHqDd0UUblmJ6DCzzGfAMCXf7iS1P/exec";

const API_SECRET = process.env.API_SECRET_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;

// ميدلوير للتحقق من التوكن
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

    // التحقق من التوكن لجميع الطلبات ما عدا طلب الـ login الأول
    if (req.method === "GET") {
        const tokenCheck = verifyToken(req);
        
        if (!tokenCheck.valid) {
            return res.status(401).json({
                success: false,
                message: tokenCheck.error || "Unauthorized"
            });
        }
        
        // هنا ممكن ترجع البيانات المطلوبة بعد التحقق من التوكن
        return res.status(200).json({
            success: true,
            message: "Authenticated successfully",
            clientId: tokenCheck.decoded.clientId,
            data: tokenCheck.decoded.licenseData || {},
            limits: tokenCheck.decoded.limits || {},
            pages: tokenCheck.decoded.pages || {}
        });
    }
    
    // منطق إنشاء التوكن لأول مرة (login)
    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }
    
    // التحقق من التوكن السري العام للAPI
    const token = req.headers["x-api-token"];
    
    if (!token || token !== API_SECRET) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }
    
    try {
        const { code } = req.body;
        
        if (!code || !code.trim()) {
            return res.status(400).json({
                success: false,
                message: "License code is required"
            });
        }
        
        const response = await fetch(
            `${GOOGLE_SCRIPT_URL}?code=${encodeURIComponent(code.trim())}`
        );
        
        if (!response.ok) {
            throw new Error("Failed to connect to Google Script");
        }
        
        const result = await response.json();
        
        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: "License not found"
            });
        }
        
        // تحديد الـ clientId بناءً على البيانات الراجعة من Google Script
        // هنا ممكن تعدل المنطق حسب احتياجك
        let clientId = "client_1";
        
        // مثال: لو البيانات فيها clientId معين
        if (result.data && result.data.clientId) {
            clientId = result.data.clientId;
        }
        
        // التحقق من وجود العميل في الـ CLIENTS_CONFIG
        if (!CLIENTS_CONFIG[clientId]) {
            return res.status(400).json({
                success: false,
                message: "Client configuration not found"
            });
        }
        
        // إنشاء التوكن
        const jwtToken = jwt.sign(
            {
                clientId: clientId,
                licenseData: result.data || {},
                limits: result.limits || {},
                pages: result.pages || {}
            },
            JWT_SECRET,
            {
                expiresIn: "30d"
            }
        );
        
        console.log("New token created for client:", clientId);
        
        return res.status(200).json({
            success: true,
            token: jwtToken,
            expiresIn: "30d",
            clientId: clientId
        });
        
    } catch (error) {
        console.error("API Error:", error);
        
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
}
