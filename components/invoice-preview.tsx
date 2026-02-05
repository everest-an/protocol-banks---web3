"use client";

import { Card } from "@/components/ui/card";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { getExplorerLink, getChainName } from "@/lib/chain-utils";

interface InvoicePreviewProps {
  data: any;
  isDemoMode?: boolean;
}

export const InvoicePreview = ({ data, isDemoMode }: InvoicePreviewProps) => {
  const date = new Date();
  const dueDate = new Date();
  // Handle expiresIn if it's a number (hours) or a date string
  if (typeof data.expiresIn === 'string' && !isNaN(parseInt(data.expiresIn))) {
      dueDate.setHours(dueDate.getHours() + parseInt(data.expiresIn));
  } else if (data.expires_at) {
      dueDate.setTime(new Date(data.expires_at).getTime());
  }

  // Handle creation date if provided
  const invoiceDate = data.created_at ? new Date(data.created_at) : date;

  // Derive Chain Info
  // If data.chain is set use it, otherwise default to "Ethereum" or check for chainId
  const chainName = data.chain || (data.chainId ? getChainName(data.chainId) : "Ethereum");
  const txHash = data.tx_hash || data.txHash || data.signature; // Fallback for demo, but really signature is not txHash

  return (
    <Card className="w-full bg-white text-black shadow-lg overflow-hidden border-0 relative">
      {isDemoMode && (
        <div className="absolute top-6 right-[-40px] rotate-45 bg-amber-400 text-amber-900 font-bold px-12 py-1 shadow-sm z-10 text-xs">
          TEST MODE
        </div>
      )}
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-black text-white p-2 rounded-lg">
                <div className="h-6 w-6 relative flex items-center justify-center">
                  <Image src="/icon.svg" width={20} height={20} alt="Logo" className="brightness-0 invert" />
                </div>
              </div>
              <span className="font-bold text-xl tracking-tight">Protocol Bank</span>
            </div>
            {/* Merchant Info */}
            <div className="text-sm text-gray-500 mt-4">
              <p className="font-medium text-black">{data.merchantName || data.merchant_name || (isDemoMode ? "Test Merchant" : "Merchant Name")}</p>
              {isDemoMode && <p className="text-xs text-amber-600 mt-1">Simulated Merchant Account</p>}
            </div>
          </div>
          <div className="text-right space-y-1">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Invoice</h2>
            <p className="font-mono text-lg font-bold">{isDemoMode && !data.invoice_id ? "TEST-0001" : (data.invoice_id || "INV-XXXX")}</p> 
            {isDemoMode && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Not a real invoice</span>}
            {data.status === 'paid' && <div className="mt-2"><span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold uppercase">PAID</span></div>}
          </div>
        </div>

        {/* Payment Details Metadata (New) */}
         {(data.status === 'paid' || data.tx_hash) && (
            <div className="bg-slate-50 p-4 rounded-md border border-slate-100 text-sm space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-gray-500">Network</span>
                    <span className="font-medium flex items-center gap-1">
                        {chainName}
                    </span>
                </div>
                {txHash && (
                  <div className="flex justify-between items-center">
                      <span className="text-gray-500">Transaction</span>
                      <a 
                        href={getExplorerLink(chainName, txHash, 'tx')} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                          {txHash.substring(0, 6)}...{txHash.substring(txHash.length - 4)}
                          <ExternalLink className="h-3 w-3" />
                      </a>
                  </div>
                )}
                 {data.paid_at && (
                  <div className="flex justify-between items-center">
                      <span className="text-gray-500">Paid At</span>
                      <span className="font-medium">{new Date(data.paid_at).toLocaleString()}</span>
                  </div>
                )}
            </div>
         )}

        {/* Dates & Bill To */}
        <div className="grid grid-cols-2 gap-8">

          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Bill to</p>
              <p className="font-medium mt-1">{data.customerName || data.customer_name || (isDemoMode ? "Test Customer" : "Customer Name")}</p>
              <p className="text-sm text-gray-500">{data.customerEmail || data.customer_email || (isDemoMode ? "test@example.com" : "customer@email.com")}</p>
            </div>
            {!isDemoMode && (data.recipientAddress || data.recipient_address) && (
              <div className="pt-2">
                 <p className="text-xs text-gray-500 uppercase font-medium">Pay to wallet</p>
                 <p className="font-mono text-xs text-gray-600 truncate max-w-[200px]">{data.recipientAddress || data.recipient_address}</p>
              </div>
            )}
            {isDemoMode && (
              <div className="pt-2 p-2 bg-amber-50 rounded border border-amber-100">
                 <p className="text-xs text-amber-800 font-medium">Test Wallet Address</p>
                 <p className="font-mono text-xs text-amber-600 truncate">0xTest...Wallet123</p>
              </div>
            )}
          </div>
          <div className="space-y-2 text-right">
             <div className="flex justify-between">
                <span className="text-sm text-gray-500">Date due</span>
                <span className="font-medium">{dueDate.toLocaleDateString()}</span>
             </div>
             <div className="flex justify-between">
                <span className="text-sm text-gray-500">Invoice date</span>
                <span className="font-medium">{invoiceDate.toLocaleDateString()}</span>
             </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="mt-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left font-medium text-gray-500 pb-3">Description</th>
                <th className="text-right font-medium text-gray-500 pb-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-4 font-medium">
                  {data.description || (isDemoMode ? "Test Details: Consulting Services" : "Service Description")}
                  {(data.lineItems?.length > 0 || (data.metadata?.lineItems && data.metadata.lineItems.length > 0)) && 
                    <span className="text-xs text-gray-400 ml-2">({data.lineItems?.length || data.metadata?.lineItems.length} items)</span>
                  }
                </td>
                <td className="py-4 text-right">
                  ${data.amountFiat || data.amount_fiat || "0.00"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex flex-col items-end gap-2 pt-4">
          <div className="w-1/2 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>${data.amountFiat || data.amount_fiat || "0.00"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Amount due</span>
              <span className="font-bold text-lg">${data.amountFiat || data.amount_fiat || "0.00"} {data.fiatCurrency || data.fiat_currency}</span>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="pt-8 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
           <div className="flex items-center gap-1">
             <span className={`inline-block w-2 h-2 rounded-full ${isDemoMode ? "bg-amber-400" : "bg-green-500"}`}></span>
             <span>Protocol Bank {isDemoMode ? "Test Environment" : "Secure Payment"}</span>
           </div>
           <div>
             {(data.enablePostPaymentInvoice || data.metadata?.enablePostPaymentInvoice) && <span>PDF Invoice Enabled</span>}
           </div>
        </div>
      </div>
    </Card>
  );
};
