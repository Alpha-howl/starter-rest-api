const express = require('express');
const app = express();

process.env.CYCLIC_DB = "shy-plum-bass-slipCyclicDB";
const db = require('cyclic-dynamodb');

const crypto = require('crypto');

const axios = require("axios").default;






function hashString(str) {
    return crypto.createHash("sha256").update(str).digest("hex");
}

function encrypt(str) {
    const myCipher = crypto.createCipher("aes-128-cbc", "2eosBZfGtPiJZYJ5VX9V3Ob9YqxKf1dyfXnIvHXvT/jExPrE/OVHRO8UE/bbOmcyvo1AY5tnSPprrXB4nsQGynym2q0VXXL1VYvVESnl1G65LAqzY43YhYyOOG9kRlKJDyT4xkTjcPzox/Z5mvnOWdcHhfdHKB+zweTQwuGUBUI=");
    let encrypted = myCipher.update(str, "utf8", "hex");
    encrypted += myCipher.final("hex");
    return encrypted;
}

function decrypt(encrypted) {
    const myDecipher = crypto.createDecipher("aes-128-cbc", "2eosBZfGtPiJZYJ5VX9V3Ob9YqxKf1dyfXnIvHXvT/jExPrE/OVHRO8UE/bbOmcyvo1AY5tnSPprrXB4nsQGynym2q0VXXL1VYvVESnl1G65LAqzY43YhYyOOG9kRlKJDyT4xkTjcPzox/Z5mvnOWdcHhfdHKB+zweTQwuGUBUI=")
    let decrypted = myDecipher.update(encrypted, "hex", "utf8");
    decrypted += myDecipher.final("utf8");
    return decrypted;
}


app.use(express.json());
app.use(express.urlencoded({ extended: true }));



app.post("/:action", async (req, response) => {
  response.header("Access-Control-Allow-Origin", "*");
  response.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  
  const action = req?.params?.action;
  switch(action.toLowerCase()) {
    case "create-new-account":
        var [email, username, password] = [
            req?.body?.email || "", 
            req?.body?.username || "",
            req?.body?.password || ""
        ];


        handleNewAccountCreation(email, username, password, response);
        break;
    
    case "log-in":
        var [usernameOrEmail, password] = [
            req?.body?.usernameOrEmail,
            req?.body?.password
        ];
        handleUserLoginAttempt(usernameOrEmail, password, response);
    break;

    case "log-user-out":
        var usernameOrEmail = req?.body?.usernameOrEmail;
        handleUserLogout(usernameOrEmail, response);
        break;
    
    case "delete-account":
        if(!userIsLoggedIn(req?.body?.jwt)) {
            response.status(200).send({
                success: false,
                message: "must-be-logged-in"
            });
            break;
        }

        var [usernameOrEmail, password] = [
            req?.body?.usernameOrEmail,
            req?.body?.password
        ];
        handleAccountDeletion(usernameOrEmail, password, req?.body?.jwt, response);
        break;


    case "create-reset-password-session":
        handleNewPasswordResetSessionRequest(req?.body?.username, response);
        break;


    case "send-otp-for-usid":
        handleSendOtpByEmailRequest(req?.body?.usid, response);
        break;

    case "validate-otp-attempt":
        handleOtpSubmission(req?.body?.usid, req?.body?.otp, response);
        break;

    case "set-new-password":
        handleSetNewPasswordRequest(req?.body?.usid, req?.body?.password, response);
        break;
    
    case "test-dynamo":
        testDynamo(response, req);
        break;

    
    default:
        response.status(200).send("Error: unknown action:'" + action.toLowerCase() + "'");
        break;

  }

});


async function testDynamo(response, req) {
    const result = await db.collection("PasswordResetSession").set("proba", {worls: true});
	
    response.status(200).send({"proba": "75-76-77", result});
}


function userIsLoggedIn(jwt) {
    let isLoggedIn = true;
    if(jwt == undefined || jwt?.split(".").length != 3) {
        // jwt does not exist so user is not logged in
        // user must be logged in: error message
        isLoggedIn = false;
    }
    if(jwtIsValid(jwt) === false) {
        // JWT is invalid
        // treat user as not logged in
        isLoggedIn = false;
    }

    return isLoggedIn;
}

function getUsernameFromJwt(jwt) {
    const payload = jwt.split(".")[1];
    const payloadObject = JSON.parse(
        Buffer.from(payload, "base64").toString()
    );
    const usernameFromJwt = payloadObject.sub;
    return usernameFromJwt;
}




async function validateEmail(email) {
    let valid = true;
    let message;


    const emailParts = email.split("@"); // [name, domain]

    if(email.length > 253+64+10) {
    	valid = false;
    	message = "Email address is too long";
    } else if (emailParts.length != 2) {
    	valid = false;
    	message = "Email addresses must contain one @ sign.";
    } else if (emailParts[0].length > 63 || emailParts[1].length > 253 + 10) {
    	valid = false;
    	message = "The recipient's name must be under 64 characters long, and the domain part must be under 263 characters long.";
    } else if (emailParts[0].length === 0 || emailParts[1].length === 0) {
    	valid = false;
    	message = "The @ symbol cannot be at one end.";
    } else if (emailParts[0].search(/[^A-Za-z0-9!#$%&'*+\-/=?^_`{}|.]/) != -1) {
    	valid = false;
    	message = "That email address contains an illegal character at position " + (emailParts[0].search(/[^A-Za-z0-9!#$%&'*+\-/=?^_`{}|]/) + 1) + ".";
    } else if(emailParts[1].search(/\./) === -1) {
    	valid = false;
    	message = "The domain name must have a period in it.";
    } else if(await emailExists(email)) {
    	valid = false;
    	message = "That email address is already in use. Please try another one.";
    }

    return {valid, message};
}
async function validatePassword(password) {
    /* 
    Rules:
        length >= 8
        length <= 30
        1 number
        1 lowercase letter
        1 capital letter OR special character out of...
        let allowedSpecChars = [".", " ", "-", "_"];
    */
   let valid = true;
   let message;
    if(password.length < 8) {
        valid = false;
        message = "Passwords must have 8 or more characters.";
    } else if(password.length > 30) {
        valid = false;
        message = "Passwords must have 30 or fewer characters.";
    } else if(password.search(/[0-9]/) === -1) {
        valid = false; 
        message = "Passwords must have at least one number.";
    } else if(password.search(/[a-z]/) === -1) {
        valid = false;
        message = "Passwords must have at least one lowercase letter.";
    } else if(password.search(/[A-Z]/) === -1 && password.search(/[\. \-\_]/) === -1) {
        valid = false;
        message = "Passwords must contain at least one capital letter, or one special character";
    } else if(password.search(/[^\. \-\_A-Za-z0-9]/) != -1) {
        valid = false;
        message = "Passwords may not contain any other character apart from the letters a-z, numbers, underscores, periods, spaces, and dashes.";
    }

    return {valid, message};
}
async function validateUsername(username) {
    let valid = true;
   	let message;

   	if(username.length < 3 || username.length > 100) {
   		valid = false;
   		message = "The username must have between 3 and 100 characters.";
   	} else if(username.search(/[^\w]/) != -1) {
   		valid = false;
   		message = "Usernames can only alphanumeric characters and underscores. Illegal detected at position " + username.search(/[^\w]/) + 1;
   	}  else if((await db.collection("User").get(username)) != null) {
   		valid = false;
   		message = "That username is already taken!";
   	}


   	return {valid, message};
}



async function emailExists(email) {
	const userTable = db.collection("User");

	let emailFound = false;

	const collectionList = await userTable.list();
	const usersArray = collectionList.results;
	for(let i = 0; i < usersArray.length; i++) {
		const currentUserKey = usersArray[i].key;
		const currentUserEmail = (await userTable.get(currentUserKey)).props.email;

		if(currentUserEmail === email) {
			emailFound = true;
			break;
		}

	}

	return emailFound;
}



async function isValid(response, ...validationData) {
    let allValid = true;
    let message;

    for (let i = 0; i < validationData.length-1; i+=2) {
        const valueToValidate = validationData[i];
        const typeOfValue = validationData[i+1];
        let validationFn;
        
        switch (typeOfValue) {
            case "email":
                // set the validation fn to validateEmail
                validationFn = validateEmail;
                break;
            case "username":
                // set the validation fn to validateUsername
                validationFn = validateUsername;
                break;
            case "password":
                // set the validation fn to validatePassword
                validationFn = validatePassword;
                break;
            default:
            	validationFn = () => {return {valid:false, message:"Not recognised typeOfValue"}};
            	break;
        }

        const validate = await validationFn(valueToValidate);
        const currentValueIsValid = validate.valid;
        if(currentValueIsValid === false) {
            // if invalid, update allValid and break from loop.
            message = validate.message;
            allValid = false;
            break;
        }


    }

    
    return {
        allValid, message
    };
}




async function handleNewAccountCreation(email, username, password, response) {

    const validationResult = await isValid(response, email, "email", username, "username", password, "password");
    if( validationResult.allValid === false ) {
        // if any one of the arguments is invalid, send back 
        // a response with the message of why it is invalid
        // and stop running the function (return)
        response.status(200).send({error: "User input was not valid", message: validationResult.message});
        return;
    }

    // response.status(200).send("all valid - may continue");
    // at this stage the username, email and password are now all valid. Add the acc to db.

    const key = username;
    const newAccountRecord = {
        email,
        passwordHash: hashString(password) // hash the pw for security
    }

    const result = await db.collection("User").set(key, newAccountRecord);



    let message = "create-new-account-success";
    if(result.collection != "User" || result.key != key) {
        message = "create-new-account-error";
    }

    response.status(200).send({
        success: (result.collection === "User" && result.key === key),
        message // todo - the front-end should recognise this code and display a corresponding message. See pg 60 of back end part of acc system.docx
    });

}
async function handleUserLoginAttempt(usernameOrEmail, password, response) {
    const [correctPasswordHash, givenPasswordHash, key, isLocked, userData] = await getPasswordHashAndAttempt(usernameOrEmail, password, response);

    if(isLocked) {
        response.status(200).send({
            success: false,
            message: "account-locked"
        });
        return;
    }

    if(correctPasswordHash === givenPasswordHash) {
        // passwords match
        // generate JWT and send to client
        // generate new jwt:
        const newJwt = generateJtw(key);
        // then send to client (the client needs to store it and 
        // send it along with each new request from now on)
        response.status(200).send({
            success: true,
            message: "user-logged-in",
            jwt: newJwt
        });
        

    } else {
        // wrong password
        // increment wrong password counter
        // if wrong password counter = 5, lock account
        let wrongPwCounter = (userData.wrongPasswordCounter || 0) + 1;
        if(wrongPwCounter >= 5) {
            // too many wrong attempts, lock acc
            userData.lockedAt = Date.now();
            wrongPwCounter = 0;
        }

        userData.wrongPasswordCounter = wrongPwCounter;

        await db.collection("User").set(key, userData);
        response.status(200).send({
            success: false,
            message: "wrong-credentials"
        });
    }

}
function handleUserLogout(usernameOrEmail, response) {
    // this function will do nothing!
    // because the app is using JWTs and not sessions.
    // so all of the storage happens in cookies in
    // the client. 
    // so a function like this is not needed on the server
    // the client-side version of this will simply clear localStorage.
    return false;
}
async function handleAccountDeletion(usernameOrEmail, password, jwt, response) {
    const [correctPasswordHash, givenPasswordHash, key, isLocked] = await getPasswordHashAndAttempt(usernameOrEmail, password, response);

    if(isLocked) {
        response.status(200).send({
            success: false,
            message: "account-locked"
        });
        return;
    }

    const payload = jwt.split(".")[1];
    const payloadObject = JSON.parse(Buffer.from(payload, "base64").toString());
    const usernameFromJwt = payloadObject.sub;

    if(usernameFromJwt != key) {
        // if the JWT is for another username
        // and not the one given in the request
        // reject the attempt
        response.status(200).send({
            success: false,
            message: "unknown-error"
        });
        return;
    }


    if(correctPasswordHash === givenPasswordHash) {
        // passwords match. Access granted.
        const item = await db.collection("User").delete(key);
        if(item) { 
            // db deletion sucessful
            response.status(200).send({
                success: true,
                message: "account-deleted"
            });
        } else {
            // deletion was not successful
            response.status(200).send({
                success: false,
                message: "unknown-error"
            });
        }
    } else {
        // wrong password given
        response.status(200).send({
            success: false,
            message: "unknown-error" // unknown so that attackers do not have details
        });
    }



}

async function handleNewPasswordResetSessionRequest(username, response) {
    // this func will only create a new session & send back the USID

    // first, generate the new session's codes:
    const newOtp = generateRandomOTP();
    const newUsid = generateRandomUSID();

    // now, inside the db, store: 
    // usid:prim key, otp, issuedAt, state, email, username:foreign key

    // find username's email
    const email = (await db.collection("User").get(username))?.props?.email;
    if(!email) {
        response.status(200).send({
            success: false,
            message: "unknown-error"
        });
        return;
    }

    const primaryKey = newUsid;
    const newSessionData = {
        otp: newOtp,
        issuedAt: Date.now(),
        state: "closed",
        email,
        username,
        ttl: Math.floor(Date.now() / 1000) + 30*60 // delete it after some minutes
    };

    const result = await db.collection("PasswordResetSession")
                           .set(primaryKey, newSessionData);

    // the database has been updated with the new session record
    // now send back the usid using the response object passed into the function

    const success = Boolean(result?.collection === "PasswordResetSession");

    response.status(200).send({
        success,
        usid: newUsid
    });

}


async function handleSendOtpByEmailRequest(usid, response) {
    // fist validate usid with state and expiration date
    // then get the email and send the otp


    // validate usid & get correct email from db
    const sessionData = await db.collection("PasswordResetSession").get(usid);

    if(sessionData?.collection != "PasswordResetSession") {
        // usid does not exist
        response.status(200).send({
            success: false,
            message: "session-unavailable"
        });
        return;
    }

    const {email, otp, issuedAt, state, username} = sessionData.props;
    // first check state, and issuedAt. Check if expired or closed. 
    // then check if username's accout is locked. 
    // if not then send the OTP

    let sessionIsValid = true;
    let message;
    if(state != "closed") {
        // the state must be closed in order to be opened by an OTP.
        // if it is not closed, then it is open or expired
        // if open, an OTP attempt has alrady been 
        // submitted - do not accept more
        // if expired, do not accept any OTP attempts
        sessionIsValid = false;
        message = "session-unavailable";
    } else if(Date.now() - issuedAt > 10*60*1000) {
        // allow 10 minutes or so before expiring session 
        // so the email can get delivered
        sessionIsValid = false;
        message = "session-unavailable";
    } 
    else if(((await db.collection("User").get(username))?.props?.lockedAt || 0) + 600000 > Date.now())
    {
        // user's acc is locked, reject
        sessionIsValid = false;
        message = "account-locked";
    }


    if(sessionIsValid === false) {
        // if the session is not valid
        // for any of the above reasons
        // send response & stop the function
        response.status(200).send({
            success: false, message
        });
        return;
    }

    // at this point, the session is valid
    // - so email over the OTP

    // now send email
    const data = {
        emailto: email,
        toname: username,
        emailfrom: "Alexander@alpha-howl.com",
        fromname: "Alexander",
        subject: "One-time code for your CTF account",
        messagebody: "Hi there, "+username+"! You recently requested to reset the password to your CTF account. This is the one-time code which you can use to reset the password:" + otp + ". If that was not you, just ignore this email - only those who have access to your email inbox can reset your password."
    };
     
    const params = new URLSearchParams( data );
    axios.post(
        "https://alpha-howl.com/database/email.php", 
        params.toString()
    ).then(res => {
      const isSuccessful = res?.data?.result;
      response.status(200).send({
        success: isSuccessful,
        message: "email-sent"
      });
    }).catch(errr => {
      console.log(errr);
      response.status(200).send({
        success: false,
        message: "unkown-error"
      });
    });
}


async function handleOtpSubmission(usid, otpAttempt, response) {
    // validate usid & get correct email from db
    const sessionData = await db.collection("PasswordResetSession").get(usid);

    if(sessionData?.collection != "PasswordResetSession") {
        // usid does not exist
        response.status(200).send({
            success: false,
            message: "session-unavailable"
        });
        return;
    }

    const {email, otp, issuedAt, state, username} = sessionData.props;
    // first check state, and issuedAt. Check if expired or closed. 
    // then check if username's accout is locked. 
    // if not then send the OTP

    let sessionIsValid = true;
    let message;
    if(state != "closed") {
        // the state must be closed in order to be opened by an OTP.
        // if it is not closed, then it is open or expired
        // if open, an OTP attempt has alrady been 
        // submitted - do not accept more
        // if expired, do not accept any OTP attempts
        sessionIsValid = false;
        message = "session-unavailable";
    } else if(Date.now() - issuedAt > 10*60*1000) {
        // allow 10 minutes or so before expiring session 
        // so the email can get delivered
        sessionIsValid = false;
        message = "session-expired";
    } 
    else if(((await db.collection("User").get(username))?.props?.lockedAt || 0) + 600000 > Date.now())
    {
        // user's acc is locked, reject
        sessionIsValid = false;
        message = "account-locked";
    }


    if(sessionIsValid === false) {
        // if the session is not valid
        // for any of the above reasons
        // send response & stop the function
        response.status(200).send({
            success: false, message
        });
        return;
    }



    // at this point, the session is valid
    // initially, set the success, mssage and state as if the OTP
    // is wrong, and change if it is not wrong.
    // set as expired because we only allow one attempt, which is this one
    const updatedSessionData = {...sessionData.props};
    updatedSessionData.state = "expired";
    let success = false;
    message = "wrong-otp"

    // compare the 2 otps
    if(otp === otpAttempt) {
        // user has supplied correct OTP
        // mark session as open
        // update issuedAt
        updatedSessionData.state = "open";
        updatedSessionData.issuedAt = Date.now();
        updatedSessionData.ttl = Math.floor(Date.now() / 1000) + 30*60;
        updatedSessionData.updated = undefined;
        updatedSessionData.created = undefined;
        success = true;
        message = "session-opened";
    }


    // response.status(200).send({usid, updatedSessionData});

    
    const dbWriteResult = await db.collection("PasswordResetSession").set(usid, updatedSessionData);
    
    if(dbWriteResult?.collection == "PasswordResetSession") {
        response.status(200).send({
            success, message
        });
    } else {
        response.status(200).send({
            success: false,
            message: "db-error"
        });
    }

}


async function handleSetNewPasswordRequest(usid, newPassword, response) {
    // check if session exists in db
    // check if state = "open" for this session
    // make sure <2mins passed since session
    // was updated to "open"
    // if these checks pass, hash new password and
    // update user account and set session as expired
    // else return error

    // todo.

}



async function getPasswordHashAndAttempt(usernameOrEmail, password, response) {
    const userTable = db.collection("User");

    // first, check whether we have a username or an email.
    const isEmail = usernameOrEmail.includes("@");

    let key;
    if(isEmail) {
        const collectionList = await userTable.list();
	    const usersArray = collectionList.results;
        for(let i = 0; i < usersArray.length; i++) {
            const currentUserKey = usersArray[i].key;
		    const currentUserEmail = (await userTable.get(currentUserKey)).props.email;
            if(currentUserEmail === usernameOrEmail) {
                key = currentUserKey;
                break;
            }
        }
    } else {
        key = usernameOrEmail;
    }

    if(key === undefined) {
        // if the key is still undefined, then the 
        // email does not exist in the table
        response.status(200).send({success: false, message: "email-not-found"});
        return;
    }




    // At this point, the key is the username of the account
    // check if the account with that key is locked
    const userData = (await userTable.get(key));
    const lockedAt = userData?.props?.lockedAt;
    let isLocked = false;
    if(typeof lockedAt === "number") {
        const lockedUntil = lockedAt + 600000; // +600000 = +10mins
        isLocked = lockedUntil > Date.now();
    }

    // get the two hashes of the passwords
    const correctPasswordHash = (await userTable.get(key))?.props?.passwordHash;
    const givenPasswordHash = hashString(password);

    delete userData.props.created;
    delete userData.props.updated;

    return [correctPasswordHash, givenPasswordHash, key, isLocked, userData.props];
}
function generateJtw(username) {
    // generate a jwt for that username
    // the username is the primary key
    const jwtHeader = {
        alg: "HS256",
        typ: "jwt"
    };
    const jwtPayload = {
        sub: username,
        iat: Date.now()
    };

    // base64 encode the above 2 JSOs
    const encodedJwtHeader = Buffer.from(JSON.stringify(jwtHeader)).toString("base64");
    const encodedJwtPayload = Buffer.from(JSON.stringify(jwtPayload)).toString("base64");
    const unhashedSignature = encodedJwtHeader + "." + encodedJwtPayload;

    const hashedSignature = hashString(unhashedSignature);
    const hashedEncryptedSignature = encrypt(hashedSignature);

    const jwt = unhashedSignature + "." + hashedEncryptedSignature;
    return jwt;
}

function jwtIsValid(jwtString) {
    try {
        const [header, payload, signature] = jwtString.split(".");
        // unhashedsignature = header + "." + payload
        // decrypt signature
        // hash header+"."+payload
        // check decrypted signature == hashed header+"."+payload
        // if true, valid
        // else invalid, someone tampered with data

        const headerPayload = header + "." + payload;
        const realHashedSignature = decrypt(signature);
        const suspiciousHashedSignature = hashString(headerPayload);
        
        const jwtWasNotTamperedWith = Boolean(realHashedSignature === suspiciousHashedSignature);
        
        const payloadObject = JSON.parse(Buffer.from(payload, "base64").toString());
        const issuedAt = payloadObject.iat;

        // if over three days (259200000ms) have passed since the creation of the JWT,
        // then treat it as expired
        const isExpired = Boolean( (Date.now() - issuedAt) > 259200000 );

        

        const thisJwtIsValid = Boolean( // valid if not changed & not expired
            jwtWasNotTamperedWith && 
            ( ! isExpired )
        )
        return thisJwtIsValid;
    } catch(er) {
        return false;
    }
}




// #############################################################################
// This configures static hosting for files in /public that have the extensions
// listed in the array.
// var options = {
//   dotfiles: 'ignore',
//   etag: false,
//   extensions: ['htm', 'html','css','js','ico','jpg','jpeg','png','svg'],
//   index: ['index.html'],
//   maxAge: '1m',
//   redirect: false
// }
// app.use(express.static('public', options))
// #############################################################################

// Create or Update an item
/* app.post('/:col/:key', async (req, res) => {
  console.log(req.body)

  const col = req.params.col
  const key = req.params.key
  console.log(`from collection: ${col} delete key: ${key} with params ${JSON.stringify(req.params)}`)
  const item = await db.collection(col).set(key, req.body)
  console.log(JSON.stringify(item, null, 2))
  res.json(item).end()
}) */

// Delete an item
/* app.delete('/:col/:key', async (req, res) => {
  const col = req.params.col
  const key = req.params.key
  console.log(`from collection: ${col} delete key: ${key} with params ${JSON.stringify(req.params)}`)
  const item = await db.collection(col).delete(key)
  console.log(JSON.stringify(item, null, 2))
  res.json(item).end()
}) */

// Get a single item
/* app.get('/:col/:key', async (req, res) => {
  const col = req.params.col
  const key = req.params.key
  console.log(`from collection: ${col} get key: ${key} with params ${JSON.stringify(req.params)}`)
  const item = await db.collection(col).get(key)
  console.log(JSON.stringify(item, null, 2))
  res.json(item).end()
}) */

// Get a full listing
/* app.get('/:col', async (req, res) => {
  const col = req.params.col
  console.log(`list collection: ${col} with params: ${JSON.stringify(req.params)}`)
  const items = await db.collection(col).list()
  console.log(JSON.stringify(items, null, 2))
  res.json(items).end()
}) */


function Basea_to_baseb(value="", base_a, base_b, result="", column=0, mag=0) {
	const characters = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
	if(value != "") {
		const current_char = value[value.length-1];
		value = value.slice(0, -1);
		mag += characters.indexOf(current_char)*base_a**column;
		column++;
		if(value != "") return Basea_to_baseb(value, base_a, base_b, result, column, mag);
		if(base_b == 10) return mag;
	};
	let remainder = mag%base_b;
	mag = Math.floor(mag/base_b);
	result = characters[remainder] + result;
	if(mag != 0) return Basea_to_baseb(value, base_a, base_b, result, column, mag);
	if(mag == 0) return result;
}

function generateRandomOTP(bytes=8, charGroupLength=2) {
	const arraySize = Math.round(bytes + (bytes/charGroupLength-1));

	const bytesArray = new Array(arraySize).fill(0).map(x => Math.floor(Math.random() * 256)) //crypto.getRandomValues(new Uint8Array(arraySize));
	const base62Array = new Array(arraySize);

	for(let i = 0; i < arraySize; i++) {
		const shouldBeWhitespace = (i+1)%(charGroupLength+1) === 0 
								 && i != 0
								 && i != arraySize-1;
		if(shouldBeWhitespace) {
			base62Array[i] = " ";
		} else {
			const randomByte = bytesArray[i];
			base62Array[i] = Basea_to_baseb(randomByte.toString(), 10, 62);
		}
	}

	return base62Array.join("");
}
function generateRandomUSID() {
	return generateRandomOTP(32, 32);
}

app.get("/", (req, res) => {
    res.status(200).send(`<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document</title>
    </head>
    <body>
        <h1>Proba get 1</h1>
    </body>
    </html>`);
});


// Catch all handler for all other request.
app.use('*', (req, res) => {
  res.json({ msg: 'no route handler found' }).end();
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`index.js listening on ${port}`);
});
