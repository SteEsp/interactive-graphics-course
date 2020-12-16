"use strict";
/**
1. Replace the cube with a more complex and irregular geometry of 20 to 30 (maximum) vertices.
Each vertex should have associated a normal (3 or 4 coordinates) and a texture coordinate (2
coordinates). Explain how you choose the normal and texture coordinates.
2. Add the viewer position (your choice), a perspective projection (your choice of parameters) and
compute the ModelView and Projection matrices in the Javascript application. The viewer position
and viewing volume should be controllable with buttons, sliders or menus. Please choose the
parameters so that the object is clearly visible.
3. Add two light sources, a spotlight in a finite position and one directional. The parameters of the
spotlight should be controllable with buttons, sliders or menus. Assign to each light source all the
necessary parameters (your choice).
4. Assign to the object a material with the relevant properties (your choice).
5. Implement a per-fragment shading model based on the shading model described at the end of this
document.
6. Add a texture loaded from file (your choice), with the pixel color a combination of the color
computed using the lighting model and the texture. Add a button that activates/deactivates the
texture.
*/

/* Global vars */
var canvas;
var gl;

var program;

var verticesArray = [];
var colorsArray = [];
var texCoordArray = [];
var normalsArray = [];

var texture;

var flat = false;
//if (localStorage.getItem("flat") != null) flat = localStorage.getItem("flat");
var shader = "phong"; // "phong" or "cartoon"
if (localStorage.getItem("shader") != null) shader = localStorage.getItem("shader"); 

var xAxis = 0;
var yAxis = 1;
var zAxis = 2;

var rotX;
var rotY;
var rotZ;

var rot_theta = [0, 0.1, 0];
var curr_rot_theta = [180, 0, 0];

var rotationMatrix;
var cameraMatrix;
var modelViewMatrix, modelViewMatrixLoc;
var projMatrix, projMatrixLoc;
var nMatrix, nMatrixLoc;

var left = -10;
var right = 10;
var bottom = -3;
var ytop = 3;
var near = 0.1;
var far = 100.0;

var togglePerspective = true;
var toggleWireframe = false;
var toggleTextures = true;

var radius = 4.0;
var theta  = 170.0;
var phi    = 140.0;
var eye;

var fovy = 60.0;  // Field-of-view in Y direction angle (in degrees)
var aspect;       // Viewport aspect ratio

/* Constants */
const at = vec3(0.0, 0.0, 0.0);
const up = vec3(0.0, 1.0, 0.0);

/* Directional light */
var toggleDirectional = true;
var directionalLightDirection = vec4(-100, 26, 11, 0); // Directional light
var directionalLightAmbient = vec4(0.2, 0.2, 0.2, 1.0);
var directionalLightDiffuse = vec4(1.0, 1.0, 1.0, 1.0);
var directionalLightSpecular = vec4(1.0, 1.0, 1.0, 1.0);

/* Spotlight */
var toggleSpotlight = true;
var spotlightPosition; // The cone’s apex
var spotTheta = 360;
var spotPhi = 110;
var spotRadius = 6;
var spotCutoff = 6; // This angle is the aperture of the cone
var spotHarshness = 0.7;  // Harshness of cone of spotlight
var spotlightAmbient = vec4(0.0, 0.0, 0.0, 1.0);
var spotlightDiffuse = vec4(1.0, 0.0, 0.0, 1.0);
var spotlightSpecular = vec4(1.0, 0.0, 0.0, 1.0);

/* Global */
var globalAmbient = vec4(0.1, 0.1, 0.1, 1.0);

/* Material */
var materialAmbient = vec4(1.0, 1.0, 1.0, 1.0);
var materialDiffuse = vec4(1.0, 1.0, 1.0, 1.0);
var materialSpecular = vec4(0, 0, 0, 1.0);
var materialShininess = 100;

var vertices = [
    // vertices cone
    vec4( 0.000000, 0.000000, -1.000000, 1.0 ),
    vec4( 0.951057, 0.000000, -0.309017, 1.0 ),
    vec4( 0.587785, 0.000000, 0.809017, 1.0 ),
    vec4( 0.000000, 2.000000, 0.000000, 1.0 ),
    vec4( -0.587785, 0.000000, 0.809017, 1.0 ),
    vec4( -0.951056, 0.000000, -0.309017, 1.0 ),
    // vertices ball_1
    vec4( -0.147731, -1.789470, -0.401326, 1.0 ),
    vec4( 0.487492, -1.593432, -0.085445, 1.0 ),
    vec4( -0.114487, -1.689194, 0.327069, 1.0 ),
    vec4( -0.692840, -1.438490, -0.052905, 1.0 ),
    vec4( -0.448285, -1.187785, -0.700258, 1.0 ),
    vec4( 0.281195, -1.283547, -0.720362, 1.0 ),
    vec4( 0.334974, -1.121293, 0.458207, 1.0 ),
    vec4( -0.394506, -1.025531, 0.478311, 1.0 ),
    vec4( -0.600803, -0.715645, -0.156607, 1.0 ),
    vec4( 0.001176, -0.619883, -0.569120, 1.0 ),
    vec4( 0.579529, -0.870588, -0.189146, 1.0 ),
    // vertices ball_2
    vec4( 0.000000, -1.584916, -0.000000, 1.0 ),
    vec4( 0.935705, -0.976853, 0.304023, 1.0 ),
    vec4( 0.000005, -0.976853, 0.983856, 1.0 ),
    vec4( -0.935714, -0.976853, 0.304032, 1.0 ),
    vec4( -0.578292, -0.976853, -0.795959, 1.0 ),
    vec4( 0.578301, -0.976853, -0.795954, 1.0 ),
    vec4( 0.578292, 0.007020, 0.795959, 1.0 ),
    vec4( -0.578301, 0.007020, 0.795954, 1.0 ),
    vec4( -0.935705, 0.007020, -0.304023, 1.0 ),
    vec4( -0.000005, 0.007020, -0.983856, 1.0 ),
    vec4( 0.935714, 0.007020, -0.304032, 1.0 )
];

var indices_cone = [
    1, 4, 2, 
    2, 4, 3, 
    3, 4, 5, 
    5, 4, 6, 
    6, 4, 1, 
    2, 5, 6, 
    6, 1, 2, 
    2, 3, 5
];

var indices_ball_1 = [
    7, 8, 9, 
    8, 7, 12, 
    7, 9, 10, 
    7, 10, 11, 
    7, 11, 12, 
    8, 12, 17, 
    9, 8, 13, 
    10, 9, 14, 
    11, 10, 15, 
    12, 11, 16, 
    8, 17, 13, 
    9, 13, 14, 
    10, 14, 15, 
    11, 15, 16, 
    12, 16, 17
];

var indices_ball_2 = [
    18, 19, 20, 
    19, 18, 23, 
    18, 20, 21, 
    18, 21, 22, 
    18, 22, 23, 
    19, 23, 28, 
    20, 19, 24, 
    21, 20, 25, 
    22, 21, 26, 
    23, 22, 27, 
    19, 28, 24, 
    20, 24, 25, 
    21, 25, 26, 
    22, 26, 27, 
    23, 27, 28
];

var cone_uvs = [
    vec2(0.1, 0.1),
    vec2(0.25, 0.4),
    vec2(0.4, 0.1)
];

var ball_1_uvs = [
    vec2(0.6, 0.6),
    vec2(0.6, 0.9),
    vec2(0.75, 0.75)
]

var ball_2_uvs = [
    vec2(0.6, 0.1),
    vec2(0.6, 0.3),
    vec2(0.75, 0.25)
]

var verticesColors = [
    vec4( 1.0, 0.0, 0.0, 1.0 ),  // red
    vec4( 1.0, 1.0, 0.0, 1.0 ),  // yellow
    vec4( 0.0, 1.0, 0.0, 1.0 ),  // green
    vec4( 0.0, 0.0, 1.0, 1.0 ),  // blue
    vec4( 1.0, 0.0, 1.0, 1.0 ),  // magenta
    vec4( 1.0, 1.0, 1.0, 1.0 ),  // white
    vec4( 0.0, 1.0, 1.0, 1.0 )   // cyan
];

var numElementsToDraw = indices_cone.length + indices_ball_1.length + indices_ball_2.length;

window.onload = function init() {

    canvas = document.getElementById( "gl-canvas" );

    gl = canvas.getContext('webgl2');
    if (!gl) alert("WebGL 2.0 isn't available" );

    /* gl Settings */
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor(0.772, 0.882, 0.647, 1.0); // background color
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.frontFace(gl.CCW); // counter clockwise
	gl.cullFace(gl.BACK); 

    /* Load Mesh */
    computeMeshData();
    
    /*  Load shaders and initialize attribute buffers */
    if (shader == "phong") program = initShaders( gl, "vertex-shader", "fragment-shader" );
    if (shader == "cartoon") program = initShaders( gl, "vertex-shader", "fragment-shader-cartoon" );
    gl.useProgram( program );

    sendMeshData();

    modelViewMatrixLoc = gl.getUniformLocation( program, "uModelViewMatrix" );
    projMatrixLoc = gl.getUniformLocation( program, "uProjectionMatrix" );
    nMatrixLoc = gl.getUniformLocation( program, "uNormalMatrix" );

    /* Lighting */
    // Directional Light
    computeAndSendGlobalAmbientProduct();
    computeAndSendAmbientProduct();
    computeAndSendDiffuseProduct();
    computeAndSendSpecularProduct();
    computeAndSendLightsData();
    sendAdditionalParameters();

    /** Init GUI values */
    initGUIValues();

    /** Event listeners */
    initEventListeners();

    var image = document.getElementById("texture_img");
 
    configureTexture( image );

    render();
}

var render = function() {
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* Compute new RotationMatrix */
    computeRotationMatrix(); // custom rotation (lights do not rotate)

    /* Compute modelViewMatrix */
    modelViewMatrix = mat4(); // just the identity 
    modelViewMatrix = mult(modelViewMatrix, rotationMatrix);

    /* Compute cameraMatrix */
    computeCameraMatrix();

    modelViewMatrix = mult(cameraMatrix, modelViewMatrix); 
    nMatrix = normalMatrix(modelViewMatrix, true);
    
    /* Compute projMatrix */
    computeProjectionMatrix();

    //gl.uniformMatrix4fv( rotationMatrixLoc, false, flatten(rotationMatrix) );
    gl.uniformMatrix4fv( modelViewMatrixLoc, false, flatten(modelViewMatrix) );
    gl.uniformMatrix4fv( projMatrixLoc, false, flatten(projMatrix) );
    gl.uniformMatrix3fv( nMatrixLoc, false, flatten(nMatrix) );

    if(toggleWireframe) {
        gl.drawArrays( gl.LINE_LOOP, 0, numElementsToDraw );
    } else {
        gl.drawArrays( gl.TRIANGLES, 0, numElementsToDraw );
    }

    requestAnimationFrame(render);

    resize();
}

var computeRotationMatrix = function() {
    curr_rot_theta[xAxis] += rot_theta[xAxis];
    curr_rot_theta[yAxis] += rot_theta[yAxis];
    curr_rot_theta[zAxis] += rot_theta[zAxis];

    rotationMatrix = mat4();
    rotationMatrix = mult(rotationMatrix, rotate(curr_rot_theta[zAxis], [0, 0, 1]));
    rotationMatrix = mult(rotationMatrix, rotate(curr_rot_theta[yAxis], [0, 1, 0]));
    rotationMatrix = mult(rotationMatrix, rotate(curr_rot_theta[xAxis], [1, 0, 0]));
}

var computeCameraMatrix = function() {
    computeAndSendEyePosition();
    cameraMatrix = lookAt(eye, at, up);
}

var computeProjectionMatrix = function() {
    if (togglePerspective) {
        projMatrix = perspective(fovy, aspect, near, far);
    }
    else {
        projMatrix = ortho(left, right, bottom, ytop, near, far);
    }
}

var computeMeshData = function() {

    /* Load mesh */
    // Cone
    for ( var i = 0; i < indices_cone.length; ++i ) {
        verticesArray.push( vertices[indices_cone[i] - 1] );
        colorsArray.push( vec4( 1.0, 1.0, 1.0, 1.0 ) ); // white color to each vertex
        //colorsArray.push( verticesColors[ Math.floor(Math.random() * 7)] ); // random color to each vertex
    }  
    // Ball 1
    for ( var i = 0; i < indices_ball_1.length; ++i ) {
        verticesArray.push( vertices[indices_ball_1[i] - 1] );
        colorsArray.push( vec4( 1.0, 1.0, 1.0, 1.0 ) ); // white color to each vertex
        //colorsArray.push( verticesColors[ Math.floor(Math.random() * 7)] ); // random color to each vertex
    }
    // Ball 2  
    for ( var i = 0; i < indices_ball_2.length; ++i ) {
        verticesArray.push( vertices[indices_ball_2[i] - 1] );
        colorsArray.push( vec4( 1.0, 1.0, 1.0, 1.0 ) ); // white color to each vertex
        //colorsArray.push( verticesColors[ Math.floor(Math.random() * 7)] ); // random color to each vertex
    }  
    // Compute Cone UV
    for (var i = 0; i < indices_cone.length; ++i ) {
        if (i % 3 == 0) texCoordArray.push( cone_uvs[0] );
        if (i % 3 == 1) texCoordArray.push( cone_uvs[1] );
        if (i % 3 == 2) texCoordArray.push( cone_uvs[2] );
    }
    // Compute Ball 1 UV
    for (var i = 0; i < indices_ball_1.length; ++i ) {
        if (i % 3 == 0) texCoordArray.push( ball_1_uvs[0] );
        if (i % 3 == 1) texCoordArray.push( ball_1_uvs[1] );
        if (i % 3 == 2) texCoordArray.push( ball_1_uvs[2] );
    }
    // Compute Ball 2 UV
    for (var i = 0; i < indices_ball_2.length; ++i ) {
        if (i % 3 == 0) texCoordArray.push( ball_2_uvs[0] );
        if (i % 3 == 1) texCoordArray.push( ball_2_uvs[1] );
        if (i % 3 == 2) texCoordArray.push( ball_2_uvs[2] );
    }
    // Compute Normals Cone
    for (var i = 0; i < indices_cone.length; i += 3) {
        var a = vertices[indices_cone[i] - 1]; // v_0
        var b = vertices[indices_cone[i + 1] - 1]; // v_1
        var c = vertices[indices_cone[i + 2] - 1]; // v_2

        if (flat) {
            var t1 = subtract(b, a); 
            var t2 = subtract(c, a); 
            var normal = normalize(cross(t2, t1));

            normalsArray.push(vec4(normal[0], normal[1], normal[2], 0.0));
            normalsArray.push(vec4(normal[0], normal[1], normal[2], 0.0));
            normalsArray.push(vec4(normal[0], normal[1], normal[2], 0.0));
        } else {
            normalsArray.push(vec4(a[0],a[1], a[2], 0.0));
            normalsArray.push(vec4(b[0],b[1], b[2], 0.0));
            normalsArray.push(vec4(c[0],c[1], c[2], 0.0));
        }
    }
    // Compute Normals Ball 1
    for (var i = 0; i < indices_ball_1.length; i += 3) {
        var a = vertices[indices_ball_1[i] - 1]; // v_0
        var b = vertices[indices_ball_1[i + 1] - 1]; // v_1
        var c = vertices[indices_ball_1[i + 2] - 1]; // v_2

        if (flat) {
            var t1 = subtract(b, a); 
            var t2 = subtract(c, a); 
            var normal = normalize(cross(t2, t1));

            normalsArray.push(vec4(normal[0], normal[1], normal[2], 0.0));
            normalsArray.push(vec4(normal[0], normal[1], normal[2], 0.0));
            normalsArray.push(vec4(normal[0], normal[1], normal[2], 0.0));
        } else {
            normalsArray.push(vec4(a[0],a[1], a[2], 0.0));
            normalsArray.push(vec4(b[0],b[1], b[2], 0.0));
            normalsArray.push(vec4(c[0],c[1], c[2], 0.0));
        }
    }
    // Compute Normals Ball 2
    for (var i = 0; i < indices_ball_2.length; i += 3) {
        var a = vertices[indices_ball_2[i] - 1]; // v_0
        var b = vertices[indices_ball_2[i + 1] - 1]; // v_1
        var c = vertices[indices_ball_2[i + 2] - 1]; // v_2

        if (flat) {
            var t1 = subtract(b, a); 
            var t2 = subtract(c, a); 
            var normal = normalize(cross(t2, t1));

            normalsArray.push(vec4(normal[0], normal[1], normal[2], 0.0));
            normalsArray.push(vec4(normal[0], normal[1], normal[2], 0.0));
            normalsArray.push(vec4(normal[0], normal[1], normal[2], 0.0));
        } else {
            normalsArray.push(vec4(a[0],a[1], a[2], 0.0));
            normalsArray.push(vec4(b[0],b[1], b[2], 0.0));
            normalsArray.push(vec4(c[0],c[1], c[2], 0.0));
        }
    }
}

var sendMeshData = function() {

    // Normals buffer
    var normalsBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, normalsBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(normalsArray), gl.STATIC_DRAW );

    var normalLoc = gl.getAttribLocation( program, "aNormal" );
    gl.vertexAttribPointer( normalLoc, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( normalLoc );

    // Texture coords
    var texCoordBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, texCoordBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(texCoordArray), gl.STATIC_DRAW );

    var texCoordLoc = gl.getAttribLocation( program, "aTexCoord" );
    gl.vertexAttribPointer( texCoordLoc, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( texCoordLoc );

    // Colors buffer
    var colorsBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, colorsBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(colorsArray), gl.STATIC_DRAW );

    var colorsLoc = gl.getAttribLocation( program, "aColor" );
    gl.vertexAttribPointer( colorsLoc, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( colorsLoc );

    // Vertex buffer
    var verticesBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, verticesBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(verticesArray), gl.STATIC_DRAW );

    var verticesLoc = gl.getAttribLocation( program, "aPosition" );
    gl.vertexAttribPointer( verticesLoc, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( verticesLoc );

}

function configureTexture( image ) {
    texture = gl.createTexture();
    gl.bindTexture( gl.TEXTURE_2D, texture );
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, 
         gl.RGBA, gl.UNSIGNED_BYTE, image );
    gl.generateMipmap( gl.TEXTURE_2D );
    gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, 
                      gl.NEAREST_MIPMAP_LINEAR );
    gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST );
    
    gl.uniform1i(gl.getUniformLocation(program, "uTextureMap"), 0);
}

/* Init values in the html page */
var initGUIValues = function() {

    /* Viewing Parameters */
    document.getElementById("togglePerspective").checked = togglePerspective;
    document.getElementById("top").disabled = togglePerspective;
    document.getElementById("bottom").disabled = togglePerspective;
    document.getElementById("left").disabled = togglePerspective;
    document.getElementById("right").disabled = togglePerspective;
    
    document.getElementById("toggleWireframe").checked = toggleWireframe;   
    document.getElementById("near").value = near;
    document.getElementById("far").value = far;
    document.getElementById("top").value = ytop;
    document.getElementById("bottom").value = bottom;
    document.getElementById("left").value = left;
    document.getElementById("right").value = right;
    
    document.getElementById("radiusSlider").value = radius;
    document.getElementById("thetaSlider").value = theta;
    document.getElementById("phiSlider").value = phi;
    document.getElementById("fovSlider").value = fovy;
    
    /* Shader */
    if (shader == "phong") document.getElementById("phongShader").checked = true;
    if (shader == "cartoon") document.getElementById("cartoonShader").checked = true;
    //document.getElementById("toggleFlatShading").checked = flat;

    /* Rotation */
    document.getElementById( "xSlider" ).value = rot_theta[xAxis];
    document.getElementById( "ySlider" ).value = rot_theta[yAxis];
    document.getElementById( "zSlider" ).value = rot_theta[zAxis];    

    /* Global ambient */
    document.getElementById("global_ambient_r").value = globalAmbient[0];
    document.getElementById("global_ambient_g").value = globalAmbient[1];
    document.getElementById("global_ambient_b").value = globalAmbient[2];

    /* Directiona light properties */
    if (toggleDirectional) document.getElementById("toggleDirectional").checked = true;
    else document.getElementById("toggleDirectional").checked = false;
    document.getElementById("dir_X").value = directionalLightDirection[0];
    document.getElementById("dir_Y").value = directionalLightDirection[1];
    document.getElementById("dir_Z").value = directionalLightDirection[2];
    document.getElementById("dir_ambient_r").value = directionalLightAmbient[0];
    document.getElementById("dir_ambient_g").value = directionalLightAmbient[1];
    document.getElementById("dir_ambient_b").value = directionalLightAmbient[2];
    document.getElementById("dir_diffuse_r").value = directionalLightDiffuse[0];
    document.getElementById("dir_diffuse_g").value = directionalLightDiffuse[1];
    document.getElementById("dir_diffuse_b").value = directionalLightDiffuse[2];
    document.getElementById("dir_specular_r").value = directionalLightSpecular[0];
    document.getElementById("dir_specular_g").value = directionalLightSpecular[1];
    document.getElementById("dir_specular_b").value = directionalLightSpecular[2];

    /* Spotlight properties */
    document.getElementById("toggleSpotlight").checked = toggleSpotlight;
    document.getElementById("spotRadiusSlider").value = spotRadius;
    document.getElementById("spotThetaSlider").value = spotTheta;
    document.getElementById("spotPhiSlider").value = spotPhi;
    document.getElementById("spot_harshness").value = spotHarshness;
    document.getElementById("spot_ambient_r").value = spotlightAmbient[0];
    document.getElementById("spot_ambient_g").value = spotlightAmbient[1];
    document.getElementById("spot_ambient_b").value = spotlightAmbient[2];
    document.getElementById("spot_diffuse_r").value = spotlightDiffuse[0];
    document.getElementById("spot_diffuse_g").value = spotlightDiffuse[1];
    document.getElementById("spot_diffuse_b").value = spotlightDiffuse[2];
    document.getElementById("spot_specular_r").value = spotlightSpecular[0];
    document.getElementById("spot_specular_g").value = spotlightSpecular[1];
    document.getElementById("spot_specular_b").value = spotlightSpecular[2];
    document.getElementById("spot_cutoff").value = spotCutoff;

    /* Material properties */
    document.getElementById("ambient_r").value = materialAmbient[0];
    document.getElementById("ambient_g").value = materialAmbient[1];
    document.getElementById("ambient_b").value = materialAmbient[2];
    document.getElementById("diffuse_r").value = materialDiffuse[0];
    document.getElementById("diffuse_g").value = materialDiffuse[1];
    document.getElementById("diffuse_b").value = materialDiffuse[2];
    document.getElementById("specular_r").value = materialSpecular[0];
    document.getElementById("specular_g").value = materialSpecular[1];
    document.getElementById("specular_b").value = materialSpecular[2];
    document.getElementById("shininess").value = materialShininess;

    /* Texture */
    document.getElementById("toggleTextures").checked = toggleTextures;
}

/** Event listeners */
var initEventListeners = function() {

    /* Viewing Parameters */
    document.getElementById("togglePerspective").onchange = function(){ 
        togglePerspective = !togglePerspective; 
        document.getElementById("radiusSlider").disabled = !togglePerspective;
        document.getElementById("fovSlider").disabled = !togglePerspective;
        document.getElementById("top").disabled = togglePerspective;
        document.getElementById("bottom").disabled = togglePerspective;
        document.getElementById("left").disabled = togglePerspective;
        document.getElementById("right").disabled = togglePerspective;

        if (togglePerspective) {
            near = 0.1;
            far = 100.0;
        } else {
            near = -100.0;
            far = 100.0;
        }

        document.getElementById("near").value = near;
        document.getElementById("far").value = far;
    };
    document.getElementById("toggleWireframe").onchange = function(){ toggleWireframe = !toggleWireframe; }
    document.getElementById("radiusSlider").onchange = function(){ radius = document.getElementById("radiusSlider").value; };
    document.getElementById("thetaSlider").onchange = function(){ theta = document.getElementById("thetaSlider").value; };
    document.getElementById("phiSlider").onchange = function(){ phi = document.getElementById("phiSlider").value; };
    document.getElementById("fovSlider").onchange = function(){ fovy = document.getElementById("fovSlider").value; };

    document.getElementById("near").onchange = function(){ near = parseFloat(document.getElementById("near").value); };
    document.getElementById("far").onchange = function(){ far = parseFloat(document.getElementById("far").value); };
    document.getElementById("top").onchange = function(){ ytop = parseFloat(document.getElementById("top").value); };
    document.getElementById("bottom").onchange = function(){ bottom = parseFloat(document.getElementById("bottom").value); };
    document.getElementById("left").onchange = function(){ left = parseFloat(document.getElementById("left").value); };
    document.getElementById("right").onchange = function(){ right = parseFloat(document.getElementById("right").value); };

    /* Global ambient */
    document.getElementById("global_ambient_r").onchange = function(){ globalAmbient[0] = parseFloat(document.getElementById("global_ambient_r").value); computeAndSendGlobalAmbientProduct(); };
    document.getElementById("global_ambient_g").onchange = function(){ globalAmbient[1] = parseFloat(document.getElementById("global_ambient_g").value); computeAndSendGlobalAmbientProduct(); };
    document.getElementById("global_ambient_b").onchange = function(){ globalAmbient[2] = parseFloat(document.getElementById("global_ambient_b").value); computeAndSendGlobalAmbientProduct(); };

    /* Directional light */
    document.getElementById("dir_X").onchange = function(){ directionalLightDirection[0] = parseFloat(document.getElementById("dir_X").value); computeAndSendLightsData(); };
    document.getElementById("dir_Y").onchange = function(){ directionalLightDirection[1] = parseFloat(document.getElementById("dir_Y").value); computeAndSendLightsData(); };
    document.getElementById("dir_Z").onchange = function(){ directionalLightDirection[2] = parseFloat(document.getElementById("dir_Z").value); computeAndSendLightsData(); };
    document.getElementById("dir_ambient_r").onchange = function(){ directionalLightAmbient[0] = parseFloat(document.getElementById("dir_ambient_r").value); computeAndSendAmbientProduct(); };
    document.getElementById("dir_ambient_g").onchange = function(){ directionalLightAmbient[1] = parseFloat(document.getElementById("dir_ambient_g").value); computeAndSendAmbientProduct(); };
    document.getElementById("dir_ambient_b").onchange = function(){ directionalLightAmbient[2] = parseFloat(document.getElementById("dir_ambient_b").value); computeAndSendAmbientProduct(); };
    document.getElementById("dir_diffuse_r").onchange = function(){ directionalLightDiffuse[0] = parseFloat(document.getElementById("dir_diffuse_r").value); computeAndSendDiffuseProduct(); };
    document.getElementById("dir_diffuse_g").onchange = function(){ directionalLightDiffuse[1] = parseFloat(document.getElementById("dir_diffuse_g").value); computeAndSendDiffuseProduct(); };
    document.getElementById("dir_diffuse_b").onchange = function(){ directionalLightDiffuse[2] = parseFloat(document.getElementById("dir_diffuse_b").value); computeAndSendDiffuseProduct(); };
    document.getElementById("dir_specular_r").onchange = function(){ directionalLightSpecular[0] = parseFloat(document.getElementById("dir_specular_r").value); computeAndSendSpecularProduct(); };
    document.getElementById("dir_specular_g").onchange = function(){ directionalLightSpecular[1] = parseFloat(document.getElementById("dir_specular_g").value); computeAndSendSpecularProduct(); };
    document.getElementById("dir_specular_b").onchange = function(){ directionalLightSpecular[2] = parseFloat(document.getElementById("dir_specular_b").value); computeAndSendSpecularProduct(); };
    document.getElementById("toggleDirectional").onchange = function(){ toggleDirectional = !toggleDirectional; computeAndSendLightsData(); };

    /* Spotlight */
    document.getElementById("spotRadiusSlider").onchange = function() { spotRadius = parseFloat(document.getElementById("spotRadiusSlider").value); computeAndSendLightsData(); };
    document.getElementById("spotThetaSlider").onchange = function() { spotTheta = parseFloat(document.getElementById("spotThetaSlider").value); computeAndSendLightsData(); };
    document.getElementById("spotPhiSlider").onchange = function() { spotPhi = parseFloat(document.getElementById("spotPhiSlider").value); computeAndSendLightsData(); };
    document.getElementById("spot_harshness").onchange = function() { spotHarshness = parseFloat(document.getElementById("spot_harshness").value); computeAndSendLightsData(); }
    document.getElementById("spot_ambient_r").onchange = function(){ spotlightAmbient[0] = parseFloat(document.getElementById("spot_ambient_r").value); computeAndSendAmbientProduct(); };
    document.getElementById("spot_ambient_g").onchange = function(){ spotlightAmbient[1] = parseFloat(document.getElementById("spot_ambient_g").value); computeAndSendAmbientProduct(); };
    document.getElementById("spot_ambient_b").onchange = function(){ spotlightAmbient[2] = parseFloat(document.getElementById("spot_ambient_b").value); computeAndSendAmbientProduct(); };
    document.getElementById("spot_diffuse_r").onchange = function(){ spotlightDiffuse[0] = parseFloat(document.getElementById("spot_diffuse_r").value); computeAndSendDiffuseProduct(); };
    document.getElementById("spot_diffuse_g").onchange = function(){ spotlightDiffuse[1] = parseFloat(document.getElementById("spot_diffuse_g").value); computeAndSendDiffuseProduct(); };
    document.getElementById("spot_diffuse_b").onchange = function(){ spotlightDiffuse[2] = parseFloat(document.getElementById("spot_diffuse_b").value); computeAndSendDiffuseProduct(); };
    document.getElementById("spot_specular_r").onchange = function(){ spotlightSpecular[0] = parseFloat(document.getElementById("spot_specular_r").value); computeAndSendSpecularProduct(); };
    document.getElementById("spot_specular_g").onchange = function(){ spotlightSpecular[1] = parseFloat(document.getElementById("spot_specular_g").value); computeAndSendSpecularProduct(); };
    document.getElementById("spot_specular_b").onchange = function(){ spotlightSpecular[2] = parseFloat(document.getElementById("spot_specular_b").value); computeAndSendSpecularProduct(); };
    document.getElementById("spot_cutoff").onchange = function(){ spotCutoff = parseFloat(document.getElementById("spot_cutoff").value); computeAndSendLightsData(); };
    document.getElementById("toggleSpotlight").onchange = function(){ toggleSpotlight = !toggleSpotlight; computeAndSendLightsData(); };

    /* Shader */
    document.getElementById("phongShader").onchange = function(){ shader = document.getElementById("phongShader").value; localStorage.setItem("shader", shader); location.reload(); };
    document.getElementById("cartoonShader").onchange = function(){ shader = document.getElementById("cartoonShader").value; localStorage.setItem("shader", shader); location.reload(); };
    //document.getElementById("toggleFlatShading").onchange = function(){ flat = !flat; localStorage.setItem("flat", flat); location.reload(); };

    /* Rotation */
    document.getElementById( "xSlider" ).onchange = function () { rot_theta[xAxis] = parseFloat(document.getElementById( "xSlider" ).value); };
    document.getElementById( "ySlider" ).onclick = function () { rot_theta[yAxis] = parseFloat(document.getElementById( "ySlider" ).value); };
    document.getElementById( "zSlider" ).onclick = function () { rot_theta[zAxis] = parseFloat(document.getElementById( "zSlider" ).value); };

    /* Material properties */
    document.getElementById("ambient_r").onchange = function(){ materialAmbient[0] = parseFloat(document.getElementById("ambient_r").value); computeAndSendAmbientProduct(); };
    document.getElementById("ambient_g").onchange = function(){ materialAmbient[1] = parseFloat(document.getElementById("ambient_g").value); computeAndSendAmbientProduct(); };
    document.getElementById("ambient_b").onchange = function(){ materialAmbient[2] = parseFloat(document.getElementById("ambient_b").value); computeAndSendAmbientProduct(); };
    document.getElementById("diffuse_r").onchange = function(){ materialDiffuse[0] = parseFloat(document.getElementById("diffuse_r").value); computeAndSendDiffuseProduct(); };
    document.getElementById("diffuse_g").onchange = function(){ materialDiffuse[1] = parseFloat(document.getElementById("diffuse_g").value); computeAndSendDiffuseProduct(); };
    document.getElementById("diffuse_b").onchange = function(){ materialDiffuse[2] = parseFloat(document.getElementById("diffuse_b").value); computeAndSendDiffuseProduct(); };
    document.getElementById("specular_r").onchange = function(){ materialSpecular[0] = parseFloat(document.getElementById("specular_r").value); computeAndSendSpecularProduct(); };
    document.getElementById("specular_g").onchange = function(){ materialSpecular[1] = parseFloat(document.getElementById("specular_g").value); computeAndSendSpecularProduct(); };
    document.getElementById("specular_b").onchange = function(){ materialSpecular[2] = parseFloat(document.getElementById("specular_b").value); computeAndSendSpecularProduct(); };
    document.getElementById("shininess").onchange = function(){ materialShininess = parseFloat(document.getElementById("shininess").value); sendAdditionalParameters(); }

    /* Textures */
    document.getElementById("toggleTextures").onchange = function(){ toggleTextures = !toggleTextures; sendAdditionalParameters(); }
}

var computeAndSendEyePosition = function() {
    var theta_rad = theta * Math.PI/180;
    var phi_rad = phi * Math.PI/180;
    eye = vec3(radius*Math.sin(theta_rad)*Math.cos(phi_rad), radius*Math.sin(theta_rad)*Math.sin(phi_rad), radius*Math.cos(theta_rad));
    gl.uniform3fv( gl.getUniformLocation( program, "uEyePosition" ), eye );
}

var computeAndSendGlobalAmbientProduct = function() {
    var globalAmbientProduct = mult(globalAmbient, materialAmbient);
    gl.uniform4fv( gl.getUniformLocation( program, "uGlobalAmbientProduct" ), globalAmbientProduct );
}

var computeAndSendAmbientProduct = function() {
    var directionalLightAmbientProduct = mult(directionalLightAmbient, materialAmbient);
    var spotlightAmbientProduct = mult(spotlightAmbient, materialAmbient);
    gl.uniform4fv( gl.getUniformLocation( program, "uDirAmbientProduct" ), directionalLightAmbientProduct );
    gl.uniform4fv( gl.getUniformLocation( program, "uSpotAmbientProduct" ), spotlightAmbientProduct );
}

var computeAndSendDiffuseProduct = function() {
    var directionalLightDiffuseProduct = mult(directionalLightDiffuse, materialDiffuse);
    var spotlightDiffuseProduct = mult(spotlightDiffuse, materialDiffuse);
    gl.uniform4fv( gl.getUniformLocation( program, "uDirDiffuseProduct" ), directionalLightDiffuseProduct );
    gl.uniform4fv( gl.getUniformLocation( program, "uSpotDiffuseProduct" ), spotlightDiffuseProduct );
}

var computeAndSendSpecularProduct = function() {
    var directionalLightSpecularProduct = mult(directionalLightSpecular, materialSpecular);
    var spotlightSpecularProduct = mult(spotlightSpecular, materialSpecular);
    gl.uniform4fv( gl.getUniformLocation( program, "uDirSpecularProduct" ), directionalLightSpecularProduct );
    gl.uniform4fv( gl.getUniformLocation( program, "uSpotSpecularProduct" ), spotlightSpecularProduct );
}

var computeAndSendLightsData = function() {
    // Directional
    gl.uniform4fv( gl.getUniformLocation( program, "uDirDirection" ), directionalLightDirection );
    gl.uniform1i( gl.getUniformLocation( program, "uIsDirectionalLightActive" ), toggleDirectional );
    
    // Spotlight
    var spotlightPosition = vec4(0.0, 0.0, spotRadius * 1.0, 1.0);
    spotlightPosition = mult(rotate(-spotTheta, vec3(0.0, 1.0, 0.0)), spotlightPosition);
    spotlightPosition = mult(rotate(-spotPhi, vec3(1.0, 0.0, 0.0)), spotlightPosition);
    gl.uniform4fv( gl.getUniformLocation( program, "uSpotPosition" ), spotlightPosition );
    gl.uniform1i( gl.getUniformLocation( program, "uIsSpotlightActive" ), toggleSpotlight );
    var outerSpotCutoff = Math.cos(Math.PI / 180.0 * spotCutoff);
    var innerSpotCutoff = Math.cos(Math.PI / 180.0 * (spotCutoff * spotHarshness));
    gl.uniform1f( gl.getUniformLocation( program, "uOuterSpotCutoff" ), outerSpotCutoff);
    gl.uniform1f( gl.getUniformLocation( program, "uInnerSpotCutoff" ), innerSpotCutoff);
}

var sendAdditionalParameters = function() {
    gl.uniform1f( gl.getUniformLocation( program, "uShininess" ), materialShininess );
    gl.uniform1i( gl.getUniformLocation( program, "uIsTextureActive" ), toggleTextures );
}

var log_state = function(){
    // TODO extend to all variables
    console.log("near = " + near);
    console.log("far = " + far);
    console.log("radius = " + radius);
    console.log("theta = " + theta);
    console.log("phi = " + phi);
    console.log("\n");
}

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
}