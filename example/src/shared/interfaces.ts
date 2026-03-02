export interface CartItem {
    productId: string;
    name: string;
    price: number;
    quantity: number;
}

export interface ChargeRequest {
    amount: number;
    currency: string;
}

export interface ChargeResult {
    transactionId: string;
    status: string;
}

export interface RefundRequest {
    transactionId: string;
}

export interface OrderRequest {
    userId: string;
}

export interface OrderResult {
    orderId: string;
    transactionId: string;
    trackingNumber: string;
    total: number;
}
