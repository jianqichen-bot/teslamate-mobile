import { createContext, useContext, useState, type PropsWithChildren } from "react";
import { useCars } from "./useCars";

const CarSelectionContext = createContext<(ReturnType<typeof useCars> & {
  carId: number | null;
  selectCar: (id: number) => void;
}) | null>(null);

export function CarSelectionProvider({ children }: PropsWithChildren) {
  const { state, refresh } = useCars();
  const [selectedId, selectCar] = useState<number | null>(null);
  const cars = state.status === "ready" ? state.cars : [];
  const carId = cars.find((car) => car.id === selectedId)?.id ?? cars[0]?.id ?? null;

  return (
    <CarSelectionContext.Provider value={{ state, refresh, carId, selectCar }}>
      {children}
    </CarSelectionContext.Provider>
  );
}

export function useCarSelection() {
  const selection = useContext(CarSelectionContext);
  if (!selection) throw new Error("Car selection is only available within the tabs");
  return selection;
}
