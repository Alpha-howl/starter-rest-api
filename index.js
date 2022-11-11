const express = require("express");
const app = express();

process.env.CYCLIC_DB = "shy-plum-bass-slipCyclicDB";
const db = require("cyclic-dynamodb");

const crypto = require("crypto");

const axios = require("axios").default;

const Pubnub = require("pubnub");


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


function haltOnTimedout(req, res, next) {
  if (!req.timedout) {
    next();
  }
}


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(haltOnTimedout);


app.post("/:action", async (req, response) => {
  response.header("Access-Control-Allow-Origin", "*");
  response.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

  req.setTimeout(4 * 60 * 1000);

  req.socket.removeAllListeners('timeout');
  req.socket.once("timeout", () => {
      req.timedout = true;
      res.status(504).send("timeout");
  });
  
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
        if(!(await userIsLoggedIn(req?.body?.jwt))) {
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

    case "validate-jwt":
        response.status(200).send({
            success: await userIsLoggedIn(req?.body?.jwt)
        });
        break;
    
    case "get-acc-details":
        handleGetAccDetailsRequest(req?.body?.jwt, response);
        break;

    case "join-room":
        // validate JWT and see what else needs to be done in the flow chart
        // handleJoinRoomRequest(req?.body?.jwt, response);
        handleJoinRoomRequest(req?.body?.jwt, response);
        break;

    case "ready-to-play":
        handleReadyToPlayRequest(req?.body?.roomId, req?.body?.jwt, response);
        break;
    
    case "test-dynamo":
        testDynamo(response, req);
        break;

    case "pubnub-open":
        pubnubOpen(response, req.body.channelName);
        break;
    
    case "maze-proba":
        mazeProba(response);
        break;

    
    default:
        response.status(200).send({
            success: false,
            message: "Error: unknown action:'" + action.toLowerCase() + "'"
        });
        break;

  }

});

const COLS = 11;
const ROWS = 11;
const MAX_NUMBER_OF_PLAYERS = 2;
const VISION_RADIUS = 3;


const spawnPointA = [0,0];
const spawnPointB = [COLS-1, ROWS-1];


class Cell {
	#x;
	#y;
	#index;
	#neighbours = [];
	#visited = false;
	#walls = [true, true, true, true];

	constructor(paramX, paramY, paramIndex) {
		this.#x = paramX;
		this.#y = paramY;
		this.#index = paramIndex;
	}


	getY() {
		return this.#y;
	}
	getX() {
		return this.#x;
	}
	getIndex() {
		return this.#index;
	}
	getNeighbours() {
		return this.#neighbours;
	}
	isVisited() {
		return this.#visited;
	}
	markAsVisited() {
		this.#visited = true;
	}
	getWalls() {
		return this.#walls;
	}
	removeWall(wallIndex) {
		if(wallIndex > 3 || wallIndex < 0) {
            console.log("Wall index out of range");
			//throw "Error - wallIndex out of range (search 4354532)";
			return;
		}
		this.#walls[wallIndex] = false;
	}

	initialiseNeighbours(grid, cols, rows) {
		if(this.#neighbours.length != 0) {
			return;
		}

		if(this.#x > 0) {
			const leftNeighIndex = this.#index-1;
			this.#neighbours.push(grid[leftNeighIndex]);
		}
		if(this.#y > 0) {
			const topNeighIndex = this.#index - cols;
			this.#neighbours.push(grid[topNeighIndex]);
		}
		if(this.#x < cols-1) {
			const rightNeighIndex = this.#index + 1;
			this.#neighbours.push(grid[rightNeighIndex]);
		}
		if(this.#y < rows-1) {
			const bottomNeighIndex = this.#index + cols;
			this.#neighbours.push(grid[bottomNeighIndex]);
		}
	}

    toJSO() {
        return {
            x: this.#x,
            y: this.#y,
            index: this.#index,
            neighbours: [], // cannot compute this as it 
            // would result in a cyclic object loop (client can just re-init neighbours)
            visited: this.#visited,
            walls: this.#walls
        };
    }
}
function randomDfs(cols, rows, probToVisitCellAgain=0.5) {
	// first, generate the initial grid of cells with all walls intact:
	// number of cells = resolution of maze = rows x columns
	const grid = new Array(cols*rows);
	// inject those cells into the grid array now
	for (let i = 0; i < grid.length; i++) {
		// find the current cell's row and column to instantiate it
		const row = Math.floor(i / cols);
		const col = i % cols;
		grid[i] = new Cell(/*x*/col, /*y*/row, /*index in grid*/i);
	}

	for (let i = 0; i < grid.length; i++) {
		// call the initialiseNeighbours method for each cell
		grid[i].initialiseNeighbours(grid, cols, rows);
	}


	// define stack of cells to be processed & place
	// the initial cell in it to start with
	const cellsToProcessStack = [grid[0]];


	while (cellsToProcessStack.length != 0) {
		// pop the last cell from the stack & call it the current cell
		const currentCell = cellsToProcessStack.splice(-1)[0];

		if (Math.random() > probToVisitCellAgain) {
			currentCell.markAsVisited();
		}

		// check to see if cell has unvisited neighbours
		// by using a linear search and a flag
		let hasUnvisitedNeighbours = false;
		const unvisitedNeighbours = [];
		const allNeighbours = currentCell.getNeighbours();
		for (let i = 0; i < allNeighbours.length; i++) {
			if(!allNeighbours[i].isVisited()) {
				hasUnvisitedNeighbours = true;
				unvisitedNeighbours.push(allNeighbours[i]);
			}
		}


		if (hasUnvisitedNeighbours) {
			// as in the structured English description, we have to do the following:
			// if there are unvisited neighbours, push the cell onto the stack
			// and remove the wall between that cell and one of the unvisited neighbours

			cellsToProcessStack.push(currentCell);
			const rand = Math.floor(Math.random()*unvisitedNeighbours.length);
			const chosenNeighbour = unvisitedNeighbours[rand];

			// now find the location of the neighbour relative to the current cell
			// and remove the walls between the neighbour and the current cell
			const indexDifference = currentCell.getIndex() - chosenNeighbour.getIndex();
			if(indexDifference === -cols) {
				// the neighbour is directly downwards from current cell, so
				// remove top wall of neighbour and bottom wall of current cell
				grid[chosenNeighbour.getIndex()].removeWall(0);
				grid[currentCell.getIndex()].removeWall(2);
			}
			else if(indexDifference === cols) {
				// neighbour is directly upwards from current cell, so
				// remove bottom wall of neighbour and top wall of current cell
				grid[chosenNeighbour.getIndex()].removeWall(2);
				grid[currentCell.getIndex()].removeWall(0);
			}
			else if(indexDifference === -1) {
				// neighbour is to the right -> of the current cell
				// remove left wall of neighbour and right wall of current
				grid[chosenNeighbour.getIndex()].removeWall(3);
				grid[currentCell.getIndex()].removeWall(1);
			}
			else {
				// indexDifference = 1, and the neighbour is to
				// the left <- of the current cell
				grid[chosenNeighbour.getIndex()].removeWall(1);
				grid[currentCell.getIndex()].removeWall(3);
			}

			// now push neighbour to stack so it is 
			// also processed like the current cell just was
			cellsToProcessStack.push(grid[chosenNeighbour.getIndex()]);

		} else {
			// has no unvisited neigh.
			// do nothing, all paths have alrady been carved around
			// this cell - so no need for new paths
		} // end if
	} // end while
	// finally, return the maze data (the grid array)
	return grid;
}




async function getLastRoomJoined() {
	const overflows = (await db.collection("Overflows").get("overflows"))?.props?.overflows;
    return (overflows || 0) + 1;
}
async function roomIsFull(roomId) {
    // check whether the room with id=roomId is full
    const roomData = await db.collection("Room").get(roomId.toString());
    if(! roomData?.key) {
        // room does not exist, create it
        // convert array of cells to array of JSOs so it can be saved in the db
        console.log("Insert new room " + roomId);
        const flagInfo = {
            teamA: {
                carriedBy: false, 
                position: spawnPointA
            },
            teamB: {
                carriedBy: false,
                position: spawnPointB
            }
        };
        const newGrid = randomDfs(COLS, ROWS).map(cell => {return cell.toJSO()});
        await db.collection("Room").set(roomId.toString(), {
            mazeData: newGrid,
            joinedPlayers: [],
            preparedPlayers: [],
            fullyReadyPlayers: {},
            state: "loading",
            startTime: undefined,
            teamsInfo: undefined,
            flagInfo,
            ttl: Math.floor(Date.now() / 1000) + 30*60 // half an hour
        });
        // the new room cannot be full, so return false
        return false;
    }
    // room exists: check how many players there are
    // return true if the room is full
    console.log(roomData.props.joinedPlayers.length, MAX_NUMBER_OF_PLAYERS);
    return roomData.props.joinedPlayers.length === MAX_NUMBER_OF_PLAYERS;
}
async function incrementOverflows() {
    const overflows = (await db.collection("Overflows").get("overflows"))?.props?.overflows;
    await db.collection("Overflows").set("overflows", {
        overflows: (overflows || 0) + 1
    });
}



async function testDynamo(response, req) {
    const result = await db.collection("PasswordResetSession").set("proba", {worls: true});
	
    response.status(200).send({"proba": "75-76-77", result});
}


const pubnub = new Pubnub({
    publishKey : "pub-c-9ab0b954-2551-4a44-85a2-cdbadb3760cb",
    subscribeKey : "sub-c-b06b11d8-a214-11ec-81c7-420d26494bdd",
    uuid: "sec-c-ZWVkYzZiZDAtODJjYS00YmVkLThmOWYtZjg4ODkwZjhlNWFk"
});

async function pubnubOpen(response, channelName) {
    pubnub.subscribe({channels: [channelName]}); // see pubnub docs
    setTimeout(() => {
        response.status(200).send("closing");
    }, 26000);
}
async function mazeProba(response) {
    const newMaze = randomDfs(11, 11);
    const JSOMaze = newMaze.map(cell => {
        return cell.toJSO();
    });

    response.status(200).send({
        success: true, 
        message: JSOMaze
    });
}

async function userIsLoggedIn(jwt) {
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
    const userData = await db.collection("User").get(getUsernameFromJwt(jwt));
    if(!userData) {
        // account does not exist
        isLoggedIn = false;
    } else if((userData.props.lockedAt || 0) + 600000 > Date.now()) {
        // if this is true, then the time when the account
        // will re-open is in the future, so the acc 
        // is still locked 
        isLoggedIn = false;
    }

    return isLoggedIn;
}

function getUsernameFromJwt(jwt) {
    const payload = jwt.split(".")[1];
    let payloadObject;
    try {
        payloadObject = JSON.parse(
            Buffer.from(payload, "base64").toString()
        );
    } catch(errr) {
        return "a"; // return an illegal username so it is not found in db
    }
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
        response.status(200).send({success:false, message: "User input was not valid: " + validationResult.message});
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
        message // the front-end should recognise this code and display a corresponding message. See pg 60 of back end part of acc system.docx
    });

}
async function handleUserLoginAttempt(usernameOrEmail, password, response) {
    
    const authenticationResult = await getPasswordHashAndAttempt(usernameOrEmail, password, response);
    if(!authenticationResult) {
        return;
    }

    const [correctPasswordHash, givenPasswordHash, key, isLocked, userData] = authenticationResult;

    if(isLocked) {
        response.status(200).send({
            success: false,
            message: "account-locked"
        });
        return;
    }

    if(correctPasswordHash === givenPasswordHash) {
        // passwords match
        // first remove the wrong password attempt counter
        userData.wrongPasswordCounter = 0;
        await db.collection("User").set(key, userData);

        // generate JWT and send to client
        // generate new jwt:
        const newJwt = generateJtw(key);
        // then send to client (the client needs to store it and 
        // send it along with each new request from now on)
        response.status(200).send({
            success: true,
            message: "user-logged-in",
            jwt: newJwt,
            username: key
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
    const authenticationResult = await getPasswordHashAndAttempt(usernameOrEmail, password, response);
    if(!authenticationResult) {
        return;
    }

    const [correctPasswordHash, givenPasswordHash, key, isLocked, userData] = authenticationResult;


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
        message: "session-generation",
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
        success = true;
        message = "session-opened";
    }
    updatedSessionData.updated = undefined;
    updatedSessionData.created = undefined;


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

    const session = await db.collection("PasswordResetSession").get(usid);
    let message,sessionIsValid = true;
    if( session?.collection != "PasswordResetSession" ) {
        sessionIsValid = false;
        message = "session-unavailable";
    } else if(session.props.state != "open") {
        sessionIsValid = false;
        message = "session-unavailable";
    } else if((Date.now() - session.props.issuedAt) > 10*60*1000) {
        sessionIsValid = false;
        message = "session-expired";
    }

    if(sessionIsValid === false) {
        // session is invalid
        response.status(200).send({
            success: false,
            message
        });
        return;
    }

    // if code is still executing, session is valid
    // validate & hash the new password
    const passwordValidationResult = await validatePassword(newPassword);

    if(passwordValidationResult.valid === false) {
        // password invalid
        response.status(200).send({success:false,
                                message:passwordValidationResult.message});
        return;
    }
    // password is valid at this point
    const newHashedPassword = hashString(newPassword);

    // update user account
    const userData = (await db.collection("User").get(session.props.username)).props;
    delete userData.updated;
    delete userData.created;
    userData.passwordHash = newHashedPassword;
    userData.lockedAt = Date.now() - 600000;
    await db.collection("User").set(session.props.username, userData);

    session.props.state = "expired";
    session.props.ttl = Math.floor(Date.now() / 1000) + 20*60;
    delete session.props.updated;
    delete session.props.created;
    await db.collection("PasswordResetSession").set(usid, session.props);
    
    response.status(200).send({ success: true, message: "password-updated" });
}


async function handleGetAccDetailsRequest(jwt, response) {
    // first validate the jwt
    if(!(await userIsLoggedIn(jwt))) {
        response.status(200).send({
            success: false,
            message: "must-be-logged-in"
        });
        return;
    }

    // get username from jwt
    // send data in format {success, data:{...}}
    const username = getUsernameFromJwt(jwt);
    const accDetails = (await db.collection("User").get(username))?.props;

    response.status(200).send({
        success: true,
        data: accDetails
    });

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
    if(!userData) {
        response.status(200).send({
            success: false,
            message: "wrong-credentials"
        });
        return;
    }
    const lockedAt = userData?.props?.lockedAt;
    let isLocked = false;
    if(typeof lockedAt === "number") {
        const lockedUntil = lockedAt + 600000; // +600000 = +10mins
        isLocked = lockedUntil > Date.now();
    }

    // get the two hashes of the passwords
    const correctPasswordHash = (await userTable.get(key))?.props?.passwordHash;
    const givenPasswordHash = hashString(password);

    if(userData?.props?.created) {
        delete userData.props.created;
    }
    if(userData?.props?.updated) {
        delete userData.props.updated;
    }

    return [correctPasswordHash, givenPasswordHash, key, isLocked, userData?.props];
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









async function handleJoinRoomRequest(jwt, response) {
    if( ! (await userIsLoggedIn(jwt)) ) {
        response.status(200).send({
            success: false,
            message: "must-be-logged-in"
        });
        return;
    }

    const username = getUsernameFromJwt(jwt);
    let lastRoomId = await getLastRoomJoined();
    const lastRoomHasSpace = Boolean(! (await roomIsFull(lastRoomId)));

    let mazeData;
    if(lastRoomHasSpace) {
        // the last room has an empty space - join it
        const roomData = await db.collection("Room").get(lastRoomId.toString());
        roomData.props.joinedPlayers ||= [];
        // only push username if it is not already there
        if(!roomData.props.joinedPlayers.includes(username)) {
            roomData.props.joinedPlayers.push(username);
        }
        await db.collection("Room").set(lastRoomId.toString(), {
            mazeData: roomData.props.mazeData,
            joinedPlayers: roomData.props.joinedPlayers,
            preparedPlayers: roomData.props.preparedPlayers,
            fullyReadyPlayers: roomData.props.fullyReadyPlayers,
            state: roomData.props.state,
            startTime: roomData.props.startTime,
            teamsInfo: roomData.props.teamsInfo,
            ttl: roomData.props.ttl // half an hour
        });
        mazeData = roomData.props.mazeData;
        console.log("Room exists");
    } else {
        console.log("Make new room");
        // the room is full, join the next one
        // next room = current room's id + 1:
        lastRoomId += 1;
        // then generate what will be the new room's maze
        mazeData = randomDfs(COLS, ROWS);
        mazeData = mazeData.map(cell => {return cell.toJSO();});

        const flagInfo = {
            teamA: {
                carriedBy: false, 
                position: spawnPointA
            },
            teamB: {
                carriedBy: false,
                position: spawnPointB
            }
        };
        // inside the overflows table, increment the value of overflows
        await incrementOverflows();
        // create the record of the new room using all the data described
        // in the ERD
        await db.collection("Room").set(lastRoomId.toString(), {
            mazeData: mazeData,
            joinedPlayers: [username],
            preparedPlayers: [],
            fullyReadyPlayers: {},
            state: "loading",
            startTime: undefined,
            teamsInfo: undefined,
            flagInfo,
            ttl: Math.floor(Date.now() / 1000) + 30*60 // half an hour
        });
    }

    // finally report back to the user and send the maze data
    // so the client can display it in a lobby-like manner while
    // waiting for more players to join
    response.status(200).send({
        success: true,
        message: "joined-room",
        mazeData: mazeData,
        roomId: lastRoomId
    });
}
async function handleReadyToPlayRequest(roomId, jwt, response) {
    const roomData = await (db.collection("Room").get(roomId.toString()))
    const username = getUsernameFromJwt(jwt);

    if(! (await userIsLoggedIn(jwt))) {
        response.status(200).send({
            success: false, 
            message: "must-be-logged-in"
        });
        return;
    }

    if(! (roomData?.props?.joinedPlayers?.includes(username))) {
        // if the user has tampered with the request payload (ie changed the roomid of the sent req)
        // reject their request
        response.status(200).send({
            success: false, 
            message: "unknown-error"
        });
        return;
    }
    if(roomData.props.joinedPlayers.length < MAX_NUMBER_OF_PLAYERS) {
        // not enough players have joined, wait for more
        response.status(200).send({
            success: false, 
            message: "waiting-for-players"
        });
        return;
    } else {
        // there are enough players now
        if(!roomData.props.preparedPlayers.includes(username)) {
            roomData.props.preparedPlayers.push(username);
            await db.collection("Room").set(roomId.toString(), {
                mazeData: roomData.props.mazeData,
                joinedPlayers: roomData.props.joinedPlayers,
                preparedPlayers: roomData.props.preparedPlayers,
                fullyReadyPlayers: roomData.props.fullyReadyPlayers,
                state: roomData.props.state,
                startTime: roomData.props.startTime,
                teamsInfo: roomData.props.teamsInfo,
                ttl: roomData.props.ttl // half an hour
            });
        }

        if(roomData.props.preparedPlayers.length < MAX_NUMBER_OF_PLAYERS) {
            // some players have not displayed the maze, wait for them
            response.status(200).send({
                success: false, 
                message: "waiting-for-players"
            });
            return;
        } else {
            // enough players are now "prepared" (ie have the maze displayed)
            // pick teams, generate pubnub and send response signalling front end to start the game
            let teamsInfo = roomData.props.teamsInfo;
            if(!teamsInfo) {
                teamsInfo = pickTeams(roomData.props.preparedPlayers, COLS, ROWS);
                roomData.props.teamsInfo = teamsInfo;
                await db.collection("Room").set(roomId.toString(), {
                    mazeData: roomData.props.mazeData,
                    joinedPlayers: roomData.props.joinedPlayers,
                    preparedPlayers: roomData.props.preparedPlayers,
                    fullyReadyPlayers: roomData.props.fullyReadyPlayers,
                    state: roomData.props.state,
                    startTime: roomData.props.startTime,
                    teamsInfo: roomData.props.teamsInfo,
                    ttl: roomData.props.ttl // half an hour
                });
            }
            
            const pubnubChannelName = "ctf-room-" + roomId + jwt; // eg "ctf-room-19"
            pubnub.subscribe({channels: [pubnubChannelName]}); // see pubnub docs
            
            response.status(200).send({
                success: true,
                message: "start-game",
                pubnubChannelName,
                teamsInfo,
                username
            });
        }
    }
}

let lastTimeStamp = 0;
async function handlePubNubReceivedMessage(receivedMessage) {
    let roomData, username, roomId;
    const securityCheck = async () => {
        const jwt = receivedMessage.channel.split(/ctf-room-\d+/)[1];
        username = getUsernameFromJwt(jwt);
        roomId = receivedMessage.channel.match(/\d+/)[0];

        roomData = await db.collection("Room").get(roomId.toString()); 
        if(! roomData.props.joinedPlayers.includes(username)) {
            console.log("'return'");
            return false;
        }

        if(! jwtIsValid(jwt)) {
            console.log("'return, jwt invalid'");
            return false;
        }
    }

    const action = receivedMessage.message.action;
    switch(action) {
        case "tone" : {
            console.log("Toned");
            break;
        }
        case "ready-to-play": {

            // first perform some security checks:
            const username = getUsernameFromJwt(receivedMessage.message.jwt);
            const roomId = receivedMessage.message.roomId;

            const roomData = await db.collection("Room").get(roomId.toString()); 
            if(! roomData.props.preparedPlayers.includes(username)) {
                console.log("return");
                return false;
            }

            if(! jwtIsValid(receivedMessage.message.jwt)) {
                console.log("return");
                return false;
            }



            // client is ready to start playing
            const teamsInfo = roomData.props.teamsInfo;
            const userTeamInfo = teamsInfo.teamA.players.includes(username) ? 
                ["teamA", teamsInfo.teamA] : ["teamB", teamsInfo.teamB];
            const spawnPoint = userTeamInfo[1].spawnPoint;
            const team = userTeamInfo[0];
            roomData.props.fullyReadyPlayers[username] = {
                position: spawnPoint, isDead: false, team: team
            }

            console.log("fullyReadyPlayers updated", roomData.props.fullyReadyPlayers);
            await db.collection("Room").set(roomId.toString(), {
                mazeData: roomData.props.mazeData,
                joinedPlayers: roomData.props.joinedPlayers,
                preparedPlayers: roomData.props.preparedPlayers,
                fullyReadyPlayers: roomData.props.fullyReadyPlayers,
                state: roomData.props.state,
                startTime: undefined,
                teamsInfo: roomData.props.teamsInfo,
                ttl: roomData.props.ttl
            });
            
            const numOfPlayers = roomData.props.preparedPlayers.length;
            if(numOfPlayers === MAX_NUMBER_OF_PLAYERS) {
                const delay = 10000; // start in 10 secs
                const startTime = roomData.props.startTime || Date.now() + delay;
                // all players have now drawn the maze and are ready to play
                pubnub.publish({
                    channel: "ctf-room-" + roomId + receivedMessage.message.jwt,
                    message: {
                        action: "start-in-3s",
                        spawnPoint,
                        startAt: startTime
                    }
                });
                if(roomData.props.startTime === undefined) {
                    db.collection("Room").set(roomId.toString(), {
                        mazeData: roomData.props.mazeData,
                        joinedPlayers: roomData.props.joinedPlayers,
                        preparedPlayers: roomData.props.preparedPlayers,
                        fullyReadyPlayers: roomData.props.fullyReadyPlayers,
                        state: "playing",
                        startTime: startTime,
                        teamsInfo: roomData.props.teamsInfo,
                        ttl: Math.floor(startTime / 1000) + 30*60
                    });
                }
            }
            break;
        }
        case "validate-frame": {
            if(lastTimeStamp > receivedMessage.message.timeStamp) {
                break;
            } 

            lastTimeStamp = receivedMessage.message.timeStamp;
            // first perform some security checks:
            const securityCheckPassed = await securityCheck(); 
            /*if(securityCheckPassed === false) {
                break;
            } */
            if(roomData.props.state != "playing") {
                await pubnub.publish({
                    channel: receivedMessage.channel,
                    message: {
                        action: "game-state-"+roomData.props.state
                    }
                });
                break;
            }
            let amplifier = 0.16;

            if(roomData.props.fullyReadyPlayers[username].isDead) {
                amplifier = 0;
            }

            
            const hitboxData = {
                player: {width: .22, height: .22},
                flag: {width: 1, height: 1}
            }; // 28/10
            const mazeGrid = roomData.props.mazeData.map(convertJsoCellToClassCell); // 28/10

            // use receivedMessage.message.pressedArrowKeys playerX and playerY and roomData, username, to validate new frame
            // then send back the new frame data 
            const playerData = roomData.props.fullyReadyPlayers[username] || {position: [0,0]};
            const positionOffsetTakenIntoAccount = [playerData.position[0] + 0.5, playerData.position[1] + 0.5];
            const closeWalls = getWallsPlayerWillCollideWith(positionOffsetTakenIntoAccount, mazeGrid, amplifier, COLS, hitboxData.player); // 28/10

            if(closeWalls.some(wall => wall===true)) {
                amplifier -= 0.03;
            }// 28/10
            
            if(receivedMessage.message.pressedArrowKeys.left && !closeWalls[3]) {
                playerData.position[0] -= amplifier;
            }
            if(receivedMessage.message.pressedArrowKeys.right && !closeWalls[1]) {
                playerData.position[0] += amplifier;
            }
            if(receivedMessage.message.pressedArrowKeys.up && !closeWalls[0]) {
                playerData.position[1] -= amplifier;
            }
            if(receivedMessage.message.pressedArrowKeys.down && !closeWalls[2]) {
                playerData.position[1] += amplifier;
            }
            roomData.props.fullyReadyPlayers ||= {};
            roomData.props.fullyReadyPlayers[username] = playerData;


            const oppositeTeam = playerData.team === "teamA" ? "teamB" : "teamA";

            /* if(roomData.props.flagInfo[oppositeTeam].carriedBy === username) {
                roomData.props.flagInfo[oppositeTeam].position = playerData.position; // 29/10
            } */
            let playerIsDead = false;
            let eventsToDisplayOnScreen = [];
            const nearbyItems = []; // find nearby things (that are inside VISION_RADIUS) done at 27/10
            const usernames = Object.keys(roomData.props.fullyReadyPlayers);
            const otherItems = {
                "flagteamA": {
                    name: "flag",
                    team: "teamA",
                    hitboxData: hitboxData.flag,
                    position: roomData.props.flagInfo["teamA"].position,
                    isDead: false
                },
                "flagteamB": {
                    name: "flag",
                    team: "teamB",
                    hitboxData: hitboxData.flag,
                    position: roomData.props.flagInfo["teamB"].position,
                    isDead: false
                }
            };
            Object.values(otherItems).forEach(currentItem => {
                const sqrDstFromPlayer = findSqrDst(currentItem.position, playerData.position);
                if(sqrDstFromPlayer < VISION_RADIUS**2) {
                    // it is close enough to player so they can see this item => push it in nearbyItems to 
                    // report it to the player

                    // collision detection with player and this item
                    const playerCollidedWithItem = isCollided(
                        playerData.position, 
                        hitboxData.player,
                        
                        currentItem.position,
                        currentItem.hitboxData
                    );
                    if(playerCollidedWithItem) {
                        // player collided with item
                        switch (currentItem.name) {
                            case "flag" : {
                                // player ran into a flag => check if it is his flag or enemies' flag
                                const oppositeTeam = playerData.team === "teamA" ? "teamB" : "teamA";
                                if(currentItem.team === playerData.team) {
                                    // player collided with his own flag,
                                    // => if he was also carrying the enemy flag, 
                                    // add a point to his team's score, then break
                                    const isDeliveringEnemyFlag = roomData.props.flagInfo[oppositeTeam].carriedBy 
                                                                                                    === username;
                                    if(isDeliveringEnemyFlag) {
                                        const flagSpawnPoint = roomData.props.teamsInfo[oppositeTeam].spawnPoint;
                                        roomData.props.flagInfo[oppositeTeam].carriedBy = false;
                                        roomData.props.flagInfo[oppositeTeam].position = flagSpawnPoint;
                                        otherItems["flag" + oppositeTeam].position = flagSpawnPoint;
                                        roomData.props.teamsInfo[playerData.team].score ||= 0;
                                        roomData.props.teamsInfo[playerData.team].score += 1;

                                        if(roomData.props.teamsInfo[playerData.team].score >= 10) {
                                            // enough points reached, end game
                                            roomData.props.state = "ended";
                                        }
                                    }
                                    break;
                                }
                                roomData.props.flagInfo[currentItem.team].carriedBy = username;
                                roomData.props.flagInfo[oppositeTeam].position = playerData.position;
                                otherItems["flag" + oppositeTeam].position = playerData.position;
                                break;
                            }
                        }
                    }
                    nearbyItems.push(currentItem);
                }
            });
            usernames.forEach(currentUsername => {
                if(currentUsername === username) {
                    return;
                }
                const currentItem = roomData.props.fullyReadyPlayers[currentUsername];
                currentItem.hitboxData = hitboxData.player;
                const sqrDstFromPlayer = findSqrDst(currentItem.position, playerData.position);
                if(sqrDstFromPlayer < VISION_RADIUS**2) {
                    // it is close enough to player so they can see this item => push it in nearbyItems to report it to the player
                    
                    // collision detection with other players
                    const playerAndOtherPlayerCollided = isCollided(
                        playerData.position, 
                        hitboxData.player,
                        
                        currentItem.position,
                        hitboxData.player
                    );
                    if(playerAndOtherPlayerCollided) {
                        // 2 players collided, kill the one which is further from its spawn
                        // playerIsDead below is for the player who sent the pubnub message
                        const playerSpawnPoint = roomData.props.teamsInfo[playerData.team].spawnPoint;
                        const playerDstToSpawn = findSqrDst(playerData.position, playerSpawnPoint);

                        const itemSpawnPoint = roomData.props.teamsInfo[currentItem.team].spawnPoint;
                        const currentItemDstToSpawn = findSqrDst(currentItem.position, itemSpawnPoint);

                        const oppositeTeam = playerData.team === "teamA" ? "teamB" : "teamA";
                        const enemyFlag = roomData.props.flagInfo[oppositeTeam];
                        const playersFlag = roomData.props.flagInfo[playerData.team];
                        
                        // in a collision, the player further away from their spawn dies, or the flag carrier if one of
                        // them is carrying a flag. If 2 carriers collide, both die.
                        
                        let itemIsDead;

                        if(enemyFlag.carriedBy === username) {
                            playerIsDead = true;
                        } else {
                            playerIsDead = playerDstToSpawn > currentItemDstToSpawn;
                        }
                        if(playersFlag.carriedBy === currentUsername) {
                            itemIsDead = true;
                        } else {
                            itemIsDead = currentItemDstToSpawn > playerDstToSpawn;
                        }

                        //roomData.props.fullyReadyPlayers[username].isDead = playerIsDead;
                        //roomData.props.fullyReadyPlayers[currentUsername].isDead = itemIsDead;


                        // push an event which will be parsed by client and displayed on the screen
                        if(playerIsDead) {
                            eventsToDisplayOnScreen.push({
                                name: "die",
                                killer: currentUsername,
                                killed: username,
                                method: "melee"
                            });
                        }
                        if(itemIsDead) {
                            eventsToDisplayOnScreen.push({
                                name: "kill",
                                killer: username,
                                killed: currentUsername,
                                method: "melee"
                            });
                        }

                        //setTimeout(async () => {
                            // after 3 secs revive and respawn player
                            /* if(playerIsDead) {
                                roomData.props.fullyReadyPlayers[username].isDead = false;
                                roomData.props.fullyReadyPlayers[username].position = playerSpawnPoint;
                                
                                // if this player was carrying the flag, reset it
                                const oppositeTeam = playerData.team === "teamA" ? "teamB" : "teamA";
                                if(roomData.props.flagInfo[oppositeTeam].carriedBy === username) {
                                    roomData.props.flagInfo[oppositeTeam].carriedBy = false;
                                    const oppTeamSpawnPoint = roomData.props.teamsInfo[oppositeTeam].spawnPoint;
                                    roomData.props.flagInfo[oppositeTeam].position = oppTeamSpawnPoint;
                                }
                            }  */
                            if(itemIsDead) {
                                roomData.props.fullyReadyPlayers[currentUsername].isDead = false;
                                roomData.props.fullyReadyPlayers[currentUsername].position = itemSpawnPoint;

                                // if this player was carrying the flag, reset it
                                const oppositeTeam = currentItem.team === "teamA" ? "teamB" : "teamA";
                                if(roomData.props.flagInfo[oppositeTeam].carriedBy === currentUsername) {
                                    roomData.props.flagInfo[oppositeTeam].carriedBy = false;
                                    const oppTeamSpawnPoint = roomData.props.teamsInfo[oppositeTeam].spawnPoint;
                                    roomData.props.flagInfo[oppositeTeam].position = oppTeamSpawnPoint;
                                }
                            }
                            /* await db.collection("Room").set(roomId.toString(), {
                                mazeData: roomData.props.mazeData,
                                joinedPlayers: roomData.props.joinedPlayers,
                                preparedPlayers: roomData.props.preparedPlayers,
                                fullyReadyPlayers: roomData.props.fullyReadyPlayers,
                                state: roomData.props.state,
                                startTime: roomData.props.startTime,
                                teamsInfo: roomData.props.teamsInfo,
                                flagInfo: roomData.props.flagInfo,
                                ttl: roomData.props.ttl
                            }); */
                        //}, 3000);
                        
                    }

                    nearbyItems.push(currentItem);
                }
            });
            


            // update roomdata in db
            await db.collection("Room").set(roomId.toString(), {
                mazeData: roomData.props.mazeData,
                joinedPlayers: roomData.props.joinedPlayers,
                preparedPlayers: roomData.props.preparedPlayers,
                fullyReadyPlayers: roomData.props.fullyReadyPlayers,
                state: roomData.props.state,
                startTime: roomData.props.startTime,
                teamsInfo: roomData.props.teamsInfo,
                flagInfo: roomData.props.flagInfo,
                ttl: roomData.props.ttl
            });


            await pubnub.publish({
                channel: receivedMessage.channel,
                message: {
                    action: "frame-results",
                    nearbyItems,
                    playerData,
                    youAreDead: playerIsDead,
                    timeStamp: performance.now(),
                    scores: {
                        teamA: roomData.props.teamsInfo.teamA.score || 0,
                        teamB: roomData.props.teamsInfo.teamB.score || 0
                    }
                }
            });

            /* if(eventsToDisplayOnScreen.length != 0) {
                const publicChannel = receivedMessage.channel.match(/ctf-room-\d+/)[0];
                setTimeout(() => {
                    pubnub.publish({
                        channel: publicChannel,
                        message: {
                            action: "event-occured",
                            eventsToDisplayOnScreen
                        }
                    });
                }, 120);
            } */

            break;
        }
    }
}
function findSqrDst(coords1, coords2) {
    return (coords1[0] - coords2[0])**2 + (coords1[1] - coords2[1])**2;
}
function isCollided(rectACoords, rectADimensions, rectBCoords, rectBDimensions) {
    return (
        rectACoords[0] < rectBCoords[0] + rectBDimensions.width &&
        rectACoords[0] + rectADimensions.width > rectBCoords[0] &&
        rectACoords[1] < rectBCoords[1] + rectBDimensions.height &&
        rectACoords[1] + rectADimensions.height > rectBCoords[1]
    );
}




pubnub.addListener({
    message: function(receivedMessage) {
        handlePubNubReceivedMessage(receivedMessage);
    }
});
function convertJsoCellToClassCell(jsoCell) {
	const cellClassObk = new Cell(jsoCell.x, jsoCell.y, jsoCell.index);
    if(jsoCell.visited) {
    	cellClassObk.markAsVisited();
    }
    jsoCell.walls.forEach((wall, index) => {
    	if(wall === false) {
    		cellClassObk.removeWall(index);
    	}
    });

    return cellClassObk;
}

function findRadiusAroundPlayer(grid, playerX, playerY, cols, radius) {
	const sqrRadius = radius*radius;
	const gridToBeDisplayed = [];
	for(let i = 0; i < grid.length; i++) {
		const currentCell = grid[i];
		//const playerCell = grid[getIndexFromXY(playerX, playerY, cols)];

		const cellX = currentCell.getX();
		const cellY = currentCell.getY();
		const pythagSquareDistanceFromPlayer = (playerX - cellX)**2 + (playerY - cellY)**2;

		if(pythagSquareDistanceFromPlayer > sqrRadius+2) {
			continue;
		}

		gridToBeDisplayed.push(currentCell);

	}

	return gridToBeDisplayed;
}

function pickTeams(preparedPlayers, cols, rows) { 
	// preparedPlayers is the array of usernames 
	// shuffle the player usernames into a rand order:
	const randomOrderUsernames = preparedPlayers.sort(() => Math.random() - .5); 

	const playerNumber = randomOrderUsernames.length; 
	const usernamesOfTeamA = randomOrderUsernames.slice(0, playerNumber/2); 
	const usernamesOfTeamB = randomOrderUsernames.slice(playerNumber/2, playerNumber);


	// now spawn points...
	// team A will spawn in the top left
	// team b will spawn in the bottom right
	// so they are an equal dst from centre

	const teamsInfo = {
		teamA: {
			players: usernamesOfTeamA,
			spawnPoint: spawnPointA,
			colour: "#E83100" // red
		},
		teamB: {
			players: usernamesOfTeamB,
			spawnPoint: spawnPointB,
			colour: "#2D4628" // green
		}
	}

	return teamsInfo;
}


function getIndexFromXY(x, y, cols) {
	return y*cols + x;
}



function getWallsPlayerWillCollideWith(coords, grid, amplifier, cols, hitboxData) {
	const position = {
		x: coords[0],
		y: coords[1]
	};

	const row = Math.floor(position.y);
	const col = Math.floor(position.x);

	const positionInCell = {
		x: position.x-col,
		y: position.y-row
	};




	const cellObject = grid[getIndexFromXY(col, row, cols)];
	const currentCellWalls = cellObject?.getWalls() || [false, false, false, false];

	let wallsThePlayerIsCloseTo = Array(4).fill(false); // in format [top, right, bottom, left]
	const sidesThePlayerIsCloseTo = [];

	// if-else clause for left&right
	if(positionInCell.x - hitboxData.width/2 - amplifier < 0) {
		// player is close to left edge of the cell
		// => check if there is a wall there
		sidesThePlayerIsCloseTo.push(3);
		wallsThePlayerIsCloseTo[3] = currentCellWalls[3];
	}
	else if(positionInCell.x + hitboxData.width/2 + amplifier > 1) {
		// player is close to right edge of the cell
		// => check if there is a wall there
		sidesThePlayerIsCloseTo.push(1);
		wallsThePlayerIsCloseTo[1] = currentCellWalls[1];
	}
	
	// separate if-else clause for top&bottom
	if(positionInCell.y - hitboxData.height/2 - amplifier < 0) {
		// player is close to top edge of cell
		// => check if there is a wall there
		sidesThePlayerIsCloseTo.push(0);
		wallsThePlayerIsCloseTo[0] = currentCellWalls[0];
	}
	else if(positionInCell.y + hitboxData.height/2 > 1) {
		// player is close to bottom edge of cell
		// => check if there is a wall there
		sidesThePlayerIsCloseTo.push(2);
		wallsThePlayerIsCloseTo[2] = currentCellWalls[2];
	}

	const playerNotByWalls = ! wallsThePlayerIsCloseTo.some(wall => {
		return wall === true;
	});
	if(playerNotByWalls && sidesThePlayerIsCloseTo.length === 2 /*===2*/) {
		// player's cell has no walls, now look at destination cell
		// the destination will always be diagonal otherwise the player's
		// cell would have had walls at the place the destination has walls
		
		// sidesThePlayerIsCloseTo will have at most 2 elmnts
		// use .some(..) to check if any of the sides the player is close to 
		// has a wall diagonally from it
		const playerCannotMoveThere = sidesThePlayerIsCloseTo.some(side => {
			// invert side to correspond to destination wall index
			const wallIndexToCheckOfDestination = side+2 < 4 ? side+2 : side-2;

			const movementX = sidesThePlayerIsCloseTo.includes(3) ? -1 
							: sidesThePlayerIsCloseTo.includes(1) ? 1 : 0;
			const movementY = sidesThePlayerIsCloseTo.includes(0) ? -1 
							: sidesThePlayerIsCloseTo.includes(2) ? 1 : 0;
			const destinationIndex = getIndexFromXY(col+movementX,row+movementY,cols);
			const destinationCell = grid[destinationIndex];

			if(destinationIndex < 0) {
				// destionation is outside grid, do not allow this.
				return true;
			}

			// now return true if a wall is blocking the path:
			return destinationCell.getWalls()[wallIndexToCheckOfDestination] === true;
		});

		if(playerCannotMoveThere) {
			// if the player is trying to move diagonally into a cell that has walls
			// at the corner the player is trying to enter it from, then
			// act as if the current cell has one of those walls which will cause
			// the player to slide down or across the outside of 
			// the destination cell instead of entering it.
			wallsThePlayerIsCloseTo[sidesThePlayerIsCloseTo[0]] = true;
		}
	}

	return wallsThePlayerIsCloseTo;
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




