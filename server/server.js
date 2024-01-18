const express = require('express');
const app = express();
const cors = require('cors')
const bodyParser = require("body-parser");
app.use(cors())
const port = 8080;
const HOST = 'localhost';
app.use(bodyParser.json())
const multer  = require('multer')
const upload = multer({ dest: 'uploads/' })
app.use('/uploads', express.static('uploads'));
const nano = require('nano')('http://admin:admin@cdb:5984');

const createDatabase = (databaseName) => {
    return new Promise((resolve, reject) => {
        nano.db.create(databaseName, (err, body) => {
            if (err) {
                console.error(`Could not create ${databaseName} database`);
                reject(err);
            } else {
                console.log(`Successfully created ${databaseName} database`);
                resolve(body);
            }
        });
    });
};



const insertView = async (database, view) => {
    const db = nano.db.use(database);
    try {
        const body = await db.insert(view);
        console.log(body);
    } catch (err) {
        if (err.statusCode === 409){
            console.log('This view is already in ' + database);
        } else {
            console.error(`Could not insert view into ${database}`, err);
        }
    }
}

const postView = {
    _id: '_design/messages',
    views: {
        byParentID: {
            map: function (doc) {
                emit(doc.parentID, {message: doc.message, id: doc._id, imageUrl: doc.image, poster: doc.poster, likes: doc.likes, dislikes: doc.dislikes});
            }.toString(),
        },
    },
};

const designDoc = {
    _id: '_design/users',
    views: {
        by_username: {
            map: function (doc) {
                emit(doc.username, {username: doc.username, password: doc.password, _id: doc._id, _rev: doc._rev});
            }.toString(),
        },
    },
};

const repliesView = {
    _id: '_design/replies',
    views: {
        byRepliedPost: {
            map: function (doc) {
                emit(doc.postRepliedID, {message: doc.message, id: doc._id, imageUrl: doc.image, poster: doc.poster});
            }.toString(),
        },
    },
};

const likesView1 = {
    _id: '_design/likes',
    views: {
        whoLiked: {
            map: function (doc) {
                    emit([doc.postID, doc.username], doc);
            }.toString(),
        },
    },
};




async function setupDatabases(){
    try {
        await Promise.all([
            createDatabase('users'),
            createDatabase('channels'),
            createDatabase('messages'),
            createDatabase('replies'),
            createDatabase('likes')
        ]);

        await Promise.all([
            insertView('users', designDoc),
            insertView('messages', postView),
            insertView('replies', repliesView),
            insertView('likes', likesView1)
        ]);
    } catch (err) {
        console.error('Error setting up databases', err);
    }
}


setupDatabases().then(r => {})

app.post('/addUser', (req, res) => {
    const {name, username, password} = req.body
    const newUser = {name, username, password}
    const users = nano.db.use('users')
    if (name !== '' && username !== '' && password !== ''){
        users.insert(newUser, function(err, body) {
            if (err) {
                console.error(err);
            } else {
                console.log(body);
                res.send(true)
            }
        })
    }

})

app.get('/getUser/:username', (req, res) => {
    const users = nano.db.use('users')
    const user = req.params.username
    users.view('users', 'by_username', { key: user }).then((body) => {
        console.log(body.rows);
        let docs = body.rows.map(function(row) {
            return row.value
        })
        res.send(docs)
    }).catch((err) => {
        console.log(err);
    });
})

app.get('/getAllUsers', (req, res) => {
    const users = nano.db.use('users')
    users.view('users', 'by_username')
        .then((body) => {
            let docs = body.rows.map(function(row) {
                return row.value
            })
            res.send(docs);
            // console.log(docs)
        })
        .catch((err) => {
            console.error(err);
            res.status(500).send(err);
        });
})

app.get('/deleteUser', (req, res) => {
    const user = req.query.user
    console.log(user.username)
    const users = nano.db.use('users')
    users.destroy(user._id, user._rev, )
        .then(r => {
            console.log('success')
        })
        .catch(err => {
            console.log(err)
        })
})

app.post('/addChannel', async (req, res) => {
    const { channel, data } = req.body
    console.log(req.body)
    const post =  { channel, data }
    console.log(post)
    const channels = nano.db.use('channels')
    channels.insert(post, function (err, body){
        if (err)
            console.error(err)
        else
            console.log(body)
    })
})

app.get('/getChannels', async (req, res) => {
    const channels = nano.db.use('channels')
    channels.list({include_docs: true}, (err, body) => {
        if (!err) {
            let docs = body.rows.map(function(row) {
                return row.doc;
            });
            // console.log(docs);
            res.json(docs)
        } else {
            console.error(err);
        }
    })
})

app.get('/deleteChannel', (req, res) => {
    const channelID = req.query.channelID
    const rev = req.query.rev
    // console.log(channelID)
    const channels = nano.db.use('channels')
    channels.destroy(channelID, rev)
        .catch(err => {
            console.log(err)
        })

})

app.post('/addPost', upload.single('image'), (req, res) => {
    const { parentID, message, poster } = req.body
    let image = req.file? req.file.path : null
    if (req.file){
        image = req.file.path
    }
    const likes = 0
    const dislikes = 0


    // console.log(req.body)
    // console.log(req.file)
    const post =  { parentID, message, poster, image, likes, dislikes }
    console.log(post)
    const messages = nano.db.use('messages')
    messages.insert(post, function (err, body){
        if (err)
            console.error(err)
        else
            console.log(body)
    })
})

app.get('/getPosts/:id', (req, res) => {
    const messages = nano.db.use('messages');
    // console.log(req.params.id)
    console.log('getting posts')
    const parentID = req.params.id
    messages.view('messages', 'byParentID', {keys: [parentID]})
        .then((body) => {
            let docs = body.rows.map(function(row) {
                return row.value
            })
            res.send(docs);
            // console.log(docs)
        })
        .catch((err) => {
            console.error(err);
            res.status(500).send(err);
        });
});

app.get('/deletePost', (req, res) => {
    const postID = req.query.postID
    console.log(postID)
    const messages = nano.db.use('messages')
    messages.get(postID)
        .then(body => {
            let rev = body._rev
            messages.destroy(postID, rev)
                .catch(err => {
                    console.log(err)
                })
        })
})
app.post('/postReplies', upload.single('image'), (req, res) => {
    const { channelId, message, poster, postRepliedID } = req.body
    let image = 'uploads/none'
    if (req.file){
        image = req.file.path
    }

    // console.log(req.body)
    // console.log(req.file)
    const post =  { channelId, message, poster, image, postRepliedID }
    console.log(post)
    const replies = nano.db.use('replies')
    replies.insert(post, function (err, body){
        if (err)
            console.error(err)
        else
            console.log(body)
    })
})

app.get('/getReplies/:id', (req, res) => {
    const replies = nano.db.use('replies');
    // console.log(req.params.id)
    console.log('getting replies')
    const repliedPostId = req.params.id
    replies.view('replies', 'byRepliedPost', {keys: [repliedPostId]})
        .then((body) => {
            let docs = body.rows.map(function(row) {
                return row.value
            })
            res.send(docs);
            // console.log(docs)
        })
        .catch((err) => {
            console.error(err);
            res.status(500).send(err);
        });
});

app.post('/addLikes', (req, res) => {
    const {postID, username, wasLiked} = req.body
    const like = {postID, username, wasLiked}
    const messages = nano.db.use('messages')
    const likes = nano.db.use('likes')

    const updateLikeCount = () => {
        messages.get(postID, (err, body) => {
            if (err) {
                console.log('getting post in addLikes: ' + err)
            }
            else{
                console.log('message ' + body)
                wasLiked ? body.likes += 1 : body.dislikes += 1
                messages.insert(body, postID, (updateErr, updatedBody) => {
                    if (updateErr){
                        console.log('updating post error:  ' + updateErr )
                    }
                    else{
                        console.log(updatedBody)
                    }
                })
            }
        })
    }
    // check if the person has liked the post already
    likes.view('likes', 'whoLiked', {key: [postID, username]})
        .then((body) => {
            if (body.rows.length > 0) {
                if (body.rows[0].value.wasLiked === wasLiked){
                    console.log('done before')
                }
                else{
                    console.log(body.rows[0].value)
                    likes.get(body.rows[0].value._id, (err, body) => {
                        if (err){
                            console.log(err)
                        }
                        else {
                            body.wasLiked = wasLiked
                            likes.insert(body, body._id)
                        }
                    })
                    messages.get(postID, (err, body) => {
                        if (err) {
                            console.log('getting post in addLikes: ' + err)
                        }
                        else{
                            body.likes = wasLiked ? body.likes += 1 : body.likes -= 1;
                            body.dislikes = !wasLiked ? body.dislikes += 1 : body.dislikes -= 1;
                            messages.insert(body, postID)
                        }
                    })
                }
            } else {
                likes.insert(like, function (err, body){
                    if (err)
                        console.error(err)
                    else
                        console.log(body)
                })
                updateLikeCount()
            }
        })
        .catch(err => {
            console.log(err)
        })

    //

})

app.get('/search/:searchPrompt', (req, res) => {
    const posts = nano.db.use('messages');

    // Define your search query
    let searchPrompt = req.params.searchPrompt
    let searchBy = req.query.searchBy
    let query;
    // Use a Mango query to find documents
    if (searchBy === 'posts'){
        query = {
            selector: {
                message: {
                    $regex: `(?i).*${searchPrompt}.*`
                }
            }
        }
    }
    else if (searchBy === 'user'){
        query = {
            selector: {
                poster: {
                    $regex: `(?i).*${searchPrompt}.*`
                }
            }
        }
    }


    posts.find(query).then((body) => {
        console.log(body.docs);
        res.send(body.docs)
    }).catch((err) => {
        console.log('Error:', err);
    });
})




app.listen(port, () => {
    console.log(`server running on ${port}`)
})