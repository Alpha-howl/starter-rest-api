import * as game from "./game.js";

/*
For the 3d effect, sprites need to be "isometric". This means they are drawn from the front angle and span backward, getting smaller and smaller. This is much easier than making the game 3d which would be impossible to achieve by the deadline.
*/

const canvas = document.getElementById("canvas1");
const ctx = canvas.getContext("2d");
canvas.width = 1200;
canvas.height = 750;

const keys = []; // Stores the currently pressed arrow keys
const player = {
	x: 0,
	y: 0,
	width: 32, // Calculated from sprite sheet. Width=128px, 4 columns => 128/4 = 32px
	height: 48, // Same here
	frameX: 0,
	frameY: 0,
	speed: 9,
	moving: false
}
const playerSprite = new Image();
playerSprite.src = "./resources/players/stormtrooper.png";

let gridDrawingParamCache;


export async function drawCanvas() {
	// Data for maze is in variable game.GRID
	// Get sprites for walls and objects before 'clothing' the maze.
	// Then get sprites for players
  		
  	console.log("Drawing canvas...");
  	const blocks = await game.GET_MAZE_BLOCKS();
  	console.log("Got blocks metadata");

  	document.getElementById("canvas1").classList.remove("hidden");


  	backgroundImg = new Image();
  	backgroundImg.src = "./resources/background/mist forest.png";



  	wallScr = blocks[blocks.horizontalWalls[0]].src;
  	WallSprite = new Image();
  	WallSprite.src = wallScr;

  	gridDrawingParamCache = new Array(game.GRID.length);
  	await preLoadWalls();
  	animate();


  	// img, sX, sY, sW, sH, dX, dY, dW, dH



}
let wallScr, WallSprite, backgroundImg;

// This code is modular and procedural. Code in graphics.js is object oriented. Explain why.

async function animate() {
	// Draw background and player. This allows us to move the player without needing to delete the sprite each time - cuz the background will be placed on top and everything else including the old player sprite will be deleted.
	//ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);

	await drawWalls();
	drawSprite(playerSprite, 0, 0, player.width, player.height, 200, 150, player.width, player.height);
	

	// later on, use requestAnimationFrame
	//requestAnimationFrame(animate);
	setTimeout(animate, 3000);
}



async function preLoadWalls() {
	const blocks = await game.GET_MAZE_BLOCKS(); // The second time this is called it will already be cached by game.js so this is not a bad/inneficient line.
	// First the horizontal walls, left to right
	blocks.horizontalWalls.forEach(async wallName => {
		const img = new Image();
		/*await (async () => {
			return new Promise(resolve => {
				img.onload = resolve;
			});
		})();*/
		img.addEventListener("load", () => {
			img.setAttribute("loaded", "yes");
		});
		img.src = blocks[wallName].src;
		horizontalWalls.push(img);
	});


	// Now vertical walls
	blocks.verticalWalls.forEach(async wallName => {
		const img = new Image();
		img.addEventListener("load", () => {
			img.setAttribute("loaded", "yes");
		});
		img.src = blocks[wallName].src;
		verticalWalls.push(img);
	});

	// Finally, preload the floorboards:
	blocks.floors.forEach(async floorName => {
		const img = new Image();
		img.addEventListener("load", () => {
			img.setAttribute("loaded", "yes");
		});
		img.src = blocks[floorName].src;
		floors.push(img);
	});
}

function getRandHorizWallSprite() {
	return new Promise(async resolve => {
		const blocks = await game.GET_MAZE_BLOCKS(); // The second time this is called it will already be cached by game.js so this is not a bad/inneficient line.
		const randIndex = Math.floor(Math.random()*blocks.horizontalWalls.length);
		const spriteData = blocks[blocks.horizontalWalls[randIndex]];
		const correspondingImg = horizontalWalls[randIndex];
		
		// wait until image is loaded before returning. Otherwise we will get error when we try to draw it onto the canvas (Error: the HTMLImage object provided was in the "broken" state);
		if(correspondingImg.getAttribute("loaded") === "yes") {
			resolve([correspondingImg, spriteData]);
		}
		correspondingImg.addEventListener("load", () => {
			resolve([correspondingImg, spriteData])
		});
	});
}
function getRandVertWallSprite() {
	return new Promise(async resolve => {
		const blocks = await game.GET_MAZE_BLOCKS(); // The second time this is called it will already be cached by game.js so this is not a bad/inneficient line.
		const randIndex = Math.floor(Math.random()*blocks.verticalWalls.length);
		const spriteData = blocks[blocks.verticalWalls[randIndex]];
		const correspondingImg = verticalWalls[randIndex];
		
		// wait until image is loaded
		if(correspondingImg.getAttribute("loaded") === "yes") {
			resolve([correspondingImg, spriteData]);
		}
		correspondingImg.addEventListener("load", () => {
			resolve([correspondingImg, spriteData])
		});
	});
}
function getRandFloorSprite() {
	return new Promise(async resolve => {
		const blocks = await game.GET_MAZE_BLOCKS(); // The second time this is called it will already be cached by game.js so this is not a bad/inneficient line.
		const randIndex = Math.floor(Math.random()*blocks.floors.length);
		const spriteData = blocks[blocks.floors[randIndex]];
		const correspondingImg = floors[randIndex];
		
		// wait until image is loaded
		if(correspondingImg.getAttribute("loaded") === "yes") {
			resolve([correspondingImg, spriteData]);
		}
		correspondingImg.addEventListener("load", () => {
			resolve([correspondingImg, spriteData])
		});
	});
}

const horizontalWalls = [];
const verticalWalls = [];
const floors = [];

async function drawWalls() {
	const cellDimensions = calcCellDimensions(); // => [width, height]
	const blocks = await game.GET_MAZE_BLOCKS(); // The second time this is called it will already be cached by game.js so this is not a bad/inneficient line.
	game.GRID.forEach(async (cell, index) => {

		if(gridDrawingParamCache[index]) {

			for (const [img, sX, sY, sW, sH, dX, dY, dW, dH] of gridDrawingParamCache[index]) {
				drawSprite(img, sX, sY, sW, sH, dX, dY, dW, dH);
			}
			return;
		}


		// cell.walls => [top, right, bottom, left]; True = there is a wall


		// ALERT: cell.x and cell.y are swapped. x should be y and y should be x;

		const [x,y] = [cell.y, cell.x];





		// Here, we get a random pre-loaded wall. Each cell will have a different wall. For an even bigger variety we may eventually place these two lines inside the if-statements below, but this level of randomness will probably not be needed. If we do that, each wall - even for the same cell - will be different to the last.
		const [rndWallSpriteHoriz, rndWallSpriteDataHoriz] = await getRandHorizWallSprite();
		const [rndWallSpriteVert, rndWallSpriteDataVert] = await getRandVertWallSprite();
		const [rndFloorSprite, rndFloorData] = await getRandFloorSprite();



		/*
		i tried to create a new image() inside each if-statement spontaneously but the images were not showing on the canvas. I fially figured out that it was because they were not loading - they have to load first before they are drawn onto the canvas. This is why i created the verticalWalls and horizontalWalls arrays which preload the walls
		*/

		// this array will hold the parameters needed to draw all the walls on all sides of the current cell, and the floor of the cell. Later on in this procedure this array is used for two things: caching and actually drawing the wall.
		let paramSets = [];




		// First we will draw the floor of the current cell so that it doesn't delete the walls later:
		const paramsForFloor = [rndFloorSprite, /*sX*/rndFloorData.sheetStartX, rndFloorData.sheetStartY, rndFloorData.width, rndFloorData.height, x*cellDimensions, y*cellDimensions, cellDimensions, cellDimensions];
		paramSets.push(paramsForFloor);

		// Now that the floor is ready, calculate the walls' positions:
		// This if-statement just checks which side of the current cell the wall(s) should be on, and sets the wall-sprite's position and dimensions accordingly.
		if(cell.walls[0]) {
			// draw wall at top of this cell
			// ctx.drawImage(WallSprite, x*cellDimensions, y*cellDimensions, cellDimensions, cellDimensions/5);
			paramSets.push([rndWallSpriteHoriz, /*sX*/rndWallSpriteDataHoriz.sheetStartX, rndWallSpriteDataHoriz.sheetStartY, rndWallSpriteDataHoriz.width, rndWallSpriteDataHoriz.height, x*cellDimensions, y*cellDimensions, cellDimensions, cellDimensions/5]);
		}
		if(cell.walls[1]) {
			// Draw wall on right side
			paramSets.push([rndWallSpriteVert, /*sX*/rndWallSpriteDataVert.sheetStartX, rndWallSpriteDataVert.sheetStartY, rndWallSpriteDataVert.width, rndWallSpriteDataVert.height, x*cellDimensions + cellDimensions, y*cellDimensions, cellDimensions/5, cellDimensions]);
		}
		if(cell.walls[2]) {
			// Wall on bottom
			paramSets.push([rndWallSpriteHoriz, /*sX*/rndWallSpriteDataHoriz.sheetStartX, rndWallSpriteDataHoriz.sheetStartY, rndWallSpriteDataHoriz.width, rndWallSpriteDataHoriz.height, x*cellDimensions, y*cellDimensions + cellDimensions, cellDimensions, cellDimensions/5]);
		}
		if(cell.walls[3]) {
			// wall on left side
			paramSets.push([rndWallSpriteVert, /*sX*/rndWallSpriteDataVert.sheetStartX, rndWallSpriteDataVert.sheetStartY, rndWallSpriteDataVert.width, rndWallSpriteDataVert.height, x*cellDimensions, y*cellDimensions, cellDimensions/5, cellDimensions]);
		}



		// Now we actually take the parameters we just created and use them to draw all the sprites needed:
		for (const individualWallParams of paramSets) {
			drawSprite(...individualWallParams);
		}


		/* Now we cache these parameters because next time we want the same image to be used in the place of the current image.
		This is because first of all, it reduces the time complexity of this algorithm as many steps are skipped
		and second, if we didn't do this, then the walls will always transform into other walls because they are picked randomly. 
		Try it - comment out the line below: gridDrawingParamCache[index] = paramSets;
		*/
		gridDrawingParamCache[index] = paramSets;

		// Todo - add a bigger variety of vertical walls and floors (only change the json file by adding new pngs)
		// Todo - make this look better. For Each cell, before the wall is placed, add a floor tile and maybe some decorations.
	});
}


function calcCellDimensions() {
	// rows: game.ROWS, cols: game.COLS; this does not include the walls;
	

	return 120;

	// Todo - calc each cell's dimensions here. Then return. Currently returning 120px by 120px (default);
}







function drawSprite(img, sX, sY, sW, sH, dX, dY, dW, dH) {
	//playerSprite, 0, 0, player.width, player.height, 200, 150, player.width, player.height
	ctx.drawImage(img, sX, sY, sW, sH, dX, dY, dW, dH);
}




export function initiatePubnubConnection(joinedRoomId) {
	if(joinedRoomId === undefined) {
		console.error("error - could not initiate pubnub connection, no RoomID was specified. 1-2-3");
		return false;
	}
	const channelName = "maze-game-room-id-" + joinedRoomId;
	console.log("Pubnub should be set to",channelName);

	// Todo
}