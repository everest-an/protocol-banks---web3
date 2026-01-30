/**
 * UI Store
 * Global UI state management using Zustand
 */

import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"

// ============================================
// Types
// ============================================

interface ModalState {
  isOpen: boolean
  data?: any
}

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void

  // Global loading
  isLoading: boolean
  loadingMessage: string
  setLoading: (loading: boolean, message?: string) => void

  // Modals
  modals: Record<string, ModalState>
  openModal: (id: string, data?: any) => void
  closeModal: (id: string) => void
  isModalOpen: (id: string) => boolean
  getModalData: (id: string) => any

  // Toast notifications queue
  toasts: Array<{
    id: string
    type: "success" | "error" | "info" | "warning"
    message: string
    duration?: number
  }>
  addToast: (toast: Omit<UIState["toasts"][0], "id">) => void
  removeToast: (id: string) => void

  // Theme preference (supplements next-themes)
  preferredView: "grid" | "list"
  setPreferredView: (view: "grid" | "list") => void

  // Demo mode
  isDemoMode: boolean
  setDemoMode: (enabled: boolean) => void
}

// ============================================
// Store
// ============================================

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set, get) => ({
        // Sidebar
        sidebarCollapsed: false,
        toggleSidebar: () =>
          set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
        setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

        // Global loading
        isLoading: false,
        loadingMessage: "",
        setLoading: (loading, message = "") =>
          set({ isLoading: loading, loadingMessage: message }),

        // Modals
        modals: {},
        openModal: (id, data) =>
          set((state) => ({
            modals: { ...state.modals, [id]: { isOpen: true, data } },
          })),
        closeModal: (id) =>
          set((state) => ({
            modals: { ...state.modals, [id]: { isOpen: false, data: undefined } },
          })),
        isModalOpen: (id) => get().modals[id]?.isOpen ?? false,
        getModalData: (id) => get().modals[id]?.data,

        // Toasts
        toasts: [],
        addToast: (toast) => {
          const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
          set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))

          // Auto-remove after duration
          if (toast.duration !== 0) {
            setTimeout(() => {
              get().removeToast(id)
            }, toast.duration ?? 5000)
          }
        },
        removeToast: (id) =>
          set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
          })),

        // View preference
        preferredView: "list",
        setPreferredView: (view) => set({ preferredView: view }),

        // Demo mode
        isDemoMode: false,
        setDemoMode: (enabled) => set({ isDemoMode: enabled }),
      }),
      {
        name: "protocol-banks-ui",
        partialize: (state) => ({
          sidebarCollapsed: state.sidebarCollapsed,
          preferredView: state.preferredView,
          isDemoMode: state.isDemoMode,
        }),
      }
    ),
    { name: "UIStore" }
  )
)

// ============================================
// Selectors
// ============================================

export const selectSidebarCollapsed = (state: UIState) => state.sidebarCollapsed
export const selectIsLoading = (state: UIState) => state.isLoading
export const selectLoadingMessage = (state: UIState) => state.loadingMessage
export const selectToasts = (state: UIState) => state.toasts
export const selectPreferredView = (state: UIState) => state.preferredView
export const selectIsDemoMode = (state: UIState) => state.isDemoMode
