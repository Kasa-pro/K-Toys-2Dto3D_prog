// Import all the Three.js parts you need
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- (1) GLOBAL VARIABLES ---

// No API key needed for this public Hugging Face demo!
// const apiKey = ""; // Keep this line commented or remove it

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

// --- (3) API CALLING LOGIC (UPDATED FOR GRADIO HUGGING FACE) ---

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

    statusText.innerText = "Image processed. Sending to TripoSR AI...";

    // --- Hugging Face Gradio API Endpoint ---
    const gradioApiUrl = "https://gdtharusha-3d-modle-generator.hf.space/--replicas/v48hg/run/predict"; // THIS IS THE URL FROM YOUR SCREENSHOT!

    try {
        const response = await fetch(gradioApiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            // The 'data' array in the body must match the Gradio function's inputs
            body: JSON.stringify({
                fn_index: 0, // This is typically 0 for the first function in a Gradio app
                data: [
                    imageDataUri, // The Base64 image
                    0, // Corresponds to num_inference_steps (defaulting for now)
                    20 // Corresponds to denoising_steps (defaulting for now)
                ]
            })
        });

        if (!response.ok) {
            // Get more detailed error info from Hugging Face
            const errorText = await response.text(); // Use text() because it might not be JSON
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log("Hugging Face API Response:", data); // Log the full response

        // Hugging Face Gradio APIs often return a list of outputs
        // The GLB model URL should be in data.data[0] or similar
        // Let's assume the first output is the GLB URL for now, but we may need to adjust
        // Check the console.log output for the exact path!
        const modelUrl = data.data[0]; // Assuming the first item in 'data' is the model URL

        if (!modelUrl || typeof modelUrl !== 'string' || !modelUrl.endsWith('.glb')) {
             throw new Error("Could not find a valid .glb model URL in the API response.");
        }

        statusText.innerText = "Generation complete! Loading 3D model...";
        loadModel(modelUrl);

    } catch (error) {
        console.error("Error during API call:", error);
        statusText.innerText = `Error: ${error.message}. Check console for details.`;
    }
}

// NEW HELPER FUNCTION: Convert File object to Base64 Data URI (Same as before)
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// --- (4) 3D MODEL LOADING (Same as before) ---

function loadModel(modelUrl) {
    const loader = new GLTFLoader();

    loader.load(
        modelUrl,
        // (gltf) is the loaded 3D model data
        function (gltf) {
            currentModel = gltf.scene; // Save the model
            scene.add(currentModel); // Add model to the 3D world
            statusText.innerText = "Model loaded! Click and drag to rotate.";

            // Optional: Adjust model scale/position if it's too big/small
            // gltf.scene.scale.set(0.1, 0.1, 0.1);
            // gltf.scene.position.set(0, -1, 0);
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
