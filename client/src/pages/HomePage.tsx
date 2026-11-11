import { Container } from "../components/layout/Container";
import { ProductListSection } from "../components/product/ProductListSection";

export function HomePage() {
  return (
    <Container className="py-10">
      <h1 className="text-2xl font-extrabold md:text-3xl">
        Buy game keys at the best prices
      </h1>
      <ProductListSection />
    </Container>
  );
}
