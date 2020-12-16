import * as THREE from './libs/threejs/build/three.module.js';
import TWEEN from './libs/tween.esm.js'; // https://cdn.jsdelivr.net/npm/@tweenjs/tween.js@18.5.0/dist/tween.esm.js
import Stats from './libs/threejs/examples/jsm/libs/stats.module.js';
import { GUI } from './libs/threejs/examples/jsm/libs/dat.gui.module.js';
import { OrbitControls } from './libs/threejs/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from './libs/threejs/examples/jsm/loaders/GLTFLoader.js';
import { OutlineEffect } from './libs/threejs/examples/jsm/effects/OutlineEffect.js';

/*
TODO list:
	- improve initGUI function
*/

var scene, camera, listener, sound, backgroundSound, renderer, effect, clock, controls, stats, gltfLoader, audioLoader, gui;
var objectsTween;
var coinsTween;
var runTweens = [];
var waveTweens = [];
var helpers = [];

// Options
var options = {
	game: {
		  velocity: 300,
		  // spawn positions
		  zSpawn: -50,
		  zRemove: 70,
		  luigiZSpawn: 44.5,
		  objectsPosition: 0,
		  isPaused: true,
		  isGameStarted: false,
		  isGameEnded: false,
		  brickProbability: 0, // increments with time
	},
	objects: {
		x_prec_coin: 0,
		y_prec_coin: 0
	},
	colors: {
		skyColor: 'white', //0x009bdf,
		grassColor: 0x00ff00,
		brickColor: 0x9f4238,
	},
	camera: {
		fov: 60,				
	},		
	showCollisionBoxes: false,   
	showHelpers: false, // TODO onUpdate
	showFog: true,
	activateOrbitControls: false,
	showStats: false, // TODO onUpdate
	showGUI: false,	
};

var luigi = {
	// Model
	mesh: new THREE.Object3D(),
	bones: {
		left: {},
		right: {},
	},
	// Game state
	health: 3,
	coins: 0,
	// Params
	// velocity: 100,
	isJumping: false,
	isSliding: false,
	jumpTime: 250,
	jumpHeigth: 10,
	slideTime: 300,
	slideAngle: 80,
	positions: { 
		left: -5,
		right: 5,
		center: 0,
	},
};

const models = {
	luigi:    { url: './assets/characters/luigi/scene.gltf' },
	coin: 	  { url: './assets/items/coin/scene.gltf' },
	mushroom: { url: './assets/characters/mushroom/scene.gltf '},
	brick:    { url: './assets/items/brick/scene.gltf' },
};

const sounds = {
	background:  { url: './assets/sounds/background.weba' },
	pause : 	 { url: './assets/sounds/pause.wav' },
	jump : 		 { url: './assets/sounds/jump.wav' },
	stomp : 	 { url: './assets/sounds/stomp.wav' },
	oneup : 	 { url: './assets/sounds/1Up.wav' },
	coin: 		 { url: './assets/sounds/coin.wav' },
	damage: 	 { url: './assets/sounds/break_brick.wav' },
	gameover: 	 { url: './assets/sounds/game_over.wav' },
}

// Loading assets
var areModelsLoaded = false;
var areSoundsLoaded = false;

// Loading models
loadModels();
loadSounds();

function loadModels() {

	const modelsLoaderManager = new THREE.LoadingManager();
	modelsLoaderManager.onLoad = () => {

		areModelsLoaded = true;

		// hide the loading bar
		document.querySelector('#models_loading').hidden = true;

		if(areModelsLoaded & areSoundsLoaded) {
			init();
		}
	};

	const modelsProgressBar = document.querySelector('#models_progressbar');
	modelsLoaderManager.onProgress = (url, itemsLoaded, itemsTotal) => {
		console.log("Loading models... ", itemsLoaded / itemsTotal * 100, '%');
		modelsProgressBar.style.width = `${itemsLoaded / itemsTotal * 100 | 0}%`;
	};
	{
		const gltfLoader = new GLTFLoader(modelsLoaderManager);
		for (const model of Object.values(models)) {
			gltfLoader.load(model.url, (gltf) => {

				gltf.scene.traverse( function ( child ) {

					if ( child.isMesh ) {
						if( child.castShadow !== undefined ) {
							child.castShadow = true;
							child.receiveShadow = true;
						}
					}
			
				} );

				model.gltf = gltf.scene;

				//console.log("******* GLTF Loaded *******\n", dumpObject(model.gltf).join('\n'));
				
			});
		}
	} 
}

function loadSounds() {

	const soundsLoaderManager = new THREE.LoadingManager();
	soundsLoaderManager.onLoad = () => {

		areSoundsLoaded = true;

		// hide the loading bar
		document.querySelector('#sounds_loading').hidden = true;

		if(areModelsLoaded & areSoundsLoaded) {
			init();
		}
	};

	const modelsProgressBar = document.querySelector('#sounds_progressbar');
	soundsLoaderManager.onProgress = (url, itemsLoaded, itemsTotal) => {
		console.log("Loading sounds... ", itemsLoaded / itemsTotal * 100, '%');
		modelsProgressBar.style.width = `${itemsLoaded / itemsTotal * 100 | 0}%`;
	};
	{
		const audioLoader = new THREE.AudioLoader(soundsLoaderManager);
		for (const sound of Object.values(sounds)) {
			audioLoader.load( sound.url, function( buffer ) {
				
				sound.sound = buffer;

				console.log("Loaded ", buffer);
			});
		}
	} 
}

// HTML elements
const container = document.getElementById( 'container' );

// Geometry
const boxGeometry = new THREE.BoxGeometry( 1, 1, 1 );
// const boxWireframeGeometry = new THREE.WireframeGeometry( boxGeometry ); // TODO try

const boxMaterial = new THREE.MeshStandardMaterial( {color: 0xffffff} );
const boxCollisionMaterial = new THREE.MeshStandardMaterial( {color: 0xffffff, transparent: true, opacity: .2});

// Count frames
var frames = 0;

// Collisions
var playerCollisionBox;
var activeCollisionBoxes = []; // remove things when no more visible

var groupObjectsToMove;

function init(){
	
	document.getElementById("main_menu").hidden = false;

	camera = new THREE.PerspectiveCamera( options.camera.fov, window.innerWidth / window.innerHeight, 0.1, 300 );
	camera.position.z = 50;
	camera.position.y = 8.5;
	camera.lookAt(0, 1, 0);
	
	// create an AudioListener and add it to the camera
	listener = new THREE.AudioListener();
	camera.add( listener );

	// create a global audio source
	sound = new THREE.Audio( listener );
	backgroundSound = new THREE.Audio( listener );

	renderer = new THREE.WebGLRenderer( {antialias: true} );
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
	renderer.setPixelRatio(devicePixelRatio);
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.gammaFactor = 2.2;
	renderer.outputEncoding = THREE.sRGBEncoding;
	container.appendChild( renderer.domElement );

	clock = new THREE.Clock(false);

	if(options.activateOrbitControls) {
		controls = new OrbitControls( camera, renderer.domElement );
		controls.maxPolarAngle = 0.9 * Math.PI / 2;
		controls.enablePan = false;
		controls.enableZoom = true;
		controls.target.set( 0, 1, 0 );
		controls.update();
	}

	if(options.showStats) {
		stats = new Stats();
		container.appendChild( stats.dom );
	}
	
	audioLoader = new THREE.AudioLoader();

	initEventListeners();

	if(options.showGUI) initGUI();

	initScene();
	initLuigi();
	initGroupObjectsToMove();

	// Outline Effect
	effect = new OutlineEffect( renderer, {
				defaultThickness: 0.0025,
				defaultColor: [ 0, 0, 0 ],
				defaultAlpha: 0.5,
				defaultKeepAlive: true // keeps outline material in cache even if material is removed from scene
			} ); 

	luigi.mesh.rotation.y = degtorad(0);

	if(options.showHelpers) showHelpers();
	else hideHelpers();

	setLuigiInitialJoints();
	playWaveAnimation();

	animate();

}

// TODO
function initGUI() {

	gui = new GUI();

	var game = gui.addFolder('Game');
	game.add(options.game, 'isPaused', 0, false).listen();
	game.add(options.game, 'isGameEnded', 0, false).listen();
	game.add(options.game, 'velocity', 0.1, 1).listen();
	game.add(options.game, 'zSpawn', -100, 0).listen();
	// game.open();

	/*
	var cam = gui.addFolder('Camera');
	cam.add(options.camera, 'fov', 0, 110).listen();
	cam.open(); */

}

function initLuigi() {

	// console.log("DEBUG: initLuigi()");

	luigi.mesh = new THREE.Object3D();
	luigi.mesh.name = "Luigi";

	luigi.mesh.position.set(0, 0, options.game.luigiZSpawn);
	luigi.mesh.rotation.set(0, Math.PI, 0);

	let body = models.luigi.gltf.getObjectByName('RootNode');
	body.scale.set(.5, .5, .5);

	var dcube =  new THREE.Mesh(boxGeometry, boxCollisionMaterial);
	dcube.name = "playerCollisionBox"
	dcube.scale.set(2, 6.5, 2.5);
	dcube.position.set(0, 4, -1.5);
	dcube.visible = options.showCollisionBoxes;

	playerCollisionBox = dcube;

	luigi.mesh.add(body);
	luigi.mesh.add(playerCollisionBox);
	
	console.log("******* LUIGI *******\n", dumpObject(luigi.mesh).join('\n'));
	scene.add(luigi.mesh);

	initLuigiSkeleton();

}

function initCoin(pos_x = 0, pos_y = 0) {

	// console.log("DEBUG: initCoin(", pos_x, ")");

	var coin = new THREE.Object3D();
	coin.name = "Coin";

	let body = models.coin.gltf.clone();
	body.getObjectByName("Coin_CoinBlinn_0").material = new THREE.MeshStandardMaterial({color: 0xffda00, emissive: 0xffa800}); // TODO
	body.getObjectByName("Coin_CoinBlinn_0").material.roughness = 0.2;
	body.getObjectByName("Coin_CoinBlinn_0").material.metalness = 1;
	//console.log(body.getObjectByName("Coin_CoinBlinn_0").material);
	body.name = "body";
	body.getObjectByName("RootNode").position.y = 2.25;
	body.getObjectByName("RootNode").scale.set(4.5, 4.5, 4.5);

	// Create box to check collision with
	var ocube = makeObjectCollisionBox(); 

	coin.add(body);
	coin.add(ocube);

	coin.position.set( pos_x, pos_y, -groupObjectsToMove.position.z + options.game.zSpawn);

	// console.log("******* COIN *******\n", dumpObject(coin).join('\n'));
	groupObjectsToMove.add( coin );
}

function animateCoins() {
	
	// rotation loop around y

	var rotation = { y: 0 };
	coinsTween = new TWEEN.Tween(rotation)
	.to({ y: degtorad(360) }, 2500) 
	.easing(TWEEN.Easing.Linear.None)
	.onUpdate( () => { 
		
		// get all coins in scene
		let coins = [];
		groupObjectsToMove.traverse( function ( child ) {
			if ( child.name == "Coin" ) coins.push(child); 
		});
		coins.forEach( (object) => {
			let coin = object.getObjectByName("body");
			if(coin) coin.rotation.y = rotation.y; // update rotation
		});

	}	)
	.onComplete( () => { 
		animateCoins(); // restart
	} )
	.start();
}

function initBrick(pos_x = 0, pos_y = 0) {

	// console.log("DEBUG: initBrick(", pos_x, ")");

	var brick = new THREE.Object3D();
	brick.name = "Damage";

	let body = models.brick.gltf.clone();
	body.getObjectByName("Box005_03_-_Default_0").material = new THREE.MeshStandardMaterial({color: 0xad3b1b, emissive: 0x0}); // TODO
	body.getObjectByName("Box005_03_-_Default_0").material.roughness = 1;
	body.getObjectByName("Box005_03_-_Default_0").material.metalness = 0;
	//console.log(body.getObjectByName("Box005_03_-_Default_0").material);

	body.position.set(0, -0.9, -1);
	body.scale.set(0.0055, 0.0055, 0.0055);

	var ocube = makeObjectCollisionBox(); 
	
	brick.add(body);
	brick.add(ocube);

	brick.position.set( pos_x, pos_y, -groupObjectsToMove.position.z + options.game.zSpawn);

	// console.log("******* BRICK *******\n", dumpObject(brick).join('\n'));
	groupObjectsToMove.add( brick );
}

function init1Up(pos_x = 0, pos_y = 0) {

	// console.log("DEBUG: init1Up(", pos_x, ")");

	var mushroom = new THREE.Object3D();
	mushroom.name = "1Up";

	let body = models.mushroom.gltf.clone();
	body.position.y = 2.2;
	body.rotation.y = - Math.PI / 2;
	body.scale.set(2.25, 2.25, 2.25);

	var ocube = makeObjectCollisionBox(); 
	
	mushroom.add(body);
	mushroom.add(ocube);

	mushroom.position.set( pos_x, pos_y, -groupObjectsToMove.position.z + options.game.zSpawn);

	// console.log("******* 1UP *******\n", dumpObject(mushroom).join('\n'));
	groupObjectsToMove.add( mushroom );
}

function makeObjectCollisionBox() {

	let ocube = new THREE.Mesh(boxGeometry, boxCollisionMaterial);
	ocube.scale.set(5, 5, 5);
	ocube.position.set(0, 2.5, 0);
	ocube.name = "collisionBox";
	ocube.visible = options.showCollisionBoxes;
	return ocube;

}

function initScene() {

	scene = new THREE.Scene();

	scene.background = new THREE.Color( options.colors.skyColor );

	// FOG
	if(options.showFog) scene.fog = new THREE.Fog( options.colors.skyColor, 0.1, 130 );

	// GRID
	const size = 100;
	const divisions = 10;
	const gridHelper = new THREE.GridHelper( size, divisions );
	helpers.push(gridHelper);
	scene.add( gridHelper );
	
	// TERRAIN
	let geometry = new THREE.BoxGeometry( 1, 1, 1 );
	let material = new THREE.MeshStandardMaterial( {color: options.colors.grassColor} );
	let mesh = new THREE.Mesh( geometry, material );
	mesh.scale.set(15, 1, 150);
	mesh.position.y = -.5;
	//mesh.castShadow = true;
	mesh.receiveShadow = true;
	scene.add(mesh);

	// LIGHTS
	const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
	scene.add(ambientLight);

	const directLight = new THREE.DirectionalLight(0xffffff, 3, 100);
	directLight.position.set(0, 50, options.game.luigiZSpawn + 20);
	
	var directLightTargetObject = new THREE.Object3D();
	directLightTargetObject.position.set(0, 0, options.game.luigiZSpawn + 20);
	scene.add(directLightTargetObject);
	directLight.target = directLightTargetObject;
	
	directLight.castShadow = true;
	directLight.shadow.mapSize.width = 512;
	directLight.shadow.mapSize.height = 512;

	const d = 60;
	directLight.shadow.camera.left = -10;
	directLight.shadow.camera.right = 10;
	directLight.shadow.camera.top = 140;
	directLight.shadow.camera.bottom = 0;
	directLight.shadow.camera.near = 30;
	directLight.shadow.camera.far = 55;
	directLight.shadow.bias = 0.0009;

	scene.add(directLight);

	var shadowHelper = new THREE.CameraHelper( directLight.shadow.camera );
	helpers.push(shadowHelper);
	scene.add( shadowHelper );

	const directLightHelper = new THREE.DirectionalLightHelper( directLight, 10 );
	helpers.push(directLightHelper);
	scene.add(directLightHelper);

}

function initGroupObjectsToMove() {

	groupObjectsToMove = new THREE.Group();
	scene.add(groupObjectsToMove);

	const axesHelper = new THREE.AxesHelper(5);
	helpers.push(axesHelper);
	groupObjectsToMove.add(axesHelper);

}

function moveObjects() {
	
	// init tween
	var delta = { z: 0 };
	objectsTween = new TWEEN.Tween(delta)
	.to({ z: 10 }, options.game.velocity) 
	.easing(TWEEN.Easing.Linear.None)
	.onUpdate( 
				() => {
					groupObjectsToMove.position.z = options.game.objectsPosition + delta.z;
					
					removeOutdatedObjectes();
					detectCollisions();
				}
	).onComplete(
				() => {
					options.game.objectsPosition = groupObjectsToMove.position.z;
					spawnObjects();
					moveObjects();
				}
	).start();

}

function spawnObjects() {

	// console.log("DEBUG: spawnObjects()");

	let isPositionFree = [];
	for (let i = 0; i < 3; i ++) {
		let row = [];
		for (let j = 0; j < 3; j++) {
			row.push(true);
		}
		isPositionFree.push(row);
	}
	isPositionFree[1][2] = false; // don't place objects too close to the camera

	let p;

	// COIN (at least one per row)
	p = Math.random();
	if (p > 0.4) {

		let x_new_coin;
		let y_new_coin;

		p = Math.random();
		if(p <= 0.5) x_new_coin = options.objects.x_prec_coin;
		if(p > 0.5) {
			if(options.objects.x_prec_coin == 0) {
				let offset = Math.round(Math.random());
				if(offset == 0) offset = -1;
				x_new_coin = options.objects.x_prec_coin + offset * 5;
			}
			if(options.objects.x_prec_coin == -5) {
				x_new_coin = options.objects.x_prec_coin + 5;
			}
			if(options.objects.x_prec_coin == 5) {
				x_new_coin = options.objects.x_prec_coin - 5;
			}
		}

		p = Math.random();
		if(p <= 0.5) y_new_coin = options.objects.y_prec_coin;
		if(p > 0.5) {
			if(options.objects.y_prec_coin == 0) {
				y_new_coin = options.objects.y_prec_coin + 5;
			}
			if(options.objects.y_prec_coin == 5) {
				let offset = Math.round(Math.random()); 
				if(offset == 0) offset = -1; // -1 if round(p) = 0, 1 otherwise
				y_new_coin = options.objects.y_prec_coin + offset * 5;
			}
			if(options.objects.y_prec_coin == 10) {
				y_new_coin = options.objects.y_prec_coin - 5;
			}
		}

		let positionIndices = getPositionIndices(x_new_coin, y_new_coin);
		if(isPositionFree[ positionIndices[0] ][ positionIndices[1] ]) {
			
			isPositionFree[ positionIndices[0] ][ positionIndices[1] ] = false;

			options.objects.x_prec_coin = x_new_coin;
			options.objects.y_prec_coin = y_new_coin;

			initCoin(x_new_coin, y_new_coin);
		}
	}

	// 1UP
	if(luigi.health < 3) {
		p = Math.random();
		if( p < 0.025 ) {

			let x_new_oneup = (Math.floor(Math.random() * 3) - 1) * 5;
			let y_new_oneup = 0; //(Math.floor(Math.random() * 2)) * 5;
			let positionIndices = getPositionIndices(x_new_oneup, y_new_oneup);
			let i = positionIndices[0];
			let j = positionIndices[1];
			if(isPositionFree[i][j]) {
				isPositionFree[i][j] = false;
				init1Up(x_new_oneup, y_new_oneup);
			}
		}
	}

	// BRICKS

	for(let i = 0; i < 3; i ++) {
		for(let j = 0; j < 3; j ++) {
			p = Math.random();
			if( p < options.game.brickProbability ) {
				let x_new_brick = (i - 1) * 5; //(Math.floor(Math.random() * 3) - 1) * 5;
				let y_new_brick = j * 5; //(Math.floor(Math.random() * 2)) * 5;
				if(isPositionFree[i][j]) {
					isPositionFree[i][j] = false;
					initBrick(x_new_brick, y_new_brick);
				}
			}
		}
	}

	// increase brick probability with time (increases difficulty)
	// max probability = 0.15
	if( options.game.brickProbability < 0.12 ) options.game.brickProbability += 0.001;

}

function getPositionIndices(x_position, y_position) {

	var index_x, index_y;
	if(x_position == -5) index_x = 0;
	if(x_position == 0) index_x = 1;
	if(x_position == 5) index_x = 2;
	if(y_position == 0) index_y = 0;
	if(y_position == 5) index_y = 1;
	if(y_position == 10) index_y = 2;
	return [index_x, index_y];

}

function moveLuigiTo( target_position ) {
	
	// console.log("DEBUG: moveLuigiTo(", target_position, ")");
	
	// animated movement
	var position = { x: luigi.mesh.position.x }; // Start at (0, 0)
	var tween = new TWEEN.Tween(position)
		.to({ x: target_position }, 100)
		.easing(TWEEN.Easing.Quadratic.Out)
		.onUpdate( 
					() => {
						luigi.mesh.position.x = position.x;
					}
		);

	tween.start();

}

function moveLeft() {

	// console.log("DEBUG: moveLeft()");

	if(options.game.isPaused) return;

	//if(luigi.isJumping || luigi.isSliding) return;

	// if at the right position (position.x == rightPosition): moveLuigiTo(centerPosition)
	if(luigi.mesh.position.x == luigi.positions.right) {
		moveLuigiTo(luigi.positions.center);
		return;
	}

	// if already at left position  (position.x == leftPosition) : return
	if(luigi.mesh.position.x == luigi.positions.left) return;

	moveLuigiTo(luigi.positions.left);
}

function moveRight() {

	// console.log("DEBUG: moveRight()");

	if(options.game.isPaused) return;

	//if(luigi.isJumping || luigi.isSliding) return;

	// if at the left position : moveLuigiTo(centerPosition)
	if(luigi.mesh.position.x == luigi.positions.left) {
		moveLuigiTo(luigi.positions.center);
		return;
	}

	// if already at right position : return
	if(luigi.mesh.position.x == luigi.positions.right) return;

	moveLuigiTo(luigi.positions.right);
}

function slide() {

	// console.log("DEBUG: slide()");

	if(options.game.isPaused) return;

	if(luigi.isSliding || luigi.isJumping) return;

	// if already sliding: return
	startSliding();
}

function startSliding() {

	// console.log("DEBUG: startSliding()");

	pauseTweens(runTweens);

	luigi.isSliding = true;
	playSlideAnimation();
	playSlideSound();
}

function endSliding() {

	// console.log("DEBUG: endSliding()");

	luigi.isSliding = false;

	setLuigiInitialJoints();
	resumeTweens(runTweens);
}

function jump() {

	// console.log("DEBUG: jump()");

	if(options.game.isPaused) return;

	if(luigi.isJumping || luigi.isSliding) return;

	// if already jumping: return
	startJumping();
}

function startJumping() {

	// console.log("DEBUG: startJumping()");

	pauseTweens(runTweens);

	luigi.isJumping = true;
	playJumpAnimation();
	playJumpSound();
}

function endJumping() {

	// console.log("DEBUG: endJumping()");

	luigi.isJumping = false;

	setLuigiInitialJoints();
	resumeTweens(runTweens);
}

function addCoin() {

	// console.log("DEBUG: addCoin()");

	luigi.coins += 1;
	playCoinSound();

}

function addHealth() {

	// console.log("DEBUG: addHealth()");

	if(luigi.health < 3) {
		luigi.health += 1;
		play1UpSound();
		return true;
	}

	return false;
}

function addDamage() {

	// console.log("DEBUG: addDamage()");
	
	if(luigi.health > 0) {
		luigi.health -= 1;
		playDamageSound();
	}
	
	if(luigi.health <= 0) {
		gameOver();
	}
}

function gameOver() {

	// console.log("DEBUG: gameOver()");

	document.getElementById("game_over").hidden = false;

	options.game.isGameEnded = true;
	options.game.isPaused = true;

	backgroundSound.pause();
	playGameOverSound();
}

function startGame() {

	// console.log("DEBUG: startGame()");

	document.getElementById("main_menu").hidden = true;
	document.getElementById("scores_box").hidden = false;

	options.game.isGameStarted = true;
	options.game.isPaused = false;

	clock.start();

	camera.position.z = 70;
	camera.position.y = 15;
	camera.updateProjectionMatrix();

	playStartGameAnimation();

	moveObjects();
	animateCoins();

	playBackgroundMusic();

}

function updateGUIScores() {

	let time = Math.floor(clock.getElapsedTime().toFixed(0) / 60) + ":" + clock.getElapsedTime().toFixed(0) % 60;
	document.getElementById( 'health' ).innerHTML = luigi.health;
	document.getElementById( 'coins' ).innerHTML =  luigi.coins;
	document.getElementById( 'time' ).innerHTML =  time;
}

function removeOutdatedObjectes() {

	// Check childs of gropObjects to move to see if there is something to remove
	let objectsToRemove = [];

	groupObjectsToMove.traverse( function ( child ) {

		if ( child.isMesh ) {

			if(child.parent.name == "Coin" || child.parent.name == "Damage" || child.parent.name == "1Up") {

				let object = child.parent;
				let objectWorldPosition = groupObjectsToMove.position.z + object.position.z; 
				if(objectWorldPosition > options.game.zRemove) {
					objectsToRemove.push(object);
				}
					
			}
		}
	});

	objectsToRemove.forEach( (object) => {
		groupObjectsToMove.remove(object);
	});

}

function detectCollisions() {

	// console.log("DEBUG: detectCollisions()");

	activeCollisionBoxes = []
	// Get active collision boxes in scene to be checked
	groupObjectsToMove.traverse( function ( child ) {

		if ( child.isMesh ) {
			let collisionBox = child.getObjectByName("collisionBox");
			if (collisionBox) activeCollisionBoxes.push(collisionBox);
		}
	});
	
	activeCollisionBoxes.forEach(detectCollision);

}

// Create ray caster
var rcaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));

function detectCollision(collisionBox) {

	// console.log("DEBUG: detectCollision(", collisionBox, ")");

	// for each vertex of the playerCollisionBox 
	let verticesIndices = [1, 3, 4, 6, -1] // only vertices from the back of the collision box
	for(var i = 0; i < verticesIndices.length; i++){   

		let origin = new THREE.Vector3();
		let direction = new THREE.Vector3(0, 0, -1);

		if(verticesIndices[i] == -1) {
			// raycast from center of playerCollisionBox
			origin = luigi.mesh.localToWorld(playerCollisionBox.position.clone());
			origin.z += 1;
		}
		else {
			// raycast from vertex of playerCollisionBox
			let vertexLocalPosition = new THREE.Vector3();
			vertexLocalPosition.multiplyVectors( playerCollisionBox.geometry.vertices[ verticesIndices[i] ].clone(), playerCollisionBox.scale );
			vertexLocalPosition.x += playerCollisionBox.position.x;
			vertexLocalPosition.y += playerCollisionBox.position.y;
			vertexLocalPosition.z += playerCollisionBox.position.z;

			origin = luigi.mesh.localToWorld(vertexLocalPosition);
		}

		let rcaster = new THREE.Raycaster(origin, direction.normalize());
		
		// visualize raycast
		/*
		let distance = 2; // at what distance to determine endpoint
		let endpoint = new THREE.Vector3();
		endpoint.addVectors( origin, direction.multiplyScalar( distance ) );
		let geometry = new THREE.Geometry();
		geometry.vertices.push( origin );
		geometry.vertices.push( endpoint );
		let material = new THREE.LineBasicMaterial( { color : 0xff0000 } );
		let line = new THREE.Line( geometry, material );
		scene.add( line );
		*/
			
		// Get collision result
		var hitResult = rcaster.intersectObject(collisionBox);
		if(hitResult.length > 0) {
			handleObjectCollision(collisionBox, hitResult[0].distance);
			break;
		}
	} 
}

function handleObjectCollision(collisionBox, hitDistance) {

	// console.log("DEBUG: handleObjectCollision(", collisionBox.parent.name, ")");

	// get object name
	let object_name = collisionBox.parent.name;

	// handle collisions based on object type
	switch(object_name){
		case 'Coin':
			if( hitDistance <= 4 ) {
				addCoin();
				groupObjectsToMove.remove(collisionBox.parent);
			}
			break;
		case '1Up':
			if ( hitDistance <= 4 ) {
				if(addHealth()) groupObjectsToMove.remove(collisionBox.parent);
			}
			break;
		case 'Damage':
			if ( hitDistance >= 1 && hitDistance <= 2 ) {
				addDamage();
				if(!options.game.isGameEnded) groupObjectsToMove.remove(collisionBox.parent);
			}
			break;
	}
}

function initLuigiSkeleton() {

	// console.log("DEBUG: initLuigiSkeleton()");

	// Traverse model and reference bones of interest
	luigi.mesh.traverse( o => {
		
		// Reference the neck and waist bones
		if (o.isBone && o.name === 'L_clavicle_023') { 
			luigi.bones.left.clavicle = o;
		}
		if (o.isBone && o.name === 'R_clavicle_040') { 
			luigi.bones.right.clavicle = o;
		} 
		if (o.isBone && o.name === 'L_upperarm_024') { 
			luigi.bones.left.upperarm = o;
		} 
		if (o.isBone && o.name === 'R_upperarm_041') { 
			luigi.bones.right.upperarm = o;
		} 
		if (o.isBone && o.name === 'L_forearm_025') { 
			luigi.bones.left.forearm = o;
		} 
		if (o.isBone && o.name === 'R_forearm_042') { 
			luigi.bones.right.forearm = o;
		}
		if (o.isBone && o.name === 'L_thigh_057') { 
			luigi.bones.left.thigh = o;
		} 
		if (o.isBone && o.name === 'R_thigh_062') { 
			luigi.bones.right.thigh = o;
		}
		if (o.isBone && o.name === 'L_calf_058') { 
			luigi.bones.left.knee = o;
		} 
		if (o.isBone && o.name === 'R_calf_063') { 
			luigi.bones.right.knee = o;
		}
		if (o.isBone && o.name === 'pelvis_03') { 
			luigi.bones.pelvis = o;
		} 
		if (o.isBone && o.name === 'spine00_04') { 
			luigi.bones.spine = o;
		} 
		if (o.isBone && o.name === 'head_05') { 
			luigi.bones.head = o;
		}


	} );

}

function playWaveAnimation() {

	// upperarm
	luigi.bones.left.upperarm.rotation.set(degtorad(0), degtorad(-45), degtorad(0));
	// forearm
	luigi.bones.left.forearm.rotation.set(degtorad(-20), degtorad(-45), degtorad(0));

	// TWEEN Loop: from -100 to -130 and viceversa 
	var rotation_up = { z: 100 };
	var tween_up = new TWEEN.Tween(rotation_up)
	.to({ z: 130 }, 200) 
	.easing(TWEEN.Easing.Quadratic.Out)
	.onUpdate( 
				() => {
					luigi.bones.left.clavicle.rotation.z = degtorad( -rotation_up.z );
				}
	);

	var rotation_down = { z: 130 };
	var tween_down = new TWEEN.Tween(rotation_down)
	.to({ z: 100 }, 200) 
	.easing(TWEEN.Easing.Quadratic.Out)
	.onUpdate( 
				() => {
					luigi.bones.left.clavicle.rotation.z = degtorad( -rotation_down.z );
				}
	);

	tween_up.onComplete( () => { tween_down.start(); } );
	tween_down.onComplete( () => { tween_up.start(); } );
	
	tween_up.start();

	waveTweens.push(tween_up);
	waveTweens.push(tween_down);

}

function playRunAnimation() {

	setLuigiInitialJoints();

	let step_time = 220;

	// LEGS 

	let thigh_max_angle = 45;
	let knee_max_angle = 40;

	// thigh
	luigi.bones.left.thigh.rotation.set(degtorad(0), degtorad(0), degtorad(-2.5)); 
	luigi.bones.right.thigh.rotation.set(degtorad(0), degtorad(0), degtorad(-2.5)); 
	// knee
	luigi.bones.left.knee.rotation.set(degtorad(0), degtorad(0), degtorad(0));
	luigi.bones.right.knee.rotation.set(degtorad(knee_max_angle), degtorad(0), degtorad(0)); 
	
	var thigh_start = { x: - thigh_max_angle, y: 0, z: 0 };
	var thigh_tween_start_step = new TWEEN.Tween(thigh_start)
	.to({ x: thigh_max_angle, y: 0, z: 0 }, step_time) 
	.easing(TWEEN.Easing.Quadratic.Out)
	.onUpdate( 
				() => {
					luigi.bones.left.thigh.rotation.x = degtorad( 180 - thigh_start.x ); // forward
					luigi.bones.right.thigh.rotation.x = degtorad( thigh_start.x ); // backward
				}
	);

	var thigh_end = { x: - thigh_max_angle, y: 0, z: 0 };
	var thigh_tween_end_step = new TWEEN.Tween(thigh_end)
	.to({ x: thigh_max_angle, y: 0, z: 0 }, step_time) 
	.easing(TWEEN.Easing.Quadratic.Out)
	.onUpdate( 
				() => {
					luigi.bones.left.thigh.rotation.x = degtorad( 180 + thigh_end.x ); // backward
					luigi.bones.right.thigh.rotation.x = degtorad( - thigh_end.x ); // forward
				}
	);

	var knee_start = { x: 0, y: 0, z: 0 };
	var knee_tween_start_step = new TWEEN.Tween(knee_start)
	.to({ x: knee_max_angle, y: 0, z: 0 }, step_time) 
	.easing(TWEEN.Easing.Quadratic.Out)
	.onUpdate( 
				() => {
					luigi.bones.left.knee.rotation.x = degtorad( knee_start.x ); // forward
					luigi.bones.right.knee.rotation.x = degtorad( knee_max_angle - knee_start.x ); // backward
				}
	);

	var knee_end = { x: 0, y: 0, z: 0 };
	var knee_tween_end_step = new TWEEN.Tween(knee_end)
	.to({ x: knee_max_angle, y: 0, z: 0 }, step_time) 
	.easing(TWEEN.Easing.Quadratic.Out)
	.onUpdate( 
				() => {
					luigi.bones.left.knee.rotation.x = degtorad( knee_max_angle - knee_end.x ); // forward
					luigi.bones.right.knee.rotation.x = degtorad( knee_end.x ); // backward
				}
	);

	// ARMS

	// clavicle
	luigi.bones.left.clavicle.rotation.z = degtorad(-85);
	luigi.bones.right.clavicle.rotation.z = degtorad(-85);
	// upperarm
	luigi.bones.left.upperarm.rotation.set(degtorad(0), degtorad(-60), degtorad(50)); // y = 60, -60 , z = 50 
	luigi.bones.right.upperarm.rotation.set(degtorad(0), degtorad(60), degtorad(50)); // y = -60, 60 , z = 50 
	// forearm
	luigi.bones.left.forearm.rotation.set(degtorad(0), degtorad(0), degtorad(15));
	luigi.bones.right.forearm.rotation.set(degtorad(0), degtorad(0), degtorad(15));

	var upperarm_start = { x: 0, y: -70, z: 0 };
	var upperarm_tween_start_step = new TWEEN.Tween(upperarm_start)
	.to({ x: 0, y: 70, z: 0 }, step_time) 
	.easing(TWEEN.Easing.Quadratic.Out)
	.onUpdate( 
				() => {
					luigi.bones.left.upperarm.rotation.y = degtorad( -upperarm_start.y ); // forward
					luigi.bones.right.upperarm.rotation.y = degtorad( upperarm_start.y ); // backward
				}
	);

	var upperarm_end = { x: 0, y: -70, z: 0 };
	var upperarm_tween_end_step = new TWEEN.Tween(upperarm_end)
	.to({ x: 0, y: 70, z: 0 }, step_time) 
	.easing(TWEEN.Easing.Quadratic.Out)
	.onUpdate( 
				() => {
					luigi.bones.left.upperarm.rotation.y = degtorad( upperarm_end.y ); // backward
					luigi.bones.right.upperarm.rotation.y = degtorad( -upperarm_end.y ); // forward
				}
	);

	// START

	thigh_tween_start_step.onComplete( () => { 
		thigh_tween_end_step.start();
		upperarm_tween_start_step.start(); 
	} );
	thigh_tween_end_step.onComplete( () => { thigh_tween_start_step.start(); } );

	knee_tween_start_step.onComplete( () => { knee_tween_end_step.start(); } );
	knee_tween_end_step.onComplete( () => { knee_tween_start_step.start(); } );

	upperarm_tween_start_step.onComplete( () => { upperarm_tween_end_step.start(); } );
	upperarm_tween_end_step.onComplete( () => { upperarm_tween_start_step.start(); } );
	
	thigh_tween_start_step.start();
	knee_tween_end_step.start();

	runTweens.push(thigh_tween_start_step);
	runTweens.push(thigh_tween_end_step);
	
	runTweens.push(knee_tween_start_step);
	runTweens.push(knee_tween_end_step);

	runTweens.push(upperarm_tween_start_step);
	runTweens.push(upperarm_tween_end_step);

}

function setLuigiInitialJoints() {

	// console.log("DEBUG: setLuigiInitialJoints()");

	// clavicle
	luigi.bones.left.clavicle.rotation.set(degtorad(180), degtorad(0), degtorad(-85));
	luigi.bones.right.clavicle.rotation.set(degtorad(0), degtorad(0), degtorad(-85));
	// upperarm
	luigi.bones.left.upperarm.rotation.set(degtorad(0), degtorad(0), degtorad(55));
	luigi.bones.right.upperarm.rotation.set(degtorad(0), degtorad(0), degtorad(55));
	// forearm
	luigi.bones.left.forearm.rotation.set(degtorad(0), degtorad(0), degtorad(0));
	luigi.bones.right.forearm.rotation.set(degtorad(0), degtorad(0), degtorad(0));
	// thigh
	luigi.bones.left.thigh.rotation.set(degtorad(180), degtorad(0), degtorad(-2.5));
	luigi.bones.right.thigh.rotation.set(degtorad(0), degtorad(0), degtorad(-2.5));
	// knee
	luigi.bones.left.knee.rotation.set(degtorad(0), degtorad(0), degtorad(0));
	luigi.bones.right.knee.rotation.set(degtorad(0), degtorad(0), degtorad(0));
	// spine
	luigi.bones.spine.rotation.x = degtorad(-10);
	// head
	luigi.bones.head.rotation.x = degtorad(-5);
	// pelvis
	luigi.bones.pelvis.rotation.x = degtorad(0);

/*
	// initial, static Luigi pose

	// clavicle
	luigi.bones.left.clavicle.rotation.set(degtorad(0), degtorad(0), degtorad(-85));
	luigi.bones.right.clavicle.rotation.set(degtorad(0), degtorad(0), degtorad(-85));
	// upperarm
	luigi.bones.left.upperarm.rotation.set(degtorad(0), degtorad(180), degtorad(55));
	luigi.bones.right.upperarm.rotation.set(degtorad(0), degtorad(0), degtorad(55));
	// forearm
	luigi.bones.left.forearm.rotation.set(degtorad(0), degtorad(0), degtorad(0));
	luigi.bones.right.forearm.rotation.set(degtorad(0), degtorad(0), degtorad(0));

	// knee
	//luigi.bones.left.knee.rotation.set(degtorad(0), degtorad(0), degtorad(0));
	//luigi.bones.right.knee.rotation.set(degtorad(0), degtorad(0), degtorad(0));
	// spine
	luigi.bones.spine.rotation.x = degtorad(-10);
	// head
	luigi.bones.head.rotation.x = degtorad(-5);
	// pelvis
	luigi.bones.pelvis.rotation.x = degtorad(0);
	*/
}

function playStartGameAnimation() {

	stopTweens(waveTweens);

	playRunAnimation();

	// rotate of - 2 pi around y
	var rotation = { y: luigi.mesh.rotation.y }; 
	var tween = new TWEEN.Tween(rotation)
	.to({ y: Math.PI }, 200) 
	.easing(TWEEN.Easing.Linear.None)
	.onUpdate( 
				() => {
					luigi.mesh.rotation.y = rotation.y;
				}
	)
	.start();

}

function playJumpAnimation() {

	// upperarm
	luigi.bones.left.upperarm.rotation.set(degtorad(0), degtorad(55), degtorad(55));
	luigi.bones.right.upperarm.rotation.set(degtorad(0), degtorad(55), degtorad(55));
	// thigh
	luigi.bones.left.thigh.rotation.set(degtorad(180), degtorad(0), degtorad(-6));
	luigi.bones.right.thigh.rotation.set(degtorad(0), degtorad(0), degtorad(-6));
	// knee
	luigi.bones.left.knee.rotation.set(degtorad(90), degtorad(0), degtorad(0));
	luigi.bones.right.knee.rotation.set(degtorad(90), degtorad(0), degtorad(0));
	// head
	luigi.bones.head.rotation.x = degtorad(-20);
	
	// animated movement
	var position = { y: luigi.mesh.position.y }; 

	var tween_start_jumping = new TWEEN.Tween(position)
		.to({ y: luigi.jumpHeigth }, luigi.jumpTime) 
		.easing(TWEEN.Easing.Exponential.Out)
		.onUpdate( () => { luigi.mesh.position.y = position.y; } );

	var tween_end_jumping = new TWEEN.Tween(position)
		.to({ y: 0 }, luigi.jumpTime) 
		.easing(TWEEN.Easing.Exponential.In)
		.onUpdate( () => { luigi.mesh.position.y = position.y; } );

	tween_start_jumping.onComplete( () => {
								tween_end_jumping.start();
						      }
	);

	tween_end_jumping.onComplete( () => {
									endJumping();
								}
	);

	tween_start_jumping.start();

}

function playSlideAnimation() {

	luigi.bones.pelvis.position.z = 0.1;

	// clavicle
	luigi.bones.left.clavicle.rotation.set(degtorad(0), degtorad(0), degtorad(-85));
	luigi.bones.right.clavicle.rotation.set(degtorad(0), degtorad(0), degtorad(-85));
	// upperarm
	luigi.bones.left.upperarm.rotation.set(degtorad(0), degtorad(180), degtorad(70));
	luigi.bones.right.upperarm.rotation.set(degtorad(0), degtorad(0), degtorad(60));
	// forearm
	luigi.bones.left.forearm.rotation.set(degtorad(-30), degtorad(45), degtorad(0));
	luigi.bones.right.forearm.rotation.set(degtorad(-30), degtorad(45), degtorad(0));

	// thigh
	luigi.bones.left.thigh.rotation.set(degtorad(135), degtorad(0), degtorad(-2.5));
	luigi.bones.right.thigh.rotation.set(degtorad(-45), degtorad(0), degtorad(-2.5));
	// knee
	luigi.bones.left.knee.rotation.set(degtorad(90), degtorad(0), degtorad(0));
	luigi.bones.right.knee.rotation.set(degtorad(90), degtorad(0), degtorad(0));
	// spine
	luigi.bones.spine.rotation.x = degtorad(45);
	// head
	luigi.bones.head.rotation.x = degtorad(25);
	
	// animated movement
	var rotation = { x: 0, c_x: 0 }; 

	playerCollisionBox.position.z += 2;

	var tween_start_sliding = new TWEEN.Tween(rotation)
		.to({ x: degtorad(luigi.slideAngle), c_x: degtorad(luigi.slideAngle) }, luigi.slideTime) 
		.easing(TWEEN.Easing.Exponential.Out)
		.onUpdate( () => { 
							luigi.mesh.rotation.x = rotation.x;
							playerCollisionBox.rotation.x = rotation.c_x;
						} );

	var tween_end_sliding = new TWEEN.Tween(rotation)
		.to({ x: 0, c_x: 0 }, luigi.slideTime / 2) 
		.easing(TWEEN.Easing.Linear.None)
		.onUpdate( () => { 
							luigi.mesh.rotation.x = rotation.x; 
							playerCollisionBox.rotation.x = rotation.c_x;
						} );
	
	tween_start_sliding.onComplete( () => {
		tween_end_sliding.start();
		}
	);

	tween_end_sliding.onComplete( () => {
					playerCollisionBox.position.z -= 2;
					endSliding();
				}
	);

	//playerCollisionBox.position.y = 0.5;
	tween_start_sliding.start();
}

function stopTweens(tweens) {
	tweens.forEach( 
		(tween) => {
			tween.stop();
		} 
	);
}

function pauseTweens(tweens) {
	tweens.forEach( 
		(tween) => {
			tween.pause();
		} 
	);
}

function resumeTweens(tweens) {
	tweens.forEach( 
		(tween) => {
			tween.resume();
		} 
	);	
}

function playBackgroundMusic() {
	
	backgroundSound.isPlaying = false;
	backgroundSound.setBuffer( sounds.background.sound );
	backgroundSound.setLoop( true );
	backgroundSound.setVolume( 0.3 );
	backgroundSound.play();

}

function playPauseSound() {
	
	sound.isPlaying = false;
	sound.setBuffer( sounds.pause.sound );
	sound.setVolume( 0.3 );
	sound.play();

}

function playJumpSound() {
	
	sound.isPlaying = false;
	sound.setBuffer( sounds.jump.sound );
	sound.setVolume( 0.25 );
	sound.play();
	
}

function playSlideSound() {

	
	sound.isPlaying = false;
	sound.setBuffer( sounds.stomp.sound );
	sound.setVolume( 0.25 );
	sound.play();

}

function play1UpSound() {
	
	sound.isPlaying = false;
	sound.setBuffer( sounds.oneup.sound );
	sound.setVolume( 0.25 );
	sound.play();

}

function playCoinSound() {
	
	sound.isPlaying = false;
	sound.setBuffer( sounds.coin.sound );
	sound.setVolume( 0.1 );
	sound.play();

}

function playDamageSound() {
	
	sound.isPlaying = false;
	sound.setBuffer( sounds.damage.sound );
	sound.setVolume( 0.25 );
	sound.play();

}

function playGameOverSound() {

	sound.isPlaying = false;
	sound.setBuffer( sounds.gameover.sound );
	sound.setVolume( 0.3 );
	sound.play();

}

function animate () {

	requestAnimationFrame( animate );

	frames += 1;

	if(!options.game.isGameStarted) TWEEN.update();

	// GAME LOOP
	if (!options.game.isPaused) { 

		TWEEN.update();

		updateGUIScores();

	}

	if(options.showStats) stats.update();

	effect.render( scene, camera );
};

function toggleGamePause() {
	options.game.isPaused = !options.game.isPaused;
	
	// if is paused show pause screen
	document.getElementById("game_pause").hidden = !options.game.isPaused;

	if(options.game.isPaused) {
		backgroundSound.pause();
		coinsTween.pause();
		objectsTween.pause();
	} else {
		backgroundSound.play();
		coinsTween.resume();
		objectsTween.resume();
	}

	playPauseSound();
}

// UTILS

function initEventListeners() {

	initKeyboardListener();
	initTouchListener();
	initWindowListener();
}

function initKeyboardListener() {
	document.onkeydown = function(e) {
	   
	    if(options.game.isGameStarted & !options.game.isGameEnded) {
			switch (e.code) {
				case 'KeyA':
				case 'ArrowLeft':
					moveLeft();
					break;
				case 'KeyD':
				case 'ArrowRight':
					moveRight();
					break;
				case 'KeyW':
				case 'ArrowUp':
					jump();
					break;
				case 'KeyS':
				case 'ArrowDown':
					slide();
					break;
				case 'Escape':
					toggleGamePause();
					break;
			}
	    }
	    if(!options.game.isGameStarted) {
			switch (e.code) {
				case 'Enter':
					startGame();
					break;
			}
	    }
	}
}

function initTouchListener() {

	document.addEventListener('swiped-left', function(e) {
		// game running
		if(options.game.isGameStarted & !options.game.isGameEnded) {
			moveLeft();
			return;
		}
	});

	document.addEventListener('swiped-right', function(e) {
		// game running
		if(options.game.isGameStarted & !options.game.isGameEnded) {
			moveRight();
			return;
		}

	});

	document.addEventListener('swiped-up', function(e) {
		// game running
		if(options.game.isGameStarted & !options.game.isGameEnded) {
			jump();
			return;
		}
		// game not started
		if(!options.game.isGameStarted) {
			startGame();
			return;
		}
	
	});

	document.addEventListener('swiped-down', function(e) {
		// game running
		if(options.game.isGameStarted & !options.game.isGameEnded) {
			slide();
			return;
		}
	});

}

function initWindowListener() {
	window.addEventListener('resize', () => {
		renderer.setSize(window.innerWidth, window.innerHeight);
		camera.aspect = window.innerWidth/window.innerHeight;
	
		camera.updateProjectionMatrix();
	});
}

function dumpObject(obj, lines = [], isLast = true, prefix = '') {
	const localPrefix = isLast ? '└─' : '├─';
	lines.push(`${prefix}${prefix ? localPrefix : ''}${obj.name || '*no-name*'} [${obj.type}]`);
	const newPrefix = prefix + (isLast ? '  ' : '│ ');
	const lastNdx = obj.children.length - 1;
	obj.children.forEach((child, ndx) => {
		const isLast = ndx === lastNdx;
		dumpObject(child, lines, isLast, newPrefix);
	});
	return lines;
}

function degtorad(degrees)
{
  var pi = Math.PI;
  return degrees * (pi/180);
}

function showHelpers() {
	helpers.forEach( (helper) => {helper.visible = true; } );
}

function hideHelpers() {
	helpers.forEach( (helper) => {helper.visible = false; } );
}