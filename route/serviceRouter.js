const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'images/uploaded/' });
const { db } = require('../db.js');
const { auth } = require('../auth.js');
const fs = require('fs');

router.get('/', async (req, res) => {
    if (req.query.keyword) {
        let kw = req.query.keyword;
        const filter = { $and: [{ availability: true }, { is_delete: false }, { $or: [{ item_name: { $regex: kw } }, { description: { $regex: kw } }] }] };
        const option = { projection: { is_delete: 0 , comment: 0} };
        const cursor = await db().collection("service").find(filter, option);
        const docs = await cursor.toArray();
        res.json(docs);
    } else {
        const filter = { $and: [{ availability: true }, { is_delete: false }] };
        const option = { projection: { is_delete: 0, comment: 0} };
        const cursor = await db().collection("service").find(filter, option);
        const docs = await cursor.toArray();
        res.json(docs);
    }
})

router.get('/:itemId', async (req, res) => {
    let id = parseInt(req.params.itemId);
    const query = { _id: id, is_delete: false };
    const option = { projection: { is_delete: 0 } };
    const targetItem = await db().collection("service").findOne(query, option);
    if(targetItem){
        res.json({item: targetItem});
    }else{
        res.json({success: false, message: "Item not found"})
    }
})

router.post('/', auth, upload.array('pictures'), async (req, res) => {
    let id = Math.floor(Date.now() * Math.random() / 1000);
    const itemName = req.body.itemName;
    const description = req.body.desc;
    const member = req.userInfo;

    if (!itemName || !description) {
        return res.json({
            success: false,
            message: "Please provide complete information"
        });
    }
    //handle image input
    let picArr = [];
    for (let i = 0; i < req.files.length; i++) {
        let picPath = `/${req.files[i].destination}${req.files[i].filename}`;
        picArr.push(picPath);
    }
    //create new item object
    let newItem = {
        _id: id,
        owner_id: member.id,
        owner_name: member.name,
        item_name: itemName,
        description: description,
        availability: true,
        likeCount: 0,
        is_delete: false,
        pictures: picArr
    }
    await db().collection("service").insertOne(newItem);
    return res.json({ success: true, message: 'Create a service successfully', item: { itemId: newItem._id, itemName: newItem.item_name } })
})

router.patch('/:itemId', auth, upload.array('pictures'), async (req, res) => {
    let id = parseInt(req.params.itemId);
    const query = { _id: id, is_delete: false };
    const targetItem = await db().collection("service").findOne(query);
    if (!targetItem) {
        return res.json({ success: false, message: `Item Not Found` });
    }
    if (targetItem.owner_id !== req.userInfo.id) {
        return res.json({ success: false, message: `You don't have permission to update this item` })
    } else {
        const itemName = req.body.itemName;
        const description = req.body.desc;
        const availability = req.body.availability;
        const filter = { _id: id };
        if(itemName === "" || description === ""){
            return res.json({ success: false, message: `Please do not leave blank if you would like to update the info` })
        }

        //Try to collect all data in one to connect with db
        let dataToUpdate = {};
        if(itemName){
            dataToUpdate.item_name = itemName;
        }
        if(description){
            dataToUpdate.description = description;
        }
        if(req.files && req.files.length > 0){
            let pics = targetItem.pictures;
            if(pics){
                fileRemove(pics);
            }
            let picArr = [];
            for (let i = 0; i < req.files.length; i++) {
                let picPath = `/${req.files[i].destination}${req.files[i].filename}`;
                picArr.push(picPath);
            }
            dataToUpdate.pictures = picArr;
        }
        const update = {$set: dataToUpdate};
        await db().collection("service").updateOne(filter, update);

        // if (itemName) {
        //     const update = { $set: { item_name: itemName } }
        //     await db().collection("service").updateOne(filter, update);
        // }
        // if (description) {
        //     const update = { $set: { description: description } }
        //     await db().collection("service").updateOne(filter, update);
        // }
        // if (req.files && req.files.length > 0) {
        //     //delete all old pics and remove path from db
        //     let pics = targetItem.pictures;
        //     if(pics){
        //         fileRemove(pics);
        //     }
        //     //Remarks: 可以直接set $set, to cover old data
        //         // const update = { $unset: { pictures: "" } };
        //         // await db().collection("service").updateOne(filter, update);
        //     //insert new pics
        //     let picArr = [];
        //     for (let i = 0; i < req.files.length; i++) {
        //         let picPath = `/${req.files[i].destination}${req.files[i].filename}`;
        //         picArr.push(picPath);
        //     }
        //     const insertNewPics = {$set: {pictures: picArr}};
        //     await db().collection("service").updateOne(filter, insertNewPics);
        // }

        //owner can cancel any booking
        if (availability === "true"){
            const removeBooker ={$set:{availability: true}, $unset:{bookedBy: ""}};
            const findRecord = {service_id: id, status: "Confirmed"};
            await db().collection("service").updateOne(filter, removeBooker);
            await db().collection("book_record").updateOne(findRecord, {$set: {status: "Cancelled/Finished"}})
        }

        res.json({ success: true, message: `You updated item (id:${id}) successfully` });
    }

    //opened a new api for owner to delete all existing pictures 
})

function fileRemove(pics){
    for (let i = 0; i < pics.length; i++) {
        let path = pics[i];
        fs.unlink(`.${path}`, function (err) {
            if (err) {
                console.error(err);
                console.log('File not found');
            } else {
                console.log('File Delete Successfuly');
            }
        });
    }
}

router.delete('/:itemId', auth, async (req, res) => {
    let id = parseInt(req.params.itemId);
    const query = { _id: id, is_delete: false };
    const targetItem = await db().collection("service").findOne(query);
    if (!targetItem) {
        return res.json({ success: false, message: `Item Not Found` });
    }
    //if it has result
    if (targetItem.owner_id !== req.userInfo.id) {
        return res.json({ success: false, message: `You don't have permission to delete this item` })
    } else if (targetItem.availability === false){
        //any service currently booked by member can't be deleted
        return res.json({ success: false, message: `You cannot delete the service which is currently occupied` })
    } else {
        //delete pictures from image file and remove pictures path from DB
        console.log('check', targetItem);
        let pics = targetItem.pictures;
        if(pics){
            fileRemove(pics);
        }
        
        //update the 'is_delete'as well
        const update = {$set: {is_delete: true}, $unset: { pictures: "" } };
        await db().collection("service").updateOne(query, update);

        return res.json({success: true, message: "Item deleted"});
    }
})

router.delete('/:itemId/all-pictures', auth, async (req, res)=>{
    let id = parseInt(req.params.itemId);
    const query = { _id: id, is_delete: false };
    const targetItem = await db().collection("service").findOne(query);
    
    if (!targetItem) {
        return res.json({ success: false, message: `Item Not Found` });
    } else if (targetItem.owner_id !== req.userInfo.id) {
        return res.json({ success: false, message: `You don't have permission to handle this item` })
    } else if(!targetItem.pictures){
        return res.json({ success: false, message: `You did not have pictures to delete` });
    }else{
        let pics = targetItem.pictures;
        console.log(targetItem);
        if(pics){
            fileRemove(pics);
        }
        const update = { $unset: { pictures: "" } };
        await db().collection("service").updateOne(query, update);
        return res.json({ success: true, message: `All pictures deleted from Item (ID: ${id})` })
    }
})

router.post('/:itemId/like', auth, async (req, res) => {
    let id = parseInt(req.params.itemId);
    const query = { _id: id, is_delete: false};
    const targetItem = await db().collection("service").findOne(query);
    if (targetItem) {
        let like = targetItem.likeCount;
        like++;
        const update = {$set: {likeCount: like}};
        await db().collection("service").updateOne(query, update);

        const displayResult = await db().collection("service").findOne(query, {projection:{is_delete:0}});
        return res.json({ success: true, message: `You Liked the post-ID:${id}`, item: displayResult  });
    } else{
        return res.json({ success: false, message: `Item Not Found` });
    }
})

router.post('/:itemId/comment', auth, async (req, res) => {
    let itemId = parseInt(req.params.itemId);
    const query = { _id: itemId, is_delete: false };

    const cmMsg = req.body.comment;
    if(!cmMsg){
        return res.json({success: false, message: "Please provide comment message"})
    }
    
    const cmDate = new Date();
    const targetItem = await db().collection("service").findOne(query);
    if(targetItem){
        const cmId = "c" + Math.floor(Date.now() * Math.random() / 10000);
        const authorId = req.userInfo.id;
        const authorName = req.userInfo.name;
        const newComment = {
            cmId,
            content: cmMsg,
            authorId,
            authorName,
            date: cmDate
        }

        //init comment
        const check = { comment: {$exists: true}};
        const isComment = await db().collection("service").findOne(check);
        if(!isComment){
            let comment = [newComment];
            const insertCm = {$set: {comment: comment}};
            await db().collection("service").updateOne(query, insertCm);
            return res.json({ success: true, message: `You left a comment on post-ID:${itemId}` });
        }else{
            const pushCm ={$push: {comment: newComment}};
            await db().collection("service").updateOne(query, pushCm);
            return res.json({ success: true, message: `You left a comment on post-ID:${itemId}` });
        }
    } else {
        return res.json({ success: false, message: 'Item Not Found' });
    }
})

router.post('/:itemId/booking', auth, async (req, res) => {
    let itemId = parseInt(req.params.itemId);
    const query = { _id: itemId, availability: true, is_delete: false };
    const targetItem = await db().collection("service").findOne(query);

    if (targetItem) {
        if (targetItem.owner_id !== req.userInfo.id) {
            const bookId = await getNextSequenceValue("bookingid");
            const newBookRecord = {
                _id: bookId,
                service_id: targetItem._id,
                booker_id: req.userInfo.id,
                status: "Confirmed"
            }

            await db().collection("book_record").insertOne(newBookRecord);
            const update = {$set: {
                availability: false,
                bookedBy: {
                    memberId: req.userInfo.id,
                    memberName: req.userInfo.name
                }
            }}

            await db().collection("service").updateOne(query, update);
            return res.json({ success: true, message: 'You have successfully booked the service' });
        } else {
            return res.json({ success: false, message: 'You cannot book the service created by yourself' });
        }
    } else {
        return res.json({ success: false, message: 'Item Not Found' });
    }
})

async function getNextSequenceValue(sequenceName){
    const query = {_id: sequenceName };
    const update = {$inc:{sequence_value:1}};
    var sequenceDocument = await db().collection("counters").findOneAndUpdate(
       query, update, {returnDocument: 'after'});
    //console.log(sequenceDocument);
    return sequenceDocument.value.sequence_value;
}

module.exports = router;