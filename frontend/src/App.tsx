import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard } from './auth/AuthGuard'

// Pages
import Login from './pages/Login'
import Forbidden from './pages/Forbidden'
import Dashboard from './pages/Dashboard'
import VehiculesList from './pages/Vehicules/VehiculesList'
import VehiculeDetail from './pages/Vehicules/VehiculeDetail'
import ConducteursList from './pages/Conducteurs/ConducteursList'
import ConducteurDetail from './pages/Conducteurs/ConducteurDetail'
import MaintenancesList from './pages/Maintenances/MaintenancesList'
import MaintenanceDetail from './pages/Maintenances/MaintenanceDetail'
import MissionsList from './pages/Missions/MissionsList'
import MissionDetail from './pages/Missions/MissionDetail'
import Localisation from './pages/Localisation'

const AboutPage = React.lazy(() => import('aboutApp/AboutPage'))

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/403" element={<Forbidden />} />

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Protected: any authenticated user */}
        <Route path="/dashboard" element={
          <AuthGuard roles={['ADMIN', 'MANAGER', 'TECHNICIEN', 'UTILISATEUR', 'CONDUCTEUR']}>
            <Dashboard />
          </AuthGuard>
        } />

        {/* Véhicules — all roles view, create/edit requires ADMIN/MANAGER */}
        <Route path="/vehicules" element={
          <AuthGuard roles={['ADMIN', 'MANAGER', 'TECHNICIEN', 'UTILISATEUR', 'CONDUCTEUR']}>
            <VehiculesList />
          </AuthGuard>
        } />
        <Route path="/vehicules/:id" element={
          <AuthGuard roles={['ADMIN', 'MANAGER', 'TECHNICIEN', 'UTILISATEUR', 'CONDUCTEUR']}>
            <VehiculeDetail />
          </AuthGuard>
        } />

        {/* Conducteurs */}
        <Route path="/conducteurs" element={
          <AuthGuard roles={['ADMIN', 'MANAGER']}>
            <ConducteursList />
          </AuthGuard>
        } />
        <Route path="/conducteurs/:id" element={
          <AuthGuard roles={['ADMIN', 'MANAGER']}>
            <ConducteurDetail />
          </AuthGuard>
        } />

        {/* Maintenances */}
        <Route path="/maintenances" element={
          <AuthGuard roles={['ADMIN', 'MANAGER', 'TECHNICIEN']}>
            <MaintenancesList />
          </AuthGuard>
        } />
        <Route path="/maintenances/:id" element={
          <AuthGuard roles={['ADMIN', 'MANAGER', 'TECHNICIEN']}>
            <MaintenanceDetail />
          </AuthGuard>
        } />

        {/* Missions — conductors only see their own missions (filtered in the component) */}
        <Route path="/missions" element={
          <AuthGuard roles={['ADMIN', 'MANAGER', 'CONDUCTEUR']}>
            <MissionsList />
          </AuthGuard>
        } />
        <Route path="/missions/:id" element={
          <AuthGuard roles={['ADMIN', 'MANAGER', 'CONDUCTEUR']}>
            <MissionDetail />
          </AuthGuard>
        } />

        {/* Localisation */}
        <Route path="/localisation" element={
          <AuthGuard roles={['ADMIN', 'MANAGER', 'TECHNICIEN', 'CONDUCTEUR']}>
            <Localisation />
          </AuthGuard>
        } />

        {/* A propos */}
        <Route path="/about" element={
          <AuthGuard roles={['ADMIN', 'MANAGER', 'TECHNICIEN', 'UTILISATEUR', 'CONDUCTEUR']}>
            <Suspense fallback={<div>Chargement...</div>}>
              <AboutPage />
            </Suspense>
          </AuthGuard>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
