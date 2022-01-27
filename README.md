Перед запуском
==============
Ставим nodejs https://nodejs.org/en/download/
Ставим sqlite3 https://www.sqlite.org/download.html

Запуск для разработки на linux
==============================

```
npm i nodemon
npm i
npm run recreate-db
npm run insert-products

export AUTH_TOKEN="токен для авторизации в api телеграмма"
export ADMIN_CHAT_ID="id чата с админом, узнать через /echo у бота"
export X_PUB="xPub кошелька с https://www.blockchain.com/"

npm run dev
```

Запуск для разработки с docker
==============================
Собираем имадж из Dockerfile
При разработке это нужно один раз, потому-что дальше код монтируется в
докер контейнер через `volume` (`-v src:/build/src`)

Либо если необходимо пересоздать базу (см. Dockerfile)
```
docker build -t tgbitbot-image .
```

Запускаем сервер для разработки
```
# поправить секреты в src/config.js или как-то донести их в env
docker run --rm --name my-bit-bot -it -v src:/build/src tgbitbot-image
```

Подключиться в контейнер из соседнего окна можно так
```
docker exec -it my-bit-bot /bin/bash
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
