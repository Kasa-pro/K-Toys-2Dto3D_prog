// Import all the Three.js parts you need
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- (1) GLOBAL VARIABLES ---

// PUT YOUR SECRET KEY HERE
const apiKey = "msy_o29s5pzvPJa7B5vMER334XxIvywh8iuiyLEX"; 

// Get references to the HTML elements
const imageInput = document.getElementById('imageInput');
const generateButton = document.getElementById('generateButton');
const statusText = document.getElementById('status');

let scene, camera, renderer, controls;
let currentModel; // A variable to hold the current model

// --- (2) THREE.JS SCENE SETUP ---

function initThree() {
    // Scene (the 3D world)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdddddd); // Light gray background

    // Camera (what you see)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Renderer (draws the scene on the screen)
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement); // Add the canvas to the page

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Controls (to rotate/zoom with mouse)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.update();

    // Handle window resizing
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// Animation Loop (runs 60 times/sec)
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// --- (3) API CALLING LOGIC ---

// Add click event to the "Generate" button
generateButton.addEventListener('click', handleGenerateClick);

// ... (existing imports and global variables) ...

// --- (2) THREE.JS SCENE SETUP (No changes here) ---

// ... (existing initThree and animate functions) ...

// --- (3) API CALLING LOGIC (BIG CHANGES HERE) ---

generateButton.addEventListener('click', handleGenerateClick);

async function handleGenerateClick() {
    const file = imageInput.files[0];
    if (!file) {
        statusText.innerText = "Error: Please select an image file first.";
        return;
    }

    // Clear any old model from the scene
    if (currentModel) {
        scene.remove(currentModel);
    }

    statusText.innerText = "Processing image...";

    // 1. Convert the uploaded file to a Base64 Data URI
    let imageDataUri;
    try {
        imageDataUri = await fileToBase64(file);
    } catch (error) {
        statusText.innerText = `Error processing image: ${error.message}`;
        console.error("Error converting file to Base64:", error);
        return;
    }

    statusText.innerText = "Image processed. Sending to Meshy AI...";

    try {
        // --- API CALL 1: Start the generation task ---
        const response = await fetch("https://api.meshy.ai/v1/image-to-3d", { // NOTE: API endpoint changed in docs to /openapi/v1/image-to-3d but the one you had is probably correct for direct use
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json" // CRITICAL: Now sending JSON
            },
            // CRITICAL: Now sending a JSON body with image_url
            body: JSON.stringify({
                image_url: imageDataUri, // Use the base64 data URI here
                // You can add optional parameters here if you want:
                // ai_model: "latest", // Or "meshy-4" etc.
                // should_texture: true,
                // should_remesh: true
            })
        });

        // The rest of your API error handling and polling logic
        if (!response.ok) {
            // Added more detailed error logging from Meshy response
            const errorData = await response.json(); 
            throw new Error(`API error: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const resultId = data.result;
        statusText.innerText = "Generation complete! Waiting for model to process... This may take a minute or two.";

        // --- API CALL 2: Poll for the result ---
        await pollForResult(resultId);

    } catch (error) {
        console.error("Error during API call:", error);
        statusText.innerText = `Error: ${error.message}. Check console for details.`;
    }
}

// NEW HELPER FUNCTION: Convert File object to Base64 Data URI
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// ... (rest of pollForResult and loadModel functions remain the same) ...

// Utility function to make the code wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function pollForResult(resultId) {
    while (true) {
        try {
            const pollResponse = await fetch(`https://api.meshy.ai/v1/image-to-3d/${resultId}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`
                }
            });

            const pollData = await pollResponse.json();

            if (pollData.status === 'SUCCEEDED') {
                // SUCCESS! Get the model URL and load it
                const modelUrl = pollData.model_url; // This is the .glb file URL
                statusText.innerText = "Generation complete! Loading 3D model...";
                loadModel(modelUrl);
                break; // Exit the loop

            } else if (pollData.status === 'FAILED') {
                throw new Error("Model generation failed.");

            } else {
                // It's still 'PROCESSING'. Wait 5 seconds and check again.
                await sleep(5000); 
            }
        } catch (error) {
            console.error("Error during polling:", error);
            statusText.innerText = `Error: ${error.message}`;
            break; // Exit loop on error
        }
    }
}

// --- (4) 3D MODEL LOADING ---

function loadModel(modelUrl) {
    const loader = new GLTFLoader();
    
    loader.load(
        modelUrl,
        // (gltf) is the loaded 3D model data
        function (gltf) {
            currentModel = gltf.scene; // Save the model
            scene.add(currentModel); // Add model to the 3D world
            statusText.innerText = "Model loaded! Click and drag to rotate.";
        },
        // (xhr) is the loading progress
        function (xhr) {
            const percentLoaded = (xhr.loaded / xhr.total * 100).toFixed(2);
            statusText.innerText = `Loading model... ${percentLoaded}%`;
        },
        // (error) is called if something goes wrong
        function (error) {
            console.error("An error happened while loading the model:", error);
            statusText.innerText = "Error: Could not load the 3D model.";
        }
    );
}


// --- (5) START THE APP ---
initThree();

animate();
