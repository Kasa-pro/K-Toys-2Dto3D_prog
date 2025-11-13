// Import all the Three.js parts you need
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- (1) GLOBAL VARIABLES ---

// PUT YOUR NEW REPLICATE API KEY HERE (for polling requests)
const apiKey = "r8_7WubxKQUbQ4j1ZaQzi2M4zPC8XeYZfT2GMGtn"; 

// Get references to the HTML elements
const imageInput = document.getElementById('imageInput');
const generateButton = document.getElementById('generateButton');
const statusText = document.getElementById('status');

let scene, camera, renderer, controls;
let currentModel; 

// --- (2) THREE.JS SCENE SETUP ---

function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdddddd);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.update();
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// --- (3) API CALLING LOGIC (UPDATED FOR NETLIFY PROXY + REPLICATE) ---

generateButton.addEventListener('click', handleGenerateClick);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function handleGenerateClick() {
    const file = imageInput.files[0];
    if (!file) {
        statusText.innerText = "Error: Please select an image file first.";
        return;
    }

    if (currentModel) {
        scene.remove(currentModel);
    }

    statusText.innerText = "Processing image...";

    let imageDataUri;
    try {
        imageDataUri = await fileToBase64(file);
    } catch (error) {
        statusText.innerText = `Error processing image: ${error.message}`;
        return;
    }

    statusText.innerText = "Starting 3D model generation...";

    try {
        // --- API CALL 1: Start the Replicate prediction (VIA YOUR NETLIFY PROXY) ---
        const response = await fetch("/api/replicate", { // This calls YOUR Netlify proxy
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                version: "d432953e1bABc455c1F6E13C41D7d751B7863E5668d2eC003639C095E7C803E1",
                input: {
                    image: imageDataUri
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Proxy error: ${response.status} - ${errorData.detail}`);
        }

        const prediction = await response.json();
        const pollUrl = prediction.urls.get; 

        statusText.innerText = "Model is 'warming up'... Please wait.";

        // --- API CALL 2: Poll for the result (DIRECTLY to Replicate) ---
        let modelUrl = null;
        while (!modelUrl) {
            const pollResponse = await fetch(pollUrl, { // Direct call to Replicate
                method: "GET",
                headers: {
                    "Authorization": `Token ${apiKey}` // Using the API key from top of app.js
                }
            });

            const pollData = await pollResponse.json();

            if (pollData.status === 'succeeded') {
                modelUrl = pollData.output;
                break;

            } else if (pollData.status === 'failed' || pollData.status === 'canceled') {
                throw new Error(`Model generation failed: ${pollData.error}`);

            } else {
                await sleep(3000);
            }
        }

        statusText.innerText = "Generation complete! Loading 3D model...";
        loadModel(modelUrl);

    } catch (error) {
        console.error("Error during API call:", error);
        statusText.innerText = `Error: ${error.message}. Check console.`;
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// --- (4) 3D MODEL LOADING ---

function loadModel(modelUrl) {
    const loader = new GLTFLoader();

    loader.load(
        modelUrl,
        function (gltf) {
            currentModel = gltf.scene;
            scene.add(currentModel);
            statusText.innerText = "Model loaded! Click and drag to rotate.";
        },
        function (xhr) {
            const percentLoaded = (xhr.loaded / xhr.total * 100).toFixed(2);
            statusText.innerText = `Loading model... ${percentLoaded}%`;
        },
        function (error) {
            console.error("An error happened while loading the model:", error);
            statusText.innerText = "Error: Could not load the 3D model.";
        }
    );
}

// --- (5) START THE APP ---
initThree();
animate();
