import MD5 from "md5"
import { Telegraf, Markup } from 'telegraf'
import { networks } from 'bitcoinjs-lib'
import { XPubGenerator } from 'xpub-generator'
import knex from 'knex'

import { conf } from './config.js';

import axiosRetry from 'axios-retry'
import axios from "axios"
import winston from "winston"

axiosRetry(axios, { retries: 3 })

const db = knex(conf.MySQL);
const bot = new Telegraf(conf.authToken);

const log = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.ms(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.printf(({ level, message, timestamp, ms }) => {
            return `${timestamp} ${level}: ${message} (${ms})`;
        }),
    ),
    transports: [new winston.transports.Console()]
});


bot.use((ctx, next) => {
    log.debug("payload: %s", { user: ctx.from.username, text: ctx.message?.text || ctx.callbackQuery?.data })
    return next()
})

bot.start(ctx => {
    ctx.reply(
        `Добро пожаловать ${ctx.message.from.first_name},` +
        ` рад приветствовать тебя в моем магазине\n` +
        ` /help - для справки.`
    )
})

/* XXX: Команды для покупателей*/
const SHOW_CATEGORIES_CMD = '/show'
const SHOW_MY_ORDERS_CMD = `/myorders`

bot.help(ctx => ctx.reply(
    `${SHOW_CATEGORIES_CMD} - Просмотр всех продуктов\n` +
    `${SHOW_MY_ORDERS_CMD} - Статусы моих заказов`
))


/* XXX: Команды для админа */
const ADD_CATEGORY_CMD = '/addcategory'
const DEL_CATEGORY_CMD = '/delcategory'
const SHOW_PRODUCTS_CMD = '/showproducts'
const ADD_PRODUCT_CMD = '/addproduct'
const DEL_PRODUCT_CMD = '/delproduct'
const SHOW_ALL_ORDERS_CMD = '/allorders'



async function calcPrice(price) {
    if (isNaN(price)) {
        throw new Error(`calcPrice require number, got: ${price}`)
    }
    try {
        let response = await axios.get(
            'https://web-api.coinmarketcap.com/v1/tools/price-conversion',
            {
                params: { amount: price, convert_id: 1, id: 2781 },
                timeout: 2000,
            }
        )
        return Number(response.data.data.quote['1'].price.toFixed(8))
    } catch (err) {
        log.error(`calcPrice: ${err}`)
        return 'Error'
    }
}

async function getBalance(address) {
    try {
        let response = await axios.get(
            `https://chain.api.btc.com/v3/address/${address}`,
            { timeout: 2000 }
        )
        // let response = { data: { data: { received: 10_000_00, unconfirmed_received: 0 } } }
        return {
            received: Number((response.data.data.received * 0.000_000_01).toFixed(8)),
            unconfirmed: Number(
                (response.data.data.unconfirmed_received * 0.000_000_01).toFixed(8)
            )
        }
    } catch (err) {
        log.error(`getBalance: ${err}`)
        return { received: 'Error', unconfirmed: 'Error' }
    }
}
const MAXIMUM_ORDERS = 10
// Событие которое срабатывает при нажатии на кнопку купить
bot.on('callback_query', async ctx => {
    try {
        let count = (await db('orders')
            .where({ from_uid: ctx.from.id })
            .whereNot({ status: 'Выполнен' })
            .count({ count: '*' })
            .first()).count

        if (count >= MAXIMUM_ORDERS) {
            ctx.reply
            ctx.reply(
                'Произошла ошибка, на вашем аккаунте достигнуто максимально ' +
                `допустимое количество заказов: ${MAXIMUM_ORDERS}.`
            )
            log.error(`too many orders for: uid(${ctx.from.id})`)
            ctx.answerCbQuery()
            return
        }

        let category_id = parseInt(ctx.callbackQuery.data)
        // select only available non reserved items
        let product = await db("products")
            .select('id', 'products.category_id')
            .leftJoin("orders", function() {
                this.on(function() {
                    this.on('products.id', '=', 'orders.product_id')
                    this.andOn('products.category_id', '=', 'orders.category_id')
                })
            })
            .where({ "orders.product_id": null, "products.category_id": category_id })
            .first()

        log.debug("Selected product %s", product)
        if (product === undefined) {
            ctx.reply("Больше нет товаров в этой категории")
            ctx.answerCbQuery()
            return

        }

        let category = await db('categories')
            .select('price')
            .where({ id: category_id }).first();
        let price_usd = category.price
        let summa = await calcPrice(price_usd)
        if (summa === 'Error') throw new Error('Во время расчёта цены произошла ошибка')
        let addresses = (await db('orders').select('address')).map(a => a.address)

        // По xPub генерируем адреса до тех пор пока не попадется тот которого нет в бд
        let didi = addresses.length
        var t_address = new XPubGenerator(conf.xPub, networks.bitcoin).nthReceiving(didi)
        while (addresses.includes(t_address)) {
            log.debug(`Retry for t_address: ${t_address}`)
            didi++
            t_address = new XPubGenerator(conf.xPub, networks.bitcoin).nthReceiving(didi)
        }


        let order = {
            from_uid: ctx.from.id,
            order_id: MD5(Date.now().toString + ctx.update.callback_query.id),
            address: t_address,
            status: 'В ожидании оплаты',
            price: summa,
            product_id: product.id,
            category_id: product.category_id,
            product_data: 'Будет доступно после оплаты',
            order_date: (new Date()).toISOString()
        }
        await db('orders').insert(order)

        ctx.reply(
            `Ваш заказ ожидает оплаты, резерв действителен 30 минут.\n` +
            `ID заказа: ${order.order_id}\n` +
            `Реквизиты для оплаты: ${order.address}\n` +
            `Сумма к оплате: ${order.price}\n` +
            `\n` +
            `Всего активных заказов: ${count + 1}`
        )

    } catch (err) {
        log.error("buy button: %s", err)
        ctx.reply('Произошла ошибка попробуйте позднее')
    }
    ctx.answerCbQuery()
})

bot.command(SHOW_CATEGORIES_CMD, ctx => {
    db('categories')
        .select()
        .orderBy('id', 'asc')
        .then(categories => {
            for (let category of categories) {
                db("products")
                    .select('id', 'products.category_id')
                    .leftJoin("orders", function() {
                        this.on(function() {
                            this.on('products.id', '=', 'orders.product_id')
                            this.andOn('products.category_id', '=', 'orders.category_id')
                        })
                    })
                    .where({ "orders.product_id": null, "products.category_id": category.id })
                    .then(resp => {
                        ctx.reply(
                            `ID: ${category.id}\n` +
                            `Name: ${category.name}\n` +
                            `Description: ${category.description}\n` +
                            `Price: ${category.price}$\n` +
                            `Count: ${resp.length}`,
                            Markup.inlineKeyboard([
                                Markup.button.callback(
                                    'Купить', `${category.id}`,
                                )
                            ]))
                    })
                    .catch(err => {
                        log.error(`count products: ${err}`)
                        ctx.reply('Произошла ошибка при получении товаров')
                    })


            }
        })
        .catch(err => {
            log.error('%s: %s', SHOW_CATEGORIES_CMD, err)
            ctx.reply('Ошибка при получении списка продуктов')
        })

})

bot.command(SHOW_MY_ORDERS_CMD, ctx => {
    db('orders').where({ from_uid: ctx.from.id })
        .then(resp => {
            if (resp.length === 0) {
                ctx.reply(`Нет заказов`)
                return
            }
            for (let order of resp) {
                ctx.reply(
                    `ID заказа: ${order.order_id}\n` +
                    `Заказ от: ${order.order_date}\n` +
                    `ID продукта: ${order.product_id}\n` +
                    `Реквизиты: ${order.address}\n` +
                    `Сумма к оплате: ${order.price}\n` +
                    `Статус: ${order.status}\n` +
                    `Товар: ${order.product_data}`
                )
            }
        })
        .catch(err => {
            log.error(`${SHOW_MY_ORDERS_CMD}: ${err}`)
            ctx.reply('Ошибка при получении списка продуктов')
        })
})

bot.command('/echo', ctx => ctx.reply(ctx.message.chat.id))

/* XXX: Команды для администратора*/

bot.use((ctx, next) => {
    // Если мы из чата администратора то выполнятся следующие функции
    if (ctx.message?.chat?.id === conf.adminChatId) {
        return next()
    }
})

bot.command('/ahelp', ctx => ctx.replyWithMarkdownV2(
    `
*Добавить категорию товаров*
${ADD_CATEGORY_CMD}   \`<Название категории>\`
\`<Описание категории товаров одной строкой>\`
\`<Цена как float>\`
${DEL_CATEGORY_CMD}  \`<id>\`

${SHOW_PRODUCTS_CMD}   \\- *показать товары в наличии*
${ADD_PRODUCT_CMD}   \`<id>\`  \`<описание товара>\`   \\- *Добавить товар*
${DEL_PRODUCT_CMD}  \`<id>\`   \\- *Удалить товар с id*

${SHOW_ALL_ORDERS_CMD}  \\-  *Показать все заказы*
`))

bot.command(ADD_CATEGORY_CMD, ctx => {
    try {
        let msg = ctx.message.text.slice(ADD_CATEGORY_CMD.length);
        let [name, description, priceAsStr] = msg.trim().split('\n')
        let price = parseFloat(priceAsStr)
        if (isNaN(price)) {
            throw new Error(`failed to parse price from: ${priceAsStr}`)
        }

        let product = { name: name, description: description, price: price }
        db('categories').insert(product)
            .then(resp => {
                log.debug('New product %s: %s', product, resp)
                ctx.reply('Товар успешно добавлен')
            })
            .catch(err => {
                log.error("%s: %s", ADD_CATEGORY_CMD, err)
                ctx.reply('Произошла ошибка во время добавления товара')
            })
    } catch (err) {
        log.error("%s: parse reply: %s", ADD_CATEGORY_CMD, err)
    }
})

bot.command(DEL_CATEGORY_CMD, ctx => {
    let id = ctx.message.text.slice(DEL_CATEGORY_CMD.length).trim()
    if (id.length === 0) {
        ctx.reply("Укажи id категории. /ahelp")
        return
    }
    db('products_info').where({ product_id: id }).del()
        .then(resp => {
            log.debug('%s %s: %s', DEL_CATEGORY_CMD, id, resp)
            ctx.reply('Категоря успешно удалена')
        })
        .catch(err => {
            log.error("%s %s: %s", DEL_CATEGORY_CMD, id, err)
            ctx.reply('Во время удаления произошла ошибка')
        })
})


bot.command(SHOW_PRODUCTS_CMD, ctx => {
    db('products').select()
        .then(resp => ctx.reply(resp))
        .catch(err => {
            log.error("%s: %s", SHOW_PRODUCTS_CMD, err)
            ctx.reply('Произошла ошибка')
        })
})

bot.command(ADD_PRODUCT_CMD, ctx => {
    let product = ctx.message.text.slice(ADD_PRODUCT_CMD.length).trim()
    let idx = product.indexOf(' ')
    if (idx === -1) {
        ctx.reply("Что? Посмотри /ahelp")
        return
    }
    let id = parseInt(product.slice(0, idx))
    let data = product.slice(idx + 1).trim()

    db('products').insert({ product_id: id, product_data: data })
        .then(_resp => ctx.reply('Продукт успешно добавлен в БД'))
        .catch(err => {
            log.error("%s: %s", ADD_PRODUCT_CMD, err)
            ctx.reply('Во время добавления в БД произошла ошибка')
        })
})

bot.command(DEL_PRODUCT_CMD, ctx => {
    let id = ctx.message.text.slice(DEL_PRODUCT_CMD.length).trim()
    if (id.length === 0) {
        ctx.reply("Укажи id продукта. /ahelp")
        return
    }
    db('products').where({ id: id }).del()
        .then(resp => {
            log.debug('%s %s: %s', DEL_PRODUCT_CMD, id, resp)
            ctx.reply('Продукт успешно удален')
        })
        .catch(err => {
            log.error("%s %s: %s", DEL_PRODUCT_CMD, id, err)
            ctx.reply('Во время удаления произошла ошибка')
        })
})

bot.command(SHOW_ALL_ORDERS_CMD, ctx => {
    db.select().from('orders')
        .then(resp => {
            if (resp.length == 0) {
                ctx.reply(`Нет заказов`)
                return
            }
            for (let order of resp) {
                ctx.reply(
                    `ID: ${order.order_id}\n` +
                    `Address: ${order.address}\n` +
                    `Status: ${order.status}\n` +
                    `Price: ${order.price}\n` +
                    `ProductID: ${order.product_id}\n` +
                    `ProductData: ${order.product_data}\n` +
                    `Date: ${order.order_date}`,
                )
            }
        })
        .catch(err => {
            log.error("%s: %s", SHOW_ALL_ORDERS_CMD, err)
            ctx.reply('Ошибка при получении списка продуктов')
        })
})
bot.on('text', ctx => ctx.reply('Хочешь поговорить?'))


bot.launch().then(() => {
    log.info('Bot Started!')
    // После старта запускаем таймер который будет срабатывать каждый
    // Интервал с которым мы будем проверять коши на оплату

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
    // для проверки ордеров и удаления лишнего
    log.info("Spawn periodic checking of orders evenry %s seconds", conf.OrdersCheckInterval / 1000)
    setInterval(async () => {
        log.info("Periodic checking of orders")
        let orders = await db('orders')
            .whereNot({ status: 'Выполнен' })
            .select('order_id', 'address', 'status', 'price', 'product_id', 'order_date')

        // Получаем заказы которые не выполнены и проходимся по каждому из заказов
        for (let order of orders) {
            let timeInMs = conf.GetBalanceThrottleTimeout()
            await delay(timeInMs) // do not ddos balance api, wait for a bit.

            let balance = await getBalance(order.address)
            log.debug("Order address for payment: %s - balance: %s", order.address, balance)

            // Если есть баланс то изменяем статус, и закидываем продукт
            if (balance.received == 'Error' || balance.undefined == 'Error') {
                continue
            }

            if (balance.received >= order.price) {
                let response = await db('products').where({ id: order.product_id })
                if (response.length != 0) {
                    await db('products').where({ id: response[0].id }).del()
                    await db('orders')
                        .where({ address: order.address })
                        .update({
                            status: 'Выполнен',
                            product_data: response[0].data
                        })
                }

            } else if (balance.unconfirmed >= order.price) {
                // Смотрим есть ли не подтвержденные ордеры
                await db('orders')
                    .where({ address: order.address })
                    .update({ status: 'В ожидании подтверждений' })

            } else {
                // Удаляем лишние ордеры если прошло 90 и больше минут с момента его создания
                let orderTS = (new Date(order.order_date)).getTime()
                let nowTS = (new Date()).getTime()
                if (orderTS + conf.ObsoleteTimeout <= nowTS) {
                    log.warn(`Remove obsolete order: ${JSON.stringify(order)}`)
                    await db('orders').where({ order_id: order.order_id }).del()
                }
            }
        }
    }, conf.OrdersCheckInterval)
})

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
