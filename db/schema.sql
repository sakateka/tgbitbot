-- дока по типам https://sqlite.org/datatype3.html
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS orders;
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    price FLOAT(8,8) NOT NULL
);

CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INT NOT NULL,
    data VARCHAR(255) NOT NULL,
    FOREIGN KEY(category_id) REFERENCES categories(id)
);

CREATE TABLE orders (
    from_uid INTEGER NOT NULL,
    order_id CHAR(32) NOT NULL,
    address VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    price FLOAT(8,8) NOT NULL,
    product_id INTEGER NOT NULL UNIQUE,
    category_id INTEGER NOT NULL,
    product_data VARCHAR(255),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(category_id) REFERENCES categories(id)
);
