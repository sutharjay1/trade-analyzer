export type Stock = {
	id: string;
	tradingSymbol: string;
	exchange: string;
	instrumentToken: number;
	isin: string;
	product: string;
	price: number;
	quantity: number;
	usedQuantity: number;
	t1Quantity: number;
	realisedQuantity: number;
	authorisedQuantity: number;
	openingQuantity: number;
	collateralQuantity: number;
	collateralType: string;
	discrepancy: boolean;
	pnl: number;
	userKiteId: string;
	authorised_date: string;
	average_price: number;
	close_price: number;
	day_change: number;
	day_change_percentage: number;
	last_price: number;
};

export type TrainingData = {
	input: number[];
	output: number[];
};

export type PredictionResult = {
	prediction: 'Up' | 'Down';
	profitLoss: number;
	currentValue: number;
	potentialValue: number;
};


