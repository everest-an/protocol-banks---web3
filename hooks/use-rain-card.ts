"use client"

import { useState, useEffect, useCallback } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { useToast } from "@/hooks/use-toast"
import { getSupabase } from "@/lib/supabase"
import type {
  RainCard,
  CardDetails,
  Transaction,
  CreateCardRequest,
  BillingAddress,
} from "@/lib/rain-card"

interface UseRainCardReturn {
  cards: RainCard[]
  activeCard: RainCard | null
  cardDetails: CardDetails | null
  transactions: Transaction[]
  loading: boolean
  error: string | null
  
  // Actions
  createCard: (data: Omit<CreateCardRequest, "user_id">) => Promise<RainCard | null>
  selectCard: (cardId: string) => void
  revealCardDetails: (cardId: string) => Promise<CardDetails | null>
  freezeCard: (cardId: string) => Promise<boolean>
  unfreezeCard: (cardId: string) => Promise<boolean>
  updateSpendingLimit: (cardId: string, limit: number) => Promise<boolean>
  topUp: (cardId: string, amount: number) => Promise<boolean>
  refresh: () => Promise<void>
}

export function useRainCard(): UseRainCardReturn {
  const { address, isConnected } = useWeb3()
  const { toast } = useToast()
  
  const [cards, setCards] = useState<RainCard[]>([])
  const [activeCard, setActiveCard] = useState<RainCard | null>(null)
  const [cardDetails, setCardDetails] = useState<CardDetails | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch cards from database (synced with Rain API)
  const fetchCards = useCallback(async () => {
    if (!address) return

    setLoading(true)
    setError(null)

    try {
      const supabase = getSupabase()
      
      // Fetch cards from local DB (synced via webhooks)
      const { data, error: dbError } = await supabase
        .from("user_cards")
        .select("*")
        .eq("wallet_address", address.toLowerCase())
        .order("created_at", { ascending: false })

      if (dbError) throw dbError

      const mappedCards: RainCard[] = (data || []).map((card) => ({
        id: card.id,
        user_id: card.wallet_address,
        card_type: card.card_type,
        status: card.status,
        last_four: card.last_four,
        expiry_month: card.expiry_month,
        expiry_year: card.expiry_year,
        cardholder_name: card.cardholder_name,
        spending_limit: card.spending_limit || 5000,
        balance: card.balance || 0,
        created_at: card.created_at,
        updated_at: card.updated_at,
      }))

      setCards(mappedCards)
      
      // Set first active card as default
      const firstActive = mappedCards.find((c) => c.status === "active")
      if (firstActive && !activeCard) {
        setActiveCard(firstActive)
      }
    } catch (err) {
      console.error("[useRainCard] Fetch error:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch cards")
    } finally {
      setLoading(false)
    }
  }, [address, activeCard])

  // Fetch transactions for active card
  const fetchTransactions = useCallback(async () => {
    if (!activeCard) return

    try {
      const supabase = getSupabase()
      
      const { data, error: dbError } = await supabase
        .from("card_transactions")
        .select("*")
        .eq("card_id", activeCard.id)
        .order("created_at", { ascending: false })
        .limit(50)

      if (dbError) throw dbError

      setTransactions(data || [])
    } catch (err) {
      console.error("[useRainCard] Transactions error:", err)
    }
  }, [activeCard])

  // Create a new card
  const createCard = useCallback(
    async (data: Omit<CreateCardRequest, "user_id">): Promise<RainCard | null> => {
      if (!address) {
        toast({
          title: "Error",
          description: "Please connect your wallet first",
          variant: "destructive",
        })
        return null
      }

      setLoading(true)
      try {
        // Call API route that handles Rain API
        const response = await fetch("/api/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            wallet_address: address.toLowerCase(),
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || "Failed to create card")
        }

        const newCard = await response.json()

        toast({
          title: "Card Created",
          description: `Your ${data.card_type} card has been created successfully`,
        })

        await fetchCards()
        return newCard
      } catch (err) {
        console.error("[useRainCard] Create error:", err)
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to create card",
          variant: "destructive",
        })
        return null
      } finally {
        setLoading(false)
      }
    },
    [address, toast, fetchCards]
  )

  // Select active card
  const selectCard = useCallback((cardId: string) => {
    const card = cards.find((c) => c.id === cardId)
    if (card) {
      setActiveCard(card)
      setCardDetails(null) // Reset sensitive details
    }
  }, [cards])

  // Reveal card details (requires PIN/auth)
  const revealCardDetails = useCallback(
    async (cardId: string): Promise<CardDetails | null> => {
      try {
        const response = await fetch(`/api/cards/${cardId}/details`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet_address: address }),
        })

        if (!response.ok) {
          throw new Error("Failed to reveal card details")
        }

        const details = await response.json()
        setCardDetails(details)
        return details
      } catch (err) {
        console.error("[useRainCard] Reveal error:", err)
        toast({
          title: "Error",
          description: "Failed to reveal card details",
          variant: "destructive",
        })
        return null
      }
    },
    [address, toast]
  )

  // Freeze card
  const freezeCard = useCallback(
    async (cardId: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/cards/${cardId}/freeze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet_address: address }),
        })

        if (!response.ok) throw new Error("Failed to freeze card")

        toast({
          title: "Card Frozen",
          description: "Your card has been frozen",
        })

        await fetchCards()
        return true
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to freeze card",
          variant: "destructive",
        })
        return false
      }
    },
    [address, toast, fetchCards]
  )

  // Unfreeze card
  const unfreezeCard = useCallback(
    async (cardId: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/cards/${cardId}/unfreeze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet_address: address }),
        })

        if (!response.ok) throw new Error("Failed to unfreeze card")

        toast({
          title: "Card Activated",
          description: "Your card has been activated",
        })

        await fetchCards()
        return true
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to unfreeze card",
          variant: "destructive",
        })
        return false
      }
    },
    [address, toast, fetchCards]
  )

  // Update spending limit
  const updateSpendingLimit = useCallback(
    async (cardId: string, limit: number): Promise<boolean> => {
      try {
        const response = await fetch(`/api/cards/${cardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet_address: address,
            spending_limit: limit,
          }),
        })

        if (!response.ok) throw new Error("Failed to update limit")

        toast({
          title: "Limit Updated",
          description: `Spending limit set to $${limit.toLocaleString()}`,
        })

        await fetchCards()
        return true
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to update spending limit",
          variant: "destructive",
        })
        return false
      }
    },
    [address, toast, fetchCards]
  )

  // Top up card
  const topUp = useCallback(
    async (cardId: string, amount: number): Promise<boolean> => {
      try {
        const response = await fetch("/api/cards/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            card_id: cardId,
            amount,
            wallet_address: address,
          }),
        })

        if (!response.ok) throw new Error("Failed to top up")

        toast({
          title: "Top Up Successful",
          description: `Added $${amount.toLocaleString()} to your card`,
        })

        await fetchCards()
        return true
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to top up card",
          variant: "destructive",
        })
        return false
      }
    },
    [address, toast, fetchCards]
  )

  // Load data on mount
  useEffect(() => {
    if (isConnected && address) {
      fetchCards()
    }
  }, [isConnected, address, fetchCards])

  // Load transactions when active card changes
  useEffect(() => {
    if (activeCard) {
      fetchTransactions()
    }
  }, [activeCard, fetchTransactions])

  return {
    cards,
    activeCard,
    cardDetails,
    transactions,
    loading,
    error,
    createCard,
    selectCard,
    revealCardDetails,
    freezeCard,
    unfreezeCard,
    updateSpendingLimit,
    topUp,
    refresh: fetchCards,
  }
}
