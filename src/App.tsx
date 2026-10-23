import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import PublicLayout from './components/PublicLayout'
import { RequireAuth, RequireRole } from './lib/auth'
import Landing from './pages/Landing'
import PublicCampaigns from './pages/PublicCampaigns'
import CampaignDetail from './pages/CampaignDetail'
import PublicLedger from './pages/PublicLedger'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Donations from './pages/Donations'
import Campaigns from './pages/Campaigns'
import Beneficiaries from './pages/Beneficiaries'
import Allocations from './pages/Allocations'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'
import Audit from './pages/Audit'
import Users from './pages/Users'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/campaigns" element={<PublicCampaigns />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/ledger" element={<PublicLedger />} />
      </Route>

      <Route path="/login" element={<Login />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="donations" element={<Donations />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="beneficiaries" element={<Beneficiaries />} />
        <Route path="allocations" element={<Allocations />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="reports" element={<Reports />} />
        <Route
          path="audit"
          element={
            <RequireRole roles={['admin', 'auditor']}>
              <Audit />
            </RequireRole>
          }
        />
        <Route
          path="users"
          element={
            <RequireRole roles={['admin']}>
              <Users />
            </RequireRole>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
