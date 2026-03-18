import { BrowserRouter as Router, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { Header } from '@/components/layout/Header'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AuthContext, useAuthState } from '@/hooks/useAuth'
import {
  Admin,
  Dashboard,
  Fournisseurs,
  Login,
  Paiements,
  Pesees,
  Tickets,
} from '@/pages'

function AppLayout() {
  return (
    <div className="min-h-svh bg-muted/40 text-foreground">
      <Header />
      <main className="w-full px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

function App() {
  const auth = useAuthState()
  return (
    <AuthContext.Provider value={auth}>
    <TooltipProvider>
      <Router>
        <Routes>
          {/* <Route path="/login" element={<Login />} /> */}

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/pesees" element={<Pesees />} />
              <Route path="/fournisseurs" element={<Fournisseurs />} />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="/paiements" element={<Paiements />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <Toaster richColors position="top-right" />
    </TooltipProvider>
    </AuthContext.Provider>
  )
}

export default App
