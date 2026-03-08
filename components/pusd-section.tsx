"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Shield, Lock, TrendingUp, Zap, RefreshCw, ChevronRight } from "lucide-react"

// ─────────────────────────────────────────────
// 3D Coin Animation (pure CSS / inline styles)
// ─────────────────────────────────────────────
function PUSDCoin() {
  return (
    <div className="flex items-center justify-center w-full h-full select-none" aria-hidden>
      {/* Outer glow ring */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: 320, height: 320 }}
      >
        {/* Ambient glow */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.12) 50%, transparent 75%)",
            filter: "blur(24px)",
            animation: "pusdPulse 4s ease-in-out infinite",
          }}
        />

        {/* Orbit ring */}
        <div
          className="absolute rounded-full border border-white/10"
          style={{
            width: 290,
            height: 290,
            animation: "pusdOrbit 12s linear infinite",
            boxShadow: "0 0 20px rgba(139,92,246,0.15)",
          }}
        >
          {/* Orbit dot */}
          <div
            className="absolute w-3 h-3 rounded-full bg-violet-400/80 shadow-lg"
            style={{
              top: -6,
              left: "50%",
              transform: "translateX(-50%)",
              boxShadow: "0 0 12px rgba(139,92,246,0.8)",
            }}
          />
        </div>

        {/* Second orbit ring (counter-rotate) */}
        <div
          className="absolute rounded-full border border-white/5"
          style={{
            width: 250,
            height: 250,
            animation: "pusdOrbitReverse 18s linear infinite",
          }}
        >
          <div
            className="absolute w-2 h-2 rounded-full bg-blue-400/70"
            style={{
              bottom: -4,
              left: "50%",
              transform: "translateX(-50%)",
              boxShadow: "0 0 8px rgba(96,165,250,0.8)",
            }}
          />
        </div>

        {/* Main coin body */}
        <div
          className="relative flex items-center justify-center rounded-full"
          style={{
            width: 200,
            height: 200,
            background:
              "linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #4c1d95 60%, #1e1b4b 100%)",
            boxShadow:
              "0 0 0 2px rgba(139,92,246,0.4), 0 0 40px rgba(99,102,241,0.35), 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.3)",
            animation: "pusdFloat 6s ease-in-out infinite",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Coin highlight (top-left sheen) */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 50%)",
              borderRadius: "50%",
            }}
          />

          {/* Inner circle border */}
          <div
            className="absolute rounded-full border border-violet-400/30"
            style={{ width: 170, height: 170 }}
          />

          {/* $PUSD text */}
          <div className="relative z-10 flex flex-col items-center gap-1">
            <span
              className="font-bold text-white tracking-widest"
              style={{
                fontSize: 13,
                letterSpacing: "0.3em",
                textShadow: "0 0 20px rgba(167,139,250,0.9)",
                fontFamily: "monospace",
              }}
            >
              PUSD
            </span>
            <span
              className="font-black text-white"
              style={{
                fontSize: 48,
                lineHeight: 1,
                textShadow:
                  "0 0 30px rgba(167,139,250,1), 0 0 60px rgba(139,92,246,0.6)",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              $
            </span>
            <span
              style={{
                fontSize: 9,
                color: "rgba(196,181,253,0.8)",
                letterSpacing: "0.15em",
                fontFamily: "monospace",
              }}
            >
              HASHKEY CHAIN
            </span>
          </div>
        </div>

        {/* Reflection / shadow below coin */}
        <div
          className="absolute rounded-full"
          style={{
            width: 160,
            height: 20,
            bottom: 10,
            background:
              "radial-gradient(ellipse, rgba(99,102,241,0.3) 0%, transparent 70%)",
            filter: "blur(8px)",
            animation: "pusdShadow 6s ease-in-out infinite",
          }}
        />
      </div>

      {/* Keyframe styles injected via a style tag */}
      <style jsx global>{`
        @keyframes pusdFloat {
          0%, 100% { transform: translateY(0px) rotateX(8deg) rotateY(-5deg); }
          50% { transform: translateY(-18px) rotateX(8deg) rotateY(5deg); }
        }
        @keyframes pusdPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes pusdOrbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pusdOrbitReverse {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes pusdShadow {
          0%, 100% { transform: scaleX(1); opacity: 0.5; }
          50% { transform: scaleX(0.75); opacity: 0.25; }
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────
// Feature pill
// ─────────────────────────────────────────────
interface FeatureItemProps {
  icon: React.ReactNode
  title: string
  description: string
}

function FeatureItem({ icon, title, description }: FeatureItemProps) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-white/10 bg-white/5 dark:bg-white/5 backdrop-blur-sm hover:border-violet-500/30 hover:bg-violet-500/5 transition-all">
      <div className="p-2 rounded-lg bg-violet-500/10 shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="font-semibold text-sm mb-1">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Section Export
// ─────────────────────────────────────────────
export function PUSDSection() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/30 via-transparent to-indigo-950/20 pointer-events-none" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-violet-400 mb-3 uppercase tracking-wider">
            Native Stablecoin
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Introducing{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #a78bfa 0%, #818cf8 50%, #c4b5fd 100%)",
              }}
            >
              $PUSD
            </span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            The first stablecoin on Hashkey Chain — built for enterprises that demand
            privacy, compliance, and sustainable DeFi yield.
          </p>
        </div>

        {/* Main grid: coin + features */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: 3D Coin */}
          <div className="flex items-center justify-center h-[380px] lg:h-[460px]">
            <PUSDCoin />
          </div>

          {/* Right: Feature list */}
          <div className="space-y-4">
            <FeatureItem
              icon={<Shield className="h-5 w-5 text-violet-400" />}
              title="1:1 USDC Backing on Circle"
              description="Every $PUSD is minted at a 1:1 ratio with USDC on Circle, ensuring full collateralization and transparent reserve proof at all times."
            />
            <FeatureItem
              icon={<RefreshCw className="h-5 w-5 text-blue-400" />}
              title="CCIP-Secured Cross-Chain Redemption"
              description="Leveraging Circle's Cross-Chain Interoperability Protocol (CCIP), $PUSD guarantees stable and trustless redemption across supported networks."
            />
            <FeatureItem
              icon={<Lock className="h-5 w-5 text-indigo-400" />}
              title="FHE Privacy (Roadmap)"
              description="With the upcoming mainnet upgrade, Fully Homomorphic Encryption (FHE) will be integrated — enabling confidential on-chain transactions ideal for enterprise finance."
            />
            <FeatureItem
              icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
              title="Institutional-Grade Staking Yield"
              description="An upcoming staking model will allow enterprises to earn stable, risk-adjusted DeFi yields on idle $PUSD holdings — without sacrificing security or liquidity."
            />
            <FeatureItem
              icon={<Zap className="h-5 w-5 text-yellow-400" />}
              title="Open-Source Smart Contracts"
              description="All $PUSD contracts are fully open-source and publicly auditable, ensuring maximum transparency and community trust."
            />

            {/* Tagline */}
            <div className="mt-6 px-4 py-3 rounded-xl border border-violet-500/20 bg-violet-500/5">
              <p className="text-sm text-violet-300 font-medium text-center tracking-wide">
                "Let capital flow back into the hands of the User."
              </p>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link href="/whitepaper#pusd">
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  style={{
                    background:
                      "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                    border: "none",
                  }}
                >
                  Read $PUSD Whitepaper
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/swap">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-500/5"
                >
                  Get $PUSD
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: "1:1", label: "USDC Collateral Ratio" },
            { value: "CCIP", label: "Cross-Chain Protocol" },
            { value: "FHE", label: "Privacy Encryption (Soon)" },
            { value: "HSK", label: "Native on Hashkey Chain" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="text-center p-5 rounded-2xl border border-white/10 bg-white/5 dark:bg-white/5 backdrop-blur-sm hover:border-violet-500/30 transition-all"
            >
              <p
                className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #a78bfa 0%, #818cf8 100%)",
                }}
              >
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
