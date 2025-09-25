import axios from 'axios';
import express, { Router } from 'express';
import serverless from "serverless-http";

const api = express();
const TRADETRON_URL = 'https://api.tradetron.tech/api';

// Entry and Exit signal from TradingView
const MY_STGY_AUTH_TOKEN = '6c074f02-0d74-447e-ba06-6a4859a01fad'

const expectedFromAddress = "noreply@tradingview.com";

const getActionValues = (action) => {
    console.log("action=" + action)
    switch (action) {
        case "buy":
            return { key: "nifty_buy", value: "1", key1: "nifty_sell", value1: "0" }
        case "closebuy":
            return { key: "nifty_buy", value: "0" }
        case "sell":
            return { key: "nifty_sell", value: "1", key1: "nifty_buy", value1: "0" }
        case "closesell":
            return { key: "nifty_sell", value: "0" }
        default:
            return null
    }
}

api.use(express.json());

const router = Router();

router.get('/health', (req, res) => {
    res.send("OK")
});

router.post('/webhook', async (req, res) => {
    console.log(req.body)
    let alertMessage = req.body.summary
    let fromAddress = req.body.fromAddress

    if (alertMessage === "Sample Summary") {
        return res.send("Ok")
    }
    if (fromAddress !== expectedFromAddress) {
        console.log("Email mismatch")
        return
    }
    if (alertMessage === null || alertMessage === undefined) {
        console.log("Alert message is null")
        return
    }
    const match = alertMessage.match(/nifty_action=([^ ]+)/);
    let action = null
    if (match) {
        action = match[1] ? match[1].trim() : null
    }

    if (action === null || action === undefined) {
        console.log("Action is null")
        return
    }
    let stopLoss = action.split("=")?.[1]
    action = action.split("=")[0]

    const actionValues = getActionValues(action)
    if (actionValues === null) {
        console.log("Action values is null")
        return
    }

    const requests = [
        axios.post(TRADETRON_URL, {}, {
            params: {
                "auth-token": MY_STGY_AUTH_TOKEN,
                key: actionValues.key,
                value: actionValues.value
            },
            headers: {
                "Content-Type": 'application/json'
            }
        })
    ];

    try {
        const results = await Promise.allSettled(requests)

        const successes = [];
        const failures = [];

        results.forEach((result, index) => {
            if (result.status === "fulfilled") {
                successes.push(result.value);
                console.log(`Request ${index + 1} succeeded:`, result.value.config.data);
            } else {
                failures.push(result.reason);
                console.error(`Request ${index + 1} failed:`, result.reason);
            }
        });

        if (successes.length > 0) {
            console.log("Partial success: Some requests completed successfully.");
        } else {
            console.log("All requests failed.");
        }
        res.send("Ok")
    } catch (error) {
        console.error("Unexpected error:", error);
        res.send("Ok")
    }
});

api.use("/api/", router);

export const handler = serverless(api);
