// secrets
//export const authToken = "0000000000:XXXXXXXXX-lolOo_ooolXXXXXXXXroologl";
//export const adminChatId = 000000000;
//export const xPub = 'xpubxxxxxxxxxxxxxxxxxxxxxxxxXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXxxxxxxxxXXXXXXXXXXXXXXXXXXXXXXXXXXX';

export const conf = {
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
