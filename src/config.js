// secrets
//export const authToken = "0000000000:XXXXXXXXX-lolOo_ooolXXXXXXXXroologl";
//export const adminChatId = 000000000;
//export const xPub = 'xpubxxxxxxxxxxxxxxxxxxxxxxxxXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXxxxxxxxxXXXXXXXXXXXXXXXXXXXXXXXXXXX';

const second = 1000
const minute = 60 * second
const TenMinutes = 10 * minute
const NinetyMinutes = 90 * minute

export const conf = {
    GetBalanceThrottleTimeout: () => (Math.random() * 5 * second) + 1000,
    OrdersCheckInterval: process.env.CHECK_INTERVAL || TenMinutes,
    ObsoleteTimeout: NinetyMinutes,

    authToken: process.env.AUTH_TOKEN,
    adminChatId: parseInt(process.env.ADMIN_CHAT_ID),
    xPub: process.env.X_PUB,
    MySQL: {
        client: 'sqlite3',
        connection: {
            filename: "db/my.db3"
        }
    }
}
