Перед запуском
==============
Ставим nodejs https://nodejs.org/en/download/
Ставим sqlite3 https://www.sqlite.org/download.html

Запуск для разработки
=====================

```
npm i

export AUTH_TOKEN="токен для авторизации в api телеграмма"
export ADMIN_CHAT_ID="id чата с админом, узнать через /echo у бота"
export X_PUB="xPub кошелька с https://www.blockchain.com/"

npm run dev
```

Работа с базой
==============

Создание/Пересоздание
---------------------
База пересоздаётся через запуск `npm run recreate-db` (Осторожно! вся база удаляется)
Чтобы сделать бекап базы нужно отложить в сторонку файл `db/my.db3`

Заливка продуктов
-----------------

Поправить `db/products.sql`, добавить туда новые продукты по образу и подобию.
Запустить npm скрипт `npm run insert-products`
