import * as utils from "./helpingFuncs.js";
import Popup from "./popup.js";
import * as graphics from "./graphics.js";

export const ROWS = 5;
export const COLS = 5;
const MAX_PLAYERS_PER_ROOM = 5;
let stack = [];
export let GRID = [];
let cells;

let current;


// This will get the info about different maze blocks, which is kept in an external JSON file
let MAZE_BLOCKS;

export const GET_MAZE_BLOCKS = async () => {
	if(MAZE_BLOCKS) {return MAZE_BLOCKS;}
	const res = await get("./resources/blocks/blocks-data.json")
	MAZE_BLOCKS = JSON.parse(res);
	return MAZE_BLOCKS;
}


// -------------------------- METHOD ONE ----------------------------------

class Cell {
  constructor(x, y, walls, visited, neighbours) {
    this.x = x;
    this.y = y;
    this.walls = walls || [true, true, true, true];
    this.visited = visited || false;
    this.neighbours = neighbours || [];
  }
  findneighbours() {
  	1// The multiplicaation and addition finds the correct neighbour in the grid. This is because the cells are not organized in rows and columns, which is what I tried earlier, but simply from index 0 -> ROWS*COLS. This is easier to use I think.
  	if(this.x > 0) {
  		this.neighbours.push(GRID[(this.x-1)*COLS+this.y]);
  	}
  	if(this.y > 0) {
  		this.neighbours.push(GRID[(this.x*COLS)-1 + this.y]);
  	}
  	// there is one to the right
  	if(ROWS-1 > this.x) {
  		this.neighbours.push(GRID[(this.x+1)*COLS+this.y]);
  	}
  	if(COLS-1 > this.y) {
  		this.neighbours.push(GRID[(this.x*COLS)+this.y+1])
  	}
  }
  update() {
  	const borderDirecs = ["top", "right", "bottom", "left"];
  	this.walls.forEach((shouldThereBeAWall,i) => {
  		if(!shouldThereBeAWall) {
  			const myCell = cells[this.x*COLS + this.y];
  			myCell.style["border-"+borderDirecs[i]] = "none";
  			myCell.style["padding-" + borderDirecs[i]] = "2px";
  		}
  	});
  }
}

function createMazeRowAndColDivs() {
	document.createdCellElmnts = true;
	for (let y = 0; y < ROWS; y++) {
		let row = document.createElement("div");
		row.classList.add("row");
		document.body.appendChild(row);    
		for (let x = 0; x < COLS; x++) {
			let column = document.createElement("div");
			column.classList.add("cell");
			row.appendChild(column);
		}
	}
  cells = document.querySelectorAll(".cell");
}
function preDefineTheGrid() {
	for (let i = 0; i < ROWS; i++) {
		for (let j = 0; j < COLS; j++) {
			GRID.push(new Cell(i, j));
		}
	}
	for (let i = 0; i < ROWS; i++) {
		for (let j = 0; j < COLS; j++) {
			GRID[i * COLS + j].findneighbours();
		}
	}
	current = GRID[0];
}

async function destroyWalls(its=0) {
	// This function uses iterative (used to be recursive) backtracking to destroy certain walls.
	// These walls are the ones which prevent a cell from being visited.
	// This means that when this function runs, you will be able to visit
	// all cells from any other cell in the maze, which is what we need.
	// I got loads of pseudocode for similar algorithms and tried to implement them
	// from here https://en.wikipedia.org/wiki/Maze_generation_algorithm
	// Problem is, although this method is one of the faster ones, it will still run in
	// O(n) where n is the resolution or area of the maze, given by width x height
	let mustDoAgain = true;

	while(mustDoAgain) {
		for(let i = 0; i < ROWS; i++) {
			for(let j = 0; j < COLS; j++) {
				GRID[i * COLS + j].update();
			}
		}
		await (() => {
			return new Promise(done => {setTimeout(done, 1)});
		})();

		cells[current.x*COLS + current.y].style.background = "#afa";
		if(!current.visited) {
			// Add to visited stack and set as visited 
			// the stack is from the recursive backtracking on the wikipedia page
			stack.push(current);
			current.visited = true;
		}
		const unvisitedArr = [];
		current.neighbours.forEach(currentNeighbour => {
			if(!currentNeighbour.visited) {
				unvisitedArr.push(currentNeighbour);
			}
		});
		if(unvisitedArr.length > 0) {
			// Choose a random cell from the array of unvisited nodes
			const randPosition = Math.floor(Math.random()*unvisitedArr.length);
			let nextCellToProcess = unvisitedArr[randPosition];
			let curToRemove, nexToRemove;
			const gapInX = current.x - nextCellToProcess.x;
			if(gapInX === 1) { // Look here
				current.walls[0] = false;
				nextCellToProcess.walls[2] = false;
				// The two cells are one by the other in the x-axis, so to make a corridor 
				// we need to remove walls at index 0 and 2
			} else if(gapInX === -1) {
				current.walls[2] = false;
				nextCellToProcess.walls[0] = false;
			}

			const gapInY = current.y - nextCellToProcess.y;
			if(gapInY === 1) { // Look here
				//curToRemove = gapInY > 0 ? 3 : 1;
				//nexToRemove = curToRemove === 3 ? 1 : 3;
				current.walls[3] = false;
				nextCellToProcess.walls[1] = false;
				// The two cells are one by the other in the x-axis, so to make a corridor 
				// we need to remove walls at index 0 and 2
			} else if(gapInY === -1) {
				current.walls[1] = false;
				nextCellToProcess.walls[3] = false;
			}
			// Finally move on
			const f =cells[current.x*COLS + current.y];
			setTimeout(() => {f.style.background = "none";}, 150);
			current = nextCellToProcess;
			//setTimeout(() => {updateMaze()}, 0);
		} else if(stack.length) {
			const f =cells[current.x*COLS + current.y];
			setTimeout(() => {f.style.background = "none";}, 150);
			current = stack[stack.length-1];
			stack.splice(-1, 1);
			//setTimeout(() => {updateMaze()}, 0);
			// Set the last cell as the current one, 
			// and remove it from stack
		} else {
			// return;
			//clearInterval(wallBreaker);
			mustDoAgain = false;
			setTimeout(() => {mazeIsReady(GRID)}, 50); // Here I'm giving it 50ms so that it returns out of this function before calling mazeIsReady so the call stack does not increase unnecessarily. I don't know if this is the best way but it achieves this purpose.
			return;
			//mazeIsReady();
			/*if(its < 10) {
				setTimeout(() => {destroyWalls(its+1)}, 100);
				console.log("One more: " + its);
			} else {
				console.log("Done", its);
			}*/
			//return;
		}
	}
	// setTimeout(updateMaze, 100);
}

let wallBreaker;
/*function updateMaze() {
	//GRID.forEach(cell => {
	//	cell.update();
	//});

	// This just updates each cell so that it reflects its data inside the GRID array.
	// Ie, if it has no walls, the DOM element which corresponds to that cells will have
	// its walls removed.
	for(let i = 0; i < ROWS; i++) {
		for(let j = 0; j < COLS; j++) {
			GRID[i * COLS + j].update();
		}
	}
	// DomUpdateBody();
	destroyWalls();
}*/




// ----------------------------- METHOD TWO --------------------------
class Maze {
	// Class inside of maze, as these cells are specific for this maze, and there is already a cell class from the other maze.
    static Cell = class {
        constructor(x, y, left, above) {
            this.x = x;
            this.y = y;
            this.walls = [false, false, false, false];
            this.neighbours = [left ?? null, above ?? null, null, null];
            // Also set link in opposite direction
            if (left) left.neighbours[2] = this;
            if (above) above.neighbours[3] = this;
        }
        
        block(direction) { 
            // Place a wall by clearing neighbour link
            if (this.neighbours[direction]) this.neighbours[direction][direction ^ 2] = null;
            this.neighbours[direction] = null;
        }
    }
    
    constructor(mazeData) {
    	if(mazeData) {
    		this.maze = mazeData;
    		return;
    	}
        let above = [];
        this.maze = Array.from({length: ROWS}, (_, y) => {
            let left = null;
            return above = Array.from({length: COLS}, (_, x) => left = new Maze.Cell(x, y, left, above[x]));
        });
        this.recursiveDivision(0, 0, COLS, ROWS);
    }


    recursiveDivision(left, top, right, bottom, its=0) {
        const randInt = (min, max) => Math.floor(Math.random() * (max - min)) + min;

        const width = right - left;
        const height = bottom - top;

        if (width < 2 || height < 2) {
        	// This sector is small and cannot be divided any more.
        	// Keep the height at 3 so there is more room
        	return;
        };
        let choice = randInt(0, (width - 1) + (height - 1));
        if (choice >= width - 1) { // Place horizontal wall
            const y = top + choice - (width - 2);
            const gap = randInt(left, right);
            for (let x = left; x < right; x++) {
                if (x != gap) this.maze[y][x].block(1);
            }
            this.recursiveDivision(left, top, right, y, its+1);
            this.recursiveDivision(left, y, right, bottom, its+1);
        } else { // Place vertical wall
            const x = left + choice + 1;
            const gap = randInt(top, bottom);
            for (let y = top; y < bottom; y++) {
                if (y != gap) this.maze[y][x].block(0);
            }
            this.recursiveDivision(left, top, x, bottom, its+1);
            this.recursiveDivision(x, top, right, bottom, its+1);
        }
    }

    display() {
        const mazeContainer = document.getElementById("maze-container");
        mazeContainer.innerHTML = "";
        const container = document.createElement("div");
        container.className = "maze";
        for (const row of this.maze) {
            const rowDiv = document.createElement("div");
            for (const cell of row) {
                const cellDiv = document.createElement("div");
                
                //cellDiv.className = ["left", "top", "right", "bottom"].filter((_, i) => !cell.neighbours[i]).join(" ");
                // When there isn't a neighbour at that position (starting with left, then top etc) add the corresponding class
                // to the cell so that a border is shown on that side.
                cell.neighbours.forEach((neighbour, i) => {
                	if(!neighbour) {
                		cellDiv.classList.add(["left", "top", "right", "bottom"][i]);

                		// ["left", "top", "right", "bottom"]
                		// ["top", "right", "bottom", "left"]
                		i -= 1;
                		if(i === -1) {
                			i = 3;
                		}
                		cell.walls[i] = true;
                	}
                })
                rowDiv.appendChild(cellDiv);
            }
            container.appendChild(rowDiv);
        }
        mazeContainer.appendChild(container);
    }
}















function mazeIsReady(mazeData) {
	const nonCircularMazeData = JSON.decycle(mazeData);
	const stringMazeData = JSON.stringify(nonCircularMazeData);
	// console.log("Maze has been generated. \nTodo: \n - Room allocation in room.js or sm,\n - Player movement. Make smooth, use cellPlayerIsLeaving.walls to check if player can leave the current cell, and cellPlayerIsEntering.walls to check if player can enter the cell he is trying to enter.\n - Menu UI before joining a room. Room joining/creating will be automatic. User will choose gamemode (with/without enemies, with = green maze with more room, without = blue maze or green maze with less room (change the if(width == 2 || height == 3) to ...height == 2)), or random (join whichever has more players). The gamemodes will have a different url. Eg room 3 on with enemies will be jasonstorage.net/items/with-enemies-rm-3, vs .../items/no-enemies-rm-3.\n - Scroll to correct place when user moves thru the maze if it is too big.");
}









let mustGenerateNewMaze = undefined;

async function joinNextAvailableRoom() {
	// according to overflow data, allocate current player to the next non-full room.

	/*Todo:
		in the remote overflow.json file:
		{
			overflows: 5,
			lastPersonJoinedARoomAt: 13:01:00 O'clock
		}

		Here is the logic for joining a room and resetting the overflows:
		When a user tries to join a room, before joining it:
			See how many overflows there are.
			Compare lastPersonJoinedARoomAt to current time
			If a lot of time has passed: 
				Check if the last non-full room has any people in it still
				If it does:
					Join it
					update lastPersonJoinedARoomAt and overflows
				Else:
					Reset overflow data to 0
					Join room-0 (ie the first room)
					update lastPersonJoinedARoomAt only - NOT overflows
			Else:
				Join the last non-full room
				update lastPersonJoinedARoomAt and overflows
	*/

	let mazeDataFromRemoteRoom = "no-maze-data";
	const overflowdata = await utils.executeSQL(`SELECT * FROM OverflowsTable`, {dbName: "alphahow_database1"});
	console.log("Got overflowdata");
	if(! overflowdata.rows) {
		overflowdata.rows = [{Overflows: 0, timeLastPlayerJoinedARoom: 0}];
	}
	let calculatedRoomData = await calcNextFreeRoom({overflows: parseInt(overflowdata?.rows[0]?.Overflows), timeLastPlayerJoinedARoom: parseInt(overflowdata?.rows[0]?.timeLastPlayerJoinedARoom)});
	console.log("Got calculatedRoomData");


	const roomID = calculatedRoomData[0];
	mazeDataFromRemoteRoom = calculatedRoomData[1];
	/*console.log(calculatedRoomData[2].replace(/\\\\\\\"/g, "\\\""));
	console.log(calculatedRoomData[2].replace(/\\\\\\\"/g, "\\\"").replace(/(?<!\\)\"\"/g, "\"\\\"").replace(/\":/g, "\\\""));

	console.log(calculatedRoomData[2].replace(/\"\"\w+\"\:\"/g, mtch => {
		const mainWord = mtch.substring(2, mtch.indexOf(":")-1);
		return '\\\\"\\\\"' + mainWord + '\\\\":\\\\"';
	}));
	const decompressionDictionary = JSON.parse(calculatedRoomData[2].replace(/\"\"\w+\"\:\"/g, mtch => {
		const mainWord = mtch.substring(2, mtch.indexOf(":")-1);
		const refo = '\\\\"\\\\"' + mainWord + '\\\\":\\\\"';
		console.log(refo);
		return refo;
	}));*/


	
	/*const comresdic = JSON.parse(calculatedRoomData[2]);
	let uncomprestmazedatr = utils.decompress(calculatedRoomData[1], comresdic);
	uncomprestmazedatr = uncomprestmazedatr.replace(/\\\"\$/g, "\"\$").replace(/\\\\/g, "\\").replace(/\]\\/g, "]");
	uncomprestmazedatr = uncomprestmazedatr.substr(1,uncomprestmazedatr.length-2)

	const retrocycltmazedatr = JSON.retrocycle(JSON.parse(uncomprestmazedatr));*/

	// const retrocycletmazedatr = JSON.retrocycle(JSON.parse(uncomprestmazedatr));
	// console.log(retrocycletmazedatr);

	/*const uncompressedMazeData = utils.decompress(mazeDataFromRemoteRoom, decompressionDictionary);
	console.log(JSON.retrocycle(JSON.parse(uncompressedMazeData)));
	console.log(JSON.stringify(JSON.decycle(GRID)));


	console.log(JSON.retrocycle(uncompressedMazeData) === JSON.stringify(JSON.decycle(GRID)));*/



	/*
		const mazedatar = JSON.stringify(JSON.decycle(GRID));
		const comprestmazedatr = utils.compress(mazedatar);


		const uncompresstmazedatr = utils.decompress(comprestmazedatr[0], comprestmazedatr[1]);
		const retrocycledmazedatr = JSON.retrocycle(JSON.parse(uncompresstmazedatr));

		console.log(retrocycledmazedatr);
		
		For the absolute longest time I couldn't get the retrocycltmazedatr to work because the system implicitly changed its "stringiness" or something. Finally, even though i'm using a hacky method, i got it to retreive the correct maze-data from the sql server.
	*/


	const unescapedMazeData = unescape(mazeDataFromRemoteRoom);
	const decycledMazeData = JSON.parse(unescapedMazeData);
	const usableMazeData = JSON.retrocycle(decycledMazeData);

	GRID = usableMazeData;


	console.log("^^^ We got the remote maze data and turned it into an object format - it is no longer just a string!!!\nTodo - set the GRID variable equal to it and rebuild the maze according to this data. Maybe this is done, just check the code below this line.");
		

	/* // For testing/illustration purposes:
	if(!document.createdCellElmnts) {
		createMazeRowAndColDivs();
	}

	GRID.forEach((cell, i) => {
		// x, y, walls, visited, neighbours
		const currentCellInst = new Cell(cell.x, cell.y, cell.walls, false, cell.neighbours);
		GRID[i] = currentCellInst;
		currentCellInst.update();
	});*/

	// Yes, the grid in the html is being updated here. so that code is already done. But remember that the html is just
	// for testing. Later on a canvas will be used. Maybe that is the next thing todo?

	// Todo - See above comment.


	graphics.initiatePubnubConnection(roomID);
	graphics.drawCanvas();


	// Note - You dont need to make a way to leave a room as nobody else should join an old room anyway. just carry on incrementing the room ids.

}


async function calcNextFreeRoom(overflowData) {
	let overflows = overflowData?.overflows || 0;
	return new Promise(async (resolve, reject) => {
		let roomToJoin = (overflows || 0) + 1;

		let roomData = await utils.executeSQL(`SELECT joinedPlayerIDs,playerCount,mazeDataCompressed,mazeDataDictionary FROM Room WHERE RoomID = ${roomToJoin}`);
		if(roomData.rows) {
			roomData = roomData.rows[0];
		}
		const numOfPlayers = parseInt(roomData?.playerCount) || 0;
		if(numOfPlayers >= MAX_PLAYERS_PER_ROOM) {
			roomToJoin++;
			overflows++;
		}

		// Now update overflows table using updatedOverflowData
		const sql1 = await utils.executeSQL(`UPDATE OverflowsTable 
									SET Overflows = ${overflows}, 
										timeLastPlayerJoinedARoom = ${Math.trunc(new Date().getTime() / 60000)}`,
		{dbName: "alphahow_database1"});


		// First update this player's row in the User table so that it contains the room the player has joined in the joinedRoom field. 
		const sql2 = await utils.executeSQL(`UPDATE User 
									SET joinedRoomId = ${roomToJoin}
									WHERE UserID = ${parseInt(localStorage.getItem("loggedInUserId"))}`);

		// todo - update this room's row in the Room table so that its playerClunk field includes this player's id and playerCount is incremented, or add this row if it does not exist.
		let sql3;
		let mazeData;
		let mazeDataCompressed, mazeDataDictionary;
		if(parseInt(roomData?.playerCount) < 5) { // Room exists, update it
			console.log("Join existing room - update existing room.");
			sql3 = await utils.executeSQL(`UPDATE Room 
									SET joinedPlayerIDs = "${roomData.joinedPlayerIDs + "," + localStorage.getItem("loggedInUserId")}",
										playerCount = ${numOfPlayers + 1}
									WHERE RoomID = ${roomToJoin};`);	
			mazeDataCompressed = roomData.mazeDataCompressed;
			mazeDataDictionary = roomData.mazeDataDictionary;

			// For now, ignore the Dictionary variable. It is to do with decompressing the maze data. Will be done later. Todo. Instead of compressng the mazedata as is, first escape() it, then compress it when placing it into the room Table. Then when retreiving it (in this function) you must decompress it first, then unescape() it. Hint - maybe you could escape the compression dict before putting it inthe Room table

		} else { // Room does not exist, add it as a record
			console.log("Create new room");
			await generateMaze();
			//mazeData = utils.compress(JSON.stringify(JSON.decycle(GRID)));
			mazeData = [escape(JSON.stringify(JSON.decycle(GRID))), ""];
			mazeDataCompressed = mazeData[0];
			mazeDataDictionary = mazeData[1];

			console.log("Length of mazeData:", mazeDataCompressed.length);
			console.log("Todo - show a loading efect at this stage because uploading the mazedata may take a long time");

			//mazeDataDictionary = JSON.stringify(mazeDataDictionary);
			//mazeDataCompressed = JSON.stringify(mazeDataCompressed);


			const newRoomSqlString = `INSERT INTO Room
									(RoomID, mazeDataCompressed, mazeDataDictionary, playerCount, joinedPlayerIDs)
									VALUES (
									${roomToJoin},
									"${mazeDataCompressed}",
									"${mazeDataDictionary}",
									1,
									"${localStorage.getItem("loggedInUserId")}"
									);`;
			sql3 = await utils.executeSQL(newRoomSqlString);

			console.log("Inserted Row into table Room");
		}
		

		console.log("Next free room-id:", roomToJoin);
		resolve([roomToJoin, mazeDataCompressed, mazeDataDictionary]);
		
	});
}

// Todo - make the account system. When they create an acc, insert this data into the User table. When logging in, search by username.




/* Room-[].json keys: {playerCount}*/
/*overflowdata: {overflows, timeLastPlayerJoinedARoom}
timeLastPlayerJoinedARoom is given as minutes. So milliseconds / 60000
*/



async function generateMaze() {
	// To improve randomness, choose a random method to use when creating the maze.
	if(true) { // Uses "iterative backtracking" (before some fixes were made, it was recursive backtracking)
		//myMaze.print();
		createMazeRowAndColDivs();
		preDefineTheGrid();
		await destroyWalls();
		//wallBreaker = setInterval(updateMaze, 25);
		/*if(mazeDataFromRemoteRoom === "no-maze-data") {
			preDefineTheGrid();
			destroyWalls();
		} else {
			// maze already exists because we joined an existing room. Simply just update the cells one by one after we get the maze data.
			// here is an example maze data. Later on, we'll get it from the server.
			// todo - get the maze data from the server.
			const retrocycledMazeData = ...
			retrocycledMazeData.forEach((cell, cellIndex) => {
				GRID[cellIndex] = new Cell(cell.x, cell.y, cell.walls, cell.visited, cell.neighbours);
			});
			for(let i = 0; i < ROWS; i++) {
				for(let j = 0; j < COLS; j++) {
					GRID[i * COLS + j].update();
				}
			}
		}*/

	} else { // Uses recursive wall division method. Should theoretically be faster than the other one. But the latter
		// has a nice animation
		const theMaze = new Maze()
		theMaze.display();
		mazeIsReady(theMaze.maze);
	}
}


let joinedRoom;
async function getRoomOverflowData() {
	//return await get(........url.......);
}




function updateLoadingBar(progress) {
	const percentage = ~~(progress*100);
	
	document.getElementById("progress-hint").innerHTML = percentage + "%";
	document.getElementById("progress-bar").style.width = percentage + "%"


	if (progress === 1) {
		const progressContainer = document.getElementById("progress-container");

		const keyFrames = [{
			opacity: 0
		}];
		const animation = progressContainer.animate(keyFrames, {
			duration: 450,
			delay: 500
		});
		animation.addEventListener("finish", () => {
			progressContainer.style.display = "none";
		});
	}
}

function loadAssets() {
	utils.waitUntil(() => {
		return document.body.loaded;
	}).then(showMainMenu);


	let assetsLoaded = 0;

	const functionsWhichLoadAssets = [utils.loadStyles, utils.loadJs, GET_MAZE_BLOCKS, checkUserLoggedIn];
	const totalAssets = functionsWhichLoadAssets.length;
	for(let i = 0; i < totalAssets; i++) {
		const assetLoadingFunc = functionsWhichLoadAssets[i];
		assetLoadingFunc().then(res => {
			assetsLoaded += 1;
			updateLoadingBar(assetsLoaded/totalAssets);
		});
	}
}

 
async function checkUserLoggedIn() {
	await utils.waitUntil(() => {
		return window.$?.ajax != undefined;
	});
	// send req validate-jwt
	console.log(5051);
	const {success} = await $.ajax("https://shy-plum-bass-slip.cyclic.app/validate-jwt", {
		method: "POST",
		cache: false,
		data: {
			jwt: localStorage.getItem("jwt")
		}
	});

	if(success) {
		// the user is signed in, return from the func
		return true;
	}

	// if not signed in notify user ab this
	document.getElementById("sign-in-msg").classList.remove("hidden");
	return false;
}



let mainMenu;
window.addEventListener("load", () => {
	document.body.loaded = true;
	mainMenu = document.getElementById("main-menu");

	document.getElementById("settings-btn").addEventListener("click", settingsButtonClick);
	document.getElementById("account-btn").addEventListener("click", accountButtonClick);
	document.getElementById("join-room-btn").addEventListener("click", joinRoomButtonClick);
});
loadAssets();


function showMainMenu() {
	mainMenu.classList.remove("hidden");
}








const popup = new Popup();

async function joinRoomButtonClick() {
	mainMenu.classList.add("hidden");
	let shouldTryMatchmaking = await utils.internetConnection();
	const elmnt = document.createElement("div");
	while(!shouldTryMatchmaking) {
		const userResponse = await popup.fire("Looks like you're offline. Check your Internet connection and try again.", {
			title: "Aw snap!",
			confirm_button_text: "Retry",
			cancel_button_text: "Enter anyway"
		});
		shouldTryMatchmaking = !userResponse.value || await utils.internetConnection();
	}
	joinNextAvailableRoom();
}
function settingsButtonClick() {
	
}
function accountButtonClick() {
	location.assign("manage-account");
}



// https://rapidapi.com/collection/list-of-free-apis