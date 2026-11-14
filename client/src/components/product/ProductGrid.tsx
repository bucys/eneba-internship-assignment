import { Children, type ReactNode } from "react";

type ProductGridProps = {
  children: ReactNode;
};

export function ProductGrid({ children }: ProductGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {Children.map(children, (child) => (
        <li>{child}</li>
      ))}
    </ul>
  );
}
