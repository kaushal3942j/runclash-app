import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useTerritories } from './hooks/useTerritories';
import { useGpsTracking } from './hooks/useGpsTracking';
import { detectLoopClosure } from './utils/geoUtils';

import { Header } from './components/common/Header';
import { NavigationBar } from './components/common/NavigationBar';
import { LeafletMapView } from './components/map/LeafletMapView';
import { RunHud } from './components/tracker/RunHud';
import { RunSummaryModal } from './components/tracker/RunSummaryModal';
import { RunnerHQ } from './components/hq/RunnerHQ';
import { SocialFeed } from './components/social/SocialFeed';
import { ProfileView } from './components/profile/ProfileView';
import { AuthModal } from './components/auth/AuthModal';
import { SubscriptionModal } from './components/monetization/SubscriptionModal';
import { ComingSoonModal } from './components/common/ComingSoonModal';

export default function App() {
  // 1. Core Hooks & State
  const auth = useAuth();
  const territoriesState = useTerritories();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTerritoryId, setSelectedTerritoryId] = useState(null);

  // Modals visibility
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [completedRunData, setCompletedRunData] = useState(null);
  const [comingSoonModalData, setComingSoonModalData] = useState(null);

  // 2. GPS Tracking Hook with Loop Detection Callback
  const gpsTracking = useGpsTracking({
    onLoopDetected: (loopResult) => {
      console.log('[RunClash] Loop closure detected!', loopResult);
    }
  });

  // Handle Run Completion and Territory Claiming
  const handleFinishRun = () => {
    const finalRunData = gpsTracking.completeRun();

    // Check if run closed a valid loop for territory claim
    if (finalRunData && finalRunData.path.length >= 5) {
      const loopResult = detectLoopClosure(finalRunData.path);

      if (loopResult.isLoop && auth.currentUser) {
        const newSector = {
          id: `territory_${Date.now()}`,
          name: `Sector Alpha-${Math.floor(Math.random() * 900 + 100)}`,
          ownerId: auth.currentUser.id,
          ownerName: auth.currentUser.displayName,
          clan: auth.currentUser.clan || 'None',
          area: `${Math.round(loopResult.areaSqMeters)} m²`,
          coords: loopResult.closedPolygon
        };
        territoriesState.claimTerritory(newSector);
      }

      setCompletedRunData({
        ...finalRunData,
        loopResult
      });
      setShowSummaryModal(true);
    } else {
      setCompletedRunData(finalRunData);
      setShowSummaryModal(true);
    }
  };

  // Render Auth Modal if User is Not Logged In
  if (!auth.currentUser && !auth.isAuthLoading) {
    return (
      <AuthModal
        authMode={auth.authMode}
        setAuthMode={auth.setAuthMode}
        authEmail={auth.authEmail}
        setAuthEmail={auth.setAuthEmail}
        authPassword={auth.authPassword}
        setAuthPassword={auth.setAuthPassword}
        authName={auth.authName}
        setAuthName={auth.setAuthName}
        authClan={auth.authClan}
        setAuthClan={auth.setAuthClan}
        authError={auth.authError}
        onLogin={auth.handleLogin}
        onRegister={auth.handleRegister}
        onGuestLogin={auth.handleGuestLogin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* Top Header */}
      <Header
        currentUser={auth.currentUser}
        activeTab={activeTab}
        onOpenSettings={() => setActiveTab('profile')}
        onOpenNotifications={() =>
          setComingSoonModalData({
            title: 'Tactical Intel Alerts',
            description: 'Real-time alerts for territory attacks and crew challenges will appear here.'
          })
        }
      />

      {/* Main Tab Content Viewport */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 relative">
        {/* Tab 1: Runner HQ Dashboard */}
        {activeTab === 'dashboard' && (
          <RunnerHQ
            currentUser={auth.currentUser}
            clanStandings={territoriesState.clanStandings}
            onOpenClanModal={() =>
              setComingSoonModalData({
                title: 'Crew Conquest HQ',
                description: 'Clan creation and joint territory conquests will launch in upcoming sprints.'
              })
            }
            onOpenSubscriptionModal={() => setShowSubscriptionModal(true)}
          />
        )}

        {/* Tab 2: Tactical Map & Live Run Tracker */}
        {activeTab === 'map' && (
          <div className="flex flex-col h-[calc(100vh-140px)] space-y-4">
            <div className="flex-1 rounded-3xl overflow-hidden border border-slate-800 shadow-xl relative">
              <LeafletMapView
                territories={territoriesState.territories}
                runPath={gpsTracking.runState.path}
                selectedTerritoryId={selectedTerritoryId}
                onSelectTerritory={setSelectedTerritoryId}
              />
            </div>

            <RunHud
              runState={gpsTracking.runState}
              trackingMode={gpsTracking.trackingMode}
              setTrackingMode={gpsTracking.setTrackingMode}
              simulationRouteKey={gpsTracking.simulationRouteKey}
              setSimulationRouteKey={gpsTracking.setSimulationRouteKey}
              onStartRun={gpsTracking.startRun}
              onPauseRun={gpsTracking.pauseRun}
              onResumeRun={gpsTracking.resumeRun}
              onCompleteRun={handleFinishRun}
              onCancelRun={gpsTracking.cancelRun}
            />
          </div>
        )}

        {/* Tab 3: Crew Conquests */}
        {activeTab === 'conquests' && (
          <div className="space-y-4 text-center py-10">
            <h2 className="text-xl font-black uppercase text-white">Crew Conquests</h2>
            <p className="text-xs text-slate-400">
              City sector map & territory dominance view.
            </p>
            <button
              onClick={() => setActiveTab('map')}
              className="px-5 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-xs shadow-lg shadow-orange-500/20"
            >
              Open Tactical Map
            </button>
          </div>
        )}

        {/* Tab 4: Social Hub */}
        {activeTab === 'clans' && (
          <SocialFeed />
        )}

        {/* Tab 5: AI Coach */}
        {activeTab === 'coach' && (
          <div className="space-y-4 text-center py-10">
            <h2 className="text-xl font-black uppercase text-white">AI Tactical Coach</h2>
            <p className="text-xs text-slate-400">
              Pacing analysis & personalized sector attack strategies powered by AI.
            </p>
          </div>
        )}

        {/* Tab 6: User Profile */}
        {activeTab === 'profile' && (
          <ProfileView
            currentUser={auth.currentUser}
            onLogout={auth.handleLogout}
            onUpdateProfile={auth.updateUserProfile}
          />
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <NavigationBar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Modal Overlays */}
      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        currentUser={auth.currentUser}
        onUpdateSubscription={(tierId) => auth.updateUserProfile({ tier: tierId })}
      />

      <RunSummaryModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        runData={completedRunData}
      />

      <ComingSoonModal
        isOpen={!!comingSoonModalData}
        onClose={() => setComingSoonModalData(null)}
        title={comingSoonModalData?.title}
        description={comingSoonModalData?.description}
      />
    </div>
  );
}
