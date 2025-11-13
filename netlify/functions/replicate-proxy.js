// netlify/functions/replicate-proxy.js
const fetch = require('node-fetch'); // node-fetch is available in Netlify functions

// Retrieve your Replicate API key from Netlify Environment Variables
// DO NOT hardcode your API key here!
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY; 

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    if (!REPLICATE_API_KEY) {
        console.error("Replicate API Key not set in Netlify Environment Variables.");
        return {
            statusCode: 500,
            body: JSON.stringify({ detail: "Server configuration error: Replicate API key missing." }),
        };
    }

    try {
        const requestBody = JSON.parse(event.body);

        // Replicate's API endpoint
        const replicateApiUrl = "https://api.replicate.com/v1/predictions";

        const response = await fetch(replicateApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${REPLICATE_API_KEY}`, // Replicate uses 'Token' for server-side
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody) // Forward the body from the client
        });

        // If the initial prediction creation fails, return the error
        if (!response.ok) {
            const errorData = await response.json();
            return {
                statusCode: response.status,
                body: JSON.stringify(errorData)
            };
        }

        const data = await response.json();

        // Set CORS headers for the response
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*", // Allow all origins for simplicity, but you can restrict it
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
            },
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error("Proxy function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ detail: `Proxy error: ${error.message}` })
        };
    }
};
