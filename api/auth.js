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

export default async function handler(req, res) {

    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }

    try {

        const code = req.query.code?.trim();

        if (!code) {
            return res.status(400).json({
                success: false,
                message: "License code is required"
            });
        }

        const response = await fetch(
            `${GOOGLE_SCRIPT_URL}?code=${encodeURIComponent(code)}`
        );

        const result = await response.json();

        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: "License not found"
            });
        }

        const clientId = result.database?.client_id;

        return res.status(200).json({
            success: true,

            data: result.data || {},

            limits: result.limits || {},

            pages: result.pages || {},

            database: {
                client_id: clientId
            }
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}
