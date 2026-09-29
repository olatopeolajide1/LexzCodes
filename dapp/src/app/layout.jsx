import "./globals.css";

export const metadata = {
  title: "ZK Age Verifier — prove 18+ without revealing your birthdate",
  description:
    "Privacy-preserving age verification: Groth16 zero-knowledge proofs generated in your browser and verified on-chain (Sepolia).",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
