const express = require('express');
const router = express.Router();
const { db } = require('../db.js');
const { auth } = require('../auth.js');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const jwt = require('jsonwebtoken');
const jwtSecret = "iamsecret";
const { v4: uuidv4 } = require('uuid');

app.post('/register', async (req, res)=>{
    const result = {
        success: false
    };
    const name = req.body.username;
    const password = req.body.password;
    if(!name || !password || name === "" || password === ""){
        result.message = "Please provide complete user information";
        return res.json(result);
    }

    const query = { name: name };
    const target = await db().collection("member").findOne(query);
    if(target){
        result.message = "User already exists";
        return res.json(result);
    }else{
        const hashed = await bcrypt.hash(password, saltRounds);
        const newMember = { 
            name: name,
            password: hashed
        }
        await db().collection("member").insertOne(newMember);

        const target = await db().collection("member").findOne({name: name});
        const jti = uuidv4();
        const date = Date.now();
        const payload = {
            id: target._id.toString(),
            name,
            jti,
            exp: Math.floor(date/1000) + (60*60)
        }
        const token = jwt.sign(payload, jwtSecret);
        const iat = new Date(date).toISOString().slice(0, 19).replace('T', ' ');
        const data = {
            jti,
            iat
        }
        await db().collection("token_whitelist").insertOne(data);
        result.success = true;
        result.token = token;
        result.message = "Registration Successful. Thank you."
        return res.json(result);
    }
});

app.post('/login', async(req, res)=>{
    let result = {
        success: false
    };
    const name = req.body.username;
    const password = req.body.password;
    if(!name || !password || name === "" || password === ""){
        result.message = "Please enter username and password";
        return res.json(result);
    }
    const target = await db().collection("member").findOne({name: name});
    if (target){
        const comparedResult = await bcrypt.compare(password, target.password);
        if(comparedResult){
            const jti = uuidv4();
            const date = Date.now();
            const payload = {
                id: target._id.toString(),
                name,
                jti,
                exp: Math.floor(date/1000)+(60*60)
            };
            const token = jwt.sign(payload, jwtSecret);
            const iat = new Date(date).toISOString().slice(0, 19).replace('T', ' ');
            const data = {
                jti,
                iat
            }
            await db().collection("token_whitelist").insertOne(data);
            result.success = true;
            result.token = token;
            result.message = "Login Successful";
            return res.json(result);
        } else {
            result.message = "Invalid username or Password";
            return res.json(result);
        }
    } else {
        result.message = "Invalid Username or password";
        return res.json(result);
    }
})

app.post('/logout', auth, async(req, res)=>{
    const targetJti = req.userInfo.jti;
    await db().collection("token_whitelist").deleteOne({jti: targetJti});
    res.json({success: false, message: 'You logged out successfully'});
})

module.exports = router;