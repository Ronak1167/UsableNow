import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { DemoDisclaimer } from './components/DemoDisclaimer';
import { ReportModal } from './components/ReportModal';
import { LandingPage } from './pages/LandingPage';
import { DiscoveryPage } from './pages/DiscoveryPage';
import { MethodologyPage } from './pages/MethodologyPage';
import { AdminPage } from './pages/AdminPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 15, // 15 seconds
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportFacilityId, setReportFacilityId] = useState<string | undefined>(undefined);
  const [reportFeatureId, setReportFeatureId] = useState<string | undefined>(undefined);

  const handleOpenReportModal = (facilityId?: string, featureId?: string) => {
    setReportFacilityId(facilityId);
    setReportFeatureId(featureId);
    setIsReportModalOpen(true);
  };

  const handleCloseReportModal = () => {
    setIsReportModalOpen(false);
    setReportFacilityId(undefined);
    setReportFeatureId(undefined);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
          {/* Top Demo Disclaimer */}
          <DemoDisclaimer />

          {/* Persistent Navbar */}
          <Navbar onOpenReportModal={() => handleOpenReportModal()} />

          {/* Main Page Content */}
          <main className="flex-1 pb-16 md:pb-0">
            <Routes>
              <Route
                path="/"
                element={<LandingPage onOpenReportModal={() => handleOpenReportModal()} />}
              />
              <Route
                path="/discover"
                element={<DiscoveryPage onOpenReportModal={handleOpenReportModal} />}
              />
              <Route path="/methodology" element={<MethodologyPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          {/* Global Report Modal */}
          <ReportModal
            key={`${reportFacilityId || 'none'}-${reportFeatureId || 'none'}-${isReportModalOpen}`}
            isOpen={isReportModalOpen}
            onClose={handleCloseReportModal}
            preselectedFacilityId={reportFacilityId}
            preselectedFeatureId={reportFeatureId}
          />

          {/* Persistent Footer */}
          <Footer />
        </div>
      </Router>
    </QueryClientProvider>
  );
};

export default App;
