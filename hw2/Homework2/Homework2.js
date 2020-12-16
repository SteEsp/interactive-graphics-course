"use strict";

var canvas;
var gl;
var program;

/* Constants */
const X = 0;
const Y = 1;
const Z = 2;
const xAxis = vec3(1, 0, 0);
const yAxis = vec3(0, 1, 0);
const zAxis = vec3(0, 0, 1);
const at = vec3(0.0, 0.0, 0.0);
const up = vec3(0.0, 1.0, 0.0);
const quad_vertices = [
    vec4(-0.5, -0.5,  0.5, 1.0),
    vec4(-0.5,  0.5,  0.5, 1.0),
    vec4(0.5,  0.5,  0.5, 1.0),
    vec4(0.5, -0.5,  0.5, 1.0),
    vec4(-0.5, -0.5, -0.5, 1.0),
    vec4(-0.5,  0.5, -0.5, 1.0),
    vec4(0.5,  0.5, -0.5, 1.0),
    vec4(0.5, -0.5, -0.5, 1.0),
];
const quad_texCoord = [
    vec2(0, 0),
    vec2(0, 1),
    vec2(1, 1),
    vec2(1, 0)
];

var modelViewMatrix, modelViewMatrixLoc;
var projectionMatrix, projectionMatrixLoc;
var instanceMatrix;

var verticesArray = [];
var texCoordArray = [];
var texIndicesArray = [];

/** TERRAIN */
const terrain_size = [25, 1, 25];
const terrainQuadsToDraw = 6 * terrain_size[0] * terrain_size[1] * terrain_size[2];

/** TREE */
var treePositions = [];
var treeCrownPositions = [];
var treesWoodQuadsToDraw = 0;
var treesLeavesQuadsToDraw = 0;

/** BEAR */
const bearComponentsIDs = {
    torso: 0,
    head: 1,
    leftUpperArm: 2,
    leftLowerArm: 3,
    rightUpperArm: 4,
    rightLowerArm: 5,
    leftUpperLeg: 6,
    leftLowerLeg: 7,
    rightUpperLeg: 8,
    rightLowerLeg: 9,
    tail: 10
};
const bearComponentsSizes = {
    torsoHeight: 3.0,
    torsoWidth: 1.5,
    upperArmHeight: 1.0,
    upperArmWidth: 0.6,
    lowerArmHeight: 1.0,
    lowerArmWidth: 0.5,
    upperLegHeight: 1.0,
    upperLegWidth: 0.6,
    lowerLegHeight: 1.0,
    lowerLegWidth: 0.5,
    headHeight: 1,
    headWidth: 1,
    tailHeight: 0.5,
    tailWidth: 0.25
}
const bearNumNodes = 11;
const bearInitialPosition = [-9, 1.5, 3];
const bearComponentsInitialAngles = {
    // (angle around X, angle around Y, angle around Z) in LOCAL COORDINATES
    torso: vec3(90, 0, 225),
    head: vec3(0, 90, 0),
    leftUpperArm: vec3(90, 0, 0),
    leftLowerArm: vec3(0, 0, 0),
    rightUpperArm: vec3(90, 0, 0),
    rightLowerArm: vec3(0, 0, 0),
    leftUpperLeg: vec3(90, 0, 0),
    leftLowerLeg: vec3(0, 0, 0),
    rightUpperLeg: vec3(90, 0, 0),
    rightLowerLeg: vec3(0, 0, 0),
    tail: vec3(0, 0, 0)
}
var bearPosition;
var bearComponentsAngles; 

/** MODELS TREE */
var stack = []; // model tree traversal

/** BEAR COMPONENTS TREE */
var bearModel = []; 

/** VIEWING */
var isPerspectiveActive = true;
var left = -10;
var right = 10;
var bottom = -10;
var ytop = 10;
var near = 0.1;                       // [m]
var far = 2000;                       // [m]
const initial_eye_radius = 23.0;      // [m]
var eye_radius = initial_eye_radius;          
var eye_theta  = 60.0;                // [deg]
var eye_phi    = 160.0;               // [deg]
var fovy = 60.0;                      // [deg]
var eye;                              // Camera position
var aspect;                           // Viewport aspect ratio
var drawnQuads = 0;

/** Buffers */
var verticesBuffer;
var verticesLoc;
var texCoordBuffer;
var texCoordLoc;
var textureIndexLoc;

/** Textures */
var images_IDs = [  
                    "uv_grid-texture",      // 0
                    "floor-texture",        // 1
                    "terrain-texture",      // 2
                    "dirt-texture",         // 3
                    "wood-texture",         // 4
                    "leaves-texture",       // 5
                    "bear_body-texture",    // 6
                    "bear_head-texture"     // 7
                ];

var texture_IDs = {
    uvgrid:     0,        
    floor:      1,        
    terrain:    2,        
    dirt:       3,        
    wood:       4,         
    leaves:     5,       
    bearbody:   6,    
    bearhead:   7
};

var textures = [];

/** Animation variables */
var isPaused = true;
var animationSequenceElapsedTime = 0;
var animationSequenceDuration = 1100;
var animationSequence = [];

/* Animation sequence */
const bearTurnStartTime1 = 0;
const bearTurnAngle1 = -135;
const bearTurnSpeed1 = -135 / (2 * 60);

animationSequence.push(
    {
        func: bearTurnInPlace,
        args: [bearTurnSpeed1, bearTurnAngle1, false],
        startTime: bearTurnStartTime1
    }
);

const bearWalkStartTime = 120; // bearTurnStartTime1 + bearTurnAngle1 / bearTurnSpeed1;
const bearTreePosition = [7, 0, 3];
const bearDestinationPosition = [
    bearTreePosition[0] - bearComponentsSizes["torsoHeight"] - bearComponentsSizes["headHeight"],
    bearInitialPosition[1],
    bearTreePosition[2]
   ];
const bearWalkSpeed = 0.05;

animationSequence.push(
    {
        func: bearMoveToDestination,
        args: [bearWalkSpeed, bearDestinationPosition],
        startTime: bearWalkStartTime
    }
);

const bearTurnStartTime2 = 120 + 240;
const bearTurnAngle2 = 180;
const bearTurnSpeed2 = bearTurnAngle2 / (4 * 60);

animationSequence.push(
    {
        func: bearTurnInPlace,
        args: [bearTurnSpeed2, bearTurnAngle2, true],
        startTime: bearTurnStartTime2
    }
);

const bearStandUpTime = 120 + 240 + 240;  
const bearStandUpSpeed = 0.90 / 60;

animationSequence.push(
    {
        func: bearStandUp,
        args: [bearStandUpSpeed],
        startTime: bearStandUpTime
    }
);

const bearScratchTime = 120 + 240 + 240 + 170;
const bearScratchSpeed = 0.7 / 60;
const bearScratchIterations = 8;

animationSequence.push(
    {
        func: bearScratch,
        args: [bearScratchSpeed, bearScratchIterations],
        startTime: bearScratchTime
    }
);

var keyframesToProcess = [];

window.onload = function init() {

    initWebGL();
    initGUI();
    handleCamera();
    loadTextures(images_IDs);

    instanceMatrix = mat4();

    initTerrain(false); // useNoise = false
    treePositions = [vec4(bearTreePosition[0], bearTreePosition[1], bearTreePosition[2], 1), // tree for the bear 
                     vec4(-10, 0, -3, 1), // other trees
                     vec4(7, 0, 10, 1), 
                     vec4(-5, 0, -7, 1),
                     vec4(6, 0, -6, 1), 
                     vec4(0, 0, -5, 1), 
                     vec4(-7, 0, 10, 1),
                    ];
    initTrees(treePositions);
    initBear();

    sendData();

    // Initialize animation and start rendering
    bearComponentsAngles = copyDictVec3(bearComponentsInitialAngles);
    bearPosition = copyArr(bearInitialPosition);
    bearUpdateKeyframesToProcess();

    render();

};

function render() {

    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

    if (animationSequenceElapsedTime >= animationSequenceDuration) isPaused = true;

    // Update camera
    handleCamera();

    gl.uniformMatrix4fv( modelViewMatrixLoc, false, flatten(modelViewMatrix) );
    gl.uniformMatrix4fv( projectionMatrixLoc, false, flatten(projectionMatrix) );

    renderTerrain();
    renderTrees();

    if(!isPaused) {
        bearAnimationStep(); // update bear values based on current active keyframes
        updateBear(); // update the bear model based on new configuration

        animationSequenceElapsedTime += 1;
        updateAnimationProgress(); // GUI

        if (animationSequenceElapsedTime > 500 && isPerspectiveActive) eye_radius = 14;

        bearUpdateKeyframesToProcess();
    }

    renderBear();

    resize();
    requestAnimationFrame(render);
};

function handleCamera() {

    eye = vec3(eye_radius*Math.sin(deg2rad(eye_theta))*Math.cos(deg2rad(eye_phi)), 
                eye_radius*Math.sin(deg2rad(eye_theta))*Math.sin(deg2rad(eye_phi)), 
                eye_radius*Math.cos(deg2rad(eye_theta)));
    modelViewMatrix = lookAt(eye, at, up); 

    if (isPerspectiveActive) {
        projectionMatrix = perspective(fovy, aspect, near, far);
    }
    else {
        projectionMatrix = ortho(-canvas.clientWidth/120, canvas.clientWidth/120, -canvas.clientHeight/120, canvas.clientHeight/120, near, far)
    }
    
}

function useTexture(texture_name) {
    var tex_id = texture_IDs[texture_name];
    if(typeof tex_id !== "undefined") {
        gl.uniform1i( textureIndexLoc, tex_id );
    } else {
        gl.uniform1i( textureIndexLoc, -1 );
    }
}

function sendData() {

    modelViewMatrixLoc = gl.getUniformLocation( program, "uModelViewMatrix" );
    projectionMatrixLoc = gl.getUniformLocation( program, "uProjectionMatrix" );
    gl.uniformMatrix4fv( modelViewMatrixLoc, false, flatten(modelViewMatrix) );
    gl.uniformMatrix4fv( projectionMatrixLoc, false, flatten(projectionMatrix) );
    
    // Texture coords
    texCoordBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, texCoordBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(texCoordArray), gl.STATIC_DRAW );

    texCoordLoc = gl.getAttribLocation( program, "aTexCoord" );
    gl.vertexAttribPointer( texCoordLoc, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( texCoordLoc );

    
    // Texture indices to select the texture to use
    textureIndexLoc = gl.getUniformLocation( program, "uTextureIndex" );

    // Vertex buffer
    verticesBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, verticesBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(verticesArray), gl.STATIC_DRAW );

    verticesLoc = gl.getAttribLocation( program, "aPosition" );
    gl.vertexAttribPointer( verticesLoc, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( verticesLoc );

    // Textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[0]);
    gl.uniform1i(gl.getUniformLocation(program, 'uTexture0'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textures[1]);
    gl.uniform1i(gl.getUniformLocation(program, 'uTexture1'), 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, textures[2]);
    gl.uniform1i(gl.getUniformLocation(program, 'uTexture2'), 2);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, textures[3]);
    gl.uniform1i(gl.getUniformLocation(program, 'uTexture3'), 3);

    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, textures[4]);
    gl.uniform1i(gl.getUniformLocation(program, 'uTexture4'), 4);

    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, textures[5]);
    gl.uniform1i(gl.getUniformLocation(program, 'uTexture5'), 5);

    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, textures[6]);
    gl.uniform1i(gl.getUniformLocation(program, 'uTexture6'), 6);

    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, textures[7]);
    gl.uniform1i(gl.getUniformLocation(program, 'uTexture7'), 7);

};

function loadTextures(images_IDs) {

    for (var i = 0; i < images_IDs.length; i++) {
        var image = document.getElementById(images_IDs[i]);
        var texture = createTexture();
        setImage(texture, image);
        textures.push(texture);
    }
};

function createTexture() {

    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    // Set the parameters so we can render any size image.
    /*
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.generateMipmap( gl.TEXTURE_2D );
    gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    */

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return texture;
};

function setImage(texture, image) {
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Upload the image into the texture.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
};

/** TERRAIN  */
function initTerrain(useNoise = false) {

    var treePositions = [];
    var noiseIntensity = 0;
    for ( var x = 0; x < terrain_size[0]; x++ ) {
        for (var z = 0; z < terrain_size[2]; z++ ) {
            
            //if (useNoise) noiseIntensity = Math.round(Math.random());
            if (useNoise) noiseIntensity = Math.random() * 0.2;
            for ( var y = 0; y < terrain_size[1]; y++ ) {

                cube(
                        x - terrain_size[0]/2, 
                        0 - terrain_size[1] + noiseIntensity, 
                        z - terrain_size[2]/2,
                        true // different uvs per face
                    ); 
            }

            // with probability p spawn a tree in the x, y, z position
            if (Math.random() < 0.01) {
                treePositions.push(vec4(x - terrain_size[0]/2, 
                                        0 - terrain_size[1] + 1, 
                                        z - terrain_size[2]/2,
                                        1));
            }
        }
    }  
    return treePositions;
};

function renderTerrain() {
    
    useTexture("terrain");
    
    for (var i = 0; i < terrainQuadsToDraw; i++) {
        gl.drawArrays(gl.TRIANGLE_FAN, 4*i, 4);
    }
    drawnQuads = terrainQuadsToDraw;
    
};

/** TREE */
function initTrees(treePositions) {
    for (var i = 0; i < treePositions.length; i++) initTree(treePositions[i]);
    for (var i = 0; i < treeCrownPositions.length; i++) initTreeCrown(treeCrownPositions[i]);
}

function initTree(treePosition) {

    // add trunk
    var treeHeight = 7 + Math.round(Math.random() * 2);
    for (var i = 0; i < treeHeight; i++) {
        cube(treePosition[0], treePosition[1] + i, treePosition[2]);
        treesWoodQuadsToDraw += 6;
    }
    treeCrownPositions.push(vec4(treePosition[0], treePosition[1] + treeHeight, treePosition[2], 1));
}

function initTreeCrown(treeCrownPosition) {
    // add leaves
    cube(treeCrownPosition[0], treeCrownPosition[1], treeCrownPosition[2]);
    treesLeavesQuadsToDraw += 6;
    for (var i = -1; i < 2; i++) {
        for (var j = -1; j < 2; j++) {
            if (!(i == 0 && j == 0)) {
                cube(treeCrownPosition[0] + i, treeCrownPosition[1] - 1, treeCrownPosition[2] + j);
                treesLeavesQuadsToDraw += 6;
            }
        }
    }
}

function renderTrees() {

    useTexture("wood");
    // draw wood
    for (var i = drawnQuads; i < drawnQuads + treesWoodQuadsToDraw; i++) {
        gl.drawArrays(gl.TRIANGLE_FAN, 4*i, 4);
    }
    drawnQuads += treesWoodQuadsToDraw;

    useTexture("leaves");
    // draw tree leaves
    for (var i = drawnQuads; i < drawnQuads + treesLeavesQuadsToDraw; i++) {
        gl.drawArrays(gl.TRIANGLE_FAN, 4*i, 4);
    }
    drawnQuads += treesLeavesQuadsToDraw;
}

/** BEAR */
function initBear() {

    bearPosition = bearInitialPosition;
    bearComponentsAngles = bearComponentsInitialAngles;

    cube();
    cube(0, 0, 0, true);

    for(var i = 0; i < bearNumNodes; i++) bearModel[i] = createNode(null, null, null, null);
    
    for(var i = 0; i < bearNumNodes; i++) {
        initBearNode(i);
    }
}

function updateBear() {

    for(var i = 0; i < bearNumNodes; i++) {
        initBearNode(i);
    }
}

/* Create and initialize a node */
function initBearNode(ID) {

    var m = mat4();
    switch(ID) {
        case bearComponentsIDs["torso"]:

            m = translate( bearPosition[0], bearPosition[1], bearPosition[2] );
            m = mult( m, rotate(bearComponentsAngles["torso"][X], xAxis ));
            m = mult( m, rotate(bearComponentsAngles["torso"][Y], yAxis ));
            m = mult( m, rotate(bearComponentsAngles["torso"][Z], zAxis ));

            bearModel[bearComponentsIDs["torso"]] = createNode( m, torso, null, bearComponentsIDs["head"] );
            break;

        case bearComponentsIDs["head"]:

            m = translate(0.0, bearComponentsSizes["torsoHeight"] + 0.3 * bearComponentsSizes["headHeight"], 0.5);
            m = mult( m, rotate(bearComponentsAngles["head"][X], xAxis))
            m = mult( m, rotate(bearComponentsAngles["head"][Y], yAxis));
            m = mult( m, rotate(bearComponentsAngles["head"][Z], zAxis));
            m = mult( m, translate(0.0, -0.5*bearComponentsSizes["headHeight"], 0.0));

            bearModel[bearComponentsIDs["head"]] = createNode( m, head, bearComponentsIDs["leftUpperArm"], null);
            break;

        case bearComponentsIDs["leftUpperArm"]:

            m = translate(-(0.6*bearComponentsSizes["torsoWidth"]), 0.9*bearComponentsSizes["torsoHeight"], 0.0);
            m = mult( m, rotate(bearComponentsAngles["leftUpperArm"][X], xAxis));
            m = mult( m, rotate(bearComponentsAngles["leftUpperArm"][Y], yAxis));
            m = mult( m, rotate(bearComponentsAngles["leftUpperArm"][Z], zAxis));

            bearModel[bearComponentsIDs["leftUpperArm"]] = createNode( m, leftUpperArm, bearComponentsIDs["rightUpperArm"], bearComponentsIDs["leftLowerArm"] );
            break;

        case bearComponentsIDs["rightUpperArm"]:

            m = translate(0.6*bearComponentsSizes["torsoWidth"], 0.9*bearComponentsSizes["torsoHeight"], 0.0);
            m = mult( m, rotate(bearComponentsAngles["rightUpperArm"][X], xAxis));
            m = mult( m, rotate(bearComponentsAngles["rightUpperArm"][Y], yAxis));
            m = mult( m, rotate(bearComponentsAngles["rightUpperArm"][Z], zAxis));

            bearModel[bearComponentsIDs["rightUpperArm"]] = createNode( m, rightUpperArm, bearComponentsIDs["leftUpperLeg"], bearComponentsIDs["rightLowerArm"] );
            break;

        case bearComponentsIDs["leftUpperLeg"]:

            m = translate(-(0.6*bearComponentsSizes["torsoWidth"]), 0.1*bearComponentsSizes["upperLegHeight"], 0.0);
            m = mult( m, rotate(bearComponentsAngles["leftUpperLeg"][X], xAxis));
            m = mult( m, rotate(bearComponentsAngles["leftUpperLeg"][Y], yAxis));
            m = mult( m, rotate(bearComponentsAngles["leftUpperLeg"][Z], zAxis));

            bearModel[bearComponentsIDs["leftUpperLeg"]] = createNode( m, leftUpperLeg, bearComponentsIDs["rightUpperLeg"], bearComponentsIDs["leftLowerLeg"] );
            break;

        case bearComponentsIDs["rightUpperLeg"]:

            m = translate(0.6*bearComponentsSizes["torsoWidth"], 0.1*bearComponentsSizes["upperLegHeight"], 0.0);
            m = mult( m, rotate(bearComponentsAngles["rightUpperLeg"][X], xAxis));
            m = mult( m, rotate(bearComponentsAngles["rightUpperLeg"][Y], yAxis));
            m = mult( m, rotate(bearComponentsAngles["rightUpperLeg"][Z], zAxis));

            bearModel[bearComponentsIDs["rightUpperLeg"]] = createNode( m, rightUpperLeg, bearComponentsIDs["tail"], bearComponentsIDs["rightLowerLeg"] );
            break;

        case bearComponentsIDs["leftLowerArm"]:

            m = translate(0.0, bearComponentsSizes["upperArmHeight"], 0.0);
            m = mult( m, rotate(bearComponentsAngles["leftLowerArm"][X], xAxis));
            m = mult( m, rotate(bearComponentsAngles["leftLowerArm"][Y], yAxis));
            m = mult( m, rotate(bearComponentsAngles["leftLowerArm"][Z], zAxis));

            bearModel[bearComponentsIDs["leftLowerArm"]] = createNode( m, leftLowerArm, null, null );
            break;

        case bearComponentsIDs["rightLowerArm"]:

            m = translate(0.0, bearComponentsSizes["upperArmHeight"], 0.0);
            m = mult( m, rotate(bearComponentsAngles["rightLowerArm"][X], xAxis));
            m = mult( m, rotate(bearComponentsAngles["rightLowerArm"][Y], yAxis));
            m = mult( m, rotate(bearComponentsAngles["rightLowerArm"][Z], zAxis));

            bearModel[bearComponentsIDs["rightLowerArm"]] = createNode( m, rightLowerArm, null, null );
            break;

        case bearComponentsIDs["leftLowerLeg"]:

            m = translate(0.0, bearComponentsSizes["upperLegHeight"], 0.0);
            m = mult( m, rotate(bearComponentsAngles["leftLowerLeg"][X], xAxis));
            m = mult( m, rotate(bearComponentsAngles["leftLowerLeg"][Y], yAxis));
            m = mult( m, rotate(bearComponentsAngles["leftLowerLeg"][Z], zAxis));

            bearModel[bearComponentsIDs["leftLowerLeg"]] = createNode( m, leftLowerLeg, null, null );
            break;

        case bearComponentsIDs["rightLowerLeg"]:

            m = translate(0.0, bearComponentsSizes["upperLegHeight"], 0.0);
            m = mult( m, rotate(bearComponentsAngles["rightLowerLeg"][X], xAxis));
            m = mult( m, rotate(bearComponentsAngles["rightLowerLeg"][Y], yAxis));
            m = mult( m, rotate(bearComponentsAngles["rightLowerLeg"][Z], zAxis));

            bearModel[bearComponentsIDs["rightLowerLeg"]] = createNode( m, rightLowerLeg, null, null );
            break;

        case bearComponentsIDs["tail"]:

            m = rotate(180, xAxis);
            m = mult(m, translate( 0, 0, -0.5 ));
            m = mult( m, rotate(bearComponentsAngles["tail"][X], xAxis)); 
            m = mult( m, rotate(bearComponentsAngles["tail"][Y], yAxis));
            m = mult( m, rotate(bearComponentsAngles["tail"][Z], zAxis));

            bearModel[bearComponentsIDs["tail"]] = createNode( m, tail, null, null );
            break;

    }
};

function torso() {

    useTexture("bearbody");

    instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5*bearComponentsSizes["torsoHeight"], 0.0) );
    instanceMatrix = mult(instanceMatrix, scale( bearComponentsSizes["torsoWidth"], bearComponentsSizes["torsoHeight"], bearComponentsSizes["torsoWidth"]));
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix) );
    for(var i=drawnQuads; i<drawnQuads + 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 4*i, 4);
};

function tail() {

    useTexture("bearbody");

    instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5*bearComponentsSizes["tailHeight"], 0.0) );
    instanceMatrix = mult(instanceMatrix, scale( bearComponentsSizes["tailWidth"], bearComponentsSizes["tailHeight"], bearComponentsSizes["tailWidth"]));
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix) );
    for(var i=drawnQuads; i<drawnQuads + 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 4*i, 4);
}

function head() {

    useTexture("bearhead");

    instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5 * bearComponentsSizes["headHeight"], 0.0 ));
	instanceMatrix = mult(instanceMatrix, scale(bearComponentsSizes["headWidth"], bearComponentsSizes["headHeight"], bearComponentsSizes["headWidth"]) );
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix) );
    for(var i=drawnQuads + 6; i<drawnQuads + 12; i++) gl.drawArrays(gl.TRIANGLE_FAN, 4*i, 4);
};

function leftUpperArm() {

    useTexture("bearbody");

    instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5 * bearComponentsSizes["upperArmHeight"], 0.0) );
	instanceMatrix = mult(instanceMatrix, scale(bearComponentsSizes["upperArmWidth"], bearComponentsSizes["upperArmHeight"], bearComponentsSizes["upperArmWidth"]) );
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix) );
    for(var i=drawnQuads; i<drawnQuads + 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 4*i, 4);
};

function leftLowerArm() {

    useTexture("bearbody");

    instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5 * bearComponentsSizes["lowerArmHeight"], 0.0) );
	instanceMatrix = mult(instanceMatrix, scale(bearComponentsSizes["lowerArmWidth"], bearComponentsSizes["lowerArmHeight"], bearComponentsSizes["lowerArmWidth"]) );
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix) );
    for(var i=drawnQuads; i<drawnQuads + 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 4*i, 4);
};

function rightUpperArm() {

    useTexture("bearbody");

    instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5 * bearComponentsSizes["upperArmHeight"], 0.0) );
	instanceMatrix = mult(instanceMatrix, scale(bearComponentsSizes["upperArmWidth"], bearComponentsSizes["upperArmHeight"], bearComponentsSizes["upperArmWidth"]) );
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix) );
    for(var i=drawnQuads; i<drawnQuads + 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 4*i, 4);
};

function rightLowerArm() {

    useTexture("bearbody");

    instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5 * bearComponentsSizes["lowerArmHeight"], 0.0) );
	instanceMatrix = mult(instanceMatrix, scale(bearComponentsSizes["lowerArmWidth"], bearComponentsSizes["lowerArmHeight"], bearComponentsSizes["lowerArmWidth"]) );
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix) );
    for(var i=drawnQuads; i<drawnQuads + 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 4*i, 4);
};

function leftUpperLeg() {

    useTexture("bearbody");

    instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5 * bearComponentsSizes["upperLegHeight"], 0.0) );
	instanceMatrix = mult(instanceMatrix, scale(bearComponentsSizes["upperLegWidth"], bearComponentsSizes["upperLegHeight"], bearComponentsSizes["upperLegWidth"]) );
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix) );
    for(var i=drawnQuads; i<drawnQuads + 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 4*i, 4);
};

function leftLowerLeg() {
    
    useTexture("bearbody");

    instanceMatrix = mult(modelViewMatrix, translate( 0.0, 0.5 * bearComponentsSizes["lowerLegHeight"], 0.0) );
	instanceMatrix = mult(instanceMatrix, scale(bearComponentsSizes["lowerLegWidth"], bearComponentsSizes["lowerLegHeight"], bearComponentsSizes["lowerLegWidth"]) );
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix) );
    for(var i=drawnQuads; i<drawnQuads + 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 4*i, 4);
};

function rightUpperLeg() {

    useTexture("bearbody");

    instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5 * bearComponentsSizes["upperLegHeight"], 0.0) );
	instanceMatrix = mult(instanceMatrix, scale(bearComponentsSizes["upperLegWidth"], bearComponentsSizes["upperLegHeight"], bearComponentsSizes["upperLegWidth"]) );
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix) );
    for(var i=drawnQuads; i<drawnQuads + 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 4*i, 4);
};

function rightLowerLeg() {

    useTexture("bearbody");

    instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5 * bearComponentsSizes["lowerLegHeight"], 0.0) );
	instanceMatrix = mult(instanceMatrix, scale(bearComponentsSizes["lowerLegWidth"], bearComponentsSizes["lowerLegHeight"], bearComponentsSizes["lowerLegWidth"]) );
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix) );
    for(var i=drawnQuads; i<drawnQuads + 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 4*i, 4);
};

function traverseBearModel(ID) {

    if(ID == null) return;
 
    stack.push(modelViewMatrix);
    modelViewMatrix = mult(modelViewMatrix, bearModel[ID].transform);
    bearModel[ID].render();
 
    if(bearModel[ID].child != null) traverseBearModel(bearModel[ID].child);
 
    modelViewMatrix = stack.pop();
 
    if(bearModel[ID].sibling != null) traverseBearModel(bearModel[ID].sibling);
 
 };

function renderBear() {
    traverseBearModel(bearComponentsIDs["torso"]);
};

/** BEAR ANIMATIONS */
function bearUpdateKeyframesToProcess() {

    bearDiscardCompletedKeyframes();

    // Check if it's the right time to activate a new animation from the sequence
    for (var i = 0; i < animationSequence.length; i++) {

        var animation = animationSequence[i];
        
        if (animation.startTime == animationSequenceElapsedTime) {
            // Generate keyframes for the animation and add them to the ones to process
            var keyframes = animation.func( ...animation.args );
            for (var j = 0; j < keyframes.length; j++) {
                keyframesToProcess.push(keyframes[j]);
            }
        }
    }
};

function bearResetAnimation() {

    animationSequenceElapsedTime = 0;
    keyframesToProcess.splice(0, keyframesToProcess.length);
    bearComponentsAngles = copyDictVec3(bearComponentsInitialAngles);
    bearPosition = copyArr(bearInitialPosition);
    eye_radius = initial_eye_radius;
    bearUpdateKeyframesToProcess();
};

function bearAnimationStep() {

    // Process active
    for (var i = 0; i < keyframesToProcess.length; i++) {

        var keyframe = keyframesToProcess[i];

        // If not yet started, ignore keyframe for now
        if (keyframe.startTime > keyframe.elapsedTime){
            continue;
        }

        // step in [0, 1] for linear interpolation
        var step = (keyframe.elapsedTime - keyframe.startTime) / keyframe.duration;

        // Change bear poisiton in space
        if (keyframe.position != null) {
            for (var j = 0; j < 3; j++) {
                var start = bearPosition[j];
                var end = keyframe.position[j];
                bearPosition[j] = mix(start, end, step);
            }
        }

        // Change bear components angles
        if (keyframe.bearAngles != null) {
            
            for(var component in bearComponentsAngles) {
                var start = bearComponentsAngles[component];
                var end = keyframe.bearAngles[component];
                bearComponentsAngles[component] = mix(start, end, step);
            }
        }
        
    }
};

function bearDiscardCompletedKeyframes() {

    var toBeRemoved = [];
    for (var i = 0; i < keyframesToProcess.length; i++) {

        var keyframe = keyframesToProcess[i];
        keyframe.elapsedTime += 1;
        if ((keyframe.elapsedTime - keyframe.startTime) >= keyframe.duration) {
            toBeRemoved.push(i);
        }
    }

    for (var i = 0; i < toBeRemoved.length; i++) {
        keyframesToProcess.splice(toBeRemoved[i], 1);
    }
}

function bearMoveToDestination(speed, bearDestination) {
    
    var keyframes = [];

    var distancePerIteration = 1;  // [m]
    var destinationDistance = vec3Distance(bearPosition, bearDestination);
    var iterations = Math.ceil(destinationDistance / distancePerIteration); // iteration needed to cover all distance

    var time = destinationDistance / speed; // time to complete the animation
    var duration = time / (4 * iterations); // duration of each keyframe    

    var keyframesNeeded = 4 * iterations;

    var deltaAngles = vec3(30, 0, 0);

    for (var i = 0; i < iterations; i++) {

        var delay = 4 * i * duration;
        
        // First keyframe: move legs simulating walk
        var interpolation = (4 * i + 1) / keyframesNeeded; 
        var firstPosition = vec3ToArr(mix( bearPosition, bearDestination, interpolation ));
        var firstBearAngles = copyDictVec3( bearComponentsAngles );

        firstBearAngles["torso"] = add(firstBearAngles["torso"], mult(vec3(0.1, 0, 0), deltaAngles));

        // arm right
        firstBearAngles["rightUpperArm"] = add(firstBearAngles["rightUpperArm"], deltaAngles);
        firstBearAngles["rightLowerArm"] = subtract(firstBearAngles["rightLowerArm"], deltaAngles);
        // arm left
        firstBearAngles["leftUpperArm"] = subtract(firstBearAngles["leftUpperArm"], deltaAngles);
        firstBearAngles["leftLowerArm"] = add(firstBearAngles["leftLowerArm"], deltaAngles);
        // leg left
        firstBearAngles["leftUpperLeg"] = add(firstBearAngles["leftUpperLeg"], deltaAngles);
        firstBearAngles["leftLowerLeg"] = subtract(firstBearAngles["leftLowerLeg"], deltaAngles);
        // leg right
        firstBearAngles["rightUpperLeg"] = subtract(firstBearAngles["rightUpperLeg"], deltaAngles);
        firstBearAngles["rightLowerLeg"] = add(firstBearAngles["rightLowerLeg"], deltaAngles);

        keyframes.push( {
            bearAngles: firstBearAngles,
            position: firstPosition,
            duration: duration,
            elapsedTime: 0,
            startTime: delay
        } );

        // Second keyframe: legs go back to initial position
        var interpolation = (4 * i + 2) / keyframesNeeded;
        var secondPosition = vec3ToArr(mix( bearPosition, bearDestination, interpolation ));
        var secondBearAngles = copyDictVec3( bearComponentsAngles );

        keyframes.push( {
            bearAngles: secondBearAngles,
            position: secondPosition,
            duration: duration,
            elapsedTime: 0,
            startTime: delay + duration,
        } );
        
        // Third keyframe: move legs in the oppisite way of the first keyframe to simulate walk
        var interpolation = (4 * i + 3) / keyframesNeeded;
        var thirdPosition = vec3ToArr(mix( bearPosition, bearDestination, interpolation ));
        var thirdBearAngles = copyDictVec3( bearComponentsAngles );

        thirdBearAngles["torso"] = subtract(thirdBearAngles["torso"], mult(vec3(0.1, 0, 0), deltaAngles));

        // arm right
        thirdBearAngles["rightUpperArm"] = subtract(thirdBearAngles["rightUpperArm"], deltaAngles);
        thirdBearAngles["rightLowerArm"] = add(thirdBearAngles["rightLowerArm"], deltaAngles);
        // arm left
        thirdBearAngles["leftUpperArm"] = add(thirdBearAngles["leftUpperArm"], deltaAngles);
        thirdBearAngles["leftLowerArm"] = subtract(thirdBearAngles["leftLowerArm"], deltaAngles);
        // leg left
        thirdBearAngles["leftUpperLeg"] = subtract(thirdBearAngles["leftUpperLeg"], deltaAngles);
        thirdBearAngles["leftLowerLeg"] = add(thirdBearAngles["leftLowerLeg"], deltaAngles);
        // leg right
        thirdBearAngles["rightUpperLeg"] = add(thirdBearAngles["rightUpperLeg"], deltaAngles);
        thirdBearAngles["rightLowerLeg"] = subtract(thirdBearAngles["rightLowerLeg"], deltaAngles);

        keyframes.push( {
            bearAngles: thirdBearAngles,
            position: thirdPosition,
            duration: duration,
            elapsedTime: 0,
            startTime: delay + 2 * duration,
        } );

        // Fourth keyframe: legs go back to initial position
        var interpolation = (4 * i + 4) / keyframesNeeded;
        var fourthPosition = vec3ToArr(mix( bearPosition, bearDestination, interpolation ));
        var fourthBearAngles = copyDictVec3( bearComponentsAngles );

        keyframes.push( {
            bearAngles: fourthBearAngles,
            position: fourthPosition,
            duration: duration,
            elapsedTime: 0,
            startTime: delay + 3 * duration,
        } );
    }

    return keyframes;
};

function bearTurnInPlace(speed, angle, keepPosition) {
    
    var duration = angle / speed; // duration of the ketframe

    var bearAngles = copyDictVec3(bearComponentsAngles);
    var position = copyArr(bearPosition);

    if (angle > 0) bearAngles["torso"] = add(bearAngles["torso"], vec3(0, 0, angle));
    else 
    bearAngles["torso"] = subtract(bearAngles["torso"], vec3(0, 0, Math.abs(angle)));
    if (keepPosition) position[0] = (position[0] + Math.sign(position[0]) * bearComponentsSizes["torsoHeight"]);

    var keyframe = {
                bearAngles: bearAngles,
                position: position,
                duration: duration,
                elapsedTime: 0,
                startTime: 0
    };

    return [keyframe];
};

function bearStandUp(speed) {

    var duration = 90 / speed; // duration of the keyframe

    var bearAngles = copyDictVec3(bearComponentsAngles);
    var position = copyArr(bearPosition);

    bearAngles["torso"] = subtract(bearAngles["torso"], vec3(0, 90, 0));
    bearAngles["head"] = add(bearAngles["head"], vec3(80, 0, 0));
    bearAngles["leftUpperLeg"] = add(bearAngles["leftUpperLeg"], vec3(90, 0, 0));
    bearAngles["rightUpperLeg"] = add(bearAngles["rightUpperLeg"], vec3(90, 0, 0));
    bearAngles["leftLowerArm"] = add(bearAngles["leftLowerArm"], vec3(90, 0, 0));
    bearAngles["rightLowerArm"] = add(bearAngles["rightLowerArm"], vec3(90, 0, 0));

    position[1] -= 0.5 * bearComponentsSizes["tailWidth"];

    var keyframe = {
        bearAngles: bearAngles,
        position: position,
        duration: duration,
        elapsedTime: 0,
        startTime: 0
    };

    return [keyframe];
};

function bearScratch(speed, iterations) {
    
    var keyframes = [];

    var deltaYPosition = 0.2 * bearComponentsSizes["torsoHeight"];

    var time = deltaYPosition / speed; // time to complete a full scratch
    var duration = time / 2; // duration of each keyframe 

    for (var i = 0; i < iterations; i++) {

        var delay = 2 * i * duration;

        // Keyframe 
        var firstPosition = copyArr(bearPosition);
        firstPosition[1] -= deltaYPosition;

        var firstBearAngles = copyDictVec3(bearComponentsAngles);

        firstBearAngles["head"] = subtract(firstBearAngles["head"], vec3(10, 0, 0));
        firstBearAngles["rightUpperLeg"] = subtract(firstBearAngles["rightUpperLeg"], vec3(50, 0, 0));
        firstBearAngles["leftUpperLeg"] = subtract(firstBearAngles["leftUpperLeg"], vec3(50, 0, 0));
        firstBearAngles["rightLowerLeg"] = add(firstBearAngles["rightLowerLeg"], vec3(70, 0, 0));
        firstBearAngles["leftLowerLeg"] = add(firstBearAngles["leftLowerLeg"], vec3(70, 0, 0));

        keyframes.push( {
            bearAngles: firstBearAngles,
            position: firstPosition,
            duration: duration,
            elapsedTime: 0,
            startTime: delay
        } );

        // Keyframe 
        var secondPosition = copyArr(bearPosition);
        var secondBearAngles = copyDictVec3(bearComponentsAngles);

        keyframes.push( {
            bearAngles: secondBearAngles,
            position: secondPosition,
            duration: duration,
            elapsedTime: 0,
            startTime: delay + duration
        } );

    }

    return keyframes;
};

/** UTILITIES */
function initWebGL() {
    canvas = document.getElementById( "gl-canvas" );

    gl = canvas.getContext('webgl2');
    if (!gl) alert("WebGL 2.0 isn't available" );

    /* gl Settings */
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor(99 / 255, 208 / 255, 255 / 255, 1.0); // background color
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.frontFace(gl.CCW); // counter clockwise
    gl.cullFace(gl.BACK); 

    //  Load shaders and initialize attribute buffers
    program = initShaders( gl, "vertex-shader", "fragment-shader");
    gl.useProgram( program );
};

function resize() {
    // Lookup the size the browser is displaying the canvas.
    var displayWidth  = canvas.clientWidth;
    var displayHeight = canvas.clientHeight;
   
    // Check if the canvas is not the same size.
    if (canvas.width  != displayWidth || canvas.height != displayHeight) {
   
      // Make the canvas the same size
      canvas.width  = displayWidth;
      canvas.height = displayHeight;

      gl.viewport( 0, 0, canvas.width, canvas.height );
      aspect = canvas.width / canvas.height;

    }
};

function hexToRgb(hex){
    var hex = hex.replace('#','');
    var r = parseInt(hex.substring(0,2), 16) / 255;
    var g = parseInt(hex.substring(2,4), 16) / 255;
    var b = parseInt(hex.substring(4,6), 16) / 255;

    var result = vec4( r, g, b, 1 );
    return result;
};

function decToHex(rgb) { 
    var hex = Number(rgb).toString(16);
    if (hex.length < 2) {
         hex = "0" + hex;
    }
    return hex;
};

function rgbToHex(rgb) {   
    var r = rgb[0] * 255;
    var g = rgb[1] * 255;
    var b = rgb[2] * 255;
    var red = decToHex(r);
    var green = decToHex(g);
    var blue = decToHex(b);
    return '#'+red+green+blue;
};

function deg2rad(deg) { return deg * Math.PI / 180; };
function rad2deg(rad) { return rad * 180 / Math.PI; };

/* Returns a 4x4 diagonal matrix whose diagonal is a b c 1 */
function scale4(a, b, c) {

    var result = mat4();
    result[0] = a;
    result[5] = b;
    result[10] = c;
    return result;

};

function updateAnimationProgress() {
    var progress = Math.floor((animationSequenceElapsedTime / animationSequenceDuration) * 100);
    $('.progress-bar').css('width', progress + '%').attr('aria-valuenow', progress);
};

/** GUI */
/* Init values in the html page */
function initGUI() {

    /* Viewing Parameters */
    document.getElementById("togglePerspective").checked = isPerspectiveActive;
    document.getElementById("near").value = near;
    document.getElementById("far").value = far;
    document.getElementById("radiusSlider").value = eye_radius;
    document.getElementById("thetaSlider").value = eye_theta;
    document.getElementById("phiSlider").value = eye_phi;
    document.getElementById("fovSlider").value = fovy;

    /* Animation */
    var progress = animationSequenceElapsedTime;
    $('.progress-bar').css('width', progress + '%').attr('aria-valuenow', progress); 

    initEventListeners();
};

/** Event listeners */
function initEventListeners() {

    /* Viewing Parameters */
    document.getElementById("togglePerspective").onchange = function(){ isPerspectiveActive = !isPerspectiveActive; eye_radius = initial_eye_radius;}
    document.getElementById("near").onchange = function(){ near = parseFloat(document.getElementById("near").value); };
    document.getElementById("far").onchange = function(){ far = parseFloat(document.getElementById("far").value); };

    document.getElementById("radiusSlider").onchange = function(){ eye_radius =  parseFloat(document.getElementById("radiusSlider").value); };
    document.getElementById("thetaSlider").onchange = function(){ eye_theta =  parseFloat(document.getElementById("thetaSlider").value); };
    document.getElementById("phiSlider").onchange = function(){ eye_phi =  parseFloat(document.getElementById("phiSlider").value); };
    document.getElementById("fovSlider").onchange = function(){ fovy =  parseFloat(document.getElementById("fovSlider").value); };

    /* Rotation */
    // document.getElementById( "xSlider" ).onchange = function () { rot_theta[xAxis] = parseFloat(document.getElementById( "xSlider" ).value); };
    // document.getElementById( "ySlider" ).onclick = function () { rot_theta[yAxis] = parseFloat(document.getElementById( "ySlider" ).value); };
    // document.getElementById( "zSlider" ).onclick = function () { rot_theta[zAxis] = parseFloat(document.getElementById( "zSlider" ).value); };

    /* Animation */
    document.getElementById( "playButton" ).onclick = function(){ isPaused = false; };
    document.getElementById( "pauseButton" ).onclick = function(){ isPaused = true; };
    document.getElementById( "resetButton" ).onclick = function(){ bearResetAnimation(); };

    /* Parts rotations */
    /*
    document.getElementById("slider0").onchange = function(event) { bearComponentsAngles["torso"][X] = event.target.value; initBearNode(bearComponentsIDs["torso"]); };
    document.getElementById("slider1").onchange = function(event) { bearComponentsAngles["head"][X] = event.target.value; initBearNode(bearComponentsIDs["head"]); };
    document.getElementById("slider2").onchange = function(event) { bearComponentsAngles["leftUpperArm"][X] = event.target.value;  initBearNode(bearComponentsIDs["leftUpperArm"]); };
    document.getElementById("slider3").onchange = function(event) { bearComponentsAngles["leftLowerArm"][X] =  event.target.value;  initBearNode(bearComponentsIDs["leftLowerArm"]); };
    document.getElementById("slider4").onchange = function(event) { bearComponentsAngles["rightUpperArm"][X] = event.target.value; initBearNode(bearComponentsIDs["rightUpperArm"]); };
    document.getElementById("slider5").onchange = function(event) { bearComponentsAngles["rightLowerArm"][X] =  event.target.value;  initBearNode(bearComponentsIDs["rightLowerArm"]); };
    document.getElementById("slider6").onchange = function(event) { bearComponentsAngles["leftUpperLeg"][X] = event.target.value; initBearNode(bearComponentsIDs["leftUpperLeg"]); };
    document.getElementById("slider7").onchange = function(event) { bearComponentsAngles["leftLowerLeg"][X] = event.target.value;  initBearNode(bearComponentsIDs["leftLowerLeg"]); };
    document.getElementById("slider8").onchange = function(event) { bearComponentsAngles["rightUpperLeg"][X] =  event.target.value;  initBearNode(bearComponentsIDs["rightUpperLeg"]); };
    document.getElementById("slider9").onchange = function(event) { bearComponentsAngles["rightLowerLeg"][X] = event.target.value; initBearNode(bearComponentsIDs["rightLowerLeg"]); };
    document.getElementById("slider10").onchange = function(event) { bearComponentsAngles["head2"][X] = event.target.value;  initBearNode(bearComponentsIDs["head2"]); };
    */
};

/** GEOMETRY */
function cube(x_offset = 0, y_offset = 0, z_offset = 0, use_per_face_UVs = false ) {

    /*
    // Same texture for all faces, if now specified (= 0) use uvgrid
    if (tex_IDs.length == 1) {
        var id = tex_IDs[0];
        tex_IDs = [id, id, id, id, id, id];
    }
    */

    // custom = true -> different texcoords per face
    quad( 6, 5, 1, 2, x_offset, y_offset, z_offset, "top", use_per_face_UVs );  // top
    quad( 3, 0, 4, 7, x_offset, y_offset, z_offset, "bottom", use_per_face_UVs );  // bottom
    quad( 1, 0, 3, 2, x_offset, y_offset, z_offset, "side1", use_per_face_UVs );  // side 1
    quad( 2, 3, 7, 6, x_offset, y_offset, z_offset, "side2", use_per_face_UVs );  // side 2
    quad( 4, 5, 6, 7, x_offset, y_offset, z_offset, "side3", use_per_face_UVs );  // side 3
    quad( 5, 4, 0, 1, x_offset, y_offset, z_offset, "side4", use_per_face_UVs );  // side 4

};

function quad(a, b, c, d, x_offset = 0, y_offset = 0, z_offset = 0, face, use_per_face_UVs) {

    var offset = vec4(x_offset, y_offset, z_offset, 0);
    verticesArray.push(add(quad_vertices[a], offset));
    verticesArray.push(add(quad_vertices[b], offset));
    verticesArray.push(add(quad_vertices[c], offset));
    verticesArray.push(add(quad_vertices[d], offset));

    if (!use_per_face_UVs) {
        texCoordArray.push(quad_texCoord[0]);
        texCoordArray.push(quad_texCoord[1]);
        texCoordArray.push(quad_texCoord[2]);
        texCoordArray.push(quad_texCoord[3]);
        return;
    }

    var coords;
    switch(face) {
    case "top":
        coords = [ vec2(0, 0), vec2(0, 0.5), vec2(0.5, 0.5), vec2(0.5, 0) ];
        break;
    case "bottom":
        coords = [ vec2(0.5, 0.5), vec2(0.5, 1), vec2(1, 1), vec2(1, 0.5) ];
        break;
    case "side1":
    case "side2":
    case "side3":
    case "side4":
        coords = [ vec2(0, 0.5), vec2(0, 1), vec2(0.5, 1), vec2(0.5, 0.5) ];
        break;
    }

    texCoordArray.push(coords[0]);
    texCoordArray.push(coords[1]);
    texCoordArray.push(coords[2]);
    texCoordArray.push(coords[3]);   

};

/* Create a node with given parameters */
function createNode(transform, render, sibling, child){

    var node = {
        transform: transform, // Node trasformation matrix starting from root
        render: render,       // Render function to be used for the node
        sibling: sibling,     // Pointer to sibling
        child: child,         // Pointer to child
    }
    return node;
};

/* Deep copy of dictionaries */
function copyDictVec3(dict) {

    var new_dict = {};
    for(var key in dict) {
        new_dict[key] = copyVec3(dict[key]);
    }
    return new_dict;
}

function copyVec3(vec) {
    return arrToVec3(vec3ToArr(vec).slice())
}

function copyArr(arr) {
    return arr.slice();
}

function vec3ToArr(vec) {
    return [vec[0], vec[1], vec[2]];
}

function arrToVec3(arr) {
    return vec3(arr[0], arr[1], arr[2]);
}

function vec3Distance(vec1, vec2) {
    return Math.sqrt( Math.pow((vec2[0] - vec1[0]), 2) + 
                              Math.pow((vec2[1] - vec1[1]), 2) + 
                              Math.pow((vec2[2] - vec1[2]), 2)
                            );
}