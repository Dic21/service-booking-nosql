const express = require('express');
const app = express();
const {db} = require('./db.js');
const jwt = require('jsonwebtoken');
const jwtSecret = "iamsecret";

const auth = async function (req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader){
        const token = authHeader.split(" ")[1];
        jwt.verify(token, jwtSecret, async (err, decoded) =>{
            if(err){
                return res.status(401).json({success: false, message: "Invalid token"});
            }else{
                req.userInfo = decoded;
                const targetJti = req.userInfo.jti;
                const jtiResult = await db().collection("token_whitelist").findOne({jti: targetJti});
                if(jtiResult){
                    return next();
                }else{
                    return res.json({success: false, message: "You are not logged in"});
                }
            }
        })
    }else{
        return res.status(401).json({success: false, message: "No token"});
    }
}

exports.auth = auth;