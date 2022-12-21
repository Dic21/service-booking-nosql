const { MongoClient } = require("mongodb");
const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);
let db = null;

async function initizeDB() {
    try {
        await client.connect();
        db = await client.db("easybooking");
    }
    catch (error) { console.log(error); }
}

function getDB(){
    return db;
}

exports.initizeDB = initizeDB;
exports.db = getDB;

