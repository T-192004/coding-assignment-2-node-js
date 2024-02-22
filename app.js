const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const app = express()

app.use(express.json())
const dbPath = path.join(__dirname, 'twitterClone.db')
let db = null

const initializeDBandServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      //console.log(db)
      console.log('Server is running at http://localhost:3000/')
    })
  } catch (error) {
    console.log(`Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDBandServer()

//////-------------------API 1 REGISTER----------------
app.post('/register/', async (request, response) => {
  console.log(request.body)
  const {username, password, name, gender} = request.body
  const checkUsernameQuery = `
  SELECT 
    *
  FROM
    user
  WHERE
    username = '${username}';
  `
  const dbUser = await db.get(checkUsernameQuery)
  if (dbUser !== undefined) {
    console.log('USER ALREADY EXIST')
    response.status(400)
    response.send('User already exists')
  } else {
    if (password.length < 6) {
      console.log('PASSWORD IS TOO SHORT')
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashedPassword = await bcrypt.hash(password, 10)
      const postNewUserQuery = `
      INSERT INTO 
        user(name, username, password, gender)
      VALUES 
        ('${name}', '${username}','${hashedPassword}','${gender}');
      `
      await db.run(postNewUserQuery)
      console.log('USER SUCCESSFULLY CREATED')
      response.status(200)
      response.send('User created successfully')
    }
  }
})

/////////-------------API 2 LOGIN--------------

app.post('/login/', async (request, response) => {
  console.log(request.username)
  const {username, password} = request.body
  const checkUsernameQuery = `
  SELECT 
    *
  FROM
    user
  WHERE
    username = '${username}';
  `
  const dbUser = await db.get(checkUsernameQuery)
  if (dbUser === undefined) {
    console.log("USER DOESN'T EXISTS")
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPassowordMatched = await bcrypt.compare(password, dbUser.password)
    console.log(isPassowordMatched)
    if (isPassowordMatched === false) {
      console.log("PASSWORD DOESN'T MATCHED")
      response.status(400)
      response.send('Invalid password')
    } else {
      const jwtToken = await jwt.sign(username, 'MY_SECRET_TOKEN')
      console.log('USER LOGIN SUCCESSFULLY')
      console.log({jwtToken})
      response.status(200)
      response.send({jwtToken})
    }
  }
})

////////------------------AUTHENTICATION JWTOKEN--------------

const authenticationJWToken = (request, response, next) => {
  let jwToken
  const authHeader = request.headers['authorization']

  if (authHeader !== undefined) {
    jwToken = authHeader.split(' ')[1]
    console.log(authHeader)
  }
  if (jwToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        console.log(payload)
        console.log('ERROR WHILE VERIFYING JWT TOKEN')
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload
        console.log(payload)
        console.log('JWT TOKEN IS CORRECT')
        next()
      }
    })
  }
}

/////------------API 3  latest tweets of people whom the user follows--------------

app.get(
  '/user/tweets/feed/',
  authenticationJWToken,
  async (request, response) => {
    console.log(request.username)
    const getUserNameQuery = `
    SELECT user_id FROM user WHERE username = '${request.username}';
    `
    const dbUser = await db.get(getUserNameQuery)
    console.log(dbUser)
    if (dbUser !== undefined) {
      const userId = dbUser.user_id
      console.log(userId)
      const getFollowingUserIdsQuery = `
      SELECT 
        following_user_id as followerId 
      FROM 
        follower 
      WHERE 
        follower_user_id = ${userId};
      `
      const followingUserIdsResponse = await db.all(getFollowingUserIdsQuery)
      console.log(followingUserIdsResponse)
      const followerId = followingUserIdsResponse.map(
        eachId => eachId.followerId,
      )
      console.log(followerId)
      const getTweetsofFollowingUserId = `
      SELECT 
        user.username as username,
        tweet.tweet as tweet,
        tweet.date_time as dateTime
      FROM
        tweet NATURAL JOIN user
      WHERE 
        tweet.user_id IN (${followerId})
      ORDER BY 
        dateTime DESC
      LIMIT
        4;
      `
      const getTweetsResponse = await db.all(getTweetsofFollowingUserId)
      console.log(getTweetsResponse)
      response.send(getTweetsResponse)
    }
  },
)

///////--------------API 4 list of all names of people whom the user follows---------------------

app.get(
  '/user/following/',
  authenticationJWToken,
  async (request, response) => {
    console.log(request.username)
    const getUserNameQuery = `
    SELECT user_id FROM user WHERE username = '${request.username}';
    `
    const dbUser = await db.get(getUserNameQuery)
    console.log(dbUser)
    if (dbUser !== undefined) {
      const userId = dbUser.user_id
      console.log(userId)
      const getFollowingUserIdsQuery = `
      SELECT 
        following_user_id as followerId 
      FROM 
        follower 
      WHERE 
        follower_user_id = ${userId};
      `
      const followingUserIdsResponse = await db.all(getFollowingUserIdsQuery)
      console.log(followingUserIdsResponse)
      const followerId = followingUserIdsResponse.map(
        eachId => eachId.followerId,
      )
      console.log(followerId)
      const getNameofFollowingUserId = `
      SELECT 
        name
      FROM
        user 
      WHERE 
        user_id IN (${followerId});
      `
      const getNamesResponse = await db.all(getNameofFollowingUserId)
      console.log(getNamesResponse)
      response.send(getNamesResponse)
    }
  },
)

///////////////--------------------API 5 list of all names of people who follows the user----------------
app.get(
  '/user/followers/',
  authenticationJWToken,
  async (request, response) => {
    console.log(request.username)
    const getUserNameQuery = `
    SELECT user_id FROM user WHERE username = '${request.username}';
    `
    const dbUser = await db.get(getUserNameQuery)
    console.log(dbUser)
    if (dbUser !== undefined) {
      const userId = dbUser.user_id
      console.log(userId)
      const getFollowerUserIdsQuery = `
      SELECT 
        follower_user_id as followerId 
      FROM 
        follower 
      WHERE 
        following_user_id = ${userId};
      `
      const followerUserIdsResponse = await db.all(getFollowerUserIdsQuery)
      console.log(followerUserIdsResponse)
      const followerIds = followerUserIdsResponse.map(
        eachId => eachId.followerId,
      )
      console.log(followerIds)
      const getNameofFollowerUserId = `
      SELECT 
        name
      FROM
        user 
      WHERE 
        user_id IN (${followerIds});
      `
      const getFollowersNamesResponse = await db.all(getNameofFollowerUserId)
      console.log(getFollowersNamesResponse)
      response.send(getFollowersNamesResponse)
    }
  },
)

////--------------------------API 6 Return the tweet, likes count, replies count and date-time--------

app.get(
  '/tweets/:tweetId/',
  authenticationJWToken,
  async (request, response) => {
    console.log(request.username)
    const {tweetId} = request.params
    console.log(tweetId)
    const getFollowingUserIdsQuery = `
  SELECT follower.following_user_id as followingId
  FROM follower NATURAL JOIN user WHERE user.username = '${request.username}'
  `
    const followingUsersIdsResponse = await db.all(getFollowingUserIdsQuery)
    const followingId = followingUsersIdsResponse.map(
      eachId => eachId.followingId,
    )
    console.log(`FollowingID : ${followingId}`)

    const getTweetIdTweetQuery = `
  SELECT * FROM tweet WHERE tweet_id = ${tweetId};
  `
    const getTweetIdResponse = await db.get(getTweetIdTweetQuery)
    console.log(getTweetIdResponse)
    const isUserRequestedTweetIdValid = followingId.includes(
      getTweetIdResponse.user_id,
    )
    console.log(isUserRequestedTweetIdValid)
    if (isUserRequestedTweetIdValid === true) {
      getLikesReplyCountQuery = `
    SELECT 
      tweet.tweet AS tweet,
        COUNT(DISTINCT like.like_id) AS likes,
        COUNt(DISTINCT reply.reply_id) AS replies,
      tweet.date_time AS dateTime
    FROM (tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id) 
     INNER JOIN like ON tweet.tweet_id = like.tweet_id
    WHERE tweet.tweet_id = ${tweetId};
    `
      const getLikesReplyCountResponse = await db.get(getLikesReplyCountQuery)
      console.log(getLikesReplyCountResponse)
      response.send(getLikesReplyCountResponse)
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)

////////----------------------API 7 the list of usernames who liked the tweet-------------------------

app.get(
  '/tweets/:tweetId/likes/',
  authenticationJWToken,
  async (request, response) => {
    console.log(request.username)
    const {tweetId} = request.params
    console.log(tweetId)
    const getFollowingUserIdsQuery = `
  SELECT follower.following_user_id as followingId
  FROM follower NATURAL JOIN user WHERE user.username = '${request.username}'
  `
    const followingUsersIdsResponse = await db.all(getFollowingUserIdsQuery)
    const followingId = followingUsersIdsResponse.map(
      eachId => eachId.followingId,
    )
    console.log(`FollowingID : ${followingId}`)

    const getTweetIdTweetQuery = `
  SELECT * FROM tweet WHERE tweet_id = ${tweetId};
  `
    const getTweetIdResponse = await db.get(getTweetIdTweetQuery)
    console.log(getTweetIdResponse)
    const isUserRequestedTweetIdValid = followingId.includes(
      getTweetIdResponse.user_id,
    )
    console.log(isUserRequestedTweetIdValid)
    if (isUserRequestedTweetIdValid === true) {
      getLikesUserNameQuery = `
    SELECT 
      user.name AS name
    FROM ( like INNER JOIN user ON like.user_id = user.user_id) 
    WHERE like.tweet_id = ${tweetId};
    `
      const getLikesUserNameResponse = await db.all(getLikesUserNameQuery)

      const getLikeNameList = getLikesUserNameResponse.map(
        eachId => eachId.name,
      )
      console.log('likes: ' + getLikeNameList)

      response.send({
        likes: getLikesUserNameResponse.map(eachId => eachId.name),
      })
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)

////-------------------API 8 he list of replies.---------------

app.get(
  '/tweets/:tweetId/replies/',
  authenticationJWToken,
  async (request, response) => {
    console.log(request.username)
    const {tweetId} = request.params
    console.log(tweetId)
    const getFollowingUserIdsQuery = `
  SELECT follower.following_user_id as followingId
  FROM follower NATURAL JOIN user WHERE user.username = '${request.username}'
  `
    const followingUsersIdsResponse = await db.all(getFollowingUserIdsQuery)
    const followingId = followingUsersIdsResponse.map(
      eachId => eachId.followingId,
    )
    console.log(`FollowingID : ${followingId}`)

    const getTweetIdTweetQuery = `
  SELECT user_id FROM tweet WHERE tweet_id = ${tweetId};
  `
    const getTweetIdResponse = await db.get(getTweetIdTweetQuery)
    console.log(getTweetIdResponse)
    const isUserRequestedTweetIdValid = followingId.includes(
      getTweetIdResponse.user_id,
    )
    console.log(isUserRequestedTweetIdValid)
    if (isUserRequestedTweetIdValid === true) {
      const getRepliesListQuery = `
    SELECT 
      user.name AS name,
      reply.reply AS reply
    FROM ( reply INNER JOIN user ON reply.user_id = reply.user_id) 
    WHERE reply.tweet_id = ${tweetId};
    `
      const getRepliesListResponse = await db.all(getRepliesListQuery)
      response.send(getRepliesListResponse)
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)

////--------------API 9 Returns a list of all tweets of the user-------------------------

app.get('/user/tweets/', authenticationJWToken, async (request, response) => {
  console.log(request.username)
  const getUsersIdQuery = `
    SELECT user_id FROM user WHERE username = '${request.username}';
    `
  const getUserIdResponse = await db.get(getUsersIdQuery)
  const userId = getUserIdResponse.user_id
  console.log({user_Id: userId})
  const getTweetIdsOnUserId = `
  SELECT tweet_id FROM tweet WHERE user_id = ${userId};
  `
  const getTweetIdResponse = await db.all(getTweetIdsOnUserId)
  const tweetIds = getTweetIdResponse.map(eachId => eachId.tweet_id)
  console.log(tweetIds)
  const getTweetsOfUserQuery = `
    SELECT 
      tweet.tweet AS tweet,
        COUNT(DISTINCT like.like_id) AS likes,
        COUNt(DISTINCT reply.reply_id) AS replies,
      tweet.date_time AS dateTime
    FROM (tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id) 
     INNER JOIN like ON tweet.tweet_id = like.tweet_id
    WHERE tweet.tweet_id IN (${tweetIds});
    `
  const getTweetsOfUsersResponse = await db.all(getTweetsOfUserQuery)
  console.log(getTweetsOfUsersResponse)
  response.send(getTweetsOfUsersResponse)
})

////-------------- API 10 CREATE A TWEET---------------------

app.post('/user/tweets/', authenticationJWToken, async (request, response) => {
  console.log(request.username)
  const {tweet} = request.body
  const getUserIdQuery = `
  SELECT user_id FROM user WHERE username = '${request.username}';
  `
  const getUserIdRespones = await db.get(getUserIdQuery)
  const userId = getUserIdRespones.user_id
  console.log(userId)
  const postTweetQuery = `
  INSERT INTO tweet (tweet, user_id)
  VALUES ('${tweet}', ${userId});
  `
  await db.run(postTweetQuery)
  response.send('Created a Tweet')
})

////////--------------API 11 user deletes his tweet ------------------

app.delete(
  '/tweets/:tweetId/',
  authenticationJWToken,
  async (request, response) => {
    console.log(request.username)
    const {tweetId} = request.params
    const getUserIdQuery = `
      SELECT user_id FROM user WHERE username = '${request.username}';
    `
    const getUserIdRespones = await db.get(getUserIdQuery)
    const userId = getUserIdRespones.user_id

    const getTweetIdsOfUserId = `
  SELECT tweet_id FROM tweet WHERE user_id = ${userId};
  `
    const getTweetIdResponse = await db.all(getTweetIdsOfUserId)
    const usertweetIds = getTweetIdResponse.map(eachId => eachId.tweet_id)
    console.log({tweetId: usertweetIds})
    console.log(typeof tweetId)
    const isTweetIdValid = usertweetIds.includes(parseInt(tweetId))
    console.log(isTweetIdValid)
    if (isTweetIdValid === true) {
      const deleteTweetQuery = `
      DELETE FROM tweet WHERE tweet_id = ${tweetId};
      `
      await db.run(deleteTweetQuery)
      response.send('Tweet Removed')
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)

module.exports = app
