export interface AggregatedTransaction {
    key: string;
    member_id: string;
    date: string;
    member_name: string;
    tithe: number;
    faith_promise: number;
    love_gift: number;
    pledge: number;
    pledge_purpose?: string;
    total: number;
    is_deleted?: boolean;
}

export interface EditTransactionForm {
    tithe_amount: number | '';
    faith_promise_amount: number | '';
    love_gift_amount: number | '';
    pledge_amount: number | '';
    pledge_purpose: string;
}

export const EMPTY_EDIT_FORM: EditTransactionForm = {
    tithe_amount: '',
    faith_promise_amount: '',
    love_gift_amount: '',
    pledge_amount: '',
    pledge_purpose: ''
};
