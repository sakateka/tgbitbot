// secrets
//export const authToken = "9101153152:AAGhahaha-lolOo_ooolBXqMYj3Uroologl";
//export const adminChatId = 090111011;
//export const xPub = 'xpublolooolooolhahadgololhr4LOLaoqJMAs7mQNV8MLPaHB19PXlPMhPP12Hjp32jduEA2rQ93DNYgtzm92ZAUIZKDUAGWNYDXWCMJWNCTPK';

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
