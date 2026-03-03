import { Card, CardBody } from "@heroui/react";
import { Copy, Phone, CheckCircle } from "lucide-react";
import { useState } from "react";

interface PaymentInstructionsProps {
  momoNumber: string;
  momoName: string;
  amount: number;
  paymentId: string;
}

export default function PaymentInstructions({ momoNumber, momoName, amount, paymentId }: PaymentInstructionsProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const steps = [
    `Dial *170# on your MTN line`,
    `Select "Transfer Money" → "MoMo User"`,
    `Enter the number: ${momoNumber}`,
    `Enter amount: GH₵ ${amount}`,
    `Confirm the name: ${momoName}`,
    `Enter your MoMo PIN to complete`,
    `Note your Transaction ID from the SMS confirmation`,
    `Come back here and enter your details to confirm payment`,
  ];

  return (
    <Card>
      <CardBody className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary-500" />
          MTN MoMo Payment Instructions
        </h3>

        <div className="space-y-3 mb-6">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <span className="text-sm text-gray-700">{step}</span>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">MoMo Number</span>
            <button onClick={() => copyToClipboard(momoNumber, "number")} className="flex items-center gap-1 text-sm font-mono font-semibold text-primary-600 hover:text-primary-700">
              {momoNumber}
              {copied === "number" ? <CheckCircle className="h-4 w-4 text-success-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Account Name</span>
            <span className="text-sm font-semibold">{momoName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Amount</span>
            <button onClick={() => copyToClipboard(String(amount), "amount")} className="flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700">
              GH₵ {amount}
              {copied === "amount" ? <CheckCircle className="h-4 w-4 text-success-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Reference</span>
            <span className="text-sm font-mono">{paymentId}</span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
