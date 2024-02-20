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
  console.log(request.body)
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
      const jwtToken = await jwt.sign('MY_SECRET_TOKEN', username)
      //console.log({jwtToken})
      //response.status(200)
      response.send({jwtToken})
    }
  }
})

////////------------------AUTHENTICATION JWTOKEN--------------

const authenticationJWToken = async (request, response, next) => {
  let jwToken = null
  const auth = request.headers['authorization']
  console.log(auth)
  jwToken = auth.split(' ')[1]
  const isJWTokenValid = await jwt.verify(jwToken)
  console.log(isJWTokenValid)
}

/////------------API 3  latest tweets of people whom the user follows--------------

module.exports = app
