require('dotenv').config()
const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const NodeCache = require('node-cache')
const Multer = require('multer')
const path = require('path')
const uuid = require('uuid')
const sharp = require('sharp')
const fs = require('fs')

const Users = require('../schemas/userSchema')
const Messages = require('../schemas/messageSchema')
const Chats = require('../schemas/chatsSchema')
const SiteSettings = require('../schemas/siteSettings')

const verifyToken = require('../utils/verify')

const storage = Multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'views/userAvatars/')
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname)
    }
})

const multer = Multer({ storage })

mongoose.connect('mongodb://localhost/socketdb')

const cache = new NodeCache()


router.get('/registration', async (req, res) => {

    res.render('registration')
})

router.post('/registration', multer.single('avatar'), async (req, res) => {
    const { username, password, uniqueUsername } = req.body
    const avatar = req.file

    try {
        const isUniqueNameExists = await Users.findOne({
            uniqueUsername: uniqueUsername
        }) 
    
        if (isUniqueNameExists) {
            return res.json({ message: "A unique username exists" })
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        let user;
        
        if (avatar) {
            const ext = path.extname(avatar.originalname)
            if (ext !== '.jpeg' && ext !== '.jpg' && ext !== '.png') {
                fs.unlinkSync(avatar.path)
                return res.json({ message: 'Incorrect file extension' })
            }

            const uniqueId = uuid.v4()

            await sharp(avatar.path)
                .resize(150, 150, { fit: 'inside' }) // Изменяем размер изображения
                .jpeg()
                .toFile('views/userAvatars/compressed_' + uniqueId + '_' + avatar.originalname); // Сохраняем сжатый файл

            try{
                fs.unlinkSync(avatar.path)  
            }catch(e){
                
            }
            

            req.file.path = '/userAvatars/compressed_' + uniqueId + '_' + avatar.originalname
            req.file.filename = 'compressed_' + uniqueId + '_' + avatar.originalname

            user = await Users.create({
                username,
                password: hashedPassword,
                uniqueUsername,
                avatar: avatar.path
            })
        }else{
            user = await Users.create({
                username,
                password: hashedPassword,
                uniqueUsername
            })
        }

    
        let id = user._id
        const token = await jwt.sign({ id }, process.env.SECRET_KEY_JWT)

        return res.json({ ok: true, token })

    } catch (e) {
        console.log(e)
        if(e.errno === -4048){
            return res.json({ message: 'Error upload file' })
        }
        return res.json({ message: 'Something error...' })
    }
})
router.get('/login', async (req, res) => {
    res.render('login')
})
router.post('/login', async (req, res) => {
    try {
        const { password, uniqueUsername } = req.body

        const findUser = await Users.findOne({ uniqueUsername }).lean().exec()

        if (findUser) {
            const hashPassword = findUser.password

            const isPasswordMatch = await bcrypt.compare(password, hashPassword)
            if (isPasswordMatch) {
                const id = findUser._id

                const token = jwt.sign({ id }, process.env.SECRET_KEY_JWT)

                return res.json({ token });
            }

            return res.json({ message: "Password didn't match!" });
        }

        return res.json({ message: "User does not exists!" });

    } catch (e) {
        return res.json({ message: e.message });
    }
})



router.get('/', async (req, res) => {
    res.render('home')
})

router.get('/acquaintances', verifyToken, async (req, res) => {
    const messagesArr = await Messages.find({}, { recipient: 1, sender: 1 }).lean().exec();
    const messagesSet = new Set()

    for (let message of messagesArr) {
        const senderId = new mongoose.Types.ObjectId(message.sender);
        const recipientId = new mongoose.Types.ObjectId(message.recipient);

        if (senderId.equals(new mongoose.Types.ObjectId(req.user))) {
            messagesSet.add(recipientId);
        }
        if (recipientId.equals(new mongoose.Types.ObjectId(req.user))) {
            messagesSet.add(senderId);
        }
    }

    const messages = Array.from(messagesSet);
    const users = await Users.find({
        $and: [
            { _id: { $ne: req.user } },
            { _id: { $in: messages } }
        ]
    }).sort({date_created: 1}).lean().exec();

    const chats = await Chats.find({
        members: {
            $in: [req.user]
        }
    })

    return res.json({ users, chats });
});


router.get('/chat/:userId', async (req, res) => {
    res.render('chat');
})

router.get('/user-data/:userId', verifyToken, async (req, res) => {
    const userId = req.params.userId;
    const cacheKey = `messeges_${userId}`;
    try {
        const recipient = await Users.findOne({ _id: userId }, { username: 1, uniqueUsername: 1, avatar: 1 });

        if (!recipient) {
            if (cache.get(cacheKey)) {
                const { chatRecipient, chatData } = cache.get(cacheKey)

                return res.json({
                    chatRecipient,
                    chatData,
                    userNow: req.user
                });
            }

            const chatRecipient = await Chats.findOne({ _id: userId })

            const chatDataDirty = await Messages.find({
                recipient: userId
            }).lean().exec()

            const chatData = await Promise.all(chatDataDirty.map(async (message) => {

                const sender = await Users.findOne({ _id: message.sender }, { username: 1, avatar: 1 });

                return {
                    ...message,
                    sender
                };
            }));

            cache.set(cacheKey, {
                chatRecipient,
                chatData,
                userNow: req.user
            })

            return res.json({
                chatRecipient,
                chatData,
                userNow: req.user
            });
        }


        if (cache.get(cacheKey)) {
            const { recipient, messages, userNow } = cache.get(cacheKey)

            return res.json({
                recipient,
                messages,
                userNow
            });

        };

        const messages = await Messages.find({
            $or: [
                { recipient: userId, sender: req.user },
                { recipient: req.user, sender: userId },
            ]
        }).sort({ date_create: 1 }).lean().exec();

        cache.set(cacheKey, {
            recipient,
            messages,
            userNow: req.user
        });

        return res.json({
            recipient,
            messages,
            userNow: req.user
        });
    } catch (e) {
        console.log(e.message);
    };
})


router.post('/send-message/:userId', verifyToken, async (req, res) => {
    const { message } = req.body;
    const userId = req.params.userId;

    const cacheKey = `messeges_${userId}`;

    try {
        if (message.trim()) {
            const recipientUser = await Users.findOne({ _id: userId }, { username: 1, uniqueUsername: 1, avatar: 1 })

            if (!recipientUser) {
                const chatRecipient = await Chats.findOne({ _id: userId })

                if (!chatRecipient.members.includes(req.user)) {
                    return res.json({ ok: false });
                }

                const createdMessageHard = await Messages.create({
                    recipient: userId,
                    sender: req.user,
                    text: message
                })

                const createdMessage = createdMessageHard.toObject();
                const username = await Users.find({ _id: createdMessageHard.sender }, { username: 1 })
                createdMessage.sender = username[0]

                const chatCacheData = cache.get(cacheKey).chatData.concat([createdMessage])

                cache.set(cacheKey, { chatData: chatCacheData, chatRecipient })

                const sender = await Users.findOne({ _id: createdMessage.sender._id }).lean()

                return res.json({ room: chatRecipient.uniqueChatName, createdMessage, sender, ok: true })

            }

            const createdMessage = await Messages.create({
                recipient: userId,
                sender: req.user,
                text: message
            });

            const cacheData = cache.get(cacheKey).messages.concat([createdMessage])
            const recipient = await Users.findOne({ _id: userId }, { username: 1, uniqueUsername: 1, avatar: 1 });

            cache.set(cacheKey, { messages: cacheData, recipient, userNow: createdMessage.sender })


            return res.json({
                createdMessage,
                ok: true
            });
        };

        res.json({ ok: false });
    } catch (e) {
        console.log(e.message)
    };
})


router.post('/confirm-unique-username', async (req, res) => {
    try {
        const { uniqueUsername } = req.body;
        const isUniqueNameExists = await Users.findOne({
            uniqueUsername: uniqueUsername
        }).lean();

        if (isUniqueNameExists) {
            return res.json({ message: "A unique username exists" })
        };

        if (!uniqueUsername) {
            return res.json({ message: "A unique username is required!" })
        };

        res.json({ ok: true })
    } catch (e) {
        return res.json({ message: e.message })
    }
})

router.post('/search-users', verifyToken, async (req, res) => {
    const { query } = req.body;
    try {
        if (!query.trim()) {
            const messagesDirty = await Messages.find().lean().exec();

            const messagesSet = new Set();

            for (let message of messagesDirty) {
                const senderId = new mongoose.Types.ObjectId(message.sender);
                const recipientId = new mongoose.Types.ObjectId(message.recipient);

                if (senderId.equals(new mongoose.Types.ObjectId(req.user))) {
                    messagesSet.add(recipientId);
                };
                if (recipientId.equals(new mongoose.Types.ObjectId(req.user))) {
                    messagesSet.add(senderId);
                };
            };

            const messages = Array.from(messagesSet);

            const users = await Users.find({
                $and: [
                    { _id: { $ne: req.user } },
                    { _id: { $in: messages } }
                ]
            }).lean().exec();
            //   CHATS       //
            const chats = await Chats.find({
                members: {
                    $in: [req.user]
                }
            })

            return res.json({ users, chats });
        }

        const chats = await Chats.find({
            uniqueChatName: new RegExp(`^${query}`)
        })

        const users = await Users.find({
            $and: [
                { uniqueUsername: new RegExp(`^${query}`) },
                {
                    _id: {
                        $ne: req.user
                    }
                }
            ]
        }, ).lean().exec()

        return res.json({ users, chats })
    } catch (e) {
        console.log(e.message)
    }
})

//             CHAT      PART           CHAT           PART        //


router.post('/create-chat', multer.single('chatAvatar'), verifyToken, async (req, res) => {
    const { chatName, uniqueChatName, maxUsers } = req.body;
    const chatAvatar = req.file
    let chat;

    try {
        if(chatAvatar){
            const ext = path.extname(chatAvatar.originalname)
            if (ext !== '.jpeg' && ext !== '.jpg' && ext !== '.png') {
                fs.unlinkSync(chatAvatar.path)
                return res.json({ message: 'Incorrect file extension' })
            }

            const uniqueId = uuid.v4()
            await sharp(chatAvatar.path)
                .resize(150, 150)
                .jpeg()
                .toFile('views/userAvatars/compressed_' + uniqueId + '_' + chatAvatar.originalname); // Сохраняем сжатый файл
                
                fs.unlinkSync(chatAvatar.path)

                req.file.path = '/userAvatars/compressed_' + uniqueId + '_' + chatAvatar.originalname
                req.file.filename = 'compressed_' + uniqueId + '_' + chatAvatar.originalname

                chat = await Chats.create({
                    chatName,
                    maxUsers,
                    uniqueChatName,
                    avatar: chatAvatar.path,
                    creator: req.user
                });
        }else{
            chat = await Chats.create({
                chatName,
                uniqueChatName,
                maxUsers,
                creator: req.user
            });
        }
    
        

        chat.members.push(req.user)
        await chat.save()

        return res.json({ uniqueChatName: chat.uniqueChatName, ok: true });

    } catch (e) {
        console.log(e)
        return res.json({ ok: false });
    };
});
router.post('/confirm-unique-chatname', async (req, res) => {
    try {

        const { uniqueChatName } = req.body;

        if (!uniqueChatName.trim()) {
            return res.json({ message: "A unique chat name is required!", ok: false })
        };

        const uniqueChatNameExists = await Chats.findOne({
            uniqueChatName
        }).lean();


        if (uniqueChatNameExists) {
            return res.json({ message: "A unique chat name exists", ok: false })
        };

        res.json({ ok: true });

    } catch (e) {
        return res.json({ message: e.message })
    };
});




router.get('/is-user-join-chat/:chatId', verifyToken, async (req, res) => {
    const chatName = req.params.chatId

    try {
        const chat = await Chats.findOne({ _id: chatName });

        if (!chat) return res.json({ message: 'Chat not found.' })

        const isMember = chat.members.includes(req.user);

        if (!isMember) {
            return res.json({ ok: -2 })
        }

        return res.json({ ok: 52 })
    } catch (error) {
        console.log(error.message)
    }
});
router.get('/join-chat/:chatId', verifyToken, async (req, res) => {
    const chat = await Chats.findOne({ _id: req.params.chatId })

    if (!chat) return res.json({ message: 'Chat not found.' })

    if (chat.members.length < chat.maxUsers || !chat.maxUsers) {
        chat.members.push(req.user);
        await chat.save();

        return res.json({ ok: 1, uniqueChatName: chat.uniqueChatName })
    } else {
        return res.json({ message: 'Chat is full.' })
    }
})

//     LEAVE     LEAVE
router.get('/leave/:chatId', verifyToken, async (req, res) => {
    const chat = await Chats.findOne({ _id: req.params.chatId })

    if (!chat) return res.json({ message: 'Chat not found.' })

    const index = chat.members.findIndex((v, i) => {
        return v === req.user
    })

    chat.members.splice(index, 1)
    await chat.save()

    return res.json({ ok: true })
})

//        ROUTER END
// SITE SETTINGS
router.get('/darkmodeCheck', verifyToken, async (req, res) => {
    const dark = await SiteSettings.findOne({
        user: req.user
    })
    if (dark) {
        return res.json({ mode: dark.darkMode })
    }
    return res.json({ ok: false })
})
router.get('/darkmodeOn', verifyToken, async (req, res) => {
    try {
        const ixExists = await SiteSettings.findOne({
            user: req.user
        })

        if (ixExists) {
            await SiteSettings.updateOne({
                darkMode: true
            })
        } else {
            await SiteSettings.create({
                darkMode: true,
                user: req.user
            })
        }

        return res.json({ ok: true })
    } catch (e) {
        console.log(e)
        return res.json({ ok: false })
    }
})
router.get('/darkmodeOff', verifyToken, async (req, res) => {
    try {
        const ixExists = await SiteSettings.findOne({
            user: req.user
        })

        if (ixExists) {
            await SiteSettings.updateOne({
                darkMode: false
            })
        } else {
            await SiteSettings.create({
                darkMode: false,
                user: req.user
            })
        }

        return res.json({ ok: true })
    } catch (e) {
        console.log(e)
        return res.json({ ok: false })
    }
})
module.exports = router;