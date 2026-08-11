import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { StockInfo } from "../types";

interface StockSelection {
  selected: { stock: StockInfo; seq: number } | null;
  selectStock: (stock: StockInfo) => void;
}

const StockSelectionContext = createContext<StockSelection>({
  selected: null,
  selectStock: () => {},
});

export function StockSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<{ stock: StockInfo; seq: number } | null>(null);

  const selectStock = (stock: StockInfo) => {
    setSelected((prev) => ({ stock, seq: (prev?.seq ?? 0) + 1 }));
  };

  return (
    <StockSelectionContext.Provider value={{ selected, selectStock }}>
      {children}
    </StockSelectionContext.Provider>
  );
}

export function useStockSelection() {
  return useContext(StockSelectionContext);
}
