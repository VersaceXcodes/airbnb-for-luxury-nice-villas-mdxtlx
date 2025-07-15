import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { use_app_store } from '@/store/main';

/* === GV Shared (shell) === */
import GV_TopNav from '@/components/views/GV_TopNav.tsx';
import GV_BottomBar from '@/components/views/GV_BottomBar.tsx';
import GV_Footer from '@/components/views/GV_Footer.tsx';

/* === Unique Views in user-flow order === */
import UV_Landing from '@/components/views/UV_Landing.tsx';
import UV_Search from '@/components/views/UV_Search.tsx';
import UV_ListingDetail from '@/components/views/UV_ListingDetail.tsx';
import UV_WizardCheckout from '@/components/views/UV_WizardCheckout.tsx';
import UV_Confirmation from '@/components/views/UV_Confirmation.tsx';
import UV_GuestTripsDashboard from '@/components/views/UV_GuestTripsDashboard.tsx';
import UV_GuestWishlist from '@/components/views/UV_GuestWishlist.tsx';
import UV_GuestProfile from '@/components/views/UV_GuestProfile.tsx';
import UV_GuestGuidebook from '@/components/views/UV_GuestGuidebook.tsx';
import UV_GuestReview from '@/components/views/UV_GuestReview.tsx';
import UV_ListYourVillaIntro from '@/components/views/UV_ListYourVillaIntro.tsx';
import UV_HostSignUp from '@/components/views/UV_HostSignUp.tsx';
import UV_HostDashboard from '@/components/views/UV_HostDashboard.tsx';
import UV_HostListings from '@/components/views/UV_HostListings.tsx';
import UV_HostListingWizard from '@/components/views/UV_HostListingWizard.tsx';
import UV_HostCalendar from '@/components/views/UV_HostCalendar.tsx';
import UV_HostInbox from '@/components/views/UV_HostInbox.tsx';
import UV_HostGuestProfileModal from '@/components/views/UV_HostGuestProfileModal.tsx';
import UV_HostPerformance from '@/components/views/UV_HostPerformance.tsx';
import UV_HostPayments from '@/components/views/UV_HostPayments.tsx';
import UV_HostSupportTicket from '@/components/views/UV_HostSupportTicket.tsx';
import UV_AdminDashboard from '@/components/views/UV_AdminDashboard.tsx';

const queryClient = new QueryClient();

type RoleCheckProps = { allowed: 'guest' | 'host' | 'admin'; children: React.ReactNode };
function RequireRole({ allowed, children }: RoleCheckProps): React.ReactElement {
  const user = use_app_store((s) => s.auth_user);
  if (!user || user.role !== allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireBookingOwner({ children }: { children: React.ReactElement }) {
  // Simplistic pass-through – ownership later checked inside UV_GuestGuidebook
  return <>{children}</>;
}

const App: React.FC = () => {
  const setScreenSize = use_app_store((s) => s.set_screen_size);

  useEffect(() => {
    function updateScreenSize() {
      const w = window.innerWidth;
      if (w < 640) setScreenSize('xs');
      else if (w < 768) setScreenSize('sm');
      else if (w < 1024) setScreenSize('md');
      else if (w < 1280) setScreenSize('lg');
      else setScreenSize('xl');
    }
    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, [setScreenSize]);

  const kioskModePaths = [
    /^\/checkout\//,
    /^\/guidebook\//,
    /^\/admin\//,
  ];
  const { pathname } = window.location;
  const isKiosk = kioskModePaths.some((re) => re.test(pathname));
  const screenSize = use_app_store((s) => s.screen_size);
  const showBottomBar = screenSize !== 'lg' && screenSize !== 'xl' && !isKiosk;

  return (
    <QueryClientProvider client={queryClient}>
      {!isKiosk && <GV_TopNav />}

      <Routes>
        {/* Public */}
        <Route path="/" element={<UV_Landing />} />
        <Route path="/search" element={<UV_Search />} />
        <Route path="/search/:others?" element={<UV_Search />} />
        <Route path="/villas/:slug-:id" element={<UV_ListingDetail />} />
        <Route path="/checkout/:villaSlug-:villaId" element={<UV_WizardCheckout />} />
        <Route path="/confirmation" element={<UV_Confirmation />} />
        <Route path="/list-your-villa" element={<UV_ListYourVillaIntro />} />
        <Route path="/host/signup" element={<UV_HostSignUp />} />

        {/* Guest-restricted */}
        <Route
          path="/trips"
          element={
            <RequireRole allowed="guest">
              <UV_GuestTripsDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/wishlist"
          element={
            <RequireRole allowed="guest">
              <UV_GuestWishlist />
            </RequireRole>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireRole allowed="guest">
              <UV_GuestProfile />
            </RequireRole>
          }
        />
        <Route
          path="/guidebook/:bookingId"
          element={
            <RequireRole allowed="guest">
              <RequireBookingOwner>
                <UV_GuestGuidebook />
              </RequireBookingOwner>
            </RequireRole>
          }
        />
        <Route
          path="/review/:bookingId"
          element={
            <RequireRole allowed="guest">
              <UV_GuestReview />
            </RequireRole>
          }
        />

        {/* Host-restricted */}
        <Route
          path="/host/dashboard"
          element={
            <RequireRole allowed="host">
              <UV_HostDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/host/listings"
          element={
            <RequireRole allowed="host">
              <UV_HostListings />
            </RequireRole>
          }
        />
        <Route
          path="/host/listings/new"
          element={
            <RequireRole allowed="host">
              <UV_HostListingWizard />
            </RequireRole>
          }
        />
        <Route
          path="/host/listings/:villaId/edit"
          element={
            <RequireRole allowed="host">
              <UV_HostListingWizard />
            </RequireRole>
          }
        />
        <Route
          path="/host/calendar"
          element={
            <RequireRole allowed="host">
              <UV_HostCalendar />
            </RequireRole>
          }
        />
        <Route
          path="/host/inbox"
          element={
            <RequireRole allowed="host">
              <UV_HostInbox />
            </RequireRole>
          }
        />
        <Route
          path="/host/payouts"
          element={
            <RequireRole allowed="host">
              <UV_HostPayments />
            </RequireRole>
          }
        />
        <Route
          path="/host/performance"
          element={
            <RequireRole allowed="host">
              <UV_HostPerformance />
            </RequireRole>
          }
        />
        <Route
          path="/host/damage"
          element={
            <RequireRole allowed="host">
              <UV_HostSupportTicket />
            </RequireRole>
          }
        />

        {/* Admin-restricted */}
        <Route
          path="/admin/overview"
          element={
            <RequireRole allowed="admin">
              <UV_AdminDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/admin/moderate/:villaId"
          element={
            <RequireRole allowed="admin">
              <UV_AdminDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/admin/tickets"
          element={
            <RequireRole allowed="admin">
              <UV_AdminDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/admin/bookings"
          element={
            <RequireRole allowed="admin">
              <UV_AdminDashboard />
            </RequireRole>
          }
        />

        {/* 404 */}
        <Route path="*" element={<div className="p-20 text-center">Page Not Found</div>} />
      </Routes>

      {!isKiosk && showBottomBar && <GV_BottomBar />}
      {!isKiosk && <GV_Footer />}
    </QueryClientProvider>
  );
};

export default App;