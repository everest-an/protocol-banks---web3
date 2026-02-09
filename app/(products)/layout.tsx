import { ProductsSidebar } from "@/components/products-sidebar"
import { WalletDemoSync } from "@/components/wallet-demo-sync"

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col md:flex-row min-h-full">
      <WalletDemoSync />
      <ProductsSidebar />
      <div className="flex-1 w-full">
        {children}
      </div>
    </div>
  )
}
