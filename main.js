const express = require("express");
const app = express();
const mainRouter = require('./route/mainRouter');
const serviceRouter = require('./route/serviceRouter');
const { initizeDB, db } = require('./db.js');
const { auth } = require('./auth.js');

app.use(express.json());
app.use('/images', express.static('images'));
app.use(express.urlencoded({ extended: true }));

app.use('/', mainRouter);
app.use('/services', serviceRouter);

initizeDB().then(() => {
    app.listen(4000, () => {
        console.log("Example app listening on port 4000!");
    });
}).catch(
    console.error
);


