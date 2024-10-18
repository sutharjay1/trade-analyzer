import express from 'express';
import fs from 'fs';
import { Architect, Trainer, Network } from 'synaptic';
import cors from 'cors';
import { PredictionResult, Stock, TrainingData } from './type';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const portfolioData: Stock[] = JSON.parse(
	fs.readFileSync('src/portfolio.json', 'utf8')
);

function prepareData(data: Stock[]): TrainingData[] {
	return data.map((stock) => ({
		input: [
			stock.day_change_percentage / 100,
			(stock.last_price - stock.average_price) / stock.average_price,
		],
		output: [stock.day_change > 0 ? 1 : 0],
	}));
}

const trainingSet: TrainingData[] = prepareData(portfolioData);

const network: Network = new Architect.Perceptron(2, 4, 1);
const trainer: Trainer = new Trainer(network);

trainer.train(trainingSet, {
	rate: 0.1,
	iterations: 20000,
	error: 0.005,
});

function predictStockMovement(
	stock: Stock,
	timeFrame: 'day' | 'week' | 'month'
): PredictionResult {
	const input: number[] = [
		stock.day_change_percentage / 100,
		(stock.last_price - stock.average_price) / stock.average_price,
	];
	const output: number[] = network.activate(input);
	const prediction: 'Up' | 'Down' = output[0] > 0.5 ? 'Up' : 'Down';

	const currentValue: number = stock.last_price * stock.quantity;
	let potentialChange: number;
	switch (timeFrame) {
		case 'day':
			potentialChange = prediction === 'Up' ? 0.01 : -0.01;
			break;
		case 'week':
			potentialChange = prediction === 'Up' ? 0.03 : -0.03;
			break;
		case 'month':
			potentialChange = prediction === 'Up' ? 0.05 : -0.05;
			break;
	}
	const potentialValue: number = currentValue * (1 + potentialChange);
	const profitLoss: number = potentialValue - currentValue;

	return {
		prediction,
		profitLoss,
		currentValue,
		potentialValue,
	};
}

async function fetchGeminiData(stockSymbol: string) {
	try {
		const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
		const prompt = `Provide performance, fundamentals, growth, profitability, and entry point data for ${stockSymbol} stock. Format the response as JSON.   I want only json data no other information or text.`;
		const result = await model.generateContent(prompt);
		const response = await result.response;
		const text = response.text();

		// Trim and remove code block indicators if present
		return JSON.parse(
			text
				.replace(/```json/g, '')
				.replace(/```/g, '')
				.trim()
		);
	} catch (error) {
		console.error('Error fetching data from Gemini API:', error);
		throw error;
	}
}

const app = express();
app.use(
	cors({
		origin: '*',
	})
);
app.use(express.json());

app.get('/predict/:symbol', (req: any, res: any) => {
	const stockSymbol: string = req.params.symbol;
	console.log(`Received request for stock symbol: ${stockSymbol}`);
	const stock: Stock | undefined = portfolioData.find(
		(s) => s.tradingSymbol === stockSymbol
	);

	if (!stock) {
		console.error(`Stock not found: ${stockSymbol}`);
		return res.status(404).json({ error: 'Stock not found in portfolio' });
	}

	try {
		const dayPrediction = predictStockMovement(stock, 'day');
		const weekPrediction = predictStockMovement(stock, 'week');
		const monthPrediction = predictStockMovement(stock, 'month');

		return res.json({
			nextDay: dayPrediction,
			nextWeek: weekPrediction,
			nextMonth: monthPrediction,
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

app.get(
	'/stock-data/:symbol',
	async (req: express.Request, res: express.Response) => {
		const stockSymbol: string = req.params.symbol;
		console.log(
			`Received request for additional stock data: ${stockSymbol}`
		);

		try {
			const geminiData = await fetchGeminiData(stockSymbol);
			res.json(geminiData);
		} catch (error) {
			console.error(error);
			res.status(500).json({
				error: 'Failed to fetch additional stock data',
			});
		}
	}
);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});
