import { ProductsSidebar } from "@/components/products-sidebar"

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col md:flex-row min-h-full">
      <ProductsSidebar />
      <div className="flex-1 w-full">
        {children}
      </div>
    </div>
  )
}
