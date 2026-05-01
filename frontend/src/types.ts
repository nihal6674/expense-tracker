export type Expense = {
  id: string;
  amount: string;
  category: string;
  description: string;
  date: string;
  created_at: string;
};

export type ListResponse = {
  expenses: Expense[];
  total: string;
  count: number;
};

export type Sort = "date_desc" | "date_asc";
