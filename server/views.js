 export const postView = {
    _id: '_design/messages',
    views: {
        byParentID: {
            map: function (doc) {
                emit(doc.parentID, {message: doc.message, id: doc._id, imageUrl: doc.image, poster: doc.poster, likes: doc.likes, dislikes: doc.dislikes});
            }.toString(),
        },
    },
};

export const designDoc = {
    _id: '_design/users',
    views: {
        by_username: {
            map: function (doc) {
                emit(doc.username, {username: doc.username, password: doc.password});
            }.toString(),
        },
    },
};

export const repliesView = {
    _id: '_design/replies',
    views: {
        byRepliedPost: {
            map: function (doc) {
                emit(doc.postRepliedID, {message: doc.message, id: doc._id, imageUrl: doc.image, poster: doc.poster});
            }.toString(),
        },
    },
};

export const likesView1 = {
    _id: '_design/likes',
    views: {
        whoLiked: {
            map: function (doc) {
                if (doc.userID && doc.postID) {
                    emit([doc.postID, doc.userID], doc);
                }
            },
        },
    },
};